import { useRef, useState } from "react";
import { motion } from "framer-motion";
import { Check, Trash2 } from "lucide-react";
import { BLOCKS } from "@/lib/flow-blocks";
import { NODE_H, NODE_W, clamp } from "@/lib/flow-graph";
import { cn } from "@/lib/utils";

export function FlowNode({ node, left, top, span, zoom, selected, state, onSelect, onMove, onDelete }) {
  const meta = BLOCKS[node.type] || BLOCKS.trigger;
  const Icon = meta.icon;
  const drag = useRef(null);
  const [dragging, setDragging] = useState(false);

  const down = (e) => {
    e.stopPropagation();
    drag.current = { x0: e.clientX, y0: e.clientY, x: node.x, y: node.y };
    setDragging(true);
    onSelect(node.id);
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* pointer already released — dragging still works */
    }
  };

  const move = (e) => {
    if (!drag.current) return;
    const dx = (e.clientX - drag.current.x0) / zoom;
    const dy = (e.clientY - drag.current.y0) / zoom;
    onMove(node.id, {
      x: clamp(drag.current.x + dx / Math.max(1, span), 0, 1),
      y: Math.max(12, drag.current.y + dy),
    });
  };

  const up = (e) => {
    if (e.currentTarget.hasPointerCapture?.(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    drag.current = null;
    setDragging(false);
  };

  return (
    <motion.div
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={up}
      initial={{ opacity: 0, scale: 0.9, y: 12 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 320, damping: 26 }}
      whileHover={dragging ? undefined : { scale: 1.04 }}
      style={{ left, top, width: NODE_W, height: NODE_H }}
      className={cn(
        "absolute flex touch-none select-none flex-col items-center overflow-hidden rounded-[22px] bg-white/90 p-[9px] ring-1 ring-black/[0.06] backdrop-blur-xl transition-shadow duration-300",
        dragging
          ? "cursor-grabbing shadow-[0_28px_46px_-18px_rgba(10,11,10,0.45)]"
          : "cursor-grab shadow-[0_14px_30px_-20px_rgba(10,11,10,0.6)]",
        selected && "ring-2 ring-studio-ink",
        state === "run" && "ring-2 ring-studio-lime shadow-[0_0_0_6px_rgba(199,251,80,0.3)]",
      )}
    >
      <span className="node-sheen pointer-events-none absolute inset-0" data-live={state === "run" ? "true" : undefined} />
      {state === "run" && (
        <span className="aura-pulse pointer-events-none absolute inset-0 rounded-[22px] ring-2 ring-studio-lime" />
      )}

      {selected && (
        <button
          type="button"
          aria-label="Remove block"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            onDelete(node.id);
          }}
          className="absolute -right-2 -top-2 grid h-[22px] w-[22px] place-items-center rounded-full border border-border bg-white text-muted-foreground shadow-sm transition-colors hover:text-destructive"
        >
          <Trash2 className="h-3 w-3" />
        </button>
      )}

      <div className={cn("grid h-9 w-9 place-items-center rounded-xl", meta.tile)}>
        <Icon className="h-[17px] w-[17px]" />
      </div>
      <p className="mt-1.5 line-clamp-2 text-center text-[10px] font-medium leading-[1.3] text-studio-ink">
        {meta.short}
      </p>

      {state === "done" && (
        <span className="absolute -right-1.5 -top-1.5 grid h-4 w-4 place-items-center rounded-full bg-studio-ink">
          <Check className="h-2.5 w-2.5 text-studio-lime" />
        </span>
      )}
    </motion.div>
  );
}