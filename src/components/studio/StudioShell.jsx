import { Link } from "@tanstack/react-router";
import { AnimatePresence, motion } from "framer-motion";
import { Check, RotateCcw, Settings2, Workflow } from "lucide-react";
import { STEPS, useStudio } from "@/components/studio/StudioProvider";

export function StudioShell({ children }) {
  const { step, reset } = useStudio();
  const current = STEPS[step];

  return (
    <div className="relative min-h-screen w-full overflow-x-hidden bg-white">
      <div className="pointer-events-none fixed inset-0 studio-grid opacity-60" />
      <div className="pointer-events-none fixed -right-24 -top-24 h-64 w-64 rounded-full bg-studio-lime/25 blur-3xl" />

      <div className="relative mx-auto flex min-h-screen w-full max-w-2xl flex-col px-5 pb-10 pt-6 sm:px-8">
        <header className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-studio-ink">
              <span className="font-display text-[15px] font-bold tracking-tight text-studio-lime">DS</span>
            </div>
            <div className="min-w-0">
              <p className="truncate font-display text-[15px] font-semibold leading-none tracking-tight text-studio-ink">
                Dev Style Studio
              </p>
              <p className="mt-1 truncate text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                Build from your phone
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <Link
              to="/flow"
              className="flex items-center gap-1.5 rounded-full border border-border bg-white/80 px-3 py-2 text-[11px] font-medium text-muted-foreground transition-colors hover:border-studio-ink hover:text-studio-ink"
            >
              <Workflow className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Flow</span>
            </Link>
            <Link
              to="/settings"
              className="flex items-center gap-1.5 rounded-full border border-border bg-white/80 px-3 py-2 text-[11px] font-medium text-muted-foreground transition-colors hover:border-studio-ink hover:text-studio-ink"
            >
              <Settings2 className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Settings</span>
            </Link>
            <button
              type="button"
              onClick={reset}
              className="flex items-center gap-1.5 rounded-full border border-border bg-white/80 px-3 py-2 text-[11px] font-medium text-muted-foreground transition-colors hover:border-studio-ink hover:text-studio-ink"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </button>
          </div>
        </header>

        <div className="mt-7">
          <div className="flex items-center gap-1.5">
            {STEPS.map((s, i) => (
              <div key={s.id} className="flex flex-1 items-center gap-1.5">
                <div
                  className={[
                    "h-1.5 flex-1 rounded-full transition-all duration-500",
                    i < step ? "bg-studio-ink" : i === step ? "bg-studio-lime" : "bg-border",
                  ].join(" ")}
                />
                {i < STEPS.length - 1 && i !== step ? null : null}
              </div>
            ))}
          </div>
          <div className="mt-3 flex items-baseline justify-between gap-3">
            <p className="min-w-0 truncate font-display text-[13px] font-medium text-studio-ink">
              <span className="tabular-nums text-muted-foreground">{String(step + 1).padStart(2, "0")}</span>
              <span className="mx-2 text-border">/</span>
              {current.title}
            </p>
            <div className="flex shrink-0 items-center gap-1.5">
              {step > 0 && <Check className="h-3 w-3 text-studio-ink" />}
              <span className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                step {step + 1} of {STEPS.length}
              </span>
            </div>
          </div>
        </div>

        <main className="mt-6 flex-1">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={step}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </main>

        <footer className="mt-8 border-t border-border pt-4">
          <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            Files stay on your device until you push · keys live on the server
          </p>
        </footer>
      </div>
    </div>
  );
}