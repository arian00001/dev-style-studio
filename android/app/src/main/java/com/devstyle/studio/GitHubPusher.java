package com.devstyle.studio;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.List;

/** Creates a repository and commits a whole file tree in a handful of calls. */
public class GitHubPusher {

  public interface Step {
    void step(String message);
  }

  public static class Result {
    public String owner;
    public String repo;
    public String branch;
    public long repoId;
  }

  private static final String API = "https://api.github.com";

  public static Result push(String token, String name, boolean isPrivate,
                            List<ZipReader.Entry> files, Step step) throws Exception {
    if (token == null || token.trim().length() == 0) {
      throw new Exception("Add your GitHub token in Settings first.");
    }
    Result result = new Result();
    JSONObject user = new JSONObject(call(token, "GET", "/user", null));
    result.owner = user.optString("login", "");
    if (result.owner.length() == 0) throw new Exception("That GitHub token has no account.");

    step.step("Creating " + result.owner + "/" + name + "…");
    JSONObject repo;
    try {
      JSONObject body = new JSONObject();
      body.put("name", name);
      body.put("private", isPrivate);
      body.put("auto_init", false);
      repo = new JSONObject(call(token, "POST", "/user/repos", body.toString()));
    } catch (Exception exists) {
      repo = new JSONObject(call(token, "GET", "/repos/" + result.owner + "/" + name, null));
    }
    result.repo = repo.optString("name", name);
    result.repoId = repo.optLong("id");
    result.branch = repo.optString("default_branch", "main");
    if (result.branch.length() == 0) result.branch = "main";

    String base = "/repos/" + result.owner + "/" + result.repo;
    String parentSha = null;
    String baseTree = null;
    try {
      JSONObject ref = new JSONObject(call(token, "GET", base + "/git/ref/heads/" + result.branch, null));
      JSONObject object = ref.optJSONObject("object");
      parentSha = object == null ? null : object.optString("sha", "");
      if (parentSha != null && parentSha.length() > 0) {
        JSONObject parent = new JSONObject(call(token, "GET", base + "/git/commits/" + parentSha, null));
        JSONObject tree = parent.optJSONObject("tree");
        baseTree = tree == null ? null : tree.optString("sha", "");
      }
    } catch (Exception empty) {
      parentSha = null;
      baseTree = null;
    }

    JSONArray tree = new JSONArray();
    for (int i = 0; i < files.size(); i++) {
      ZipReader.Entry file = files.get(i);
      JSONObject node = new JSONObject();
      node.put("path", file.path);
      node.put("mode", "100644");
      node.put("type", "blob");
      if (file.binary()) {
        JSONObject blobBody = new JSONObject();
        blobBody.put("content", file.base64);
        blobBody.put("encoding", "base64");
        JSONObject blob = new JSONObject(call(token, "POST", base + "/git/blobs", blobBody.toString()));
        node.put("sha", blob.optString("sha", ""));
      } else {
        node.put("content", file.text == null ? "" : file.text);
      }
      tree.put(node);
      if (i % 5 == 0 || i == files.size() - 1) {
        step.step("Uploading files… " + (i + 1) + "/" + files.size());
      }
    }

    JSONObject treeBody = new JSONObject();
    treeBody.put("tree", tree);
    if (baseTree != null && baseTree.length() > 0) treeBody.put("base_tree", baseTree);
    JSONObject created = new JSONObject(call(token, "POST", base + "/git/trees", treeBody.toString()));
    String treeSha = created.optString("sha", "");

    JSONObject commitBody = new JSONObject();
    commitBody.put("message", "Upload " + files.size() + " files from Dev Style Studio");
    commitBody.put("tree", treeSha);
    JSONArray parents = new JSONArray();
    if (parentSha != null && parentSha.length() > 0) parents.put(parentSha);
    commitBody.put("parents", parents);
    JSONObject commit = new JSONObject(call(token, "POST", base + "/git/commits", commitBody.toString()));
    String commitSha = commit.optString("sha", "");

    step.step("Saving the branch…");
    if (parentSha != null && parentSha.length() > 0) {
      JSONObject refBody = new JSONObject();
      refBody.put("sha", commitSha);
      refBody.put("force", true);
      call(token, "PATCH", base + "/git/refs/heads/" + result.branch, refBody.toString());
    } else {
      JSONObject refBody = new JSONObject();
      refBody.put("ref", "refs/heads/" + result.branch);
      refBody.put("sha", commitSha);
      call(token, "POST", base + "/git/refs", refBody.toString());
    }
    return result;
  }

  /** Writes one file (the reply template) into an existing repository. */
  public static void putFile(String token, String owner, String repo, String path,
                             String content, String message) throws Exception {
    if (token == null || token.trim().length() == 0) {
      throw new Exception("Add your GitHub token in Settings first.");
    }
    String base = "/repos/" + owner + "/" + repo;
    String branch;
    try {
      branch = new JSONObject(call(token, "GET", base, null)).optString("default_branch", "main");
    } catch (Exception e) {
      throw new Exception("GitHub could not find " + owner + "/" + repo + ".");
    }
    if (branch == null || branch.length() == 0) branch = "main";

    String sha = null;
    try {
      JSONObject existing = new JSONObject(call(token, "GET", base + "/contents/" + path, null));
      sha = existing.optString("sha", "");
      if (sha.length() == 0) sha = null;
    } catch (Exception missing) {
      sha = null;
    }

    JSONObject body = new JSONObject();
    body.put("message", message);
    body.put("content", android.util.Base64.encodeToString(
        content.getBytes("UTF-8"), android.util.Base64.NO_WRAP));
    body.put("branch", branch);
    if (sha != null) body.put("sha", sha);
    call(token, "PUT", base + "/contents/" + path, body.toString());
  }

  private static String call(String token, String method, String path, String body) throws Exception {
    HttpURLConnection conn = null;
    try {
      conn = (HttpURLConnection) new URL(API + path).openConnection();
      conn.setRequestMethod(method);
      conn.setConnectTimeout(20000);
      conn.setReadTimeout(60000);
      conn.setRequestProperty("Accept", "application/vnd.github+json");
      conn.setRequestProperty("X-GitHub-Api-Version", "2022-11-28");
      conn.setRequestProperty("User-Agent", "DevStyleStudio-Android");
      conn.setRequestProperty("Authorization", "Bearer " + token.trim());
      if (body != null) {
        conn.setDoOutput(true);
        conn.setRequestProperty("Content-Type", "application/json");
        OutputStream out = conn.getOutputStream();
        out.write(body.getBytes("UTF-8"));
        out.close();
      }
      int code = conn.getResponseCode();
      InputStream stream = (code >= 200 && code < 300) ? conn.getInputStream() : conn.getErrorStream();
      String text = read(stream);
      if (code < 200 || code >= 300) {
        String message = "GitHub returned " + code;
        try {
          JSONObject err = new JSONObject(text.length() == 0 ? "{}" : text);
          if (err.has("message")) message = err.getString("message") + " (" + code + ")";
        } catch (Exception ignored) {
          // keep the generic message
        }
        throw new Exception(message);
      }
      return text.length() == 0 ? "{}" : text;
    } finally {
      if (conn != null) conn.disconnect();
    }
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