import { motion } from "framer-motion";
import { Loader2, Minus, Play, Plus, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";

function IconButton({ label, onClick, disabled, children }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className="grid h-8 w-8 place-items-center rounded-full text-studio-ink/60 transition-colors hover:bg-studio-ash hover:text-studio-ink disabled:opacity-40"
    >
      {children}
    </button>
  );
}

export function FlowToolbar({ running, zoom, onRun, onReset, onZoomIn, onZoomOut }) {
  const busy = typeof running === "number";

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-[92px] z-20 flex justify-center px-3 lg:bottom-6">
      <motion.div
        initial={{ y: 18, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: "spring", stiffness: 240, damping: 24, delay: 0.05 }}
        className="pointer-events-auto flex items-center gap-1 rounded-full border border-white/70 bg-white/75 p-1.5 shadow-[0_22px_50px_-24px_rgba(10,11,10,0.6)] ring-1 ring-black/[0.04] backdrop-blur-xl"
      >
        <button
          type="button"
          onClick={onRun}
          disabled={busy}
          className={cn(
            "flex items-center gap-1.5 rounded-full bg-studio-ink px-3.5 py-2 text-[12px] font-semibold text-white shadow-[0_12px_26px_-14px_rgba(10,11,10,0.95)] transition-transform active:scale-[0.97]",
            busy ? "opacity-90" : "hover:-translate-y-[1px]",
          )}
        >
          {busy ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin text-studio-lime" />
          ) : (
            <Play className="h-3.5 w-3.5 fill-studio-lime text-studio-lime" />
          )}
          {busy ? "Running" : "Run once"}
        </button>

        <span className="mx-1 h-5 w-px bg-border" />

        <IconButton label="Reset flow" onClick={onReset} disabled={busy}>
          <RotateCcw className="h-[15px] w-[15px]" />
        </IconButton>

        <span className="mx-1 h-5 w-px bg-border" />

        <IconButton label="Zoom out" onClick={onZoomOut} disabled={zoom <= 0.7}>
          <Minus className="h-[15px] w-[15px]" />
        </IconButton>
        <span className="w-8 text-center text-[10.5px] font-medium tabular-nums text-muted-foreground">
          {Math.round(zoom * 100)}
        </span>
        <IconButton label="Zoom in" onClick={onZoomIn} disabled={zoom >= 1.3}>
          <Plus className="h-[15px] w-[15px]" />
        </IconButton>
      </motion.div>
    </div>
  );
}