import {
  Check,
  FolderTree,
  GitCommitHorizontal,
  Github,
  Hammer,
  Rocket,
  Upload,
} from "lucide-react";
import { STEPS, useStudio } from "@/components/studio/StudioProvider";

const ICONS = {
  upload: Upload,
  files: FolderTree,
  repo: Github,
  push: GitCommitHorizontal,
  run: Hammer,
  ship: Rocket,
};

export function StepFlowCanvas({ compact = false }) {
  const { step, setStep } = useStudio();

  if (compact) {
    return (
      <div className="no-scrollbar -mx-1 flex items-center gap-2 overflow-x-auto px-1 py-1">
        {STEPS.map((s, i) => {
          const Icon = ICONS[s.id] || Upload;
          const done = i < step;
          const active = i === step;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => i <= step && setStep(i)}
              disabled={i > step}
              className={[
                "flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] transition-colors",
                active
                  ? "border-studio-lime bg-white text-studio-ink shadow-sm"
                  : done
                    ? "border-transparent bg-white/65 text-studio-ink/70"
                    : "border-white/50 bg-white/30 text-studio-ink/40",
              ].join(" ")}
            >
              <Icon className="h-3.5 w-3.5" />
              {s.title}
              {done ? <Check className="h-3 w-3" /> : null}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div className="glass-card hidden shrink-0 flex-col rounded-[26px] p-4 lg:flex lg:w-[296px]">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-[10px] uppercase tracking-[0.22em] text-studio-ink/45">Flow</p>
        <span className="rounded-full bg-white/70 px-2 py-0.5 text-[10px] tabular-nums text-studio-ink/55">
          {step + 1} / {STEPS.length}
        </span>
      </div>

      <ol className="flex flex-1 flex-col">
        {STEPS.map((s, i) => {
          const Icon = ICONS[s.id] || Upload;
          const done = i < step;
          const active = i === step;
          return (
            <li key={s.id} className="flex flex-col">
              <button
                type="button"
                onClick={() => i <= step && setStep(i)}
                disabled={i > step}
                className={[
                  "node-sheen relative flex items-center gap-3 overflow-hidden rounded-2xl px-3 py-2.5 text-left transition-all",
                  active
                    ? "bg-white shadow-[0_16px_40px_-24px_rgba(12,24,14,0.55)] ring-1 ring-studio-lime"
                    : done
                      ? "bg-white/70 hover:bg-white"
                      : "bg-white/35",
                ].join(" ")}
                data-live={active ? "true" : "false"}
              >
                <span
                  className={[
                    "grid h-9 w-9 shrink-0 place-items-center rounded-xl",
                    active
                      ? "bg-studio-ink text-studio-lime"
                      : done
                        ? "bg-studio-lime/45 text-studio-ink"
                        : "bg-white/70 text-studio-ink/45",
                  ].join(" ")}
                >
                  <Icon className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span
                    className={[
                      "block truncate font-display text-[13px] font-semibold",
                      i > step ? "text-studio-ink/45" : "text-studio-ink",
                    ].join(" ")}
                  >
                    {s.title}
                  </span>
                  <span className="mt-0.5 block truncate text-[10.5px] text-studio-ink/45">
                    {done ? "Completed" : active ? "In progress" : s.hint}
                  </span>
                </span>
                {done ? <Check className="h-3.5 w-3.5 shrink-0 text-studio-ink/70" /> : null}
                {active ? <span className="h-2 w-2 shrink-0 rounded-full bg-studio-lime aura-pulse" /> : null}
              </button>
              {i < STEPS.length - 1 ? <span className="ml-[34px] h-4 w-px rail-line" /> : null}
            </li>
          );
        })}
      </ol>

      <p className="mt-3 border-t border-white/60 pt-3 text-[10px] leading-relaxed text-studio-ink/40">
        Tap a completed node to revisit that step.
      </p>
    </div>
  );
}
