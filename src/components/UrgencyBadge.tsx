import { Badge } from "@/components/ui/badge";

export const URGENCY_PRIORITY: Record<string, number> = {
  ASAP: 0,
  "Anytime soon": 1,
  Scheduled: 2,
};

/** Normalize any urgency string to a canonical value. */
export function normalizeUrgency(raw?: string | null): "ASAP" | "Anytime soon" | "Scheduled" {
  if (!raw) return "Scheduled";
  const key = raw.trim().toLowerCase().replace(/[\s_-]+/g, "");
  if (key === "asap") return "ASAP";
  if (key.startsWith("anytime")) return "Anytime soon";
  if (key.startsWith("sched")) return "Scheduled";
  if (import.meta.env.DEV) console.warn(`Unknown urgency value: "${raw}", defaulting to Scheduled`);
  return "Scheduled";
}

const STYLE_MAP: Record<string, string> = {
  ASAP: "bg-red-100 text-red-700 border-red-300",
  "Anytime soon": "bg-yellow-100 text-yellow-800 border-yellow-300",
  Scheduled: "bg-green-100 text-green-700 border-green-300",
};

export function UrgencyBadge({ urgency }: { urgency?: string }) {
  const canonical = normalizeUrgency(urgency);
  return (
    <Badge variant="outline" className={`text-xs font-medium ${STYLE_MAP[canonical]}`}>
      {canonical}
    </Badge>
  );
}
