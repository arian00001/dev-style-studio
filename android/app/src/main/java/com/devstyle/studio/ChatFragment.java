package com.devstyle.studio;

import android.os.Bundle;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.EditText;
import android.widget.TextView;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.fragment.app.Fragment;
import androidx.recyclerview.widget.LinearLayoutManager;
import androidx.recyclerview.widget.RecyclerView;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.regex.Matcher;
import java.util.regex.Pattern;

/** AI chat that can also drive GitHub and Vercel. */
public class ChatFragment extends Fragment {

  private static final Pattern ACTION =
      Pattern.compile("\\[\\[action:(build|deploy)\\s+([A-Za-z0-9_.-]+)/([A-Za-z0-9_.-]+)\\]\\]");

  private static final String SYSTEM =
      "You are DevStyle Studio, a concise mobile assistant for a developer. "
          + "The developer controls GitHub and Vercel from this app. Answer in at most 3 short sentences. "
          + "If the developer asks to build an APK for a repository, end your answer with "
          + "[[action:build owner/repo]]. If they ask to deploy a repository, end with "
          + "[[action:deploy owner/repo]]. Use only the exact owner/repo they named. "
          + "Never invent repository names.";

  private Prefs prefs;
  private ChatAdapter adapter;
  private RecyclerView list;
  private EditText input;
  private TextView send;
  private boolean busy = false;
  private final StringBuilder history = new StringBuilder();

  @Nullable
  @Override
  public View onCreateView(@NonNull LayoutInflater inflater, @Nullable ViewGroup container,
                           @Nullable Bundle state) {
    return inflater.inflate(R.layout.fragment_chat, container, false);
  }

  @Override
  public void onViewCreated(@NonNull View view, @Nullable Bundle state) {
    prefs = new Prefs(requireContext());
    list = view.findViewById(R.id.chatList);
    input = view.findViewById(R.id.chatInput);
    send = view.findViewById(R.id.chatSend);

    LinearLayoutManager manager = new LinearLayoutManager(requireContext());
    manager.setStackFromEnd(true);
    list.setLayoutManager(manager);
    adapter = new ChatAdapter();
    list.setAdapter(adapter);

    adapter.add("Hi — I'm your studio copilot. Ask me to build an APK, deploy a repo to Vercel, "
        + "explain a failing step or draft an email reply.", false);

    send.setOnClickListener(v -> submit());
  }

  private void submit() {
    if (busy) return;
    String text = input.getText().toString().trim();
    if (text.length() == 0) return;
    if (prefs.gemini().trim().length() == 0) {
      adapter.add("Add your Gemini API key in Settings and I can help right away.", false);
      return;
    }
    input.setText("");
    adapter.add(text, true);
    scroll();

    busy = true;
    send.setAlpha(0.4f);

    history.append("Developer: ").append(text).append('\n');
    String prompt = SYSTEM + "\n\n" + history.toString() + "Assistant:";

    GeminiApi.ask(prefs.gemini(), prompt, new GeminiApi.Callback() {
      @Override
      public void onSuccess(String answer) {
        if (!isAdded()) return;
        busy = false;
        send.setAlpha(1f);

        Matcher matcher = ACTION.matcher(answer);
        String clean = matcher.find() ? answer.substring(0, matcher.start()).trim() : answer;
        String actionKind = matcher.reset().find() ? matcher.group(1) : null;
        String fullName = actionKind == null ? null : matcher.group(2) + "/" + matcher.group(3);

        adapter.add(clean.length() == 0 ? "On it." : clean, false);
        history.append("Assistant: ").append(clean).append('\n');
        scroll();

        if ("build".equals(actionKind)) {
          runBuild(fullName);
        } else if ("deploy".equals(actionKind)) {
          runDeploy(fullName);
        }
      }

      @Override
      public void onError(String message) {
        if (!isAdded()) return;
        busy = false;
        send.setAlpha(1f);
        adapter.add("Gemini: " + message, false);
        scroll();
      }
    });
  }

  private void runBuild(String fullName) {
    String[] parts = fullName == null ? new String[]{"", ""} : fullName.split("/");
    final String owner = parts[0];
    final String repo = parts.length > 1 ? parts[1] : "";
    adapter.add("Triggering the Android workflow for " + fullName + "…", false);
    scroll();
    GitHubClient.build(prefs.github(), owner, repo, new GitHubClient.Callback() {
      @Override
      public void onSuccess(String body) {
        if (!isAdded()) return;
        adapter.add("Build queued. Open the Home tab to watch the live progress.", false);
        scroll();
      }

      @Override
      public void onError(String message) {
        if (!isAdded()) return;
        adapter.add("Could not start the build: " + message, false);
        scroll();
      }
    });
  }

  private void runDeploy(final String fullName) {
    if (prefs.vercel().trim().length() == 0) {
      adapter.add("Add a Vercel token in Settings first.", false);
      scroll();
      return;
    }
    adapter.add("Looking up " + fullName + " on GitHub before deploying…", false);
    scroll();
    GitHubClient.repoList(prefs.github(), new GitHubClient.Callback() {
      @Override
      public void onSuccess(String body) {
        if (!isAdded()) return;
        try {
          JSONArray repos = new JSONArray(body);
          for (int i = 0; i < repos.length(); i++) {
            JSONObject repo = repos.getJSONObject(i);
            if (!fullName.equals(repo.optString("full_name"))) continue;
            deploy(repo);
            return;
          }
          adapter.add("I could not find " + fullName + " in your repositories.", false);
          scroll();
        } catch (Exception e) {
          adapter.add("Could not read the repository list.", false);
          scroll();
        }
      }

      @Override
      public void onError(String message) {
        if (!isAdded()) return;
        adapter.add("GitHub: " + message, false);
        scroll();
      }
    });
  }

  private void deploy(JSONObject repo) {
    String name = repo.optString("name");
    long id = repo.optLong("id");
    String branch = repo.optString("default_branch", "main");
    VercelApi.deploy(prefs.vercel(), name, id, branch, new VercelApi.Callback() {
      @Override
      public void onSuccess(String body) {
        if (!isAdded()) return;
        adapter.add("Deployment started for " + name + ". The live URL appears on the Home tab when it is ready.", false);
        scroll();
      }

      @Override
      public void onError(String message) {
        if (!isAdded()) return;
        adapter.add("Vercel: " + message, false);
        scroll();
      }
    });
  }

  private void scroll() {
    list.post(() -> list.scrollToPosition(adapter.getItemCount() - 1));
  }
}