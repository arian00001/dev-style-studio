import { Link } from "@tanstack/react-router";
import { AnimatePresence, motion } from "framer-motion";
import { RotateCcw, Settings2 } from "lucide-react";
import { STEPS, useStudio } from "@/components/studio/StudioProvider";
import { StudioSidebar } from "@/components/studio/StudioSidebar";
import { StepFlowCanvas } from "@/components/studio/StepFlowCanvas";
import { StudioToolbar } from "@/components/studio/StudioToolbar";

export function StudioShell({ children }) {
  const { step, reset } = useStudio();
  const current = STEPS[step];

  return (
    <div className="studio-stage relative min-h-screen w-full overflow-x-hidden">
      <div className="canvas-grid pointer-events-none absolute inset-0 opacity-[0.55]" />

      <div className="relative mx-auto flex min-h-screen w-full max-w-[1560px] gap-3 p-3 sm:gap-5 sm:p-5">
        <StudioSidebar />

        <div className="flex min-w-0 flex-1 flex-col gap-3 sm:gap-4">
          <div className="glass-dark flex items-center justify-between gap-3 rounded-[22px] px-3 py-2 lg:hidden">
            <div className="flex min-w-0 items-center gap-2.5">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-studio-lime">
                <span className="font-display text-[13px] font-bold tracking-tight text-studio-ink">DS</span>
              </span>
              <div className="min-w-0">
                <p className="truncate font-display text-[13px] font-semibold leading-none text-white">
                  Dev Style Studio
                </p>
                <p className="mt-1 truncate text-[9px] uppercase tracking-[0.2em] text-white/40">Automator</p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <button
                type="button"
                onClick={reset}
                className="grid h-9 w-9 place-items-center rounded-xl text-white/60 transition-colors hover:bg-white/10 hover:text-white"
                aria-label="Start over"
              >
                <RotateCcw className="h-4 w-4" />
              </button>
              <Link
                to="/settings"
                className="grid h-9 w-9 place-items-center rounded-xl text-white/60 transition-colors hover:bg-white/10 hover:text-white"
                aria-label="Settings"
              >
                <Settings2 className="h-4 w-4" />
              </Link>
            </div>
          </div>

          <div className="lg:hidden">
            <StepFlowCanvas compact />
          </div>

          <div className="flex min-h-0 flex-1 flex-col gap-3 sm:gap-4 lg:flex-row">
            <StepFlowCanvas />

            <section className="glass-panel relative flex min-w-0 flex-1 flex-col overflow-hidden rounded-[26px] sm:rounded-[30px]">
              <header className="flex items-center justify-between gap-3 border-b border-white/60 px-4 py-3.5 sm:px-6 sm:py-4">
                <div className="min-w-0">
                  <p className="truncate text-[10px] uppercase tracking-[0.2em] text-studio-ink/40">
                    Step {String(step + 1).padStart(2, "0")} · {current.hint}
                  </p>
                  <p className="mt-1 truncate font-display text-[17px] font-semibold tracking-tight text-studio-ink sm:text-[19px]">
                    {current.title}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  {STEPS.map((s, i) => (
                    <span
                      key={s.id}
                      className={[
                        "h-1.5 rounded-full transition-all",
                        i === step
                          ? "w-5 bg-studio-ink"
                          : i < step
                            ? "w-1.5 bg-studio-limeDeep"
                            : "w-1.5 bg-studio-ink/15",
                      ].join(" ")}
                    />
                  ))}
                </div>
              </header>

              <div className="thin-scroll min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6 sm:py-6">
                <AnimatePresence mode="wait" initial={false}>
                  <motion.div
                    key={step}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                  >
                    {children}
                  </motion.div>
                </AnimatePresence>
              </div>
            </section>
          </div>

          <StudioToolbar />
        </div>
      </div>
    </div>
  );
}
