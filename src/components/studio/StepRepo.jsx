import { useEffect, useState } from "react";
import { ArrowRight, Check, CircleAlert, ExternalLink, Search, Trash2 } from "lucide-react";
import { createRepo, deleteRepo, githubIdentity, listBranches, listRepos } from "@/lib/github-fns";
import { useStudio } from "@/components/studio/StudioProvider";
import { logEvent } from "@/lib/activity";
import { slugify } from "@/lib/settings";
import { relativeTime } from "@/lib/format";

export function StepRepo() {
  const { zip, project, repo, setRepo, setStep, setError, error } = useStudio();
  const [me, setMe] = useState(null);
  const [repos, setRepos] = useState([]);
  const [branches, setBranches] = useState([]);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(null);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState(slugify(zip?.file?.name?.replace(/\.zip$/i, "")) || "my-project");
  const [isPrivate, setIsPrivate] = useState(true);
  const [confirmDelete, setConfirmDelete] = useState(null);

  const refresh = async () => {
    setBusy("Loading repositories…");
    try {
      const [identity, list] = await Promise.all([githubIdentity(), listRepos({ data: { page: 1 } })]);
      setMe(identity);
      setRepos(list.repos);
      setError(null);
    } catch (err) {
      setError(err?.message || "Could not reach GitHub.");
    } finally {
      setBusy(null);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  const pick = async (item) => {
    setBusy("Loading branches…");
    try {
      const { branches: list } = await listBranches({ data: { owner: item.owner, repo: item.name } });
      setBranches(list);
      const branch = list.includes(item.default_branch) ? item.default_branch : list[0] || item.default_branch;
      setRepo({
        id: item.id,
        owner: item.owner,
        name: item.name,
        full_name: item.full_name,
        html_url: item.html_url,
        private: item.private,
        default_branch: item.default_branch,
        branch,
        isNew: false,
      });
      setConfirmDelete(null);
    } catch (err) {
      setError(err?.message || "Could not load branches.");
    } finally {
      setBusy(null);
    }
  };

  const handleCreate = async () => {
    setBusy("Creating repository…");
    try {
      const { repo: created } = await createRepo({ data: { name: newName.trim(), isPrivate } });
      setRepos((prev) => [created, ...prev]);
      setCreating(false);
      setRepo({
        id: created.id,
        owner: created.owner,
        name: created.name,
        full_name: created.full_name,
        html_url: created.html_url,
        private: created.private,
        default_branch: created.default_branch,
        branch: created.default_branch || "main",
        isNew: true,
      });
      setBranches([created.default_branch || "main"]);
      logEvent({
        project_name: zip?.file?.name,
        repo_full_name: created.full_name,
        action: "create repo",
        status: "success",
        message: `Repository ${created.full_name} created`,
      });
    } catch (err) {
      setError(err?.message || "Could not create the repository.");
    } finally {
      setBusy(null);
    }
  };

  const handleDelete = async (item) => {
    if (confirmDelete !== item.full_name) {
      setConfirmDelete(item.full_name);
      return;
    }
    setBusy("Deleting repository…");
    try {
      await deleteRepo({ data: { owner: item.owner, repo: item.name, confirm: true } });
      setRepos((prev) => prev.filter((r) => r.id !== item.id));
      if (repo?.id === item.id) setRepo(null);
      setConfirmDelete(null);
      logEvent({
        repo_full_name: item.full_name,
        action: "delete repo",
        status: "success",
        message: `Repository ${item.full_name} deleted`,
      });
    } catch (err) {
      setError(err?.message || "Could not delete the repository.");
    } finally {
      setBusy(null);
    }
  };

  const filtered = repos.filter((r) => r.full_name.toLowerCase().includes(query.toLowerCase()));

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-[26px] font-semibold leading-[1.15] tracking-tight text-studio-ink">
          Select repository
        </h1>
        <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
          {me ? (
            <>
              Connected as <span className="font-medium text-studio-ink">@{me.login}</span>. Pick where this project
              should live.
            </>
          ) : error ? (
            "GitHub is not connected yet — the studio server needs a token before it can list repositories."
          ) : (
            "Checking your GitHub connection…"
          )}
        </p>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-2xl border border-destructive/25 bg-destructive/5 px-4 py-3">
          <CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
          <p className="text-[12.5px] leading-relaxed text-destructive">{error}</p>
        </div>
      )}

      <div className="rounded-2xl border border-border bg-white">
        <div className="flex items-center gap-2 border-b border-border px-3 py-2.5">
          <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search repositories…"
            className="w-full bg-transparent text-[12.5px] text-studio-ink placeholder:text-muted-foreground focus:outline-none"
          />
          <span className="shrink-0 font-mono text-[10px] text-muted-foreground">{filtered.length}</span>
        </div>

        <div className="thin-scroll max-h-[300px] overflow-y-auto">
          {busy && !repos.length ? (
            <p className="px-4 py-8 text-center text-[12px] text-muted-foreground">{busy}</p>
          ) : filtered.length ? (
            filtered.map((item) => {
              const active = repo?.id === item.id;
              return (
                <div key={item.id} className="flex items-center gap-2 border-b border-border/60 px-3 py-2 last:border-0">
                  <button
                    type="button"
                    onClick={() => pick(item)}
                    className="flex min-w-0 flex-1 items-center gap-2 text-left"
                  >
                    <span
                      className={[
                        "grid h-5 w-5 shrink-0 place-items-center rounded-full border transition-colors",
                        active ? "border-studio-ink bg-studio-lime" : "border-border",
                      ].join(" ")}
                    >
                      {active && <Check className="h-3 w-3 text-studio-ink" />}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate font-mono text-[11.5px] text-studio-ink">{item.full_name}</span>
                      <span className="block truncate text-[10px] text-muted-foreground">
                        {item.private ? "private" : "public"} · updated {relativeTime(item.updated_at)}
                      </span>
                    </span>
                  </button>
                  <a
                    href={item.html_url}
                    target="_blank"
                    rel="noreferrer"
                    className="shrink-0 rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-studio-ash hover:text-studio-ink"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                  <button
                    type="button"
                    onClick={() => handleDelete(item)}
                    className={[
                      "shrink-0 rounded-lg p-1.5 transition-colors",
                      confirmDelete === item.full_name
                        ? "bg-destructive/10 text-destructive"
                        : "text-muted-foreground hover:bg-studio-ash hover:text-destructive",
                    ].join(" ")}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              );
            })
          ) : (
            <p className="px-4 py-8 text-center text-[12px] text-muted-foreground">
              {busy ? busy : "No repositories match."}
            </p>
          )}
        </div>

        {confirmDelete && (
          <p className="border-t border-border bg-destructive/5 px-3 py-2 text-[11px] text-destructive">
            Tap delete again to permanently remove <span className="font-mono">{confirmDelete}</span>.
          </p>
        )}
      </div>

      {creating ? (
        <div className="space-y-3 rounded-2xl border border-studio-ink/15 bg-white p-4">
          <p className="font-display text-[13px] font-semibold text-studio-ink">New repository</p>
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="repository-name"
            className="w-full rounded-xl border border-border bg-white px-3 py-2.5 font-mono text-[12px] text-studio-ink focus:border-studio-ink focus:outline-none"
          />
          <label className="flex items-center gap-2 text-[12px] text-studio-ink">
            <input
              type="checkbox"
              checked={isPrivate}
              onChange={(e) => setIsPrivate(e.target.checked)}
              className="h-3.5 w-3.5 accent-studio-ink"
            />
            Private repository
          </label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleCreate}
              disabled={!newName.trim() || Boolean(busy)}
              className="flex-1 rounded-full bg-studio-ink px-4 py-2.5 font-display text-[12.5px] font-semibold text-white disabled:opacity-40"
            >
              Create
            </button>
            <button
              type="button"
              onClick={() => setCreating(false)}
              className="rounded-full border border-border px-4 py-2.5 text-[12.5px] text-muted-foreground"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="w-full rounded-full border border-dashed border-border py-3 font-display text-[12.5px] font-medium text-muted-foreground transition-colors hover:border-studio-ink hover:text-studio-ink"
        >
          + Create repository
        </button>
      )}

      {repo && (
        <div className="rounded-2xl border border-studio-lime/70 bg-studio-lime/15 px-4 py-3">
          <p className="text-[10px] uppercase tracking-[0.16em] text-studio-ink/60">Target</p>
          <div className="mt-1 flex items-center justify-between gap-2">
            <p className="min-w-0 truncate font-mono text-[12px] text-studio-ink">{repo.full_name}</p>
            {branches.length > 0 && (
              <select
                value={repo.branch}
                onChange={(e) => setRepo({ ...repo, branch: e.target.value })}
                className="shrink-0 rounded-lg border border-studio-ink/20 bg-white px-2 py-1 font-mono text-[11px] text-studio-ink focus:outline-none"
              >
                {branches.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>
      )}

      <button
        type="button"
        disabled={!repo}
        onClick={() => setStep(3)}
        className="group inline-flex w-full items-center justify-center gap-2 rounded-full bg-studio-ink px-5 py-3 font-display text-[13px] font-semibold text-white transition-all hover:bg-studio-ink/90 disabled:opacity-40"
      >
        Continue to push
        <ArrowRight className="h-4 w-4 text-studio-lime transition-transform group-hover:translate-x-0.5" />
      </button>
    </div>
  );
}