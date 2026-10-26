package com.devstyle.studio;

import android.content.Intent;
import android.graphics.Bitmap;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.provider.Settings;
import android.view.Gravity;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.EditText;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.Switch;
import android.widget.TextView;
import android.widget.Toast;

import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.contract.ActivityResultContracts;
import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.appcompat.app.AlertDialog;
import androidx.fragment.app.Fragment;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;

/** Tokens, inbox credentials, the designed reply template and the 24/7 switch. */
public class SettingsFragment extends Fragment {

  private Prefs prefs;
  private EditText github;
  private EditText vercel;
  private EditText gemini;
  private EditText imgbb;
  private EditText email;
  private EditText appPassword;
  private EditText tplSubject;
  private EditText tplHeading;
  private EditText tplBody;
  private EditText tplSign;
  private Switch useAi;
  private Switch autoReply;
  private TextView modeNote;
  private TextView monitorState;
  private TextView monitorButton;
  private TextView imgState;
  private TextView posTop;
  private TextView posMiddle;
  private TextView posBottom;

  private final ActivityResultLauncher<String> pickImage =
      registerForActivityResult(new ActivityResultContracts.GetContent(), uri -> {
        if (uri != null) uploadImage(uri);
      });

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
    imgbb = view.findViewById(R.id.inputImgbb);
    email = view.findViewById(R.id.inputEmail);
    appPassword = view.findViewById(R.id.inputAppPassword);
    tplSubject = view.findViewById(R.id.inputTplSubject);
    tplHeading = view.findViewById(R.id.inputTplHeading);
    tplBody = view.findViewById(R.id.inputTplBody);
    tplSign = view.findViewById(R.id.inputTplSign);
    useAi = view.findViewById(R.id.switchUseAi);
    autoReply = view.findViewById(R.id.switchAutoReply);
    modeNote = view.findViewById(R.id.modeNote);
    monitorState = view.findViewById(R.id.monitorState);
    monitorButton = view.findViewById(R.id.monitorButton);
    imgState = view.findViewById(R.id.imgState);
    posTop = view.findViewById(R.id.posTop);
    posMiddle = view.findViewById(R.id.posMiddle);
    posBottom = view.findViewById(R.id.posBottom);

    fill();

    view.findViewById(R.id.saveButton).setOnClickListener(v -> save());
    view.findViewById(R.id.verifyGithub).setOnClickListener(v -> verifyGithub());
    view.findViewById(R.id.batteryButton).setOnClickListener(v -> openBatterySettings());
    view.findViewById(R.id.addImage).setOnClickListener(v -> pickImage.launch("image/*"));
    view.findViewById(R.id.clearImage).setOnClickListener(v -> {
      prefs.put("tplImage", "");
      refreshImageState();
    });
    view.findViewById(R.id.previewTemplate).setOnClickListener(v -> preview());
    view.findViewById(R.id.pushTemplate).setOnClickListener(v -> publishToGithub());
    view.findViewById(R.id.posTop).setOnClickListener(v -> setPosition("top"));
    view.findViewById(R.id.posMiddle).setOnClickListener(v -> setPosition("middle"));
    view.findViewById(R.id.posBottom).setOnClickListener(v -> setPosition("bottom"));
    useAi.setOnCheckedChangeListener((button, checked) -> refreshMode());
    monitorButton.setOnClickListener(v -> toggleMonitor());

