import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  CircleAlert,
  ExternalLink,
  Loader2,
  Play,
  RefreshCw,
  Timer,
  Workflow,
} from "lucide-react";
import {
  commitPush,
  createBlobs,
  dispatchWorkflow,
  jobLog,
  listRuns,
  listWorkflows,
  runDetail,
} from "@/lib/github-fns";
import { useStudio } from "@/components/studio/StudioProvider";
import { AiFixPanel } from "@/components/studio/AiFixPanel";
import { LogTerminal } from "@/components/studio/LogTerminal";
import { androidWorkflowTemplate, loadSettings, textToBase64 } from "@/lib/settings";
import { formatDuration } from "@/lib/format";
import { logEvent } from "@/lib/activity";

const STATE_COPY = {
  idle: "Not started",
  starting: "Triggering workflow",
  waiting: "Waiting for the runner",
  running: "Building",
  success: "Build succeeded",
  failed: "Build failed",
  error: "Build error",
};

export function StepBuild() {
  const { project, zip, repo, build, setBuild, setStep, setError } = useStudio();
  const settings = useRef(loadSettings()).current;
  const [workflows, setWorkflows] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [status, setStatus] = useState("idle");
  const [run, setRun] = useState(null);
  const [artifacts, setArtifacts] = useState([]);
  const [log, setLog] = useState("");
  const [attempt, setAttempt] = useState(1);
  const [message, setMessage] = useState(null);
  const [watching, setWatching] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const known = useRef(new Set());

  const owner = repo?.owner;
  const name = repo?.name;
  const branch = repo?.branch;

  const loadWorkflows = async () => {
    try {
      const [remote, runs] = await Promise.all([
        listWorkflows({ data: { owner, repo: name } }),
        listRuns({ data: { owner, repo: name, branch } }),
      ]);
      setWorkflows(remote.workflows);
      runs.runs.forEach((r) => known.current.add(r.id));
      const preferred = project.info.workflows[0]?.split("/").pop();
      const match = remote.workflows.find((w) => w.path.endsWith(preferred || "___"));
      const first = match || remote.workflows[0];
      setSelectedId((prev) => prev ?? first?.id ?? null);
    } catch (err) {
      setError(err?.message || "Could not read workflows.");
    }
  };

  useEffect(() => {
    loadWorkflows();
  }, [repo?.full_name]);

  useEffect(() => {
    if (!watching) return undefined;
    let cancelled = false;
    const tick = async () => {
      try {
        const { runs } = await listRuns({ data: { owner, repo: name, branch } });
        const fresh = runs.find((r) => !known.current.has(r.id));
        const target = fresh || runs[0];
        if (!target) return;
        if (fresh) known.current.add(fresh.id);
        const detail = await runDetail({ data: { owner, repo: name, runId: target.id } });
        if (cancelled) return;
        setRun(detail.run);
        setArtifacts(detail.artifacts);
        if (detail.run.status === "queued") setStatus("waiting");
        else if (detail.run.status === "in_progress") setStatus("running");
        if (detail.run.status === "completed") {
          setWatching(false);
          if (detail.run.conclusion === "success") {
            setStatus("success");
            setBuild({ status: "success", run: detail.run, artifacts: detail.artifacts });
            logEvent({
              project_name: zip?.file?.name,
              repo_full_name: repo?.full_name,
              action: "build",
              status: "success",
              message: `Workflow run #${detail.run.id} succeeded`,
            });
          } else {
            setStatus("failed");
            setMessage(
              detail.run.conclusion === "cancelled"
                ? "This run was cancelled on GitHub."
                : "The build finished with errors.",
            );
            logEvent({
              project_name: zip?.file?.name,
              repo_full_name: repo?.full_name,
              action: "build",
              status: "error",
              message: `Workflow run #${detail.run.id} ${detail.run.conclusion}`,
            });
            await loadFailureLogs(detail.jobs);
          }
        }
      } catch (err) {
        if (!cancelled) {
          setStatus("error");
          setMessage(err?.message || "Lost contact with GitHub Actions.");
          setWatching(false);
        }
      }
    };
    tick();
    const timer = setInterval(tick, 6000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [watching]);

  useEffect(() => {
    if (!["waiting", "running", "starting"].includes(status) || !run?.started_at) return undefined;
    const started = new Date(run.started_at).getTime();
    const timer = setInterval(() => setElapsed(Date.now() - started), 1000);
    return () => clearInterval(timer);
  }, [status, run?.started_at]);

  const loadFailureLogs = async (jobs) => {
    const failed = jobs.filter((job) => job.conclusion === "failure");
    const targets = (failed.length ? failed : jobs).slice(0, 2);
    let text = "";
    for (const job of targets) {
      try {
        const res = await jobLog({ data: { owner, repo: name, jobId: job.id } });
        text += `\n=== ${job.name} ===\n${res.log}`;
      } catch (err) {
        text += `\n=== ${job.name} ===\n${err?.message || "Log unavailable"}`;
      }
    }
    setLog(text.slice(-40000) || "No log output was published for this run.");
  };

  const addWorkflow = async () => {
    setStatus("starting");
    setMessage(null);
    try {
      const generated = await createBlobs({
        data: {
          owner,
          repo: name,
          files: [
            {
              path: ".github/workflows/android-build.yml",
              content: textToBase64(androidWorkflowTemplate(settings.gradleTask)),
            },
          ],
        },
      });
      await commitPush({
        data: {
          owner,
          repo: name,
          branch,
          message: "ci: add Android build workflow",
          entries: generated.files,
        },
      });
      await new Promise((resolve) => setTimeout(resolve, 2500));
      await loadWorkflows();
      setStatus("idle");
      setMessage("Workflow added. Start the build to run it.");
    } catch (err) {
      setStatus("error");
      setMessage(err?.message || "Could not add the workflow.");
    }
  };

  const startBuild = async () => {
    if (!selectedId) return;
    setStatus("starting");
    setMessage(null);
    setLog("");
    setRun(null);
    try {
      await dispatchWorkflow({ data: { owner, repo: name, workflowId: selectedId, ref: branch } });
      setWatching(true);
      setStatus("waiting");
    } catch (err) {
      setStatus("error");
      setMessage(
        err?.message ||
          "GitHub refused to start this workflow. It needs an `on: workflow_dispatch` trigger — add the build workflow instead.",
      );
    }
  };

  const busy = ["starting", "waiting", "running"].includes(status);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-[26px] font-semibold leading-[1.15] tracking-tight text-studio-ink">
          Build & monitor
        </h1>
        <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
          The build runs on GitHub Actions. Status, timing and logs below come straight from the run itself.
        </p>
      </div>

      {!workflows.length ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3.5">
          <p className="text-[12.5px] font-medium text-amber-900">No build workflow found</p>
          <p className="mt-1 text-[11.5px] leading-relaxed text-amber-900/80">
            Gradle is present in this project, but the repository has no workflow. Add one that builds the APK and
            uploads it as an artifact.
          </p>
          <button
            type="button"
            onClick={addWorkflow}
            disabled={busy}
            className="mt-3 w-full rounded-full bg-studio-ink px-4 py-2.5 font-display text-[12.5px] font-semibold text-white disabled:opacity-40"
          >
            Add Android build workflow
          </button>
        </div>
      ) : (
        <div className="rounded-2xl border border-border bg-white p-4">
          <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Workflow</p>
          <div className="mt-1.5 flex items-center gap-2">
            <Workflow className="h-4 w-4 shrink-0 text-studio-ink" />
            <select
              value={selectedId ?? ""}
              onChange={(e) => setSelectedId(Number(e.target.value))}
              disabled={busy}
              className="min-w-0 flex-1 rounded-lg border border-border bg-white px-2 py-1.5 font-mono text-[11.5px] text-studio-ink focus:outline-none"
            >
              {workflows.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name} · {w.path.split("/").pop()}
                </option>
              ))}
            </select>
          </div>

          <div className="mt-3 flex items-center justify-between border-t border-border pt-3 text-[11.5px]">
            <span className="flex items-center gap-1.5 text-studio-ink">
              {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {STATE_COPY[status]}
            </span>
            {run?.started_at && (
              <span className="flex items-center gap-1 font-mono tabular-nums text-muted-foreground">
                <Timer className="h-3 w-3" />
                {formatDuration(elapsed || Date.now() - new Date(run.started_at).getTime())}
              </span>
            )}
          </div>

          {run && (
            <div className="mt-2 flex items-center justify-between gap-2 border-t border-border pt-2.5">
              <p className="min-w-0 truncate font-mono text-[10.5px] text-muted-foreground">
                run #{run.id} · {run.branch}
              </p>
              <a
                href={run.html_url}
                target="_blank"
                rel="noreferrer"
                className="flex shrink-0 items-center gap-1 text-[10.5px] text-studio-ink"
              >
                Open on GitHub <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          )}
        </div>
      )}

      {message && (
        <div
          className={[
            "flex items-start gap-2 rounded-2xl px-4 py-3",
            status === "error" || status === "failed"
              ? "border border-destructive/25 bg-destructive/5"
              : "border border-border bg-studio-ash",
          ].join(" ")}
        >
          {status === "error" || status === "failed" ? (
            <CircleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-destructive" />
          ) : null}
          <p
            className={[
              "break-words text-[11.5px] leading-relaxed",
              status === "error" || status === "failed" ? "text-destructive" : "text-muted-foreground",
            ].join(" ")}
          >
            {message}
          </p>
        </div>
      )}

      {(status === "failed" || log) && <LogTerminal text={log} status={run?.conclusion || status} />}

      {status === "failed" && (
        <AiFixPanel
          log={log}
          paths={project.paths}
          repo={repo}
          attempt={attempt}
          limit={settings.retryLimit}
          onApplied={() => {
            setAttempt((a) => a + 1);
            setTimeout(() => startBuild(), 1500);
          }}
        />
      )}

      {status === "success" && (
        <div className="flex items-start gap-2.5 rounded-2xl border border-studio-lime bg-studio-lime/20 px-4 py-3">
          <RefreshCw className="mt-0.5 h-3.5 w-3.5 shrink-0 text-studio-ink" />
          <div className="min-w-0">
            <p className="text-[12.5px] font-medium text-studio-ink">
              Build finished · {artifacts.length} artifact{artifacts.length === 1 ? "" : "s"}
            </p>
            <p className="mt-0.5 text-[11px] text-studio-ink/70">
              {artifacts.length
                ? artifacts.map((a) => a.name).join(", ")
                : "No artifact was published by this workflow."}
            </p>
          </div>
        </div>
      )}

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setStep(3)}
          className="inline-flex items-center gap-1.5 rounded-full border border-border px-4 py-3 font-display text-[12.5px] font-medium text-muted-foreground hover:border-studio-ink hover:text-studio-ink"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back
        </button>
        {status === "success" && build ? (
          <button
            type="button"
            onClick={() => setStep(5)}
            className="group inline-flex flex-1 items-center justify-center gap-2 rounded-full bg-studio-ink px-5 py-3 font-display text-[13px] font-semibold text-white"
          >
            Get the APK
            <ArrowRight className="h-4 w-4 text-studio-lime transition-transform group-hover:translate-x-0.5" />
          </button>
        ) : (
          <button
            type="button"
            onClick={startBuild}
            disabled={busy || !workflows.length}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-full bg-studio-ink px-5 py-3 font-display text-[13px] font-semibold text-white disabled:opacity-40"
          >
            <Play className="h-3.5 w-3.5 text-studio-lime" />
            {busy ? "Building…" : status === "failed" ? "Rebuild" : "Start build"}
          </button>
        )}
      </div>
    </div>
  );
}