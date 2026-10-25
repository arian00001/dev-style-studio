import { useEffect, useRef, useState } from "react";
import { Paperclip, Workflow } from "lucide-react";
import { FlowNode } from "@/components/flow/FlowNode";
import { NODE_W, wirePath, worldHeight } from "@/lib/flow-graph";

export function FlowCanvas({ nodes, selectedId, running, zoom, scrollSignal, onSelect, onMove, onDelete }) {
  const frameRef = useRef(null);
  const [width, setWidth] = useState(360);

  useEffect(() => {
    const el = frameRef.current;
    if (!el) return;
    const measure = () => setWidth(el.clientWidth || 360);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!scrollSignal) return;
    const el = frameRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [scrollSignal]);

  const height = worldHeight(nodes);
  const span = Math.max(0, width - NODE_W);

  return (
    <div
      ref={frameRef}
      onPointerDown={() => onSelect(null)}
      className="studio-grid relative h-full w-full overflow-auto overscroll-contain"
    >
      <div style={{ height: height * zoom }} className="relative w-full">
        <div
          className="relative w-full"
          style={{ height, transform: `scale(${zoom})`, transformOrigin: "top center" }}
        >
          <svg className="pointer-events-none absolute inset-0 h-full w-full overflow-visible">
            {nodes.slice(0, -1).map((node, i) => {
              const link = wirePath(node, nodes[i + 1], width);
              const live = typeof running === "number" && running > i;
              return (
                <path
                  key={`${node.id}-wire`}
                  d={link.d}
                  fill="none"
                  stroke="#0A0B0A"
                  strokeOpacity={live ? 0.6 : 0.26}
                  strokeWidth={1.6}
                  strokeLinecap="round"
                  className={live ? "flow-wire-live" : undefined}
                />
              );
            })}
          </svg>

          {nodes.slice(0, -1).map((node, i) => {
            const link = wirePath(node, nodes[i + 1], width);
            return (
              <div
                key={`${node.id}-clip`}
                style={{ left: link.mx - 9, top: link.my - 9 }}
                className="pointer-events-none absolute grid h-[18px] w-[18px] place-items-center rounded-full border border-black/10 bg-white"
              >
                <Paperclip className="h-[9px] w-[9px] text-black/35" />
              </div>
            );
          })}

          {nodes.map((node, i) => {
            const state =
              typeof running !== "number" ? "idle" : running > i ? "done" : running === i ? "run" : "idle";
            return (
              <FlowNode
                key={node.id}
                node={node}
                left={node.x * span}
                top={node.y}
                span={span}
                zoom={zoom}
                selected={selectedId === node.id}
                state={state}
                onSelect={onSelect}
                onMove={onMove}
                onDelete={onDelete}
              />
            );
          })}

          {!nodes.length && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-10 text-center">
              <div className="grid h-12 w-12 place-items-center rounded-2xl bg-white shadow-sm ring-1 ring-black/5">
                <Workflow className="h-5 w-5 text-studio-ink" />
              </div>
              <p className="text-[13px] font-medium text-studio-ink">This flow is empty</p>
              <p className="max-w-[220px] text-[11.5px] leading-relaxed text-muted-foreground">
                Open the block panel below and tap a block to start building.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}