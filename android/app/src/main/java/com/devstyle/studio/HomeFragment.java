package com.devstyle.studio;

import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.EditText;
import android.widget.FrameLayout;
import android.widget.ProgressBar;
import android.widget.TextView;
import android.widget.Toast;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.appcompat.app.AlertDialog;
import androidx.fragment.app.Fragment;
import androidx.recyclerview.widget.LinearLayoutManager;
import androidx.recyclerview.widget.RecyclerView;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.List;

/** Dashboard: repository list, live build progress and Vercel deployments. */
public class HomeFragment extends Fragment implements RepoAdapter.Listener {

  private Prefs prefs;
  private RepoAdapter adapter;
  private TextView subtitle;
  private TextView buildTitle;
  private TextView buildStatus;
  private TextView buildSteps;
  private TextView apkLink;
  private TextView vercelStatus;
  private TextView liveUrl;
  private TextView vercelButton;
  private ProgressBar buildBar;
  private ProgressBar repoBar;

  private final Handler handler = new Handler(Looper.getMainLooper());
  private Repo current;
  private long polledRun = -1;
  private boolean buildPolling = false;

  @Nullable
  @Override
  public View onCreateView(@NonNull LayoutInflater inflater, @Nullable ViewGroup container,
                           @Nullable Bundle state) {
    return inflater.inflate(R.layout.fragment_home, container, false);
  }

  @Override
  public void onViewCreated(@NonNull View view, @Nullable Bundle state) {
    prefs = new Prefs(requireContext());

    subtitle = view.findViewById(R.id.homeSubtitle);
    buildTitle = view.findViewById(R.id.buildTitle);
    buildStatus = view.findViewById(R.id.buildStatus);
    buildSteps = view.findViewById(R.id.buildSteps);
    apkLink = view.findViewById(R.id.apkLink);
    vercelStatus = view.findViewById(R.id.vercelStatus);
    liveUrl = view.findViewById(R.id.liveUrl);
    vercelButton = view.findViewById(R.id.vercelButton);
    buildBar = view.findViewById(R.id.buildBar);
    repoBar = view.findViewById(R.id.repoBar);

    apkLink.setOnClickListener(v -> {
      String url = (String) v.getTag();
      if (url != null) open(url);
    });
    liveUrl.setOnClickListener(v -> {
      String url = (String) v.getTag();
      if (url != null) open(url);
    });
    vercelButton.setOnClickListener(v -> {
      if (getActivity() instanceof MainActivity) {
        ((MainActivity) getActivity()).openTab(R.id.tab_settings);
      }
    });

    RecyclerView list = view.findViewById(R.id.repoList);
    list.setLayoutManager(new LinearLayoutManager(requireContext()));
    adapter = new RepoAdapter(this);
    list.setAdapter(adapter);

    refreshVercelCard();
    loadRepos();
  }

  // ---------------------------------------------------------------- repositories

  private void loadRepos() {
    if (!prefs.hasGithub()) {
      subtitle.setText("Add your GitHub token in Settings to load your repositories.");
      repoBar.setVisibility(View.GONE);
      adapter.submit(new ArrayList<>(), "");
      buildStatus.setText("Not connected to GitHub yet.");
      return;
    }
    repoBar.setVisibility(View.VISIBLE);
    subtitle.setText("Loading repositories…");
    GitHubClient.repoList(prefs.github(), new GitHubClient.Callback() {
      @Override
      public void onSuccess(String body) {
        if (!isAdded()) return;
        repoBar.setVisibility(View.GONE);
        List<Repo> repos = new ArrayList<>();
        try {
          JSONArray array = new JSONArray(body);
          for (int i = 0; i < array.length(); i++) {
            JSONObject repo = array.getJSONObject(i);
            JSONObject owner = repo.optJSONObject("owner");
            repos.add(new Repo(
                repo.optLong("id"),
                owner == null ? "unknown" : owner.optString("login", "unknown"),
                repo.optString("name", "repository"),
                repo.optString("default_branch", "main"),
                repo.optBoolean("private", false),
                repo.optString("updated_at", "")));
          }
        } catch (Exception e) {
          subtitle.setText("Could not read the repository list.");
          return;
        }
        subtitle.setText(repos.size() + " repositories · tap a card to build, deploy, edit or delete");
        adapter.submit(repos, prefs.selectedRepo());
        if (repos.isEmpty()) {
          buildStatus.setText("This token cannot see any repositories.");
          return;
        }
        Repo pick = null;
        for (Repo repo : repos) {
          if (repo.fullName().equals(prefs.selectedRepo())) pick = repo;
        }
        select(pick == null ? repos.get(0) : pick);
      }

      @Override
      public void onError(String message) {
        if (!isAdded()) return;
        repoBar.setVisibility(View.GONE);
        subtitle.setText("GitHub: " + message);
      }
    });
  }

