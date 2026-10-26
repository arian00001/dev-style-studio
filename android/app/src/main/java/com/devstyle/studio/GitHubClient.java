package com.devstyle.studio;

import android.os.Handler;
import android.os.Looper;

import org.json.JSONArray;
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

/** GitHub REST client on HttpURLConnection. Native only, no browser engine. */
public class GitHubClient {

  public interface Callback {
    void onSuccess(String body);

    void onError(String message);
  }

  private static final ExecutorService POOL = Executors.newFixedThreadPool(4);
  private static final Handler MAIN = new Handler(Looper.getMainLooper());
  private static final String API = "https://api.github.com";

  public static void request(String token, String method, String path, String bodyJson,
                             final Callback callback) {
    final String finalBody = bodyJson;
    final String finalToken = token;
    final String finalMethod = method;
    final String finalPath = path;
    POOL.execute(() -> {
      HttpURLConnection conn = null;
      try {
        conn = (HttpURLConnection) new URL(API + finalPath).openConnection();
        conn.setRequestMethod(finalMethod);
        conn.setConnectTimeout(15000);
        conn.setReadTimeout(25000);
        conn.setRequestProperty("Accept", "application/vnd.github+json");
        conn.setRequestProperty("X-GitHub-Api-Version", "2022-11-28");
        conn.setRequestProperty("User-Agent", "DevStyleStudio-Android");
        if (finalToken != null && finalToken.length() > 0) {
          conn.setRequestProperty("Authorization", "Bearer " + finalToken);
        }
        if (finalBody != null) {
          conn.setDoOutput(true);
          conn.setRequestProperty("Content-Type", "application/json");
          OutputStream out = conn.getOutputStream();
          out.write(finalBody.getBytes("UTF-8"));
          out.close();
        }

        final int code = conn.getResponseCode();
        InputStream stream = (code >= 200 && code < 300) ? conn.getInputStream() : conn.getErrorStream();
        final String text = read(stream);

        if (code >= 200 && code < 300) {
          MAIN.post(() -> callback.onSuccess(text));
        } else {
          String message = "GitHub returned " + code;
          try {
            JSONObject err = new JSONObject(text.length() == 0 ? "{}" : text);
            if (err.has("message")) message = err.getString("message") + " (" + code + ")";
          } catch (Exception ignored) {
            // keep the generic message
          }
          final String finalMessage = message;
          MAIN.post(() -> callback.onError(finalMessage));
        }
      } catch (Exception e) {
        final String message = (e.getMessage() == null) ? e.toString() : e.getMessage();
        MAIN.post(() -> callback.onError(message));
      } finally {
        if (conn != null) conn.disconnect();
      }
    });
  }

  public static void repoList(String token, Callback cb) {
    request(token, "GET", "/user/repos?per_page=100&sort=updated&affiliation=owner,collaborator", null, cb);
  }

  /** Triggers the Android workflow of a repository and reports the run id. */
  public static void build(String token, final String owner, final String repo, final Callback cb) {
    request(token, "GET", "/repos/" + owner + "/" + repo, null, new Callback() {
      @Override
      public void onSuccess(String repoBody) {
        String branch = "main";
        try {
          branch = new JSONObject(repoBody).optString("default_branch", "main");
        } catch (Exception ignored) {
          // fall back to main
        }
        final String ref = branch;
        request(token, "GET", "/repos/" + owner + "/" + repo + "/actions/workflows", null, new Callback() {
          @Override
          public void onSuccess(String workflowsBody) {
            String workflowId = null;
            try {
              JSONArray list = new JSONObject(workflowsBody).optJSONArray("workflows");
              if (list != null && list.length() > 0) {
                for (int i = 0; i < list.length(); i++) {
                  JSONObject w = list.getJSONObject(i);
                  String path = w.optString("path", "");
                  if (path.contains("android") || path.contains("apk")) {
                    workflowId = String.valueOf(w.optLong("id"));
                    break;
                  }
                }
                if (workflowId == null) workflowId = String.valueOf(list.getJSONObject(0).optLong("id"));
              }
            } catch (Exception ignored) {
              // handled below
            }
            if (workflowId == null) {
              cb.onError("No GitHub Actions workflow found in this repository.");
              return;
            }
            request(token, "POST",
                "/repos/" + owner + "/" + repo + "/actions/workflows/" + workflowId + "/dispatches",
                "{\"ref\":\"" + ref + "\"}", new Callback() {
                  @Override
                  public void onSuccess(String ignored) {
                    cb.onSuccess("queued");
                  }

                  @Override
                  public void onError(String message) {
                    cb.onError(message);
                  }
                });
          }

          @Override
          public void onError(String message) {
            cb.onError(message);
          }
        });
      }

      @Override
      public void onError(String message) {
        cb.onError(message);
      }
    });
  }

  public static void latestRun(String token, String owner, String repo, Callback cb) {
    request(token, "GET", "/repos/" + owner + "/" + repo + "/actions/runs?per_page=1", null, cb);
  }

  public static void runJobs(String token, String owner, String repo, long runId, Callback cb) {
    request(token, "GET", "/repos/" + owner + "/" + repo + "/actions/runs/" + runId + "/jobs", null, cb);
  }

  public static void latestApk(String token, String owner, String repo, Callback cb) {
    request(token, "GET", "/repos/" + owner + "/" + repo + "/releases/latest", null, cb);
  }

  public static void editRepo(String token, String owner, String repo, String bodyJson, Callback cb) {
    request(token, "PATCH", "/repos/" + owner + "/" + repo, bodyJson, cb);
  }

  public static void deleteRepo(String token, String owner, String repo, Callback cb) {
    request(token, "DELETE", "/repos/" + owner + "/" + repo, null, cb);
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