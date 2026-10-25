import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, CircleAlert, ExternalLink, Globe, Loader2, Rocket } from "lucide-react";
import { enablePages, pagesStatus } from "@/lib/github-fns";
import { vercelDeploy, vercelStatus } from "@/lib/deploy-fns";
import { useStudio } from "@/components/studio/StudioProvider";
import { loadSettings, slugify } from "@/lib/settings";
import { logEvent } from "@/lib/activity";

export function StepDeploy() {
  const { project, repo, zip, build, setBuild, setStep } = useStudio();
  const settings = useRef(loadSettings()).current;
  const isStatic = project?.info?.type === "static";
  const [status, setStatus] = useState("idle");
  const [url, setUrl] = useState(null);
  const [message, setMessage] = useState(null);
  const [projectName, setProjectName] = useState(
    settings.vercelProject || slugify(repo?.name || zip?.file?.name?.replace(/\.zip$/i, "") || "site"),
  );
  const polling = useRef(null);

  useEffect(() => () => clearInterval(polling.current), []);

  const pollPages = () => {
    polling.current = setInterval(async () => {
      try {
        const res = await pagesStatus({ data: { owner: repo.owner, repo: repo.name } });
        if (res.url) setMessage(`Pages status: ${res.status || "building"}`);
        if (res.status === "built" || res.status === "errored") {
          clearInterval(polling.current);
          if (res.status === "built") finish(res.url);
          else {
            setStatus("error");
            setMessage("GitHub Pages reported a build error. Check the Pages tab on GitHub.");
          }
        }
      } catch (err) {
        clearInterval(polling.current);
        setStatus("error");
        setMessage(err?.message || "Could not read Pages status.");
      }
    }, 5000);
  };

  const finish = (liveUrl) => {
    setStatus("success");
    setUrl(liveUrl);
    setBuild({ status: "success", deploy: { url: liveUrl, kind: isStatic ? "pages" : "vercel" } });
    logEvent({
      project_name: zip?.file?.name,
      repo_full_name: repo?.full_name,
      action: "deploy",
      status: "success",
      message: `Live at ${liveUrl}`,
    });
  };

  const deployPages = async () => {
    setStatus("working");
    setMessage("Enabling GitHub Pages…");
    try {
      const res = await enablePages({ data: { owner: repo.owner, repo: repo.name, branch: repo.branch } });
      setMessage(`Pages status: ${res.status || "building"}`);
      if (res.status === "built" && res.url) finish(res.url);
      else pollPages();
    } catch (err) {
      setStatus("error");
      setMessage(err?.message || "GitHub Pages could not be enabled.");
    }
  };

  const deployVercel = async () => {
    setStatus("working");
    setMessage("Creating the Vercel deployment…");
    try {
      const created = await vercelDeploy({
        data: {
          owner: repo.owner,
          repo: repo.name,
          repoId: repo.id,
          projectName: slugify(projectName),
          branch: repo.branch,
          framework: project.info.framework?.includes("Vite") ? "vite" : undefined,
        },
      });
      setMessage("Deployment queued — waiting for Vercel…");
      polling.current = setInterval(async () => {
        try {
          const res = await vercelStatus({ data: { deploymentId: created.deploymentId } });
          setMessage(`Vercel status: ${res.state}`);
          if (res.state === "READY") {
            clearInterval(polling.current);
            finish(res.url || created.url);
          } else if (res.state === "ERROR" || res.state === "CANCELED") {
            clearInterval(polling.current);
            setStatus("error");
            setMessage(res.error || "Vercel reported that this deployment failed.");
          }
        } catch (err) {
          clearInterval(polling.current);
          setStatus("error");
          setMessage(err?.message || "Could not read the deployment status.");
        }
      }, 5000);
    } catch (err) {
      setStatus("error");
      setMessage(err?.message || "The Vercel deployment could not be created.");
    }
  };

  const busy = status === "working";

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-[26px] font-semibold leading-[1.15] tracking-tight text-studio-ink">
          {isStatic ? "Publish with Pages" : "Deploy to Vercel"}
        </h1>
        <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
          {isStatic
            ? "This is a static site, so GitHub Pages hosts it straight from the branch you pushed."
            : "Vercel builds the pushed commit and gives you a production URL once it is ready."}
        </p>
      </div>

      <div className="rounded-2xl border border-border bg-white p-4">
        <div className="flex items-center gap-2.5">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-studio-ash">
            <Globe className="h-4 w-4 text-studio-ink" />
          </div>
          <div className="min-w-0">
            <p className="truncate font-mono text-[12px] text-studio-ink">{repo?.full_name}</p>
            <p className="text-[10.5px] text-muted-foreground">
              {repo?.branch} · {project?.info?.framework}
            </p>
          </div>
        </div>

        {!isStatic && (
          <div className="mt-3 border-t border-border pt-3">
            <label className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Project name</label>
            <input
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              className="mt-1 w-full rounded-xl border border-border bg-white px-3 py-2 font-mono text-[12px] text-studio-ink focus:border-studio-ink focus:outline-none"
            />
          </div>
        )}

        {message && (
          <p className="mt-3 flex items-start gap-1.5 border-t border-border pt-3 text-[11.5px] leading-relaxed text-muted-foreground">
            {busy && <Loader2 className="mt-0.5 h-3 w-3 shrink-0 animate-spin" />}
            <span className="break-words">{message}</span>
          </p>
        )}
      </div>

      {status === "error" && (
        <div className="flex items-start gap-2.5 rounded-2xl border border-destructive/25 bg-destructive/5 px-4 py-3">
          <CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
          <p className="break-words text-[12.5px] leading-relaxed text-destructive">{message}</p>
        </div>
      )}

      {status === "success" && url && (
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className="flex items-center justify-between gap-2 rounded-2xl border border-studio-lime bg-studio-lime/20 px-4 py-3"
        >
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-[0.16em] text-studio-ink/60">Live URL</p>
            <p className="mt-0.5 truncate font-mono text-[12px] text-studio-ink">{url}</p>
          </div>
          <ExternalLink className="h-4 w-4 shrink-0 text-studio-ink" />
        </a>
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
        {status === "success" ? (
          <button
            type="button"
            onClick={() => setStep(5)}
            className="group inline-flex flex-1 items-center justify-center gap-2 rounded-full bg-studio-ink px-5 py-3 font-display text-[13px] font-semibold text-white"
          >
            Finish
            <ArrowRight className="h-4 w-4 text-studio-lime transition-transform group-hover:translate-x-0.5" />
          </button>
        ) : (
          <button
            type="button"
            onClick={isStatic ? deployPages : deployVercel}
            disabled={busy}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-full bg-studio-ink px-5 py-3 font-display text-[13px] font-semibold text-white disabled:opacity-40"
          >
            <Rocket className="h-3.5 w-3.5 text-studio-lime" />
            {busy ? "Deploying…" : isStatic ? "Enable Pages" : "Deploy to Vercel"}
          </button>
        )}
      </div>

      {build?.status === "success" && build.deploy && (
        <p className="text-[11px] text-muted-foreground">
          Last deploy: {build.deploy.kind === "pages" ? "GitHub Pages" : "Vercel"} · {build.deploy.url}
        </p>
      )}
    </div>
  );
}