  private void select(Repo repo) {
    current = repo;
    prefs.put("selected", repo.fullName());
    adapter.setSelected(repo.fullName());
    buildTitle.setText(repo.fullName());
    buildSteps.setText("");
    buildBar.setProgress(0);
    startBuildPolling(repo);
  }

  // ---------------------------------------------------------------- build progress

  private void startBuildPolling(Repo repo) {
    buildPolling = true;
    polledRun = -1;
    buildStatus.setText("Checking the latest build…");
    handler.removeCallbacksAndMessages(null);
    pollBuild(repo);
  }

  private void pollBuild(final Repo repo) {
    if (!buildPolling || !isAdded()) return;
    GitHubClient.latestRun(prefs.github(), repo.owner, repo.name, new GitHubClient.Callback() {
      @Override
      public void onSuccess(String body) {
        if (!isAdded() || !buildPolling) return;
        try {
          JSONArray runs = new JSONObject(body).optJSONArray("workflow_runs");
          if (runs == null || runs.length() == 0) {
            buildStatus.setText("No build yet — tap Build to start one.");
            buildBar.setProgress(0);
            return;
          }
          final JSONObject run = runs.getJSONObject(0);
          final long runId = run.optLong("id");
          polledRun = runId;
          String state = run.optString("status", "queued");
          String conclusion = run.optString("conclusion", "");
          String label = "Run #" + run.optLong("run_number") + " · " + state;
          if (conclusion.length() > 0) label = "Run #" + run.optLong("run_number") + " · " + conclusion;
          buildStatus.setText(label);
          loadSteps(repo, runId, conclusion);
          if ("completed".equals(state)) {
            buildPolling = false;
            if ("success".equals(conclusion)) loadApk(repo);
          }
        } catch (Exception e) {
          buildStatus.setText("Could not read build status.");
        }
      }

      @Override
      public void onError(String message) {
        if (isAdded()) buildStatus.setText("Build status: " + message);
      }
    });
    handler.postDelayed(() -> pollBuild(repo), 6000);
  }

  private void loadSteps(Repo repo, long runId, String conclusion) {
    GitHubClient.runJobs(prefs.github(), repo.owner, repo.name, runId, new GitHubClient.Callback() {
      @Override
      public void onSuccess(String body) {
        if (!isAdded()) return;
        try {
          JSONArray jobs = new JSONObject(body).optJSONArray("jobs");
          if (jobs == null || jobs.length() == 0) return;
          JSONArray steps = jobs.getJSONObject(0).optJSONArray("steps");
          if (steps == null) return;
          int done = 0;
          StringBuilder text = new StringBuilder();
          for (int i = 0; i < steps.length(); i++) {
            JSONObject step = steps.getJSONObject(i);
            String status = step.optString("status", "");
            String stepConclusion = step.optString("conclusion", "");
            String mark = "•";
            if ("success".equals(stepConclusion)) {
              mark = "✓";
              done++;
            } else if ("failure".equals(stepConclusion) || "cancelled".equals(stepConclusion)) {
              mark = "✗";
              done++;
            } else if ("in_progress".equals(status)) {
              mark = "▸";
            }
            text.append(mark).append(' ').append(step.optString("name")).append('\n');
          }
          buildSteps.setText(text.toString().trim());
          buildBar.setProgress(steps.length() == 0 ? 0 : (done * 100) / steps.length());
          if ("failure".equals(conclusion)) {
            buildStatus.setText("Build failed — open GitHub Actions for the log, or ask the AI to fix it.");
          }
        } catch (Exception ignored) {
          // steps are optional
        }
      }

      @Override
      public void onError(String message) {
        // leave the previous step list
      }
    });
  }

