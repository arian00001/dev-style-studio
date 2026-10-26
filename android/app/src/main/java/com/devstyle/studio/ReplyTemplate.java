package com.devstyle.studio;

import org.json.JSONObject;

import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;
import java.util.TimeZone;

/** The house reply: a few editable fields folded into a designed HTML email. */
public class ReplyTemplate {

  public static final String MODE_TEMPLATE = "template";
  public static final String MODE_AI = "ai";

  public static final String DEFAULT_BODY =
      "Thanks for your message — I have received it and will get back to you personally very soon.\n\n"
          + "If it is urgent, just reply to this email and I will pick it up right away.";

  public String mode = MODE_TEMPLATE;
  public String subject = "Re: {{subject}}";
  public String heading = "Thanks for reaching out";
  public String body = DEFAULT_BODY;
  public String signature = "— Dev Style Studio";
  public String imageUrl = "";
  public String imagePosition = "top";

  public static ReplyTemplate load(Prefs prefs) {
    ReplyTemplate template = new ReplyTemplate();
    template.mode = MODE_AI.equals(prefs.get("replyMode")) ? MODE_AI : MODE_TEMPLATE;
    template.subject = pick(prefs.get("tplSubject"), template.subject);
    template.heading = pick(prefs.get("tplHeading"), template.heading);
    String savedBody = prefs.get("tplBody");
    if (savedBody.trim().length() == 0) savedBody = prefs.template();
    template.body = pick(savedBody, template.body);
    template.signature = pick(prefs.get("tplSign"), template.signature);
    template.imageUrl = prefs.get("tplImage");
    template.imagePosition = pick(prefs.get("tplImagePos"), "top");
    return template;
  }

  public void save(Prefs prefs) {
    prefs.put("replyMode", mode);
    prefs.put("tplSubject", subject);
    prefs.put("tplHeading", heading);
    prefs.put("tplBody", body);
    // Kept for the older Gemini "house style" prompt.
    prefs.put("template", body);
    prefs.put("tplSign", signature);
    prefs.put("tplImage", imageUrl);
    prefs.put("tplImagePos", imagePosition);
  }

  private static String pick(String value, String fallback) {
    return value == null || value.trim().length() == 0 ? fallback : value;
  }

  /** Template mode never calls Gemini, even when a key is saved. */
  public boolean aiEnabled(Prefs prefs) {
    return MODE_AI.equals(mode) && prefs.gemini().trim().length() > 0;
  }

  private String fill(String text, String from, String subjectLine) {
    if (text == null) return "";
    return text.replace("{{from}}", from == null ? "" : from)
        .replace("{{subject}}", subjectLine == null ? "" : subjectLine);
  }

  public String replySubject(String subjectLine) {
    String value = fill(subject, "", subjectLine).trim();
    if (value.length() == 0) value = subjectLine;
    return value.toLowerCase().startsWith("re:") ? value : "Re: " + value;
  }

  public String plainText(String from, String subjectLine) {
    return plainText(from, subjectLine, null);
  }

  /** mainText is an AI written reply; null means "send the saved template body". */
  public String plainText(String from, String subjectLine, String mainText) {
    String headingText = fill(heading, from, subjectLine).trim();
    String bodyText = mainText != null && mainText.trim().length() > 0
        ? mainText.trim() : fill(body, from, subjectLine).trim();
    String signText = fill(signature, from, subjectLine).trim();
    StringBuilder sb = new StringBuilder();
    if (headingText.length() > 0) sb.append(headingText).append("\n\n");
    sb.append(bodyText);
    if (signText.length() > 0) sb.append("\n\n").append(signText);
    return sb.toString();
  }

  public String html(String from, String subjectLine) {
    return html(from, subjectLine, null);
  }

  public String html(String from, String subjectLine, String mainText) {
    String headingText = fill(heading, from, subjectLine).trim();
    String bodyText = mainText != null && mainText.trim().length() > 0
        ? mainText.trim() : fill(body, from, subjectLine);
    return build(headingText, paragraphs(bodyText), escape(fill(signature, from, subjectLine).trim()));
  }

  /** HTML with the {{from}} / {{subject}} placeholders left in for GitHub Actions. */
  public String rawHtml() {
    return build(heading, paragraphs(body), escape(signature));
  }

  /** The file the cloud cron reads, so a template set here also replies from GitHub. */
  public JSONObject toJson() {
    JSONObject json = new JSONObject();
    try {
      json.put("mode", mode);
      json.put("subject", subject);
      json.put("heading", heading);
      json.put("body", body);
      json.put("signature", signature);
      json.put("image_url", imageUrl);
      json.put("image_position", imagePosition);
      json.put("html", rawHtml());
      SimpleDateFormat format = new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'", Locale.US);
      format.setTimeZone(TimeZone.getTimeZone("UTC"));
      json.put("updated_at", format.format(new Date()));
    } catch (Exception ignored) {
      // every field is a plain string, so nothing can realistically fail here
    }
    return json;
  }

  private boolean hasImage() {
    return imageUrl != null && imageUrl.trim().length() > 0;
  }

  private String image() {
    return "<img src=\"" + imageUrl.trim() + "\" alt=\"\" "
        + "style=\"display:block;width:100%;height:auto;border:0;\" />";
  }

  private String build(String headingText, String bodyHtml, String signatureHtml) {
    StringBuilder sb = new StringBuilder();
    sb.append("<div style=\"margin:0;padding:22px;background:#f4f6f1;")
        .append("font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#101314;\">");
    sb.append("<div style=\"max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e4e8de;")
        .append("border-radius:18px;overflow:hidden;\">");
    if (hasImage() && "top".equals(imagePosition)) sb.append(image());
    sb.append("<div style=\"padding:26px 26px 30px;\">");
    sb.append("<span style=\"display:inline-block;background:#e9ffb5;color:#22400a;font-size:11px;")
        .append("font-weight:700;letter-spacing:1.2px;text-transform:uppercase;padding:6px 11px;")
        .append("border-radius:999px;\">Auto reply</span>");
    if (headingText.length() > 0) {
      sb.append("<div style=\"margin:16px 0 12px;font-size:21px;font-weight:700;line-height:1.3;\">")
          .append(escape(headingText)).append("</div>");
    }
    sb.append("<div style=\"font-size:14px;line-height:1.7;color:#4b5350;\">").append(bodyHtml);
    if (hasImage() && "middle".equals(imagePosition)) sb.append(image());
    sb.append("</div>");
    if (signatureHtml.length() > 0) {
      sb.append("<div style=\"margin-top:22px;padding-top:16px;border-top:1px solid #ecefe6;")
          .append("font-size:13px;font-weight:600;color:#22400a;\">").append(signatureHtml).append("</div>");
    }
    sb.append("</div>");
    if (hasImage() && "bottom".equals(imagePosition)) sb.append(image());
    sb.append("</div>");
    sb.append("<div style=\"max-width:560px;margin:12px auto 0;text-align:center;font-size:11px;")
        .append("color:#9aa19c;\">Sent automatically by Dev Style Studio</div>");
    sb.append("</div>");
    return sb.toString();
  }

  private String paragraphs(String text) {
    if (text == null) return "";
    StringBuilder sb = new StringBuilder();
    String[] blocks = text.trim().split("\\n\\s*\\n");
    for (String block : blocks) {
      String clean = block.trim();
      if (clean.length() == 0) continue;
      sb.append("<p style=\"margin:0 0 14px;\">")
          .append(escape(clean).replace("\n", "<br/>"))
          .append("</p>");
    }
    return sb.toString();
  }

  private String escape(String text) {
    if (text == null) return "";
    return text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;");
  }
}