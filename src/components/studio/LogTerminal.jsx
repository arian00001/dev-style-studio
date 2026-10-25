import { useEffect } from "react";
import { cn } from "@/lib/utils";

export function LogTerminal({ text, status = "idle", className }) {
  useEffect(() => {
    const el = document.getElementById("dss-log");
    if (el) el.scrollTop = el.scrollHeight;
  }, [text]);

  return (
    <div className={cn("overflow-hidden rounded-2xl bg-studio-ink", className)}>
      <div className="flex items-center justify-between border-b border-white/10 px-3 py-2">
        <div className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-white/25" />
          <span className="h-2 w-2 rounded-full bg-white/25" />
          <span className="h-2 w-2 rounded-full bg-studio-lime" />
          <span className="ml-2 font-mono text-[10px] uppercase tracking-[0.16em] text-white/50">build log</span>
        </div>
        <span className="font-mono text-[10px] text-white/40">{status}</span>
      </div>
      <pre
        id="dss-log"
        className="thin-scroll max-h-64 overflow-auto whitespace-pre-wrap break-words px-3 py-3 font-mono text-[10.5px] leading-relaxed text-white/75"
      >
        {text || "Waiting for log output…"}
      </pre>
    </div>
  );
}