    refreshMode();
    refreshImageState();
    refreshMonitorState();
  }

  private ReplyTemplate currentTemplate() {
    ReplyTemplate template = new ReplyTemplate();
    template.mode = useAi.isChecked() ? ReplyTemplate.MODE_AI : ReplyTemplate.MODE_TEMPLATE;
    template.subject = tplSubject.getText().toString().trim();
    template.heading = tplHeading.getText().toString().trim();
    template.body = tplBody.getText().toString().trim();
    template.signature = tplSign.getText().toString().trim();
    if (template.subject.length() == 0) template.subject = "Re: {{subject}}";
    if (template.heading.length() == 0) template.heading = "Thanks for reaching out";
    if (template.body.length() == 0) template.body = ReplyTemplate.DEFAULT_BODY;
    template.imageUrl = prefs.get("tplImage");
    template.imagePosition = prefs.get("tplImagePos").length() == 0 ? "top" : prefs.get("tplImagePos");
    return template;
  }

  private void fill() {
    ReplyTemplate template = ReplyTemplate.load(prefs);
    github.setText(prefs.github());
    vercel.setText(prefs.vercel());
    gemini.setText(prefs.gemini());
    imgbb.setText(prefs.get("imgbb"));
    email.setText(prefs.email());
    appPassword.setText(prefs.appPassword());
    tplSubject.setText(template.subject);
    tplHeading.setText(template.heading);
    tplBody.setText(template.body);
    tplSign.setText(template.signature);
    useAi.setChecked(ReplyTemplate.MODE_AI.equals(template.mode));
    autoReply.setChecked(prefs.autoReply());
  }

  private void save() {
    boolean hadMail = prefs.hasMail();
    prefs.put("github", github.getText().toString().trim());
    prefs.put("vercel", vercel.getText().toString().trim());
    prefs.put("gemini", gemini.getText().toString().trim());
    prefs.put("imgbb", imgbb.getText().toString().trim());
    prefs.put("email", email.getText().toString().trim());
    prefs.put("appPassword", appPassword.getText().toString().replace(" ", "").trim());
    prefs.putBool("autoReply", autoReply.isChecked());
    currentTemplate().save(prefs);

    Toast.makeText(requireContext(), "Saved.", Toast.LENGTH_SHORT).show();
    if (!hadMail && prefs.hasMail()) {
      // Mailbox just filled in for the first time: switch the 24/7 monitor on straight away.
      prefs.putBool("monitor", true);
      MailService.start(requireContext());
      Toast.makeText(requireContext(), "24/7 monitor is on.", Toast.LENGTH_SHORT).show();
    }
    refreshMode();
    refreshMonitorState();
  }

  private void refreshMode() {
    if (useAi.isChecked()) {
      modeNote.setText(gemini.getText().toString().trim().length() == 0
          ? "AI is on but no Gemini key is saved — the template will be sent instead."
          : "Gemini writes each reply, wrapped in your template design.");
    } else {
      modeNote.setText("Template mode: no Gemini call at all — this exact mail goes to every sender.");
    }
  }

  private void refreshImageState() {
    String url = prefs.get("tplImage");
    if (url == null || url.trim().length() == 0) {
      imgState.setText("No image yet — upload one with your ImgBB key.");
      markPosition(prefs.get("tplImagePos").length() == 0 ? "top" : prefs.get("tplImagePos"));
    } else {
      imgState.setText("Image ready · " + url);
      markPosition(prefs.get("tplImagePos").length() == 0 ? "top" : prefs.get("tplImagePos"));
    }
  }

  private void setPosition(String position) {
    prefs.put("tplImagePos", position);
    markPosition(position);
    Toast.makeText(requireContext(), "Image placed: " + labelOf(position), Toast.LENGTH_SHORT).show();
  }

  private String labelOf(String position) {
    if ("middle".equals(position)) return "inside the body";
    if ("bottom".equals(position)) return "footer";
    return "header";
  }

  private void markPosition(String position) {
    posTop.setBackgroundResource("top".equals(position) ? R.drawable.bg_pill_active : R.drawable.bg_pill);
    posMiddle.setBackgroundResource("middle".equals(position) ? R.drawable.bg_pill_active : R.drawable.bg_pill);
    posBottom.setBackgroundResource("bottom".equals(position) ? R.drawable.bg_pill_active : R.drawable.bg_pill);
  }

  private void uploadImage(Uri uri) {
    String key = imgbb.getText().toString().trim();
    if (key.length() == 0) {
      Toast.makeText(requireContext(), "Paste your ImgBB API key first.", Toast.LENGTH_LONG).show();
      return;
    }
    imgState.setText("Uploading the image to ImgBB…");
    new Thread(() -> {
      try (InputStream in = requireContext().getContentResolver().openInputStream(uri)) {
        if (in == null) throw new Exception("That image could not be opened.");
        ByteArrayOutputStream buffer = new ByteArrayOutputStream();
        byte[] chunk = new byte[8192];
        int read;
        while ((read = in.read(chunk)) > 0) buffer.write(chunk, 0, read);
        byte[] bytes = buffer.toByteArray();
        ImgBb.upload(key, bytes, new ImgBb.Upload() {
          @Override
          public void onSuccess(String url) {
            if (!isAdded()) return;
            prefs.put("imgbb", key);
            prefs.put("tplImage", url);
            refreshImageState();
            Toast.makeText(requireContext(), "Image uploaded.", Toast.LENGTH_SHORT).show();
          }

          @Override
          public void onError(String message) {
            if (!isAdded()) return;
            imgState.setText("Upload failed: " + message);
            Toast.makeText(requireContext(), "ImgBB: " + message, Toast.LENGTH_LONG).show();
          }
        });
      } catch (Exception e) {
        String message = e.getMessage() == null ? e.toString() : e.getMessage();
        if (!isAdded()) return;
        requireActivity().runOnUiThread(() -> imgState.setText("Upload failed: " + message));
      }
    }).start();
  }

  private void preview() {
    save();
    ReplyTemplate template = ReplyTemplate.load(prefs);

    LinearLayout column = new LinearLayout(requireContext());
    column.setOrientation(LinearLayout.VERTICAL);
    column.setPadding(34, 34, 34, 34);
    column.setBackgroundColor(0xFFF4F6F1);
    if (template.imageUrl != null && template.imageUrl.trim().length() > 0
        && "top".equals(template.imagePosition)) {
      addImage(column, template.imageUrl);
    }
    addPill(column);
    addText(column, template.heading, 21, 0xFF101314, true, 14);
    addText(column, template.body.replace("{{from}}", "you@gmail.com"), 14, 0xFF4B5350, false, 12);
    if (template.imageUrl != null && template.imageUrl.trim().length() > 0
        && "middle".equals(template.imagePosition)) {
      addImage(column, template.imageUrl);
    }
    if (template.signature.trim().length() > 0) {
      addText(column, template.signature, 13, 0xFF22400A, true, 20);
    }
    if (template.imageUrl != null && template.imageUrl.trim().length() > 0
        && "bottom".equals(template.imagePosition)) {
      addImage(column, template.imageUrl);
    }

    ScrollView scroll = new ScrollView(requireContext());
    scroll.addView(column);

    new AlertDialog.Builder(requireContext())
        .setTitle("Template preview")
        .setView(scroll)
        .setPositiveButton("Looks good", null)
        .show();
  }

  private void addPill(LinearLayout parent) {
    TextView badge = new TextView(requireContext());
    badge.setText("AUTO REPLY");
    badge.setTextSize(10);
    badge.setTextColor(0xFF22400A);
    badge.setTypeface(badge.getTypeface(), android.graphics.Typeface.BOLD);
    badge.setBackgroundColor(0xFFE9FFB5);
    badge.setPadding(20, 8, 20, 8);
    LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(
        LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT);
    params.topMargin = 12;
    parent.addView(badge, params);
  }

  private void addText(LinearLayout parent, String value, int size, int color, boolean bold, int top) {
    TextView text = new TextView(requireContext());
    text.setText(value);
    text.setTextSize(size);
    text.setTextColor(color);
    if (bold) text.setTypeface(text.getTypeface(), android.graphics.Typeface.BOLD);
    text.setLineSpacing(6f, 1f);
    LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(
        LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT);
    params.topMargin = top;
    parent.addView(text, params);
  }

  private void addImage(LinearLayout parent, String url) {
    ImageView image = new ImageView(requireContext());
    image.setAdjustViewBounds(true);
    image.setScaleType(ImageView.ScaleType.CENTER_CROP);
    LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(
        LinearLayout.LayoutParams.MATCH_PARENT, 420);
    parent.addView(image, params);
    ImgBb.loadBitmap(url, image::setImageBitmap);
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

  private void publishToGithub() {
    save();
    String token = prefs.github();
    String selected = prefs.selectedRepo();
    if (token.trim().length() == 0) {
      Toast.makeText(requireContext(), "Add your GitHub token first.", Toast.LENGTH_LONG).show();
      return;
    }
    if (selected == null || !selected.contains("/")) {
      Toast.makeText(requireContext(), "Pick a repository on the Home tab first.", Toast.LENGTH_LONG).show();
      return;
    }
    String owner = selected.substring(0, selected.indexOf('/'));
    String repo = selected.substring(selected.indexOf('/') + 1);
    String json = currentTemplate().toJson().toString();

    Toast.makeText(requireContext(), "Publishing the template…", Toast.LENGTH_SHORT).show();
    new Thread(() -> {
      try {
        GitHubPusher.putFile(token, owner, repo, "mail-template.json", json,
            "Update reply template from Dev Style Studio");
        if (!isAdded()) return;
        requireActivity().runOnUiThread(() -> Toast.makeText(requireContext(),
            "Template published to " + selected + ".", Toast.LENGTH_LONG).show());
      } catch (Exception e) {
        String message = e.getMessage() == null ? e.toString() : e.getMessage();
        if (!isAdded()) return;
        requireActivity().runOnUiThread(() -> Toast.makeText(requireContext(),
            "Publish failed: " + message, Toast.LENGTH_LONG).show());
      }
    }).start();
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
      MailService.start(requireContext());
      Toast.makeText(requireContext(), "24/7 monitor is on.", Toast.LENGTH_SHORT).show();
      if (prefs.get("batteryAsked").length() == 0) {
        prefs.put("batteryAsked", "1");
        new AlertDialog.Builder(requireContext())
            .setTitle("Keep the monitor alive 24/7")
            .setMessage("Allow Dev Style Studio to ignore battery optimisation, otherwise Android "
                + "stops the inbox monitor in the background.")
            .setPositiveButton("Allow", (dialog, which) -> openBatterySettings())
            .setNegativeButton("Later", null)
            .show();
      }
    }
    refreshMonitorState();
  }

  private void refreshMonitorState() {
    if (prefs.monitor()) {
      monitorState.setText("Monitoring " + (prefs.email().length() > 0 ? prefs.email() : "your inbox")
          + " every minute · auto-reply " + (prefs.autoReply() ? "on" : "off")
          + " · " + (ReplyTemplate.MODE_AI.equals(prefs.get("replyMode")) ? "Gemini" : "template"));
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
    intent.setAction(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS);
    intent.setData(Uri.parse("package:" + pkg));
    try {
      startActivity(intent);
    } catch (Exception e) {
      startActivity(new Intent(Settings.ACTION_SETTINGS));
    }
  }
}