  private void loadApk(final Repo repo) {
    GitHubClient.latestApk(prefs.github(), repo.owner, repo.name, new GitHubClient.Callback() {
      @Override
      public void onSuccess(String body) {
        if (!isAdded()) return;
        try {
          JSONObject release = new JSONObject(body);
          JSONArray assets = release.optJSONArray("assets");
          for (int i = 0; assets != null && i < assets.length(); i++) {
            JSONObject asset = assets.getJSONObject(i);
            String name = asset.optString("name", "");
            if (name.endsWith(".apk")) {
              String url = asset.optString("browser_download_url", "");
              apkLink.setTag(url);
              apkLink.setText("Download APK · " + name);
              apkLink.setVisibility(View.VISIBLE);
              prefs.put("apk_" + repo.fullName(), url);
              return;
            }
          }
          apkLink.setVisibility(View.GONE);
        } catch (Exception ignored) {
          apkLink.setVisibility(View.GONE);
        }
      }

      @Override
      public void onError(String message) {
        if (isAdded()) apkLink.setVisibility(View.GONE);
      }
    });
  }

  // ---------------------------------------------------------------- row actions

  @Override
  public void onBuild(Repo repo) {
    select(repo);
    buildStatus.setText("Dispatching the Android workflow…");
    apkLink.setVisibility(View.GONE);
    GitHubClient.build(prefs.github(), repo.owner, repo.name, new GitHubClient.Callback() {
      @Override
      public void onSuccess(String body) {
        if (!isAdded()) return;
        buildStatus.setText("Build queued — waiting for a runner…");
        handler.postDelayed(() -> {
          buildPolling = true;
          pollBuild(repo);
        }, 7000);
      }

      @Override
      public void onError(String message) {
        if (isAdded()) buildStatus.setText("Could not start the build: " + message);
      }
    });
  }

  @Override
  public void onDeploy(Repo repo) {
    select(repo);
    String vercel = prefs.vercel();
    if (vercel.trim().length() == 0) {
      Toast.makeText(requireContext(), "Add your Vercel token in Settings first.", Toast.LENGTH_LONG).show();
      return;
    }
    vercelStatus.setText("Deploying " + repo.fullName() + " to production…");
    VercelApi.deploy(vercel, repo.name, repo.id, repo.branch, new VercelApi.Callback() {
      @Override
      public void onSuccess(String body) {
        if (!isAdded()) return;
        try {
          JSONObject deployment = new JSONObject(body);
          String id = deployment.optString("id", "");
          pollDeployment(repo, id, 0);
        } catch (Exception e) {
          vercelStatus.setText("Vercel: could not read the deployment.");
        }
      }

      @Override
      public void onError(String message) {
        if (isAdded()) vercelStatus.setText("Vercel: " + message);
      }
    });
  }

  private void pollDeployment(final Repo repo, final String id, final int attempt) {
    if (attempt > 40 || !isAdded()) return;
    VercelApi.deployment(prefs.vercel(), id, new VercelApi.Callback() {
      @Override
      public void onSuccess(String body) {
        if (!isAdded()) return;
        try {
          JSONObject deployment = new JSONObject(body);
          String state = deployment.optString("readyState", "QUEUED");
          vercelStatus.setText("Deployment " + state.toLowerCase() + " · " + repo.fullName());
          String host = deployment.optString("url", "");
          if ("READY".equals(state) && host.length() > 0) {
            String url = host.startsWith("http") ? host : "https://" + host;
            liveUrl.setTag(url);
            liveUrl.setText(url);
            liveUrl.setVisibility(View.VISIBLE);
            prefs.put("live_" + repo.fullName(), url);
            vercelStatus.setText("Live in production");
            return;
          }
          if ("ERROR".equals(state) || "CANCELED".equals(state)) {
            vercelStatus.setText("Vercel deployment " + state.toLowerCase() + ".");
            return;
          }
        } catch (Exception ignored) {
          // keep polling
        }
        handler.postDelayed(() -> pollDeployment(repo, id, attempt + 1), 5000);
      }

      @Override
      public void onError(String message) {
        if (isAdded()) vercelStatus.setText("Vercel: " + message);
      }
    });
  }

