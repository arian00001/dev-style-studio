import { useMemo, useState } from "react";
import { ChevronRight, File, FileCode2, FileJson, FileText, Folder, FolderOpen, Image as ImageIcon } from "lucide-react";

const EXT = {
  js: FileCode2,
  jsx: FileCode2,
  ts: FileCode2,
  tsx: FileCode2,
  kt: FileCode2,
  java: FileCode2,
  gradle: FileCode2,
  kts: FileCode2,
  json: FileJson,
  xml: FileCode2,
  yml: FileText,
  yaml: FileText,
  md: FileText,
  txt: FileText,
  png: ImageIcon,
  jpg: ImageIcon,
  jpeg: ImageIcon,
  webp: ImageIcon,
  svg: ImageIcon,
};

function iconFor(name) {
  const ext = name.split(".").pop()?.toLowerCase();
  return EXT[ext] || File;
}

function Row({ node, depth, query }) {
  const [open, setOpen] = useState(depth < 1);
  const Icon = node.type === "dir" ? (open ? FolderOpen : Folder) : iconFor(node.name);

  if (node.type === "dir") {
    return (
      <div>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex w-full items-center gap-1.5 rounded-lg px-1.5 py-[5px] text-left transition-colors hover:bg-studio-ash"
          style={{ paddingLeft: 6 + depth * 12 }}
        >
          <ChevronRight
            className={`h-3 w-3 shrink-0 text-muted-foreground transition-transform ${open ? "rotate-90" : ""}`}
          />
          <Folder className="h-3.5 w-3.5 shrink-0 text-studio-ink" />
          <span className="min-w-0 truncate font-mono text-[11.5px] text-studio-ink">{node.name}</span>
          <span className="ml-auto shrink-0 pl-2 font-mono text-[10px] text-muted-foreground">
            {node.children.filter((c) => c.type === "file").length || ""}
          </span>
        </button>
        {open && (
          <div>
            {node.children.map((child) => (
              <Row key={child.path} node={child} depth={depth + 1} query={query} />
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      className="flex items-center gap-1.5 rounded-lg py-[5px] pr-1.5 transition-colors hover:bg-studio-ash"
      style={{ paddingLeft: 6 + depth * 12 + 14 }}
    >
      <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      <span className="min-w-0 truncate font-mono text-[11.5px] text-studio-ink/80">{node.name}</span>
    </div>
  );
}

export function FileTree({ nodes }) {
  const [query, setQuery] = useState("");

  const flat = useMemo(() => {
    if (!query.trim()) return null;
    const q = query.toLowerCase();
    const out = [];
    const walk = (list) => {
      list.forEach((n) => {
        if (n.type === "dir") walk(n.children);
        else if (n.path.toLowerCase().includes(q)) out.push(n);
      });
    };
    walk(nodes);
    return out.slice(0, 200);
  }, [nodes, query]);

  return (
    <div className="rounded-2xl border border-border bg-white">
      <div className="flex items-center gap-2 border-b border-border px-3 py-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filter files…"
          className="w-full bg-transparent font-mono text-[11.5px] text-studio-ink placeholder:text-muted-foreground focus:outline-none"
        />
        <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
          {flat ? flat.length : nodes.length}
        </span>
      </div>
      <div className="thin-scroll max-h-[380px] overflow-y-auto px-2 py-2">
        {flat ? (
          flat.length ? (
            flat.map((n) => (
              <div key={n.path} className="flex items-center gap-2 rounded-lg px-2 py-[5px] hover:bg-studio-ash">
                <File className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <span className="min-w-0 truncate font-mono text-[11.5px] text-studio-ink/80">{n.path}</span>
              </div>
            ))
          ) : (
            <p className="px-2 py-6 text-center font-mono text-[11.5px] text-muted-foreground">No matches</p>
          )
        ) : (
          nodes.map((n) => <Row key={n.path} node={n} depth={0} query={query} />)
        )}
      </div>
    </div>
  );
}