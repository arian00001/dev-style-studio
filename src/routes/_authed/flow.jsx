import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { FlowCanvas } from "@/components/flow/FlowCanvas";
import { FlowPalette } from "@/components/flow/FlowPalette";
import { FlowRail } from "@/components/flow/FlowRail";
import { FlowToolbar } from "@/components/flow/FlowToolbar";
import { useFlowGraph } from "@/components/flow/useFlowGraph";

export const Route = createFileRoute("/_authed/flow")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Flow builder — Dev Style Studio" },
      { name: "description", content: "Compose a pipeline of blocks on a mobile canvas." },
    ],
  }),
  component: FlowPage,
});

function FlowPage() {
  const { nodes, saveState, addNode, removeNode, moveNode, loadTypes, reset } = useFlowGraph();
  const [selectedId, setSelectedId] = useState(null);
  const [zoom, setZoom] = useState(1);
  const [running, setRunning] = useState(null);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [scrollSignal, setScrollSignal] = useState(0);

  const handleAdd = (type) => {
    addNode(type);
    setScrollSignal((n) => n + 1);
    setPaletteOpen(false);
  };

  const handlePreset = (preset) => {
    loadTypes(preset.types);
    setPaletteOpen(false);
    toast(preset.name, { description: `${preset.types.length} blocks placed on the canvas.` });
  };

  const runOnce = async () => {
    if (!nodes.length || running !== null) return;
    setRunning(0);
    for (let i = 1; i <= nodes.length; i += 1) {
      await new Promise((resolve) => setTimeout(resolve, 340));
      setRunning(i);
    }
    await new Promise((resolve) => setTimeout(resolve, 700));
    setRunning(null);
    toast("Preview run finished — nothing executes yet.");
  };

  return (
    <div className="flex h-[100dvh] w-full overflow-hidden bg-accent/50">
      <FlowRail />

      <div className="relative flex min-h-0 min-w-0 flex-1">
        <div className="relative min-w-0 flex-1">
          <FlowCanvas
            nodes={nodes}
            selectedId={selectedId}
            running={running}
            zoom={zoom}
            scrollSignal={scrollSignal}
            onSelect={setSelectedId}
            onMove={moveNode}
            onDelete={(id) => {
              removeNode(id);
              setSelectedId(null);
            }}
          />

          <div className="pointer-events-none absolute left-3 top-3 z-10 flex items-center gap-2 rounded-full border border-black/[0.05] bg-white/85 px-3 py-1.5 backdrop-blur">
            <span className="h-1.5 w-1.5 rounded-full bg-studio-lime" />
            <span className="text-[11px] font-medium text-studio-ink">{nodes.length} blocks</span>
            <span className="text-[9px] uppercase tracking-[0.14em] text-muted-foreground">
              {saveState === "saving" ? "saving" : "saved"}
            </span>
          </div>

          <FlowToolbar
            running={running}
            zoom={zoom}
            onRun={runOnce}
            onReset={reset}
            onZoomIn={() => setZoom((z) => Math.min(1.3, Number((z + 0.1).toFixed(2))))}
            onZoomOut={() => setZoom((z) => Math.max(0.7, Number((z - 0.1).toFixed(2))))}
          />
        </div>

        <FlowPalette
          open={paletteOpen}
          count={nodes.length}
          onToggle={() => setPaletteOpen((v) => !v)}
          onAdd={handleAdd}
          onPreset={handlePreset}
        />
      </div>
    </div>
  );
}