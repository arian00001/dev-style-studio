import { base44 } from "@/api/base44Client";

export function logEvent(entry) {
  base44.entities.ActivityEvent.create({
    status: "info",
    ...entry,
  }).catch(() => {});
}