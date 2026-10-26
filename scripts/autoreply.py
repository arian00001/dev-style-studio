#!/usr/bin/env python3
"""Cloud backup for the 24/7 email auto-reply.

Runs on a schedule in GitHub Actions, so replies keep going out even when the
phone is off: reads unread mail over IMAP, answers with the template that the
Android app published as ``mail-template.json`` (designed HTML, images included)
or, only when the template file says ``"mode": "ai"``, with a Gemini written
reply.

Secrets (repo settings -> Secrets and variables -> Actions):
  MAIL_EMAIL          your address
  MAIL_APP_PASSWORD   16 character Gmail app password
  GEMINI_API_KEY      optional, only used when the template mode is "ai"
Optional variables:
  MAIL_TEMPLATE       plain house style used when no mail-template.json exists
  MAIL_MAX_REPLIES    how many mails to answer per run (default 10)
"""
from __future__ import annotations

import email
import imaplib
import json
import os
import re
import smtplib
import ssl
import sys
import urllib.request
from email.header import decode_header, make_header
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.utils import parseaddr

DEFAULT_TEMPLATE = (
    "Hi,\n\nThanks for your email - I have received it and will reply shortly.\n\n"
    "- Sent from Dev Style Studio"
)
TEMPLATE_FILES = ("mail-template.json", "scripts/mail-template.json")
MODEL_CACHE: list = []
SKIP_SENDERS = (
    "noreply", "no-reply", "no_reply", "donotreply", "do-not-reply",
    "mailer-daemon", "postmaster", "notifications", "notification",
)


def env(*names: str, default: str = "") -> str:
    for name in names:
        value = os.environ.get(name, "").strip()
        if value:
            return value
    return default


def load_template() -> dict:
    """The template the Android app publishes into the repository root."""
    for path in TEMPLATE_FILES:
        if not os.path.exists(path):
            continue
        try:
            with open(path, encoding="utf-8") as handle:
                data = json.load(handle)
            if isinstance(data, dict):
                print(f"template loaded from {path}")
                return data
        except Exception as error:  # noqa: BLE001
            print(f"template {path} unreadable: {error}")
    return {}


ADDRESS = env("MAIL_EMAIL", "MAIL_USER", "GMAIL_USER")
PASSWORD = env("MAIL_APP_PASSWORD", "MAIL_PASS", "GMAIL_APP_PASSWORD")
GEMINI_KEY = env("GEMINI_API_KEY")
TEMPLATE_TEXT = env("MAIL_TEMPLATE", default=DEFAULT_TEMPLATE).replace("\\n", "\n")
TEMPLATE_JSON = load_template()
TEMPLATE_HTML = (TEMPLATE_JSON.get("html") or "").strip()
TEMPLATE_MODE = (TEMPLATE_JSON.get("mode") or "").strip().lower()
TEMPLATE_SUBJECT = (TEMPLATE_JSON.get("subject") or "Re: {{subject}}").strip()
IMAP_HOST = env("MAIL_IMAP_HOST", default="imap.gmail.com")
SMTP_HOST = env("MAIL_SMTP_HOST", default="smtp.gmail.com")
MAX_REPLIES = int(env("MAIL_MAX_REPLIES", default="10"))
DRY_RUN = env("MAIL_DRY_RUN") == "1"


def use_ai() -> bool:
    """A published template always wins; Gemini only runs when mode is "ai"."""
    if TEMPLATE_HTML:
        return TEMPLATE_MODE == "ai" and bool(GEMINI_KEY)
    return bool(GEMINI_KEY)


def text_of(message: email.message.Message) -> str:
    if message.is_multipart():
        for part in message.walk():
            if part.get_content_type() == "text/plain" and "attachment" not in str(
                part.get("Content-Disposition", "")
            ):
                try:
                    return part.get_payload(decode=True).decode(part.get_content_charset() or "utf-8", "replace")
                except Exception:
                    continue
        return ""
    try:
        return message.get_payload(decode=True).decode(message.get_content_charset() or "utf-8", "replace")
    except Exception:
        return ""


