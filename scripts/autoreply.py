#!/usr/bin/env python3
"""Cloud backup for the 24/7 email auto-reply.

Runs on a schedule in GitHub Actions, so replies keep going out even when the
phone is off: reads unread mail over IMAP, composes an answer from the house
template (optionally polished by Gemini) and sends it over SMTP.

Secrets (repo settings -> Secrets and variables -> Actions):
  MAIL_EMAIL          your address
  MAIL_APP_PASSWORD   16 character Gmail app password
  GEMINI_API_KEY      optional, makes the replies written by the model
Optional variables:
  MAIL_TEMPLATE       house style, use \\n for line breaks
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
from email.mime.text import MIMEText
from email.utils import parseaddr

DEFAULT_TEMPLATE = (
    "Hi,\n\nThanks for your email - I have received it and will reply shortly.\n\n"
    "- Sent from Dev Style Studio"
)
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


ADDRESS = env("MAIL_EMAIL", "MAIL_USER", "GMAIL_USER")
PASSWORD = env("MAIL_APP_PASSWORD", "MAIL_PASS", "GMAIL_APP_PASSWORD")
GEMINI_KEY = env("GEMINI_API_KEY")
TEMPLATE = env("MAIL_TEMPLATE", default=DEFAULT_TEMPLATE).replace("\\n", "\n")
IMAP_HOST = env("MAIL_IMAP_HOST", default="imap.gmail.com")
SMTP_HOST = env("MAIL_SMTP_HOST", default="smtp.gmail.com")
MAX_REPLIES = int(env("MAIL_MAX_REPLIES", default="10"))
DRY_RUN = env("MAIL_DRY_RUN") == "1"


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


def compose(sender: str, subject: str, body: str) -> str:
    template = TEMPLATE.replace("{{from}}", sender).replace("{{subject}}", subject)
    if not GEMINI_KEY:
        return template
    prompt = (
        "Write a short, friendly reply email (max 90 words, no subject line) to this "
        f"message. Reply body:\n{body[:2000]}\n\nUse this house style as guidance:\n{template}"
    )
    return gemini(prompt) or template


def send(to: str, subject: str, body: str) -> None:
    message = MIMEText(body, "plain", "utf-8")
    message["From"] = ADDRESS
    message["To"] = to
    message["Subject"] = subject if subject.lower().startswith("re:") else f"Re: {subject}"
    context = ssl.create_default_context()
    with smtplib.SMTP_SSL(SMTP_HOST, 465, context=context, timeout=30) as smtp:
        smtp.login(ADDRESS, PASSWORD)
        smtp.send_message(message)


def main() -> int:
    if not ADDRESS or not PASSWORD:
        print("MAIL_EMAIL and MAIL_APP_PASSWORD secrets are missing.")
        return 1

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
                print(f"[dry run] would reply to {sender}: {subject}")
            else:
                send(sender, subject, reply)
                print(f"Replied to {sender}: {subject}")
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