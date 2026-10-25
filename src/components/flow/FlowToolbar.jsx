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
      <div className="pointer-events-auto flex items-center gap-1 rounded-full border border-black/[0.06] bg-white/90 p-1.5 shadow-[0_18px_40px_-22px_rgba(10,11,10,0.55)] backdrop-blur">
        <button
          type="button"
          onClick={onRun}
          disabled={busy}
          className={cn(
            "flex items-center gap-1.5 rounded-full bg-studio-ink px-3.5 py-2 text-[12px] font-semibold text-white transition-opacity",
            busy ? "opacity-80" : "hover:opacity-90",
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
      </div>
    </div>
  );
}