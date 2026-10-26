package com.devstyle.studio;

import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Typeface;
import android.os.Bundle;
import android.view.View;
import android.view.ViewGroup;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.TextView;

import androidx.appcompat.app.AppCompatActivity;

import org.json.JSONArray;
import org.json.JSONObject;

/** Native connect screen: GitHub token, then the user's repositories. */
public class MainActivity extends AppCompatActivity {

  private EditText tokenInput;
  private TextView connectButton;
  private TextView statusText;
  private LinearLayout repoList;
  private ProgressBar progress;
  private SharedPreferences prefs;

  @Override
  protected void onCreate(Bundle state) {
    super.onCreate(state);
    setContentView(R.layout.activity_main);

    prefs = getSharedPreferences("studio", MODE_PRIVATE);
    tokenInput = (EditText) findViewById(R.id.tokenInput);
    connectButton = (TextView) findViewById(R.id.connectButton);
    statusText = (TextView) findViewById(R.id.statusText);
    repoList = (LinearLayout) findViewById(R.id.repoList);
    progress = (ProgressBar) findViewById(R.id.progress);

    String saved = prefs.getString("token", "");
    if (saved != null && saved.length() > 0) tokenInput.setText(saved);

    connectButton.setOnClickListener(new View.OnClickListener() {
      @Override
      public void onClick(View v) {
        connect();
      }
    });
  }

  private void connect() {
    final String token = tokenInput.getText().toString().trim();
    if (token.length() == 0) {
      statusText.setText("Paste a GitHub token with repo and workflow access first.");
      return;
    }
    prefs.edit().putString("token", token).apply();
    setBusy(true, "Connecting to GitHub…");

    GitHubClient.request(token, "GET", "/user", null, new GitHubClient.Callback() {
      @Override
      public void onSuccess(String body) {
        String login = "you";
        try {
          login = new JSONObject(body).optString("login", "you");
        } catch (Exception ignored) {
          // keep the fallback name
        }
        loadRepos(token, login);
      }

      @Override
      public void onError(String message) {
        setBusy(false, "Could not connect: " + message);
      }
    });
  }

  private void loadRepos(final String token, String login) {
    setBusy(true, "Signed in as " + login + ". Loading repositories…");

    GitHubClient.request(token, "GET",
        "/user/repos?per_page=100&sort=updated&affiliation=owner,collaborator",
        null, new GitHubClient.Callback() {
          @Override
          public void onSuccess(String body) {
            setBusy(false, "Tap a repository to build it.");
            repoList.removeAllViews();
            try {
              JSONArray repos = new JSONArray(body);
              if (repos.length() == 0) {
                statusText.setText("This token cannot see any repositories.");
                return;
              }
              for (int i = 0; i < repos.length(); i++) {
                JSONObject repo = repos.getJSONObject(i);
                JSONObject owner = repo.optJSONObject("owner");
                addRepoRow(
                    owner == null ? "unknown" : owner.optString("login", "unknown"),
                    repo.optString("name", "repository"),
                    repo.optString("default_branch", "main"),
                    repo.optBoolean("private", false));
              }
            } catch (Exception e) {
              statusText.setText("Could not read the repository list.");
            }
          }

          @Override
          public void onError(String message) {
            setBusy(false, "Repositories: " + message);
          }
        });
  }

  private void addRepoRow(final String owner, final String name, final String branch,
                          boolean isPrivate) {
    LinearLayout card = new LinearLayout(this);
    card.setOrientation(LinearLayout.VERTICAL);
    card.setBackgroundResource(R.drawable.bg_card);
    card.setPadding(dp(18), dp(15), dp(18), dp(15));

    LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(
        ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
    params.bottomMargin = dp(10);
    card.setLayoutParams(params);

    TextView title = new TextView(this);
    title.setText(name);
    title.setTextColor(getColor(R.color.ink));
    title.setTextSize(16f);
    title.setTypeface(null, Typeface.BOLD);

    TextView meta = new TextView(this);
    meta.setText(owner + "  ·  " + branch + (isPrivate ? "  ·  private" : ""));
    meta.setTextColor(getColor(R.color.muted));
    meta.setTextSize(12f);
    meta.setPadding(0, dp(4), 0, 0);

    card.addView(title);
    card.addView(meta);

    card.setOnClickListener(new View.OnClickListener() {
      @Override
      public void onClick(View v) {
        Intent intent = new Intent(MainActivity.this, RepoActivity.class);
        intent.putExtra("owner", owner);
        intent.putExtra("repo", name);
        intent.putExtra("branch", branch);
        startActivity(intent);
      }
    });

    repoList.addView(card);
  }

  private void setBusy(boolean busy, String message) {
    progress.setVisibility(busy ? View.VISIBLE : View.GONE);
    connectButton.setEnabled(!busy);
    connectButton.setAlpha(busy ? 0.5f : 1f);
    statusText.setText(message);
  }

  private int dp(int value) {
    return Math.round(getResources().getDisplayMetrics().density * value);
  }
}
