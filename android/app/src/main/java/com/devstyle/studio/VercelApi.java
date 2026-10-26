package com.devstyle.studio;

import android.os.Handler;
import android.os.Looper;

import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/** Minimal Vercel REST client: verify the token, deploy a GitHub repo, read status. */
public class VercelApi {

  public interface Callback {
    void onSuccess(String body);

    void onError(String message);
  }

  private static final ExecutorService POOL = Executors.newFixedThreadPool(2);
  private static final Handler MAIN = new Handler(Looper.getMainLooper());
  private static final String API = "https://api.vercel.com";

  public static void call(String token, String method, String path, String bodyJson, Callback cb) {
    final String finalToken = token;
    final String finalMethod = method;
    final String finalPath = path;
    final String finalBody = bodyJson;
    POOL.execute(() -> {
      HttpURLConnection conn = null;
      try {
        conn = (HttpURLConnection) new URL(API + finalPath).openConnection();
        conn.setRequestMethod(finalMethod);
        conn.setConnectTimeout(15000);
        conn.setReadTimeout(25000);
        conn.setRequestProperty("Authorization", "Bearer " + finalToken);
        conn.setRequestProperty("Content-Type", "application/json");
        if (finalBody != null) {
          conn.setDoOutput(true);
          OutputStream out = conn.getOutputStream();
          out.write(finalBody.getBytes("UTF-8"));
          out.close();
        }
        int code = conn.getResponseCode();
        InputStream stream = (code >= 200 && code < 300) ? conn.getInputStream() : conn.getErrorStream();
        String text = read(stream);
        if (code >= 200 && code < 300) {
          MAIN.post(() -> cb.onSuccess(text));
        } else {
          String message = "Vercel returned " + code;
          try {
            org.json.JSONObject err = new org.json.JSONObject(text);
            if (err.has("error")) message = err.getJSONObject("error").optString("message", message);
          } catch (Exception ignored) {
            // keep generic
          }
          final String finalMessage = message;
          MAIN.post(() -> cb.onError(finalMessage));
        }
      } catch (Exception e) {
        final String message = (e.getMessage() == null) ? e.toString() : e.getMessage();
        MAIN.post(() -> cb.onError(message));
      } finally {
        if (conn != null) conn.disconnect();
      }
    });
  }

  public static void verify(String token, Callback cb) {
    call(token, "GET", "/v2/user", null, cb);
  }

  public static void deploy(String token, String name, long repoId, String ref, Callback cb) {
    String body = "{\"name\":\"" + name + "\",\"target\":\"production\",\"gitSource\":{\"type\":\"github\","
        + "\"repoId\":" + repoId + ",\"ref\":\"" + ref + "\"}}";
    call(token, "POST", "/v13/deployments?forceNew=1", body, cb);
  }

  public static void deployment(String token, String id, Callback cb) {
    call(token, "GET", "/v13/deployments/" + id, null, cb);
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