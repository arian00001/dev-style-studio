import { Link } from "@tanstack/react-router";
import { Home, RotateCcw, Settings2, Sparkles } from "lucide-react";
import { useStudio } from "@/components/studio/StudioProvider";

const itemClass =
  "grid h-11 w-11 place-items-center rounded-2xl text-white/55 transition-colors hover:bg-white/10 hover:text-white";

export function StudioSidebar() {
  const { reset } = useStudio();

  return (
    <aside className="glass-dark sticky top-5 hidden h-[calc(100vh-2.5rem)] w-[76px] shrink-0 flex-col items-center gap-2 rounded-[26px] py-4 lg:flex">
      <span className="grid h-11 w-11 place-items-center rounded-2xl bg-studio-lime shadow-[0_10px_30px_-12px_rgba(199,251,80,0.9)]">
        <span className="font-display text-[15px] font-bold tracking-tight text-studio-ink">DS</span>
      </span>

      <div className="mt-3 flex flex-col items-center gap-1.5">
        <Link to="/" className={itemClass} aria-label="Studio">
          <Home className="h-[18px] w-[18px]" />
        </Link>
        <button type="button" onClick={reset} className={itemClass} aria-label="Start over">
          <RotateCcw className="h-[18px] w-[18px]" />
        </button>
        <Link to="/settings" className={itemClass} aria-label="Settings">
          <Settings2 className="h-[18px] w-[18px]" />
        </Link>
      </div>

      <div className="mt-auto flex flex-col items-center gap-2">
        <span className="grid h-9 w-9 place-items-center rounded-full bg-white/10">
          <Sparkles className="h-4 w-4 text-studio-lime" />
        </span>
        <span className="text-[9px] uppercase tracking-[0.18em] text-white/35">beta</span>
      </div>
    </aside>
  );
}