def candidate_models() -> list:
    """Ask the API which models this key may use, flash models first."""
    if MODEL_CACHE:
        return MODEL_CACHE
    url = f"https://generativelanguage.googleapis.com/v1beta/models?key={GEMINI_KEY}"
    try:
        with urllib.request.urlopen(url, timeout=20) as response:
            body = json.loads(response.read().decode("utf-8"))
        skip = ("image", "tts", "embedding", "aqa", "live", "audio", "gemma", "nano", "banana", "computer", "veo")
        names = [
            item["name"].split("/")[-1]
            for item in body.get("models", [])
            if "generateContent" in item.get("supportedGenerationMethods", [])
            and not any(word in item["name"] for word in skip)
        ]

        def rank(name: str):
            version = re.search(r"gemini-(\d+(?:\.\d+)?)", name)
            return (0 if "flash" in name else 1, -float(version.group(1)) if version else 0.0, len(name))

        names.sort(key=rank)
        MODEL_CACHE.extend(names[:5])
        print(f"using models: {', '.join(MODEL_CACHE) or 'none'}")
    except Exception as error:  # noqa: BLE001
        print(f"model discovery failed: {error}")
    return MODEL_CACHE


def gemini(prompt: str) -> str:
    """Best effort: ask Gemini for a short reply, fall back to the template."""
    if not GEMINI_KEY:
        return ""
    payload = {"contents": [{"role": "user", "parts": [{"text": prompt}]}]}
    data = json.dumps(payload).encode("utf-8")
    for model in candidate_models():
        url = (
            "https://generativelanguage.googleapis.com/v1beta/models/"
            f"{model}:generateContent?key={GEMINI_KEY}"
        )
        request = urllib.request.Request(
            url, data=data, headers={"Content-Type": "application/json"}, method="POST"
        )
        try:
            with urllib.request.urlopen(request, timeout=30) as response:
                body = json.loads(response.read().decode("utf-8"))
            parts = body["candidates"][0]["content"]["parts"]
            text = "".join(part.get("text", "") for part in parts).strip()
            if text:
                return text
        except Exception as error:  # noqa: BLE001 - any model error falls through
            print(f"gemini {model} failed: {error}")
    return ""


def automated(sender: str, message: email.message.Message) -> bool:
    """Newsletters, no-reply addresses and bulk mail get no answer."""
    local = sender.split("@")[0].lower()
    if any(token in local for token in SKIP_SENDERS):
        return True
    if message.get("List-Unsubscribe") or (message.get("Precedence") or "").lower() in ("bulk", "list", "junk"):
        return True
    return False


def fill(text: str, sender: str, subject: str) -> str:
    return (text or "").replace("{{from}}", sender).replace("{{subject}}", subject)


def plain_from_template(sender: str, subject: str, main_text: str = "") -> str:
    heading = fill(TEMPLATE_JSON.get("heading", ""), sender, subject).strip()
    body = (main_text or fill(TEMPLATE_JSON.get("body", ""), sender, subject)).strip()
    signature = fill(TEMPLATE_JSON.get("signature", ""), sender, subject).strip()
    parts = [part for part in (heading, body, signature) if part]
    if parts:
        return "\n\n".join(parts)
    return fill(TEMPLATE_TEXT, sender, subject)


def reply_subject(subject: str) -> str:
    value = fill(TEMPLATE_SUBJECT, "", subject).strip() or subject
    return value if value.lower().startswith("re:") else f"Re: {value}"


def compose(sender: str, subject: str, body: str) -> dict:
    """Returns the reply to send: mode, subject, plain text and HTML."""
    if use_ai():
        prompt = (
            "Write a short, friendly reply email (max 90 words, no subject line) to this "
            f"message. Reply body:\n{body[:2000]}\n\nUse this house style as guidance:\n"
            f"{fill(TEMPLATE_TEXT, sender, subject)}"
        )
        written = gemini(prompt)
        if written:
            if TEMPLATE_HTML:
                return {
                    "mode": "ai",
                    "subject": reply_subject(subject),
                    "plain": plain_from_template(sender, subject, written),
                    "html": wrap_ai_reply(written, sender, subject),
                }
            return {
                "mode": "ai",
                "subject": reply_subject(subject),
                "plain": written,
                "html": "",
            }

    if TEMPLATE_HTML:
        return {
            "mode": "template",
            "subject": reply_subject(subject),
            "plain": plain_from_template(sender, subject),
            "html": fill(TEMPLATE_HTML, sender, subject),
        }

    return {
        "mode": "template",
        "subject": reply_subject(subject),
        "plain": fill(TEMPLATE_TEXT, sender, subject),
        "html": "",
    }


CLICKABLE = re.compile(
    r"((?:https?://|www\.)[^\s<]+)"
    r"|([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})"
    r"|(\+?\d[\d\s().-]{7,}\d)"
)
LINK_STYLE = "color:#166534;font-weight:600;text-decoration:none;"