  @Override
  public void onEdit(Repo repo) {
    final EditText input = new EditText(requireContext());
    input.setText(repo.name);
    input.setSingleLine(true);
    int pad = Math.round(getResources().getDisplayMetrics().density * 18);
    FrameLayout wrap = new FrameLayout(requireContext());
    wrap.setPadding(pad, pad / 2, pad, pad / 2);
    wrap.addView(input);

    new AlertDialog.Builder(requireContext())
        .setTitle("Rename " + repo.fullName())
        .setView(wrap)
        .setPositiveButton("Save", (dialog, which) -> {
          String name = input.getText().toString().trim();
          if (name.length() == 0) return;
          GitHubClient.editRepo(prefs.github(), repo.owner, repo.name,
              "{\"name\":\"" + name + "\"}", new GitHubClient.Callback() {
                @Override
                public void onSuccess(String body) {
                  Toast.makeText(requireContext(), "Repository renamed.", Toast.LENGTH_SHORT).show();
                  loadRepos();
                }

                @Override
                public void onError(String message) {
                  Toast.makeText(requireContext(), message, Toast.LENGTH_LONG).show();
                }
              });
        })
        .setNegativeButton("Cancel", null)
        .show();
  }

  @Override
  public void onDelete(Repo repo) {
    new AlertDialog.Builder(requireContext())
        .setTitle("Delete " + repo.fullName() + "?")
        .setMessage("This removes the repository from GitHub permanently.")
        .setPositiveButton("Delete", (dialog, which) ->
            GitHubClient.deleteRepo(prefs.github(), repo.owner, repo.name, new GitHubClient.Callback() {
              @Override
              public void onSuccess(String body) {
                Toast.makeText(requireContext(), "Repository deleted.", Toast.LENGTH_SHORT).show();
                if (repo.fullName().equals(prefs.selectedRepo())) prefs.put("selected", "");
                loadRepos();
              }

              @Override
              public void onError(String message) {
                Toast.makeText(requireContext(), message, Toast.LENGTH_LONG).show();
              }
            }))
        .setNegativeButton("Keep", null)
        .show();
  }

  @Override
  public void onSelect(Repo repo) {
    select(repo);
  }

  // ---------------------------------------------------------------- helpers

  private void refreshVercelCard() {
    String vercel = prefs.vercel();
    liveUrl.setVisibility(View.GONE);
    if (vercel.trim().length() == 0) {
      vercelStatus.setText("Not connected — add a Vercel token to go live from a repo.");
      vercelButton.setText("Connect Vercel");
      return;
    }
    vercelButton.setText("Vercel settings");
    vercelStatus.setText("Connected. Use Deploy on any repository.");
    VercelApi.verify(vercel, new VercelApi.Callback() {
      @Override
      public void onSuccess(String body) {
        if (!isAdded()) return;
        try {
          JSONObject user = new JSONObject(body).optJSONObject("user");
          String name = user == null ? "connected" : user.optString("username", "connected");
          vercelStatus.setText("Connected as " + name + " · deploy from any repo");
        } catch (Exception ignored) {
          vercelStatus.setText("Connected.");
        }
      }

      @Override
      public void onError(String message) {
        if (isAdded()) vercelStatus.setText("Vercel token rejected: " + message);
      }
    });
  }

  private void open(String url) {
    try {
      startActivity(new android.content.Intent(android.content.Intent.ACTION_VIEW,
          android.net.Uri.parse(url)));
    } catch (Exception e) {
      Toast.makeText(requireContext(), "No browser available.", Toast.LENGTH_SHORT).show();
    }
  }

  @Override
  public void onDestroyView() {
    buildPolling = false;
    handler.removeCallbacksAndMessages(null);
    super.onDestroyView();
  }
}