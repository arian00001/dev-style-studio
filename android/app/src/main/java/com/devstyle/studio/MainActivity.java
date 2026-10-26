package com.devstyle.studio;

import android.Manifest;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Bundle;

import androidx.annotation.NonNull;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import androidx.fragment.app.Fragment;

import com.google.android.material.bottomnavigation.BottomNavigationView;

/** Four tabs: home, inbox, AI chat, settings. */
public class MainActivity extends AppCompatActivity {

  private static final int NOTIFICATIONS = 7;

  @Override
  protected void onCreate(Bundle state) {
    super.onCreate(state);
    setContentView(R.layout.activity_main);
    askNotifications();

    BottomNavigationView nav = findViewById(R.id.bottomNav);
    nav.setOnItemSelectedListener(item -> {
      show(item.getItemId());
      return true;
    });

    if (state == null) {
      nav.setSelectedItemId(R.id.tab_home);
    }

    Prefs prefs = new Prefs(this);
    if (prefs.monitor() && prefs.hasMail()) {
      ContextCompat.startForegroundService(this, new Intent(this, MailService.class));
    }
  }

  public void openTab(int tabId) {
    BottomNavigationView nav = findViewById(R.id.bottomNav);
    nav.setSelectedItemId(tabId);
  }

  private void show(int tabId) {
    Fragment fragment;
    if (tabId == R.id.tab_inbox) {
      fragment = new InboxFragment();
    } else if (tabId == R.id.tab_chat) {
      fragment = new ChatFragment();
    } else if (tabId == R.id.tab_settings) {
      fragment = new SettingsFragment();
    } else {
      fragment = new HomeFragment();
    }
    getSupportFragmentManager().beginTransaction().replace(R.id.container, fragment).commit();
  }

  private void askNotifications() {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU
        && ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS)
        != PackageManager.PERMISSION_GRANTED) {
      ActivityCompat.requestPermissions(this,
          new String[]{Manifest.permission.POST_NOTIFICATIONS}, NOTIFICATIONS);
    }
  }

  @Override
  public void onRequestPermissionsResult(int code, @NonNull String[] permissions, @NonNull int[] results) {
    super.onRequestPermissionsResult(code, permissions, results);
    // The monitor keeps running either way; only the ticker notification needs this.
  }
}