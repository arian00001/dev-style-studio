package com.devstyle.studio;

import android.content.Context;
import android.content.SharedPreferences;

/** Single place for every saved key so the screens stay simple. */
public class Prefs {

  private static final String NAME = "studio";

  private final SharedPreferences prefs;

  public Prefs(Context context) {
    prefs = context.getSharedPreferences(NAME, Context.MODE_PRIVATE);
  }

  public String github() {
    return prefs.getString("github", "");
  }

  public String vercel() {
    return prefs.getString("vercel", "");
  }

  public String gemini() {
    return prefs.getString("gemini", "");
  }

  public String email() {
    return prefs.getString("email", "");
  }

  public String appPassword() {
    return prefs.getString("appPassword", "");
  }

  public String template() {
    return prefs.getString("template", "");
  }

  public boolean autoReply() {
    return prefs.getBoolean("autoReply", true);
  }

  public boolean monitor() {
    return prefs.getBoolean("monitor", false);
  }

  public String selectedRepo() {
    return prefs.getString("selected", "");
  }

  public void put(String key, String value) {
    prefs.edit().putString(key, value).apply();
  }

  public void putBool(String key, boolean value) {
    prefs.edit().putBoolean(key, value).apply();
  }

  public boolean hasGithub() {
    return github().trim().length() > 0;
  }

  public boolean hasMail() {
    return email().trim().length() > 0 && appPassword().trim().length() > 0;
  }
}