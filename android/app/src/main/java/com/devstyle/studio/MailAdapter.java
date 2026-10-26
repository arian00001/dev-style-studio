package com.devstyle.studio;

import android.text.format.DateFormat;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.TextView;

import androidx.annotation.NonNull;
import androidx.recyclerview.widget.RecyclerView;

import java.util.ArrayList;
import java.util.List;

/** Inbox rows. */
public class MailAdapter extends RecyclerView.Adapter<MailAdapter.Holder> {

  public interface Listener {
    void onOpen(MailStore.Mail mail);
  }

  private final List<MailStore.Mail> mails = new ArrayList<>();
  private final Listener listener;

  public MailAdapter(Listener listener) {
    this.listener = listener;
  }

  public void submit(List<MailStore.Mail> next) {
    mails.clear();
    mails.addAll(next);
    notifyDataSetChanged();
  }

  @NonNull
  @Override
  public Holder onCreateViewHolder(@NonNull ViewGroup parent, int viewType) {
    View view = LayoutInflater.from(parent.getContext()).inflate(R.layout.item_mail, parent, false);
    return new Holder(view);
  }

  @Override
  public void onBindViewHolder(@NonNull Holder holder, int position) {
    MailStore.Mail mail = mails.get(position);
    holder.sender.setText(mail.from);
    holder.subject.setText(mail.subject == null || mail.subject.isEmpty() ? "(no subject)" : mail.subject);
    String snippet = mail.body == null ? "" : mail.body.replace('\n', ' ').trim();
    if (snippet.length() > 110) snippet = snippet.substring(0, 110) + "…";
    holder.snippet.setText(snippet);
    holder.time.setText(DateFormat.format("dd MMM · HH:mm", mail.time));
    holder.state.setText(mail.replied ? "auto-replied" : "waiting");
    holder.card.setOnClickListener(v -> listener.onOpen(mail));
  }

  @Override
  public int getItemCount() {
    return mails.size();
  }

  static class Holder extends RecyclerView.ViewHolder {
    final View card;
    final TextView sender;
    final TextView subject;
    final TextView snippet;
    final TextView time;
    final TextView state;

    Holder(View view) {
      super(view);
      card = view.findViewById(R.id.mailCard);
      sender = view.findViewById(R.id.mailSender);
      subject = view.findViewById(R.id.mailSubject);
      snippet = view.findViewById(R.id.mailSnippet);
      time = view.findViewById(R.id.mailTime);
      state = view.findViewById(R.id.mailState);
    }
  }
}