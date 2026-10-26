package com.devstyle.studio;

import android.content.Intent;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.View;
import android.view.animation.OvershootInterpolator;
import android.widget.TextView;

import androidx.appcompat.app.AppCompatActivity;

/** Animated splash: the mark scales in, the wordmark slides up, then the studio opens. */
public class SplashActivity extends AppCompatActivity {

  @Override
  protected void onCreate(Bundle state) {
    super.onCreate(state);
    setContentView(R.layout.activity_splash);

    View mark = findViewById(R.id.splashMark);
    TextView title = findViewById(R.id.splashTitle);
    TextView subtitle = findViewById(R.id.splashSubtitle);
    View bar = findViewById(R.id.splashBar);

    mark.setAlpha(0f);
    mark.setScaleX(0.55f);
    mark.setScaleY(0.55f);
    mark.animate().alpha(1f).scaleX(1f).scaleY(1f).setDuration(620)
        .setInterpolator(new OvershootInterpolator(1.1f)).start();

    title.setAlpha(0f);
    title.setTranslationY(18f);
    title.animate().alpha(1f).translationY(0f).setStartDelay(220).setDuration(520).start();

    subtitle.setAlpha(0f);
    subtitle.setTranslationY(14f);
    subtitle.animate().alpha(1f).translationY(0f).setStartDelay(380).setDuration(520).start();

    bar.setAlpha(0f);
    bar.animate().alpha(1f).setStartDelay(520).setDuration(400).start();

    new Handler(Looper.getMainLooper()).postDelayed(() -> {
      startActivity(new Intent(SplashActivity.this, MainActivity.class));
      overridePendingTransition(android.R.anim.fade_in, android.R.anim.fade_out);
      finish();
    }, 1500);
  }
}