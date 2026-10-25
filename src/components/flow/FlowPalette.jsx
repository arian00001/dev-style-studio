import { useMemo, useState } from "react";
import { ChevronDown, Search, Sparkles, X } from "lucide-react";
import { BLOCKS, PRESETS, SECTIONS } from "@/lib/flow-blocks";
import { FlowPaletteItem } from "@/components/flow/FlowPaletteItem";
import { cn } from "@/lib/utils";

export function FlowPalette({ open, count, onToggle, onAdd, onPreset }) {
  const [query, setQuery] = useState("");
  const [closed, setClosed] = useState({ apps: true, drive: true, sheets: true, text: true });
  const [presetsOpen, setPresetsOpen] = useState(false);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return null;
    return Object.entries(BLOCKS)
      .filter(([, meta]) => meta.name.toLowerCase().includes(q))
      .map(([type]) => type)
      .slice(0, 20);
  }, [query]);

  const toggleSection = (id) => setClosed((c) => ({ ...c, [id]: !c[id] }));

  return (
    <aside
      className={cn(
        "fixed inset-x-0 bottom-0 z-30 flex h-[70vh] flex-col rounded-t-[26px] border-t border-border bg-white shadow-[0_-20px_50px_-26px_rgba(10,11,10,0.4)] transition-transform duration-300 ease-out",
        "lg:static lg:h-full lg:w-[304px] lg:shrink-0 lg:translate-y-0 lg:rounded-none lg:border-l lg:border-t-0 lg:shadow-none",
        open ? "translate-y-0" : "translate-y-[calc(100%-74px)]",
      )}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-label={open ? "Hide blocks" : "Show blocks"}
        className="flex h-[74px] w-full shrink-0 flex-col items-center justify-center gap-2 lg:hidden"
      >
        <span className="h-1 w-9 rounded-full bg-studio-ink/15" />
        <span className="text-[11px] font-medium text-muted-foreground">
          {count} blocks · tap to {open ? "hide" : "add"}
        </span>
      </button>

      <div className="shrink-0 px-3 pb-2 pt-3 lg:pt-4">
        <div className="flex items-center gap-2 rounded-xl border border-border bg-studio-ash/60 px-3 py-2">
          <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search blocks…"
            className="w-full bg-transparent text-[12px] text-studio-ink placeholder:text-muted-foreground focus:outline-none"
          />
          {query && (
            <button type="button" aria-label="Clear search" onClick={() => setQuery("")}>
              <X className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
          )}
        </div>
      </div>

      <div className="thin-scroll min-h-0 flex-1 overflow-y-auto px-2 pb-3">
        {results ? (
          results.length ? (
            results.map((type) => <FlowPaletteItem key={type} type={type} onAdd={onAdd} />)
          ) : (
            <p className="px-3 py-8 text-center text-[11.5px] text-muted-foreground">No blocks match</p>
          )
        ) : (
          SECTIONS.map((section) => {
            const isClosed = !!closed[section.id];
            const items = section.groups ? section.groups.flatMap((g) => g.items) : section.items;
            return (
              <div key={section.id} className="mb-0.5">
                <button
                  type="button"
                  onClick={() => toggleSection(section.id)}
                  className="flex w-full items-center gap-2 rounded-lg px-2 py-2"
                >
                  <ChevronDown
                    className={cn(
                      "h-3.5 w-3.5 text-muted-foreground transition-transform",
                      isClosed && "-rotate-90",
                    )}
                  />
                  <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-studio-ink/70">
                    {section.title}
                  </span>
                  <span className="ml-auto text-[10px] text-muted-foreground">{items.length}</span>
                </button>

                {!isClosed &&
                  (section.groups ? (
                    section.groups.map((group) => (
                      <div key={group.label} className="mb-1">
                        <p className="px-3 pb-1 pt-1.5 text-[9px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                          {group.label}
                        </p>
                        {group.items.map((type) => (
                          <FlowPaletteItem key={`${group.label}-${type}`} type={type} onAdd={onAdd} />
                        ))}
                      </div>
                    ))
                  ) : (
                    section.items.map((type) => <FlowPaletteItem key={type} type={type} onAdd={onAdd} />)
                  ))}
              </div>
            );
          })
        )}
      </div>

      <div className="shrink-0 border-t border-border px-3 py-3">
        {presetsOpen && (
          <div className="mb-2 grid gap-1">
            <p className="px-1 pb-1 text-[9px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Starting points
            </p>
            {PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => {
                  onPreset(preset);
                  setPresetsOpen(false);
                }}
                className="flex items-center gap-2 rounded-xl bg-studio-ash px-2.5 py-2 text-left text-[11.5px] text-studio-ink transition-colors hover:bg-accent"
              >
                <span className="min-w-0 truncate">{preset.name}</span>
                <span className="ml-auto shrink-0 text-[10px] text-muted-foreground">
                  {preset.types.length}
                </span>
              </button>
            ))}
          </div>
        )}

        <button
          type="button"
          onClick={() => setPresetsOpen((v) => !v)}
          className="flex w-full items-center gap-2 rounded-xl bg-studio-ash px-3 py-2.5 transition-colors hover:bg-accent"
        >
          <Sparkles className="h-3.5 w-3.5 text-studio-ink" />
          <span className="text-[12px] font-medium text-studio-ink">AI Help</span>
          <span className="rounded-full bg-studio-lime px-1.5 py-[1px] text-[8.5px] font-bold uppercase tracking-wide text-studio-ink">
            beta
          </span>
          <ChevronDown
            className={cn(
              "ml-auto h-3.5 w-3.5 text-muted-foreground transition-transform",
              presetsOpen && "rotate-180",
            )}
          />
        </button>
      </div>
    </aside>
  );
}