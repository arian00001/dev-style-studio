import { useRef, useState } from "react";
import { AlertCircle, FileArchive, Loader2, Upload } from "lucide-react";
import { useStudio } from "@/components/studio/StudioProvider";
import { formatBytes } from "@/lib/format";

export function StepUpload() {
  const { loadArchive, busy, error } = useStudio();
  const [dragging, setDragging] = useState(false);
  const [picked, setPicked] = useState(null);
  const inputRef = useRef(null);

  const handleFile = (file) => {
    if (!file) return;
    setPicked(file);
    loadArchive(file);
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-[26px] font-semibold leading-[1.15] tracking-tight text-studio-ink">
          Upload your project
        </h1>
        <p className="mt-2 max-w-md text-[13px] leading-relaxed text-muted-foreground">
          Drop in a ZIP of an Android, React or static site. The archive is opened on your device, then
          you decide where it goes.
        </p>
      </div>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          handleFile(e.dataTransfer.files?.[0]);
        }}
        className={[
          "relative overflow-hidden rounded-[26px] border-2 border-dashed bg-white/70 px-6 py-10 text-center transition-all duration-300",
          dragging ? "border-studio-ink bg-studio-lime/20" : "border-border",
        ].join(" ")}
      >
        <div className="pointer-events-none absolute inset-0 opacity-[0.04] studio-grid" />
        <div className="relative flex flex-col items-center">
          <div
            className={[
              "grid h-16 w-16 place-items-center rounded-2xl transition-transform duration-300",
              dragging ? "scale-110 bg-studio-ink text-studio-lime" : "bg-studio-ash text-studio-ink",
            ].join(" ")}
          >
            {busy ? <Loader2 className="h-7 w-7 animate-spin" /> : <Upload className="h-7 w-7" />}
          </div>

          <p className="mt-5 font-display text-[15px] font-semibold text-studio-ink">
            {busy ? busy.label : "Select Project ZIP"}
          </p>
          <p className="mt-1 text-[12px] text-muted-foreground">
            {picked && !busy ? `${picked.name} · ${formatBytes(picked.size)}` : "Tap to browse, or drag the file here"}
          </p>

          <input
            ref={inputRef}
            type="file"
            accept=".zip,application/zip,application/x-zip-compressed"
            className="hidden"
            onChange={(e) => handleFile(e.target.files?.[0])}
          />
          <button
            type="button"
            disabled={Boolean(busy)}
            onClick={() => inputRef.current?.click()}
            className="mt-5 inline-flex items-center gap-2 rounded-full bg-studio-ink px-5 py-3 font-display text-[13px] font-semibold text-white transition-all hover:bg-studio-ink/90 disabled:opacity-50"
          >
            <FileArchive className="h-4 w-4 text-studio-lime" />
            {busy ? "Working…" : "Choose a ZIP"}
          </button>
        </div>

        {busy && (
          <div className="relative mx-auto mt-6 h-1.5 w-40 overflow-hidden rounded-full bg-border">
            <div
              className="h-full rounded-full bg-studio-lime transition-all duration-300"
              style={{ width: `${Math.max(8, Math.min(100, busy.progress || 0))}%` }}
            />
          </div>
        )}
      </div>

      {error && (
        <div className="flex items-start gap-2.5 rounded-2xl border border-destructive/25 bg-destructive/5 px-4 py-3">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
          <p className="text-[12.5px] leading-relaxed text-destructive">{error}</p>
        </div>
      )}

      <div className="grid gap-2 rounded-2xl border border-border bg-white/60 px-4 py-3.5">
        <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
          Accepted
        </p>
        <p className="text-[12.5px] leading-relaxed text-studio-ink">
          Up to 500 MB — subject to your device memory. Nested folders are preserved, and archives
          containing a single top folder are unwrapped automatically.
        </p>
      </div>
    </div>
  );
}