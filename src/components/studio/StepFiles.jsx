import { ArrowRight, ArrowLeft, Boxes, FileArchive, GitBranch, HardDrive } from "lucide-react";
import { useStudio } from "@/components/studio/StudioProvider";
import { FileTree } from "@/components/studio/FileTree";
import { PROJECT_TYPES } from "@/lib/project-detect";
import { formatBytes } from "@/lib/format";

const TONE = {
  lime: "bg-studio-lime/25 text-studio-ink border-studio-lime/60",
  blue: "bg-sky-50 text-sky-900 border-sky-200",
  amber: "bg-amber-50 text-amber-900 border-amber-200",
  grey: "bg-studio-ash text-muted-foreground border-border",
};

export function StepFiles() {
  const { project, zip, setStep } = useStudio();
  if (!project) return null;

  const type = PROJECT_TYPES[project.info.type] || PROJECT_TYPES.unknown;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-[26px] font-semibold leading-[1.15] tracking-tight text-studio-ink">
          Extracted project
        </h1>
        <p className="mt-2 max-w-md text-[13px] leading-relaxed text-muted-foreground">
          Every folder and file was read from the archive. Nothing has left this device yet.
        </p>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-white">
        <div className="flex items-center gap-3 border-b border-border px-4 py-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-studio-ash">
            <FileArchive className="h-5 w-5 text-studio-ink" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate font-display text-[13px] font-semibold text-studio-ink">{zip?.file?.name}</p>
            <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
              {formatBytes(zip?.file?.size || 0)} archive · {project.stats.files} files extracted
            </p>
          </div>
          <span className={`shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-medium ${TONE[type.tone]}`}>
            {type.label}
          </span>
        </div>

        <div className="grid grid-cols-3 divide-x divide-border">
          <Stat icon={Boxes} label="Files" value={project.stats.files.toLocaleString("en-US")} />
          <Stat icon={HardDrive} label="Unpacked" value={formatBytes(project.stats.bytes)} />
          <Stat
            icon={GitBranch}
            label="Workflows"
            value={project.info.workflows.length ? String(project.info.workflows.length) : "none"}
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        <span className="rounded-full bg-studio-ash px-2.5 py-1 font-mono text-[10.5px] text-studio-ink">
          {project.info.framework}
        </span>
        {project.info.buildCommand && (
          <span className="rounded-full bg-studio-ash px-2.5 py-1 font-mono text-[10.5px] text-studio-ink">
            {project.info.buildCommand}
          </span>
        )}
        {project.info.workflows.slice(0, 2).map((w) => (
          <span key={w} className="rounded-full bg-studio-lime/25 px-2.5 py-1 font-mono text-[10.5px] text-studio-ink">
            {w.split("/").pop()}
          </span>
        ))}
      </div>

      <FileTree nodes={project.tree} />

      <div className="flex items-center gap-2 pt-1">
        <button
          type="button"
          onClick={() => setStep(0)}
          className="inline-flex items-center gap-1.5 rounded-full border border-border px-4 py-3 font-display text-[12.5px] font-medium text-muted-foreground transition-colors hover:border-studio-ink hover:text-studio-ink"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back
        </button>
        <button
          type="button"
          onClick={() => setStep(2)}
          className="group inline-flex flex-1 items-center justify-center gap-2 rounded-full bg-studio-ink px-5 py-3 font-display text-[13px] font-semibold text-white transition-all hover:bg-studio-ink/90"
        >
          Continue
          <ArrowRight className="h-4 w-4 text-studio-lime transition-transform group-hover:translate-x-0.5" />
        </button>
      </div>
    </div>
  );
}

function Stat({ icon: Icon, label, value }) {
  return (
    <div className="px-3 py-3">
      <div className="flex items-center gap-1.5 text-muted-foreground">
        <Icon className="h-3 w-3" />
        <span className="text-[9.5px] uppercase tracking-[0.14em]">{label}</span>
      </div>
      <p className="mt-1 font-display text-[15px] font-semibold tabular-nums text-studio-ink">{value}</p>
    </div>
  );
}