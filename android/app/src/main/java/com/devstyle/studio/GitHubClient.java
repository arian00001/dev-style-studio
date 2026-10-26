package com.devstyle.studio;

import android.os.Handler;
import android.os.Looper;

import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/** Tiny GitHub REST client built on HttpURLConnection and org.json. No WebView. */
public class GitHubClient {

  public interface Callback {
    void onSuccess(String body);

    void onError(String message);
  }

  private static final ExecutorService POOL = Executors.newFixedThreadPool(3);
  private static final Handler MAIN = new Handler(Looper.getMainLooper());
  private static final String API = "https://api.github.com";

  public static void request(final String token, final String method, final String path,
                             final String bodyJson, final Callback callback) {
    POOL.execute(new Runnable() {
      @Override
      public void run() {
        HttpURLConnection conn = null;
        try {
          conn = (HttpURLConnection) new URL(API + path).openConnection();
          conn.setRequestMethod(method);
          conn.setConnectTimeout(15000);
          conn.setReadTimeout(20000);
          conn.setRequestProperty("Accept", "application/vnd.github+json");
          conn.setRequestProperty("X-GitHub-Api-Version", "2022-11-28");
          conn.setRequestProperty("User-Agent", "DevStyleStudio-Android");
          if (token != null && token.length() > 0) {
            conn.setRequestProperty("Authorization", "Bearer " + token);
          }
          if (bodyJson != null) {
            conn.setDoOutput(true);
            conn.setRequestProperty("Content-Type", "application/json");
            OutputStream out = conn.getOutputStream();
            out.write(bodyJson.getBytes("UTF-8"));
            out.close();
          }

          final int code = conn.getResponseCode();
          InputStream stream = (code >= 200 && code < 300) ? conn.getInputStream() : conn.getErrorStream();
          final String text = read(stream);

          if (code >= 200 && code < 300) {
            MAIN.post(new Runnable() {
              @Override
              public void run() {
                callback.onSuccess(text);
              }
            });
          } else {
            String message = "GitHub returned " + code;
            try {
              JSONObject err = new JSONObject(text.length() == 0 ? "{}" : text);
              if (err.has("message")) message = err.getString("message") + " (" + code + ")";
            } catch (Exception ignored) {
              // keep the generic message
            }
            final String finalMessage = message;
            MAIN.post(new Runnable() {
              @Override
              public void run() {
                callback.onError(finalMessage);
              }
            });
          }
        } catch (Exception e) {
          final String message = (e.getMessage() == null) ? e.toString() : e.getMessage();
          MAIN.post(new Runnable() {
            @Override
            public void run() {
              callback.onError(message);
            }
          });
        } finally {
          if (conn != null) conn.disconnect();
        }
      }
    });
  }

  private static String read(InputStream in) throws IOException {
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
