package com.devstyle.studio;

import android.content.Context;
import android.net.Uri;
import android.os.Handler;
import android.os.Looper;

/** Reads the zip, creates the repo and pushes every file — all off the main thread. */
public class ZipUploader {

  public interface Listener {
    void onStep(String message);

    void onDone(GitHubPusher.Result result);

    void onFailed(String message);
  }

  private static final Handler MAIN = new Handler(Looper.getMainLooper());

  public static void start(final Context context, final String token, final Uri uri,
                           final String name, final boolean isPrivate, final Listener listener) {
    final Context app = context.getApplicationContext();
    new Thread(() -> {
      try {
        MAIN.post(() -> listener.onStep("Reading the zip…"));
        ZipReader.Result zip = ZipReader.read(app, uri);
        MAIN.post(() -> listener.onStep(
            zip.files.size() + " files found · pushing to GitHub…"));
        GitHubPusher.Result result = GitHubPusher.push(token, name, isPrivate, zip.files,
            message -> MAIN.post(() -> listener.onStep(message)));
        MAIN.post(() -> listener.onDone(result));
      } catch (Exception e) {
        String message = e.getMessage() == null ? e.toString() : e.getMessage();
        MAIN.post(() -> listener.onFailed(message));
      }
    }).start();
  }
}