import { useState } from "react";
import { Check, CircleAlert, Loader2, Sparkles, Wand2 } from "lucide-react";
import { commitPush, createBlobs, getFileContent } from "@/lib/github-fns";
import { diagnoseBuild } from "@/lib/ai-fns";
import { textToBase64 } from "@/lib/settings";

function candidateFiles(log, paths) {
  const scored = paths.map((path) => {
    let score = 0;
    if (log.includes(path)) score += 3;
    const base = path.split("/").pop();
    if (base && base.length > 3 && log.includes(base)) score += 1;
    return { path, score };
  });
  return scored
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((item) => item.path);
}

export function AiFixPanel({ log, paths, repo, attempt, limit, onApplied }) {
  const [state, setState] = useState({ status: "idle" });
  const [approved, setApproved] = useState(false);

  const analyze = async () => {
    setState({ status: "analyzing" });
    try {
      const candidates = candidateFiles(log, paths).slice(0, 5);
      const files = [];
      for (const path of candidates) {
        try {
          const res = await getFileContent({
            data: { owner: repo.owner, repo: repo.name, path, ref: repo.branch },
          });
          files.push(res);
        } catch {
          // A file that cannot be read is simply left out of the analysis.
        }
      }
      const result = await diagnoseBuild({
        data: {
          logs: log,
          projectType: "android",
          attempt,
          files,
          tree: paths,
        },
      });
      setState({ status: "ready", result, files });
      setApproved(result.patches.length <= 3);
    } catch (err) {
      setState({ status: "error", message: err?.message || "Gemini could not analyse this build." });
    }
  };

  const apply = async () => {
    setState((prev) => ({ ...prev, status: "applying" }));
    try {
      const patches = state.result.patches;
      const created = await createBlobs({
        data: {
          owner: repo.owner,
          repo: repo.name,
          files: patches.map((patch) => ({ path: patch.path, content: textToBase64(patch.content) })),
        },
      });
      const commit = await commitPush({
        data: {
          owner: repo.owner,
          repo: repo.name,
          branch: repo.branch,
          message: `fix: AI patch for failed build (attempt ${attempt})`,
          entries: created.files,
        },
      });
      setState({ status: "applied", commit });
      onApplied(commit);
    } catch (err) {
      setState({ status: "error", message: err?.message || "The patch could not be committed." });
    }
  };

  const exhausted = attempt >= limit;
  const broad = state.status === "ready" && state.result.patches.length > 3;

  return (
    <div className="rounded-2xl border border-studio-ink/15 bg-white p-4">
      <div className="flex items-start gap-2.5">
        <div className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-studio-ink">
          <Sparkles className="h-4 w-4 text-studio-lime" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-display text-[13px] font-semibold text-studio-ink">Fix with AI</p>
          <p className="mt-0.5 text-[11.5px] leading-relaxed text-muted-foreground">
            Gemini reads the real build log, proposes a minimal patch, and the build is retried only after the change
            is committed. Attempt {attempt} of {limit}.
          </p>
        </div>
      </div>

      {state.status === "idle" && (
        <button
          type="button"
          onClick={analyze}
          disabled={exhausted}
          className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-full bg-studio-ink px-4 py-2.5 font-display text-[12.5px] font-semibold text-white disabled:opacity-40"
        >
          <Wand2 className="h-3.5 w-3.5 text-studio-lime" />
          {exhausted ? "Retry limit reached" : "Analyse build log"}
        </button>
      )}

      {state.status === "analyzing" && (
        <p className="mt-3 flex items-center gap-2 text-[12px] text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Reading logs and drafting a patch…
        </p>
      )}

      {state.status === "error" && (
        <div className="mt-3 flex items-start gap-2 rounded-xl border border-destructive/25 bg-destructive/5 px-3 py-2">
          <CircleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-destructive" />
          <p className="break-words text-[11.5px] leading-relaxed text-destructive">{state.message}</p>
        </div>
      )}

      {state.status === "ready" && (
        <div className="mt-3 space-y-2.5">
          <div className="rounded-xl bg-studio-ash px-3 py-2.5">
            <p className="text-[11.5px] font-medium text-studio-ink">{state.result.summary}</p>
            {state.result.root_cause && (
              <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{state.result.root_cause}</p>
            )}
          </div>

          {state.result.patches.length ? (
            <ul className="space-y-1.5">
              {state.result.patches.map((patch) => (
                <li key={patch.path} className="rounded-xl border border-border px-3 py-2">
                  <p className="truncate font-mono text-[11px] text-studio-ink">{patch.path}</p>
                  <p className="mt-0.5 text-[10.5px] leading-relaxed text-muted-foreground">{patch.reason}</p>
                  <pre className="thin-scroll mt-1.5 max-h-24 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-studio-ink px-2 py-1.5 font-mono text-[9.5px] leading-relaxed text-white/70">
                    {patch.content.slice(0, 900)}
                  </pre>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[11.5px] text-muted-foreground">
              The log did not contain enough information to propose a safe patch.
            </p>
          )}

          {broad && (
            <label className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] leading-relaxed text-amber-900">
              <input
                type="checkbox"
                checked={approved}
                onChange={(e) => setApproved(e.target.checked)}
                className="mt-0.5 h-3.5 w-3.5 accent-studio-ink"
              />
              This patch touches {state.result.patches.length} files — approve applying it.
            </label>
          )}

          <button
            type="button"
            onClick={apply}
            disabled={!approved || !state.result.patches.length || exhausted}
            className="w-full rounded-full bg-studio-ink px-4 py-2.5 font-display text-[12.5px] font-semibold text-white disabled:opacity-40"
          >
            Apply patch & rebuild
          </button>
        </div>
      )}

      {state.status === "applying" && (
        <p className="mt-3 flex items-center gap-2 text-[12px] text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Committing the patch…
        </p>
      )}

      {state.status === "applied" && (
        <p className="mt-3 flex items-center gap-1.5 text-[12px] text-studio-ink">
          <Check className="h-3.5 w-3.5" />
          Patch committed — restarting the build.
        </p>
      )}
    </div>
  );
}