import { useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, Check, CircleAlert, GitCommitHorizontal, Loader2 } from "lucide-react";
import { commitPush, createBlobs } from "@/lib/github-fns";
import { useStudio } from "@/components/studio/StudioProvider";
import { bytesToBase64 } from "@/lib/settings";
import { formatBytes } from "@/lib/format";
import { logEvent } from "@/lib/activity";

const MAX_FILE_BYTES = 15 * 1024 * 1024;
const BATCH_CHARS = 5_000_000;

export function StepPush() {
  const { project, zip, repo, setStep, push, setPush, setError } = useStudio();
  const [error, setLocalError] = useState(null);

  const plan = useMemo(() => {
    if (!zip?.parsed) return { total: 0, bytes: 0, oversized: [] };
    const entries = zip.parsed.entries;
    const oversized = entries.filter((e) => (e.uncompressedSize || 0) > MAX_FILE_BYTES);
    const included = entries.filter((e) => (e.uncompressedSize || 0) <= MAX_FILE_BYTES);
    const bytes = included.reduce((sum, e) => sum + (e.uncompressedSize || 0), 0);
    return { total: included.length, bytes, oversized };
  }, [zip]);

  const start = async () => {
    if (!zip?.parsed || !repo) return;
    setLocalError(null);
    const entries = zip.parsed.entries.filter((e) => (e.uncompressedSize || 0) <= MAX_FILE_BYTES);

    const batches = [];
    let current = [];
    let size = 0;
    for (const entry of entries) {
      const estimate = Math.ceil((entry.uncompressedSize || 0) * 1.4);
      if (current.length && (size + estimate > BATCH_CHARS || current.length >= 6)) {
        batches.push(current);
        current = [];
        size = 0;
      }
      current.push(entry);
      size += estimate;
    }
    if (current.length) batches.push(current);

    setPush({ status: "running", done: 0, total: entries.length, skipped: plan.oversized, batches: batches.length });
    try {
      const shas = [];
      let done = 0;
      for (const batch of batches) {
        const files = [];
        for (const entry of batch) {
          const bytes = await zip.parsed.readEntry(entry);
          files.push({ path: entry.path, content: bytesToBase64(bytes) });
        }
        const result = await createBlobs({ data: { owner: repo.owner, repo: repo.name, files } });
        shas.push(...result.files);
        done += batch.length;
        setPush({ status: "running", done, total: entries.length, skipped: plan.oversized, batches: batches.length });
      }

      const commit = await commitPush({
        data: {
          owner: repo.owner,
          repo: repo.name,
          branch: repo.branch,
          message: `chore: upload ${zip.file.name} via Dev Style Studio`,
          entries: shas,
        },
      });

      setPush({
        status: "done",
        done: entries.length,
        total: entries.length,
        skipped: plan.oversized,
        commit,
      });
      logEvent({
        project_name: zip.file.name,
        repo_full_name: repo.full_name,
        action: "push",
        status: "success",
        message: `Pushed ${entries.length} files to ${commit.branch} (${commit.commit.slice(0, 7)})`,
      });
    } catch (err) {
      const message = err?.message || "The push failed.";
      setLocalError(message);
      setPush({ status: "error", done: 0, total: entries.length, skipped: plan.oversized });
      logEvent({
        project_name: zip?.file?.name,
        repo_full_name: repo?.full_name,
        action: "push",
        status: "error",
        message,
      });
    }
  };

  const percent = push?.total ? Math.round((push.done / push.total) * 100) : 0;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-[26px] font-semibold leading-[1.15] tracking-tight text-studio-ink">
          Push to GitHub
        </h1>
        <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
          Files are uploaded one commit at a time. Progress below counts files GitHub has actually accepted.
        </p>
      </div>

      <div className="rounded-2xl border border-border bg-white p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Repository</p>
            <p className="mt-1 truncate font-mono text-[12.5px] text-studio-ink">{repo?.full_name}</p>
          </div>
          <span className="shrink-0 rounded-full bg-studio-ash px-2.5 py-1 font-mono text-[10.5px] text-studio-ink">
            {repo?.branch}
          </span>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3 border-t border-border pt-3">
          <div>
            <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Files</p>
            <p className="mt-0.5 font-display text-[15px] font-semibold tabular-nums text-studio-ink">
              {plan.total.toLocaleString("en-US")}
            </p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Size</p>
            <p className="mt-0.5 font-display text-[15px] font-semibold tabular-nums text-studio-ink">
              {formatBytes(plan.bytes)}
            </p>
          </div>
        </div>
      </div>

      {push?.status === "running" && (
        <div className="rounded-2xl border border-border bg-white p-4">
          <div className="flex items-center justify-between text-[11.5px]">
            <span className="flex items-center gap-1.5 text-studio-ink">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Uploading
            </span>
            <span className="font-mono tabular-nums text-muted-foreground">
              {push.done} / {push.total} files · {percent}%
            </span>
          </div>
          <div className="mt-2.5 h-2 overflow-hidden rounded-full bg-border">
            <div
              className="h-full rounded-full bg-studio-lime transition-all duration-300"
              style={{ width: `${Math.max(3, percent)}%` }}
            />
          </div>
        </div>
      )}

      {push?.status === "done" && (
        <a
          href={push.commit.html_url}
          target="_blank"
          rel="noreferrer"
          className="flex items-start gap-2.5 rounded-2xl border border-studio-lime bg-studio-lime/20 px-4 py-3"
        >
          <Check className="mt-0.5 h-4 w-4 shrink-0 text-studio-ink" />
          <div className="min-w-0">
            <p className="font-display text-[12.5px] font-semibold text-studio-ink">
              Pushed {push.total} files to {push.commit.branch}
            </p>
            <p className="mt-0.5 flex items-center gap-1 font-mono text-[10.5px] text-studio-ink/70">
              <GitCommitHorizontal className="h-3 w-3" />
              {push.commit.commit.slice(0, 7)} · view commit
            </p>
          </div>
        </a>
      )}

      {(error || push?.status === "error") && (
        <div className="flex items-start gap-2.5 rounded-2xl border border-destructive/25 bg-destructive/5 px-4 py-3">
          <CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
          <p className="min-w-0 break-words text-[12.5px] leading-relaxed text-destructive">{error}</p>
        </div>
      )}

      {plan.oversized.length > 0 && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
          <p className="text-[12px] font-medium text-amber-900">
            {plan.oversized.length} file{plan.oversized.length > 1 ? "s" : ""} will be skipped
          </p>
          <p className="mt-1 text-[11.5px] leading-relaxed text-amber-900/80">
            Files over {formatBytes(MAX_FILE_BYTES)} can't be sent through the GitHub file API. Skipped files means
            the push is incomplete — they are listed below.
          </p>
          <ul className="mt-1.5 space-y-0.5">
            {plan.oversized.slice(0, 5).map((f) => (
              <li key={f.path} className="truncate font-mono text-[10.5px] text-amber-900/70">
                {f.path} · {formatBytes(f.uncompressedSize)}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setStep(2)}
          className="inline-flex items-center gap-1.5 rounded-full border border-border px-4 py-3 font-display text-[12.5px] font-medium text-muted-foreground hover:border-studio-ink hover:text-studio-ink"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back
        </button>
        {push?.status === "done" ? (
          <button
            type="button"
            onClick={() => setStep(4)}
            className="group inline-flex flex-1 items-center justify-center gap-2 rounded-full bg-studio-ink px-5 py-3 font-display text-[13px] font-semibold text-white"
          >
            Continue
            <ArrowRight className="h-4 w-4 text-studio-lime transition-transform group-hover:translate-x-0.5" />
          </button>
        ) : (
          <button
            type="button"
            onClick={start}
            disabled={push?.status === "running" || !project}
            className="flex-1 rounded-full bg-studio-ink px-5 py-3 font-display text-[13px] font-semibold text-white disabled:opacity-40"
          >
            {push?.status === "running" ? "Pushing…" : push?.status === "error" ? "Retry push" : "Push project"}
          </button>
        )}
      </div>
    </div>
  );
}