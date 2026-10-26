package com.devstyle.studio;

import android.graphics.Typeface;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.TextView;

import androidx.annotation.NonNull;
import androidx.recyclerview.widget.RecyclerView;

import java.util.ArrayList;
import java.util.List;

/** Repository list with build / deploy / edit / delete actions on every row. */
public class RepoAdapter extends RecyclerView.Adapter<RepoAdapter.Holder> {

  public interface Listener {
    void onBuild(Repo repo);

    void onDeploy(Repo repo);

    void onEdit(Repo repo);

    void onDelete(Repo repo);

    void onSelect(Repo repo);
  }

  private final List<Repo> repos = new ArrayList<>();
  private final Listener listener;
  private String selected = "";

  public RepoAdapter(Listener listener) {
    this.listener = listener;
  }

  public void submit(List<Repo> next, String selectedFullName) {
    repos.clear();
    repos.addAll(next);
    selected = selectedFullName == null ? "" : selectedFullName;
    notifyDataSetChanged();
  }

  public void setSelected(String fullName) {
    selected = fullName == null ? "" : fullName;
    notifyDataSetChanged();
  }

  public List<Repo> items() {
    return repos;
  }

  @NonNull
  @Override
  public Holder onCreateViewHolder(@NonNull ViewGroup parent, int viewType) {
    View view = LayoutInflater.from(parent.getContext()).inflate(R.layout.item_repo, parent, false);
    return new Holder(view);
  }

  @Override
  public void onBindViewHolder(@NonNull Holder holder, int position) {
    Repo repo = repos.get(position);
    boolean isSelected = repo.fullName().equals(selected);
    holder.name.setText(repo.name);
    holder.name.setTypeface(null, Typeface.BOLD);
    holder.meta.setText(repo.owner + "  ·  " + repo.branch + (repo.isPrivate ? "  ·  private" : ""));
    holder.badge.setText(isSelected ? "selected" : repo.isPrivate ? "private" : "public");
    holder.badge.setBackgroundResource(isSelected ? R.drawable.bg_pill_active : R.drawable.bg_pill);
    holder.card.setBackgroundResource(isSelected ? R.drawable.bg_card_active : R.drawable.bg_card);

    holder.card.setOnClickListener(v -> listener.onSelect(repo));
    holder.build.setOnClickListener(v -> listener.onBuild(repo));
    holder.deploy.setOnClickListener(v -> listener.onDeploy(repo));
    holder.edit.setOnClickListener(v -> listener.onEdit(repo));
    holder.delete.setOnClickListener(v -> listener.onDelete(repo));
  }

  @Override
  public int getItemCount() {
    return repos.size();
  }

  static class Holder extends RecyclerView.ViewHolder {
    final View card;
    final TextView name;
    final TextView meta;
    final TextView badge;
    final TextView build;
    final TextView deploy;
    final TextView edit;
    final TextView delete;

    Holder(View view) {
      super(view);
      card = view.findViewById(R.id.repoCard);
      name = view.findViewById(R.id.repoName);
      meta = view.findViewById(R.id.repoMeta);
      badge = view.findViewById(R.id.repoBadge);
      build = view.findViewById(R.id.repoBuild);
      deploy = view.findViewById(R.id.repoDeploy);
      edit = view.findViewById(R.id.repoEdit);
      delete = view.findViewById(R.id.repoDelete);
    }
  }
}