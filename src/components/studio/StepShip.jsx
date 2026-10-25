import { useState } from "react";
import {
  ArrowLeft,
  Check,
  CircleAlert,
  Copy,
  Download,
  ExternalLink,
  Loader2,
  Package,
  RotateCcw,
  Tag,
} from "lucide-react";
import { releaseApk } from "@/lib/github-fns";
import { useStudio } from "@/components/studio/StudioProvider";
import { formatBytes } from "@/lib/format";
import { logEvent } from "@/lib/activity";

export function StepShip() {
  const { project, repo, zip, build, reset, setStep } = useStudio();
  const [tag, setTag] = useState("v1.0.0");
  const [state, setState] = useState({ status: "idle" });
  const [copied, setCopied] = useState(false);

  const isAndroid = project?.info?.type === "android";
  const artifacts = build?.artifacts || [];
  const apkArtifact = artifacts.find((a) => /apk|release|app/i.test(a.name)) || artifacts[0];
  const liveUrl = build?.deploy?.url;

  const release = async () => {
    if (!apkArtifact) return;
    setState({ status: "working" });
    try {
      const result = await releaseApk({
        data: {
          owner: repo.owner,
          repo: repo.name,
          artifactId: apkArtifact.id,
          tag: tag.trim(),
          title: `${repo.name} ${tag.trim()}`,
          notes: `Built from ${zip?.file?.name || "the uploaded project"} with Dev Style Studio.`,
        },
      });
      setState({ status: "done", result });
      logEvent({
        project_name: zip?.file?.name,
        repo_full_name: repo?.full_name,
        action: "release",
        status: "success",
        message: `Release ${result.tag} published (${result.asset_name})`,
      });
    } catch (err) {
      setState({ status: "error", message: err?.message || "The release could not be published." });
    }
  };

  const copy = async () => {
    if (!liveUrl) return;
    await navigator.clipboard.writeText(liveUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-[26px] font-semibold leading-[1.15] tracking-tight text-studio-ink">
          {isAndroid ? "APK & release" : "Your live site"}
        </h1>
        <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
          {isAndroid
            ? "Artifacts listed here exist on the completed workflow run — nothing is shown before it is published."
            : "The deployment is live. Share the URL or start another project."}
        </p>
      </div>

      {!isAndroid && liveUrl && (
        <div className="rounded-2xl border border-studio-lime bg-studio-lime/20 p-4">
          <p className="text-[10px] uppercase tracking-[0.16em] text-studio-ink/60">
            {build?.deploy?.kind === "pages" ? "GitHub Pages" : "Vercel production"}
          </p>
          <p className="mt-1 break-all font-mono text-[13px] text-studio-ink">{liveUrl}</p>
          <div className="mt-3 flex gap-2">
            <a
              href={liveUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-full bg-studio-ink px-4 py-2.5 font-display text-[12.5px] font-semibold text-white"
            >
              <ExternalLink className="h-3.5 w-3.5 text-studio-lime" />
              Open site
            </a>
            <button
              type="button"
              onClick={copy}
              className="inline-flex items-center gap-1.5 rounded-full border border-studio-ink/20 bg-white px-4 py-2.5 font-display text-[12.5px] font-medium text-studio-ink"
            >
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
        </div>
      )}

      {isAndroid && (
        <>
          {apkArtifact ? (
            <div className="rounded-2xl border border-border bg-white">
              <div className="flex items-center gap-2 border-b border-border px-4 py-3">
                <Package className="h-4 w-4 text-studio-ink" />
                <p className="font-display text-[12.5px] font-semibold text-studio-ink">Build artifact</p>
              </div>
              <div className="space-y-2 px-4 py-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-mono text-[11.5px] text-studio-ink">{apkArtifact.name}</p>
                    <p className="text-[10.5px] text-muted-foreground">
                      {formatBytes(apkArtifact.size_in_bytes)}
                      {apkArtifact.expired ? " · expired" : ""}
                    </p>
                  </div>
                  <a
                    href={apkArtifact.download_url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-studio-ink px-3.5 py-2 font-display text-[11.5px] font-semibold text-white"
                  >
                    <Download className="h-3.5 w-3.5 text-studio-lime" />
                    Download
                  </a>
                </div>
                {repo?.private && (
                  <p className="rounded-xl bg-studio-ash px-3 py-2 text-[10.5px] leading-relaxed text-muted-foreground">
                    This repository is private, so GitHub asks you to sign in before the artifact downloads.
                  </p>
                )}
              </div>
            </div>
          ) : (
            <div className="flex items-start gap-2.5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
              <CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
              <p className="text-[11.5px] leading-relaxed text-amber-900">
                This workflow published no artifact, so there is no APK to download yet. Check that the build uploads
                one before relying on it.
              </p>
            </div>
          )}

          <div className="rounded-2xl border border-border bg-white p-4">
            <div className="flex items-center gap-2">
              <Tag className="h-4 w-4 text-studio-ink" />
              <p className="font-display text-[12.5px] font-semibold text-studio-ink">Release APK</p>
            </div>
            <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
              Publishes a GitHub release and attaches the real APK extracted from the artifact.
            </p>
            <div className="mt-2.5 flex gap-2">
              <input
                value={tag}
                onChange={(e) => setTag(e.target.value)}
                className="min-w-0 flex-1 rounded-xl border border-border bg-white px-3 py-2 font-mono text-[12px] text-studio-ink focus:border-studio-ink focus:outline-none"
              />
              <button
                type="button"
                onClick={release}
                disabled={!apkArtifact || state.status === "working" || !tag.trim()}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-studio-ink px-4 py-2 font-display text-[12px] font-semibold text-white disabled:opacity-40"
              >
                {state.status === "working" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                Release
              </button>
            </div>

            {state.status === "error" && (
              <p className="mt-2 break-words rounded-xl border border-destructive/25 bg-destructive/5 px-3 py-2 text-[11px] leading-relaxed text-destructive">
                {state.message}
              </p>
            )}

            {state.status === "done" && (
              <a
                href={state.result.release_url}
                target="_blank"
                rel="noreferrer"
                className="mt-2 flex items-center justify-between gap-2 rounded-xl border border-studio-lime bg-studio-lime/20 px-3 py-2"
              >
                <span className="min-w-0">
                  <span className="block text-[11.5px] font-medium text-studio-ink">
                    {state.result.tag} · {state.result.asset_name}
                  </span>
                  <span className="block text-[10.5px] text-studio-ink/70">
                    {formatBytes(state.result.size_in_bytes)} attached to the release
                  </span>
                </span>
                <ExternalLink className="h-3.5 w-3.5 shrink-0 text-studio-ink" />
              </a>
            )}
          </div>
        </>
      )}

      <div className="grid gap-2 rounded-2xl bg-studio-ash px-4 py-3.5">
        <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">What shipped</p>
        <p className="text-[11.5px] leading-relaxed text-studio-ink">
          {repo?.full_name} · {project?.stats?.files} files · {project?.info?.framework}
        </p>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setStep(isAndroid ? 4 : 3)}
          className="inline-flex items-center gap-1.5 rounded-full border border-border px-4 py-3 font-display text-[12.5px] font-medium text-muted-foreground hover:border-studio-ink hover:text-studio-ink"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back
        </button>
        <button
          type="button"
          onClick={reset}
          className="inline-flex flex-1 items-center justify-center gap-2 rounded-full bg-studio-ink px-5 py-3 font-display text-[13px] font-semibold text-white"
        >
          <RotateCcw className="h-3.5 w-3.5 text-studio-lime" />
          Start another project
        </button>
      </div>
    </div>
  );
}