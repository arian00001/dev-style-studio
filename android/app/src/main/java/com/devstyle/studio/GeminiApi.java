package com.devstyle.studio;

import android.os.Handler;
import android.os.Looper;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/** Gemini text generation used by the chat screen and the auto-reply / auto-fix logic. */
public class GeminiApi {

  public interface Callback {
    void onSuccess(String text);

    void onError(String message);
  }

  private static final ExecutorService POOL = Executors.newSingleThreadExecutor();
  private static final Handler MAIN = new Handler(Looper.getMainLooper());
  private static final String[] MODELS = {"gemini-2.0-flash", "gemini-2.5-flash", "gemini-flash-latest"};

  public static void ask(final String key, final String prompt, final Callback cb) {
    if (key == null || key.trim().length() == 0) {
      cb.onError("Add your Gemini API key in Settings first.");
      return;
    }
    POOL.execute(() -> {
      String lastError = "Gemini did not answer.";
      for (String model : MODELS) {
        try {
          String text = callModel(key.trim(), model, prompt);
          if (text != null) {
            final String finalText = text;
            MAIN.post(() -> cb.onSuccess(finalText));
            return;
          }
        } catch (Exception e) {
          lastError = (e.getMessage() == null) ? e.toString() : e.getMessage();
        }
      }
      final String finalError = lastError;
      MAIN.post(() -> cb.onError(finalError));
    });
  }

  private static String callModel(String key, String model, String prompt) throws Exception {
    String url = "https://generativelanguage.googleapis.com/v1beta/models/" + model
        + ":generateContent?key=" + key;
    JSONObject body = new JSONObject();
    JSONArray contents = new JSONArray();
    JSONObject turn = new JSONObject();
    turn.put("role", "user");
    JSONArray parts = new JSONArray();
    parts.put(new JSONObject().put("text", prompt));
    turn.put("parts", parts);
    contents.put(turn);
    body.put("contents", contents);

    HttpURLConnection conn = (HttpURLConnection) new URL(url).openConnection();
    conn.setRequestMethod("POST");
    conn.setConnectTimeout(20000);
    conn.setReadTimeout(45000);
    conn.setRequestProperty("Content-Type", "application/json");
    conn.setDoOutput(true);
    OutputStream out = conn.getOutputStream();
    out.write(body.toString().getBytes("UTF-8"));
    out.close();

    int code = conn.getResponseCode();
    InputStream stream = (code >= 200 && code < 300) ? conn.getInputStream() : conn.getErrorStream();
    String text = read(stream);
    conn.disconnect();

    if (code < 200 || code >= 300) {
      String message = "Gemini returned " + code;
      try {
        JSONObject err = new JSONObject(text);
        if (err.has("error")) message = err.getJSONObject("error").optString("message", message);
      } catch (Exception ignored) {
        // keep generic
      }
      if (code == 404) return null;
      throw new Exception(message);
    }

    JSONObject json = new JSONObject(text);
    JSONArray candidates = json.optJSONArray("candidates");
    if (candidates == null || candidates.length() == 0) return "I could not produce an answer.";
    JSONObject content = candidates.getJSONObject(0).optJSONObject("content");
    if (content == null) return "I could not produce an answer.";
    JSONArray replyParts = content.optJSONArray("parts");
    if (replyParts == null || replyParts.length() == 0) return "I could not produce an answer.";
    return replyParts.getJSONObject(0).optString("text", "").trim();
  }

  private static String read(InputStream in) throws Exception {
    if (in == null) return "";
    BufferedReader reader = new BufferedReader(new InputStreamReader(in, "UTF-8"));
    StringBuilder sb = new StringBuilder();
    String line;
    while ((line = reader.readLine()) != null) {
      sb.append(line).append('\n');
    }
    reader.close();
    return sb.toString();
  }
}