def whatsapp_number(label: str) -> str:
    digits = re.sub(r"\D", "", label)
    if digits.startswith("00"):
        digits = digits[2:]
    elif digits.startswith("0"):
        digits = "880" + digits[1:]
    return digits


def linkify(text: str) -> str:
    """Escaped HTML where links, addresses and numbers are tappable (numbers open WhatsApp)."""
    import html as htmllib

    escaped = htmllib.escape(text or "")
    out: list = []
    last = 0
    for match in CLICKABLE.finditer(escaped):
        label, end = match.group(), match.end()
        url, mail, phone = match.group(1), match.group(2), match.group(3)
        if url:
            trimmed = url.rstrip(".,;:!?)'\"")
            end = match.start() + len(trimmed)
            label = trimmed
            href = trimmed if trimmed.startswith("http") else f"https://{trimmed}"
        elif mail:
            href = f"mailto:{label}"
        elif phone:
            digits = whatsapp_number(label)
            if len(digits) < 9:
                continue
            href = f"https://wa.me/{digits}"
        else:
            continue
        out.append(escaped[last:match.start()])
        out.append(f'<a href="{href}" target="_blank" style="{LINK_STYLE}">{label}</a>')
        last = end
    out.append(escaped[last:])
    return "".join(out)


def wrap_ai_reply(written: str, sender: str, subject: str) -> str:
    """Drop the model's words into the designed card the app published."""
    paragraphs = "".join(
        f'<p style="margin:0 0 14px;">{linkify(block.strip()).replace(chr(10), "<br/>")}</p>'
        for block in written.split("\n\n")
        if block.strip()
    )
    filled = fill(TEMPLATE_HTML, sender, subject)
    body_marker = fill(TEMPLATE_JSON.get("body", ""), sender, subject).strip()
    first = body_marker.split("\n")[0] if body_marker else ""
    if first and first in filled:
        return filled.replace(first, paragraphs, 1)
    return filled


def send(to: str, subject: str, plain: str, html: str = "") -> None:
    if html:
        message = MIMEMultipart("alternative")
        message.attach(MIMEText(plain, "plain", "utf-8"))
        message.attach(MIMEText(html, "html", "utf-8"))
    else:
        message = MIMEText(plain, "plain", "utf-8")
    message["From"] = ADDRESS
    message["To"] = to
    message["Subject"] = subject
    context = ssl.create_default_context()
    with smtplib.SMTP_SSL(SMTP_HOST, 465, context=context, timeout=30) as smtp:
        smtp.login(ADDRESS, PASSWORD)
        smtp.send_message(message)


def main() -> int:
    if not ADDRESS or not PASSWORD:
        print("MAIL_EMAIL and MAIL_APP_PASSWORD secrets are missing.")
        return 1

    print(f"reply mode: {'ai (Gemini)' if use_ai() else 'template only'}")
    box = imaplib.IMAP4_SSL(IMAP_HOST, 993)
    try:
        box.login(ADDRESS, PASSWORD)
        box.select("INBOX")
        status, data = box.search(None, "UNSEEN")
        if status != "OK" or not data or not data[0]:
            print("Nothing unread.")
            return 0

        pending = list(reversed(data[0].split()))
        print(f"{len(pending)} unread message(s) found.")
        answered = 0

        for uid in pending:
            if answered >= MAX_REPLIES:
                break
            status, fetched = box.fetch(uid, "(BODY.PEEK[])")
            if status != "OK" or not fetched or not isinstance(fetched[0], tuple):
                continue
            message = email.message_from_bytes(fetched[0][1])
            sender = parseaddr(message.get("From", ""))[1]
            if not sender or sender.lower() == ADDRESS.lower():
                box.store(uid, "+FLAGS", "(\\Seen)")
                continue

            if automated(sender, message):
                print(f"Skipped automated sender: {sender}")
                continue

            raw_subject = message.get("Subject") or "(no subject)"
            subject = str(make_header(decode_header(raw_subject)))
            body = text_of(message)
            reply = compose(sender, subject, body)

            if DRY_RUN:
                print(f"[dry run] would reply to {sender} with {reply['mode']}: {subject}")
            else:
                send(sender, reply["subject"], reply["plain"], reply["html"])
                print(f"Replied ({reply['mode']}) to {sender}: {subject}")
            box.store(uid, "+FLAGS", "(\\Seen)")
            answered += 1

        print(f"Done - {answered} repl{'y' if answered == 1 else 'ies'} sent.")
        return 0
    finally:
        try:
            box.logout()
        except Exception:
            pass


if __name__ == "__main__":
    sys.exit(main())