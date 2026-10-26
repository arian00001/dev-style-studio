import { Link } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight, RotateCcw, Settings2 } from "lucide-react";
import { STEPS, useStudio } from "@/components/studio/StudioProvider";

export function StudioToolbar() {
  const { step, setStep, reset, project, repo, push, build } = useStudio();

  const ready = [Boolean(project), Boolean(project), Boolean(repo), Boolean(push), Boolean(build)];
  const canAdvance = step < STEPS.length - 1 && Boolean(ready[step]);

  const control =
    "grid h-9 w-9 place-items-center rounded-full text-studio-ink/55 transition-colors hover:bg-white/80 hover:text-studio-ink disabled:opacity-25";

  return (
    <div className="sticky bottom-3 z-20 flex justify-center">
      <div className="glass-panel flex items-center gap-1 rounded-full px-2 py-1.5">
        <button
          type="button"
          onClick={() => setStep(Math.max(0, step - 1))}
          disabled={step === 0}
          className={control}
          aria-label="Previous step"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>

        <div className="flex items-center gap-1.5 px-2">
          {STEPS.map((s, i) => (
            <button
              key={s.id}
              type="button"
              onClick={() => i <= step && setStep(i)}
              disabled={i > step}
              aria-label={s.title}
              className={[
                "h-1.5 rounded-full transition-all",
                i === step ? "w-6 bg-studio-ink" : i < step ? "w-1.5 bg-studio-limeDeep" : "w-1.5 bg-studio-ink/15",
              ].join(" ")}
            />
          ))}
        </div>

        <button
          type="button"
          onClick={() => canAdvance && setStep(step + 1)}
          disabled={!canAdvance}
          className="grid h-9 w-9 place-items-center rounded-full bg-studio-ink text-white transition-opacity disabled:opacity-25"
          aria-label="Next step"
        >
          <ChevronRight className="h-4 w-4" />
        </button>

        <span className="mx-1 h-6 w-px bg-studio-ink/10" />

        <button type="button" onClick={reset} className={control} aria-label="Start over">
          <RotateCcw className="h-4 w-4" />
        </button>
        <Link to="/settings" className={control} aria-label="Settings">
          <Settings2 className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}
