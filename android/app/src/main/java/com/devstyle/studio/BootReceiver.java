package com.devstyle.studio;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

import androidx.core.content.ContextCompat;

/** Restarts the 24/7 monitor after the phone reboots. */
public class BootReceiver extends BroadcastReceiver {

  @Override
  public void onReceive(Context context, Intent intent) {
    Prefs prefs = new Prefs(context);
    if (prefs.monitor() && prefs.hasMail()) {
      ContextCompat.startForegroundService(context, new Intent(context, MailService.class));
    }
  }
}