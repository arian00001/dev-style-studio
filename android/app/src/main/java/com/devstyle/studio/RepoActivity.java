package com.devstyle.studio;

import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import android.os.Bundle;
import android.view.View;
import android.widget.ProgressBar;
import android.widget.TextView;

import androidx.appcompat.app.AppCompatActivity;

import org.json.JSONArray;
import org.json.JSONObject;

/** Native repository screen: trigger the APK workflow and fetch the latest build. */
public class RepoActivity extends AppCompatActivity {

  private String owner;
  private String repo;
  private String branch;
  private String token;

  private TextView statusText;
  private TextView runText;
  private ProgressBar progress;
  private TextView buildButton;

  @Override
  protected void onCreate(Bundle state) {
    super.onCreate(state);
    setContentView(R.layout.activity_repo);

    owner = getIntent().getStringExtra("owner");
    repo = getIntent().getStringExtra("repo");
    branch = getIntent().getStringExtra("branch");
    if (owner == null) owner = "";
    if (repo == null) repo = "";
    if (branch == null || branch.length() == 0) branch = "main";

    SharedPreferences prefs = getSharedPreferences("studio", MODE_PRIVATE);
    token = prefs.getString("token", "");
    if (token == null) token = "";

    TextView title = (TextView) findViewById(R.id.repoTitle);
    TextView subtitle = (TextView) findViewById(R.id.repoSubtitle);
    statusText = (TextView) findViewById(R.id.repoStatus);
    runText = (TextView) findViewById(R.id.runStatus);
    progress = (ProgressBar) findViewById(R.id.repoProgress);
    buildButton = (TextView) findViewById(R.id.buildButton);

    title.setText(repo);
    subtitle.setText(owner + "  ·  " + branch);

    buildButton.setOnClickListener(new View.OnClickListener() {
      @Override
      public void onClick(View v) {
        triggerBuild();
      }
    });
    findViewById(R.id.refreshButton).setOnClickListener(new View.OnClickListener() {
      @Override
      public void onClick(View v) {
        refreshRun();
      }
    });
    findViewById(R.id.apkButton).setOnClickListener(new View.OnClickListener() {
      @Override
      public void onClick(View v) {
        openLatestApk();
      }
    });
    findViewById(R.id.openButton).setOnClickListener(new View.OnClickListener() {
      @Override
      public void onClick(View v) {
        openUrl("https://github.com/" + owner + "/" + repo);
      }
    });

    if (token.length() == 0) {
      statusText.setText("No GitHub token saved. Go back and connect first.");
      buildButton.setEnabled(false);
      buildButton.setAlpha(0.5f);
      return;
    }
    refreshRun();
  }

  private void triggerBuild() {
    setBusy(true, "Looking up the APK workflow…");

    GitHubClient.request(token, "GET",
        "/repos/" + owner + "/" + repo + "/actions/workflows", null,
        new GitHubClient.Callback() {
          @Override
          public void onSuccess(String body) {
            String workflowId = null;
            String workflowName = null;
            try {
              JSONArray workflows = new JSONObject(body).optJSONArray("workflows");
              if (workflows != null) {
                for (int i = 0; i < workflows.length(); i++) {
                  JSONObject w = workflows.getJSONObject(i);
                  String path = w.optString("path", "").toLowerCase();
                  boolean active = "active".equals(w.optString("state", ""));
                  if (active && (path.contains("apk") || path.contains("android"))) {
                    workflowId = w.optString("id", null);
                    workflowName = w.optString("name", "build");
                    break;
                  }
                }
              }
            } catch (Exception ignored) {
              // handled below
            }
            if (workflowId == null) {
              setBusy(false, "No active APK workflow in this repository.");
              return;
            }
            dispatch(workflowId, workflowName);
          }

          @Override
          public void onError(String message) {
            setBusy(false, "Workflows: " + message);
          }
        });
  }

  private void dispatch(String workflowId, String workflowName) {
    setBusy(true, "Starting the build on " + branch + "…");
    String payload = "{\"ref\":\"" + branch + "\"}";

    GitHubClient.request(token, "POST",
        "/repos/" + owner + "/" + repo + "/actions/workflows/" + workflowId + "/dispatches",
        payload, new GitHubClient.Callback() {
          @Override
          public void onSuccess(String body) {
            setBusy(false, "Build queued. GitHub needs a few seconds to start it.");
            refreshRun();
          }

          @Override
          public void onError(String message) {
            setBusy(false, "Could not start the build: " + message);
          }
        });
  }

  private void refreshRun() {
    statusText.setText("Checking the latest run…");

    GitHubClient.request(token, "GET",
        "/repos/" + owner + "/" + repo + "/actions/runs?per_page=1", null,
        new GitHubClient.Callback() {
          @Override
          public void onSuccess(String body) {
            try {
              JSONArray runs = new JSONObject(body).optJSONArray("workflow_runs");
              if (runs == null || runs.length() == 0) {
                statusText.setText("No builds yet. Start one with the build button.");
                runText.setText("");
                return;
              }
              JSONObject run = runs.getJSONObject(0);
              String status = run.optString("status", "unknown");
              String conclusion = run.optString("conclusion", "");
              String name = run.optString("name", "Build");
              String sha = run.optString("head_sha", "");
              if (sha.length() > 7) sha = sha.substring(0, 7);

              String line = name + "  ·  " + status;
              if (conclusion.length() > 0 && !"null".equals(conclusion)) {
                line = line + " (" + conclusion + ")";
              }
              statusText.setText(line);
              runText.setText("commit " + sha + "\n"
                  + run.optString("created_at", "").replace("T", " ").replace("Z", " UTC"));
            } catch (Exception e) {
              statusText.setText("Could not read the latest run.");
            }
          }

          @Override
          public void onError(String message) {
            statusText.setText("Run status: " + message);
          }
        });
  }

  private void openLatestApk() {
    statusText.setText("Looking for the newest APK…");

    GitHubClient.request(token, "GET",
        "/repos/" + owner + "/" + repo + "/releases?per_page=10", null,
        new GitHubClient.Callback() {
          @Override
          public void onSuccess(String body) {
            String downloadUrl = null;
            try {
              JSONArray releases = new JSONArray(body);
              for (int i = 0; i < releases.length() && downloadUrl == null; i++) {
                JSONArray assets = releases.getJSONObject(i).optJSONArray("assets");
                if (assets == null) continue;
                for (int j = 0; j < assets.length(); j++) {
                  String url = assets.getJSONObject(j).optString("browser_download_url", "");
                  if (url.endsWith(".apk")) {
                    downloadUrl = url;
                    break;
                  }
                }
              }
            } catch (Exception ignored) {
              // handled below
            }
            if (downloadUrl == null) {
              statusText.setText("No APK release yet. Run a build, then check again.");
              return;
            }
            statusText.setText("Opening the APK download…");
            openUrl(downloadUrl);
          }

          @Override
          public void onError(String message) {
            statusText.setText("Releases: " + message);
          }
        });
  }

  private void openUrl(String url) {
    try {
      startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url)));
    } catch (ActivityNotFoundException e) {
      statusText.setText("No browser or download manager available.");
    }
  }

  private void setBusy(boolean busy, String message) {
    progress.setVisibility(busy ? View.VISIBLE : View.GONE);
    buildButton.setEnabled(!busy);
    buildButton.setAlpha(busy ? 0.5f : 1f);
    statusText.setText(message);
  }
}
