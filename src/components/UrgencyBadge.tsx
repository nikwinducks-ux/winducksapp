import { Badge } from "@/components/ui/badge";

export const URGENCY_PRIORITY: Record<string, number> = {
  ASAP: 0,
  "Anytime soon": 1,
  Scheduled: 2,
};

const urgencyStyle = (urgency: string) => {
  switch (urgency) {
    case "ASAP":
      return "bg-red-100 text-red-700 border-red-300";
    case "Anytime soon":
      return "bg-yellow-100 text-yellow-800 border-yellow-300";
    default:
      return "bg-green-100 text-green-700 border-green-300";
  }
};

export function UrgencyBadge({ urgency }: { urgency?: string }) {
  const label = urgency || "Scheduled";
  return (
    <Badge variant="outline" className={`text-xs font-medium ${urgencyStyle(label)}`}>
      {label}
    </Badge>
  );
}
