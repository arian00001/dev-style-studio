package com.devstyle.studio;

import android.view.Gravity;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.TextView;

import androidx.annotation.NonNull;
import androidx.recyclerview.widget.RecyclerView;

import java.util.ArrayList;
import java.util.List;

/** Chat bubbles for the AI assistant screen. */
public class ChatAdapter extends RecyclerView.Adapter<ChatAdapter.Holder> {

  public static class ChatMessage {
    final String text;
    final boolean fromUser;

    ChatMessage(String text, boolean fromUser) {
      this.text = text;
      this.fromUser = fromUser;
    }
  }

  private final List<ChatMessage> messages = new ArrayList<>();

  public void add(String text, boolean fromUser) {
    messages.add(new ChatMessage(text, fromUser));
    notifyItemInserted(messages.size() - 1);
  }

  @NonNull
  @Override
  public Holder onCreateViewHolder(@NonNull ViewGroup parent, int viewType) {
    View view = LayoutInflater.from(parent.getContext()).inflate(R.layout.item_chat, parent, false);
    return new Holder(view);
  }

  @Override
  public void onBindViewHolder(@NonNull Holder holder, int position) {
    ChatMessage message = messages.get(position);
    holder.bubble.setText(message.text);
    holder.bubble.setBackgroundResource(
        message.fromUser ? R.drawable.bg_chat_user : R.drawable.bg_chat_ai);
    holder.bubble.setGravity(message.fromUser ? Gravity.END : Gravity.START);
    ViewGroup.MarginLayoutParams params =
        (ViewGroup.MarginLayoutParams) holder.bubble.getLayoutParams();
    params.gravity = message.fromUser ? Gravity.END : Gravity.START;
    holder.bubble.setLayoutParams(params);
    holder.bubble.setTextColor(holder.bubble.getContext()
        .getColor(message.fromUser ? R.color.ink : R.color.ink));
  }

  @Override
  public int getItemCount() {
    return messages.size();
  }

  static class Holder extends RecyclerView.ViewHolder {
    final TextView bubble;

    Holder(View view) {
      super(view);
      bubble = view.findViewById(R.id.chatBubble);
    }
  }
}