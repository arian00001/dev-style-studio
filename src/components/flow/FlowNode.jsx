import { useRef, useState } from "react";
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
    <div
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={up}
      style={{ left, top, width: NODE_W, height: NODE_H }}
      className={cn(
        "absolute flex touch-none select-none flex-col items-center rounded-[20px] bg-white p-[9px] ring-1 ring-black/[0.07] transition-shadow",
        dragging
          ? "cursor-grabbing shadow-[0_20px_34px_-16px_rgba(10,11,10,0.4)]"
          : "cursor-grab shadow-[0_10px_22px_-18px_rgba(10,11,10,0.55)]",
        selected && "ring-2 ring-studio-ink",
        state === "run" && "ring-2 ring-studio-lime shadow-[0_0_0_5px_rgba(199,251,80,0.28)]",
      )}
    >
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
    </div>
  );
}