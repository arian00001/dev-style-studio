package com.devstyle.studio;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.os.Build;
import android.os.Bundle;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.TextView;
import android.widget.Toast;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.appcompat.app.AlertDialog;
import androidx.core.content.ContextCompat;
import androidx.fragment.app.Fragment;
import androidx.recyclerview.widget.LinearLayoutManager;
import androidx.recyclerview.widget.RecyclerView;

import java.util.List;

/** Every mirrored email, newest first. */
public class InboxFragment extends Fragment implements MailAdapter.Listener {

  private MailStore store;
  private MailAdapter adapter;
  private TextView status;
  private TextView refresh;

  private final BroadcastReceiver mailReceiver = new BroadcastReceiver() {
    @Override
    public void onReceive(Context context, Intent intent) {
      if (isAdded()) load();
    }
  };

  @Nullable
  @Override
  public View onCreateView(@NonNull LayoutInflater inflater, @Nullable ViewGroup container,
                           @Nullable Bundle state) {
    return inflater.inflate(R.layout.fragment_inbox, container, false);
  }

  @Override
  public void onViewCreated(@NonNull View view, @Nullable Bundle state) {
    store = new MailStore(requireContext());
    status = view.findViewById(R.id.inboxStatus);
    refresh = view.findViewById(R.id.inboxRefresh);

    RecyclerView list = view.findViewById(R.id.mailList);
    list.setLayoutManager(new LinearLayoutManager(requireContext()));
    adapter = new MailAdapter(this);
    list.setAdapter(adapter);

    refresh.setOnClickListener(v -> sync());
  }

  private void sync() {
    Prefs prefs = new Prefs(requireContext());
    if (!prefs.hasMail()) {
      status.setText("Add your email and 16-character app password in Settings first.");
      Toast.makeText(requireContext(), "No mailbox saved yet.", Toast.LENGTH_SHORT).show();
      return;
    }
    prefs.putBool("monitor", true);
    MailService.start(requireContext());
    status.setText("Syncing your inbox now…");
    Toast.makeText(requireContext(), "Syncing now…", Toast.LENGTH_SHORT).show();
  }

  @Override
  public void onResume() {
    super.onResume();
    IntentFilter filter = new IntentFilter(MailService.ACTION_MAIL);
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
      requireContext().registerReceiver(mailReceiver, filter, Context.RECEIVER_NOT_EXPORTED);
    } else {
      requireContext().registerReceiver(mailReceiver, filter);
    }
    load();
  }

  @Override
  public void onPause() {
    try {
      requireContext().unregisterReceiver(mailReceiver);
    } catch (Exception ignored) {
      // receiver was never registered
    }
    super.onPause();
  }

  private void load() {
    Prefs prefs = new Prefs(requireContext());
    List<MailStore.Mail> mails = store.list(1000);
    adapter.submit(mails);

    if (!prefs.hasMail()) {
      status.setText("Add your email and 16-character app password in Settings to start the 24/7 monitor.");
    } else if (prefs.monitor()) {
      status.setText(mails.size() + " emails mirrored · monitoring on 24/7 · auto-reply "
          + (prefs.autoReply() ? "on" : "off"));
    } else {
      status.setText(mails.size() + " emails mirrored · monitor is paused. Turn it on in Settings.");
    }
  }

  @Override
  public void onOpen(MailStore.Mail mail) {
    new AlertDialog.Builder(requireContext())
        .setTitle(mail.subject)
        .setMessage("From: " + mail.from + "\n\n" + mail.body)
        .setPositiveButton("Close", null)
        .show();
  }
}