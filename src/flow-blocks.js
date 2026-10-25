import {
  BookOpen,
  Bot,
  Braces,
  FileSpreadsheet,
  FileText,
  GitBranch,
  HardDrive,
  Layers,
  MessageCircle,
  Palette,
  Plus,
  Slack,
  Timer,
  Variable,
  Webhook,
  Zap,
} from "lucide-react";

/**
 * Block catalog. `tile` holds full Tailwind class strings on purpose —
 * dynamic class names are purged by the build.
 */
export const BLOCKS = {
  trigger: { name: "Basic trigger", short: "Trigger", icon: Zap, tile: "bg-lime-100 text-lime-700" },
  sleep: { name: "Sleep", short: "Sleep", icon: Timer, tile: "bg-slate-100 text-slate-600" },
  setvars: { name: "Set multiple variables", short: "Set vars", icon: Variable, tile: "bg-cyan-100 text-cyan-700" },
  getvars: { name: "Get multiple variables", short: "Get vars", icon: Layers, tile: "bg-sky-100 text-sky-700" },
  getvar: { name: "Get variable", short: "Get var", icon: Braces, tile: "bg-sky-100 text-sky-700" },
  increment: { name: "Increment function", short: "Increment", icon: Plus, tile: "bg-cyan-100 text-cyan-700" },
  text: { name: "Text Parcel", short: "Text", icon: FileText, tile: "bg-stone-100 text-stone-700" },
  sheets: { name: "Google Sheets", short: "Sheets", icon: FileSpreadsheet, tile: "bg-emerald-100 text-emerald-700" },
  webhook: { name: "Webhooks", short: "Webhooks", icon: Webhook, tile: "bg-indigo-100 text-indigo-700" },
  slack: { name: "Slack", short: "Slack", icon: Slack, tile: "bg-violet-100 text-violet-700" },
  openai: { name: "Chat GPT", short: "Chat GPT", icon: Bot, tile: "bg-teal-100 text-teal-700" },
  gdrive: { name: "Google Drive", short: "Drive", icon: HardDrive, tile: "bg-amber-100 text-amber-700" },
  canva: { name: "Canva", short: "Canva", icon: Palette, tile: "bg-fuchsia-100 text-fuchsia-700" },
  discord: { name: "Discord", short: "Discord", icon: MessageCircle, tile: "bg-indigo-100 text-indigo-700" },
  notion: { name: "Notion", short: "Notion", icon: BookOpen, tile: "bg-stone-200 text-stone-800" },
  github: { name: "GitHub", short: "GitHub", icon: GitBranch, tile: "bg-zinc-200 text-zinc-800" },
};

export const SECTIONS = [
  {
    id: "flow",
    title: "Flow Control",
    items: ["sleep", "setvars", "getvars", "getvar", "increment"],
  },
  {
    id: "tools",
    title: "Tools",
    groups: [
      { label: "Triggers", items: ["trigger", "webhook"] },
      { label: "Actions", items: ["getvars", "getvar", "increment", "setvars", "sleep"] },
    ],
  },
  { id: "text", title: "Text Parcel", items: ["text"] },
  { id: "sheets", title: "Google Sheets", items: ["sheets"] },
  { id: "drive", title: "Google Drive", items: ["gdrive"] },
  {
    id: "apps",
    title: "Apps",
    items: ["slack", "openai", "canva", "discord", "notion", "github"],
  },
];

export const DEFAULT_FLOW = ["webhook", "slack", "openai", "gdrive", "canva", "discord", "notion"];

export const PRESETS = [
  {
    id: "release",
    name: "Android release pipeline",
    types: ["webhook", "github", "openai", "notion"],
  },
  {
    id: "notify",
    name: "Webhook → AI → Slack",
    types: ["webhook", "openai", "slack"],
  },
  {
    id: "nightly",
    name: "Nightly variable sync",
    types: ["trigger", "getvars", "setvars", "sheets"],
  },
];

export const ALL_TYPES = SECTIONS.flatMap((s) =>
  s.groups ? s.groups.flatMap((g) => g.items) : s.items,
).filter((v, i, a) => a.indexOf(v) === i);