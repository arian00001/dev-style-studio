package com.devstyle.studio;

import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.provider.Settings;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.EditText;
import android.widget.Switch;
import android.widget.TextView;
import android.widget.Toast;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.core.content.ContextCompat;
import androidx.fragment.app.Fragment;

/** Tokens, inbox credentials, auto-reply template and the 24/7 switch. */
public class SettingsFragment extends Fragment {

  private Prefs prefs;
  private EditText github;
  private EditText vercel;
  private EditText gemini;
  private EditText email;
  private EditText appPassword;
  private EditText template;
  private Switch autoReply;
  private TextView monitorState;
  private TextView monitorButton;

  @Nullable
  @Override
  public View onCreateView(@NonNull LayoutInflater inflater, @Nullable ViewGroup container,
                           @Nullable Bundle state) {
    return inflater.inflate(R.layout.fragment_settings, container, false);
  }

  @Override
  public void onViewCreated(@NonNull View view, @Nullable Bundle state) {
    prefs = new Prefs(requireContext());

    github = view.findViewById(R.id.inputGithub);
    vercel = view.findViewById(R.id.inputVercel);
    gemini = view.findViewById(R.id.inputGemini);
    email = view.findViewById(R.id.inputEmail);
    appPassword = view.findViewById(R.id.inputAppPassword);
    template = view.findViewById(R.id.inputTemplate);
    autoReply = view.findViewById(R.id.switchAutoReply);
    monitorState = view.findViewById(R.id.monitorState);
    monitorButton = view.findViewById(R.id.monitorButton);

    github.setText(prefs.github());
    vercel.setText(prefs.vercel());
    gemini.setText(prefs.gemini());
    email.setText(prefs.email());
    appPassword.setText(prefs.appPassword());
    template.setText(prefs.template());
    autoReply.setChecked(prefs.autoReply());

    view.findViewById(R.id.saveButton).setOnClickListener(v -> save());
    view.findViewById(R.id.verifyGithub).setOnClickListener(v -> verifyGithub());
    monitorButton.setOnClickListener(v -> toggleMonitor());
    view.findViewById(R.id.batteryButton).setOnClickListener(v -> openBatterySettings());

    refreshMonitorState();
  }

  private void save() {
    prefs.put("github", github.getText().toString().trim());
    prefs.put("vercel", vercel.getText().toString().trim());
    prefs.put("gemini", gemini.getText().toString().trim());
    prefs.put("email", email.getText().toString().trim());
    prefs.put("appPassword", appPassword.getText().toString().replace(" ", "").trim());
    prefs.put("template", template.getText().toString());
    prefs.putBool("autoReply", autoReply.isChecked());
    Toast.makeText(requireContext(), "Saved.", Toast.LENGTH_SHORT).show();
    refreshMonitorState();
  }

  private void verifyGithub() {
    String token = github.getText().toString().trim();
    if (token.length() == 0) {
      Toast.makeText(requireContext(), "Paste a token first.", Toast.LENGTH_SHORT).show();
      return;
    }
    GitHubClient.request(token, "GET", "/user", null, new GitHubClient.Callback() {
      @Override
      public void onSuccess(String body) {
        if (!isAdded()) return;
        prefs.put("github", token);
        Toast.makeText(requireContext(), "GitHub connected.", Toast.LENGTH_SHORT).show();
      }

      @Override
      public void onError(String message) {
        if (!isAdded()) return;
        Toast.makeText(requireContext(), "GitHub: " + message, Toast.LENGTH_LONG).show();
      }
    });
  }

  private void toggleMonitor() {
    save();
    if (prefs.monitor()) {
      prefs.putBool("monitor", false);
      requireContext().stopService(new Intent(requireContext(), MailService.class));
      Toast.makeText(requireContext(), "24/7 monitor stopped.", Toast.LENGTH_SHORT).show();
    } else {
      if (!prefs.hasMail()) {
        Toast.makeText(requireContext(), "Add your email and app password first.", Toast.LENGTH_LONG).show();
        return;
      }
      prefs.putBool("monitor", true);
      ContextCompat.startForegroundService(requireContext(), new Intent(requireContext(), MailService.class));
      Toast.makeText(requireContext(), "24/7 monitor is on.", Toast.LENGTH_SHORT).show();
    }
    refreshMonitorState();
  }

  private void refreshMonitorState() {
    if (prefs.monitor()) {
      monitorState.setText("Monitoring " + (prefs.email().length() > 0 ? prefs.email() : "your inbox")
          + " every minute · auto-reply " + (prefs.autoReply() ? "on" : "off"));
      monitorButton.setText("Stop 24/7 monitor");
    } else {
      monitorState.setText("Monitor is off. Start it to watch the inbox in the background.");
      monitorButton.setText("Start 24/7 monitor");
    }
  }

  private void openBatterySettings() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) return;
    Intent intent = new Intent();
    String pkg = requireContext().getPackageName();
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
      intent.setAction(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS);
      intent.setData(Uri.parse("package:" + pkg));
    }
    try {
      startActivity(intent);
    } catch (Exception e) {
      startActivity(new Intent(Settings.ACTION_SETTINGS));
    }
  }
}