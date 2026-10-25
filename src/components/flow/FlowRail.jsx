import { Link, useLocation } from "@tanstack/react-router";
import { Home, Settings2, Workflow } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { cn } from "@/lib/utils";

const ITEMS = [
  { to: "/", label: "Studio", icon: Home },
  { to: "/flow", label: "Flow", icon: Workflow },
  { to: "/settings", label: "Settings", icon: Settings2 },
];

export function FlowRail() {
  const { pathname } = useLocation();
  const { user } = useAuth();
  const initials = (user?.full_name || user?.email || "DS").trim().slice(0, 2).toUpperCase();

  return (
    <aside className="relative z-20 flex h-full w-[58px] shrink-0 flex-col items-center gap-1.5 bg-studio-ink py-4">
      <Link
        to="/"
        aria-label="Dev Style Studio"
        className="mb-2 grid h-9 w-9 place-items-center rounded-xl bg-white/[0.07] font-display text-[13px] font-bold tracking-tight text-studio-lime"
      >
        DS
      </Link>
      <span className="mb-1 h-px w-5 bg-white/10" />

      {ITEMS.map(({ to, label, icon: Icon }) => {
        const active = pathname === to;
        return (
          <Link
            key={to}
            to={to}
            title={label}
            aria-label={label}
            className={cn(
              "relative grid h-9 w-9 place-items-center rounded-xl transition-colors",
              active
                ? "bg-white/[0.1] text-studio-lime"
                : "text-white/40 hover:bg-white/[0.06] hover:text-white/80",
            )}
          >
            <Icon className="h-[17px] w-[17px]" />
            {active && <span className="absolute -left-[9px] h-4 w-[3px] rounded-full bg-studio-lime" />}
          </Link>
        );
      })}

      <div className="mt-auto flex flex-col items-center gap-2">
        <Link
          to="/settings"
          title="Account"
          className="grid h-8 w-8 place-items-center rounded-full bg-studio-lime font-display text-[10px] font-bold text-studio-ink transition-transform hover:scale-105"
        >
          {initials}
        </Link>
      </div>
    </aside>
  );
}