import { Plus } from "lucide-react";
import { BLOCKS } from "@/lib/flow-blocks";
import { cn } from "@/lib/utils";

export function FlowPaletteItem({ type, onAdd }) {
  const meta = BLOCKS[type];
  if (!meta) return null;
  const Icon = meta.icon;

  return (
    <button
      type="button"
      onClick={() => onAdd(type)}
      className="group flex w-full items-center gap-2.5 rounded-xl px-2 py-[7px] text-left transition-colors hover:bg-studio-ash active:bg-studio-ash"
    >
      <span className={cn("grid h-7 w-7 shrink-0 place-items-center rounded-lg", meta.tile)}>
        <Icon className="h-3.5 w-3.5" />
      </span>
      <span className="min-w-0 truncate text-[12px] text-studio-ink">{meta.name}</span>
      <Plus className="ml-auto h-3.5 w-3.5 shrink-0 text-studio-ink/25" />
    </button>
  );
}