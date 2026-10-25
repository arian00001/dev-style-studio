import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Check, CircleAlert, KeyRound, Save, Settings2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { integrationStatus } from "@/lib/config-fns";
import { DEFAULT_SETTINGS, loadSettings, saveSettings } from "@/lib/settings";
import { relativeTime } from "@/lib/format";
import { useAuth } from "@/lib/AuthContext";

export const Route = createFileRoute("/_authed/settings")({
  ssr: false,
  head: () => ({ meta: [{ title: "Settings — Dev Style Studio" }] }),
  component: SettingsPage,
});

function SettingsPage() {
  const { logout } = useAuth();
  const [keys, setKeys] = useState(null);
  const [form, setForm] = useState(DEFAULT_SETTINGS);
  const [saved, setSaved] = useState(false);
  const [activity, setActivity] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    setForm(loadSettings());
    integrationStatus()
      .then(setKeys)
      .catch((err) => setError(err?.message || "Could not read the server configuration."));
    base44.entities.ActivityEvent.list({ sort: "-created_date", limit: 15 })
      .then((page) => setActivity(page?.items ?? page ?? []))
      .catch(() => setActivity([]));
  }, []);

  const update = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const save = () => {
    saveSettings(form);
    setSaved(true);
    setTimeout(() => setSaved(false), 1800);
  };

  const items = [
    { id: "github", label: "GitHub token", hint: "Repos, pushes, Actions runs" },
    { id: "gemini", label: "Gemini API key", hint: "Build log analysis and patches" },
    { id: "vercel", label: "Vercel token", hint: "Web project deployments" },
  ];

  return (
    <div className="relative min-h-screen w-full overflow-x-hidden bg-white">
      <div className="pointer-events-none fixed inset-0 studio-grid opacity-60" />
      <div className="relative mx-auto w-full max-w-2xl px-5 pb-12 pt-6 sm:px-8">
        <div className="flex items-center justify-between gap-3">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-white/80 px-3 py-2 text-[11px] font-medium text-muted-foreground transition-colors hover:border-studio-ink hover:text-studio-ink"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Studio
          </Link>
          <button
            type="button"
            onClick={() => logout()}
            className="rounded-full border border-border bg-white/80 px-3 py-2 text-[11px] font-medium text-muted-foreground transition-colors hover:border-studio-ink hover:text-studio-ink"
          >
            Sign out
          </button>
        </div>

        <h1 className="mt-6 font-display text-[26px] font-semibold tracking-tight text-studio-ink">Settings</h1>
        <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">
          Keys live on the server only — they are never written into the app bundle, the browser or the logs.
        </p>

        {error && (
          <div className="mt-4 flex items-start gap-2 rounded-2xl border border-destructive/25 bg-destructive/5 px-4 py-3">
            <CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
            <p className="text-[12px] text-destructive">{error}</p>
          </div>
        )}

        <section className="mt-6">
          <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Credentials</p>
          <div className="mt-2 divide-y divide-border overflow-hidden rounded-2xl border border-border bg-white">
            {items.map((item) => {
              const connected = keys?.[item.id];
              return (
                <div key={item.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-studio-ash">
                    <KeyRound className="h-3.5 w-3.5 text-studio-ink" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[12.5px] font-medium text-studio-ink">{item.label}</p>
                    <p className="text-[10.5px] text-muted-foreground">{item.hint}</p>
                  </div>
                  <span
                    className={[
                      "shrink-0 rounded-full px-2.5 py-1 text-[10px] font-medium",
                      keys === null
                        ? "bg-studio-ash text-muted-foreground"
                        : connected
                          ? "bg-studio-lime/30 text-studio-ink"
                          : "bg-amber-50 text-amber-800",
                    ].join(" ")}
                  >
                    {keys === null ? "checking" : connected ? "connected" : "not set"}
                  </span>
                </div>
              );
            })}
          </div>
          <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
            Add or rotate these in the workspace secrets page. The studio picks them up immediately.
          </p>
        </section>

        <section className="mt-7">
          <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Build configuration</p>
          <div className="mt-2 space-y-3 rounded-2xl border border-border bg-white p-4">
            <Field label="Default branch" value={form.branch} onChange={(v) => update("branch", v)} mono />
            <Field label="Gradle task" value={form.gradleTask} onChange={(v) => update("gradleTask", v)} mono />
            <Field
              label="AI fix retry limit"
              value={String(form.retryLimit)}
              onChange={(v) => update("retryLimit", Number(v) || 1)}
              type="number"
            />
            <Field
              label="Vercel project name"
              value={form.vercelProject}
              onChange={(v) => update("vercelProject", v)}
              mono
              placeholder="auto from repository"
            />
            <button
              type="button"
              onClick={save}
              className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-studio-ink px-4 py-2.5 font-display text-[12.5px] font-semibold text-white"
            >
              {saved ? <Check className="h-3.5 w-3.5 text-studio-lime" /> : <Save className="h-3.5 w-3.5 text-studio-lime" />}
              {saved ? "Saved" : "Save configuration"}
            </button>
          </div>
        </section>

        <section className="mt-7">
          <div className="flex items-center justify-between">
            <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Activity</p>
            <Settings2 className="h-3.5 w-3.5 text-muted-foreground" />
          </div>
          <div className="mt-2 overflow-hidden rounded-2xl border border-border bg-white">
            {activity.length ? (
              activity.map((item) => (
                <div key={item.id} className="flex items-start gap-2.5 border-b border-border/60 px-4 py-2.5 last:border-0">
                  <span
                    className={[
                      "mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full",
                      item.status === "error" ? "bg-destructive" : item.status === "success" ? "bg-studio-limeDeep" : "bg-border",
                    ].join(" ")}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="break-words text-[11.5px] leading-relaxed text-studio-ink">{item.message}</p>
                    <p className="mt-0.5 truncate font-mono text-[10px] text-muted-foreground">
                      {item.action} · {item.repo_full_name || item.project_name || "local"} · {relativeTime(item.created_date)}
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <p className="px-4 py-6 text-center text-[11.5px] text-muted-foreground">No activity yet.</p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, mono, type = "text", placeholder }) {
  return (
    <label className="block">
      <span className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">{label}</span>
      <input
        type={type}
        value={value ?? ""}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className={[
          "mt-1 w-full rounded-xl border border-border bg-white px-3 py-2 text-[12px] text-studio-ink focus:border-studio-ink focus:outline-none",
          mono ? "font-mono" : "",
        ].join(" ")}
      />
    </label>
  );
}