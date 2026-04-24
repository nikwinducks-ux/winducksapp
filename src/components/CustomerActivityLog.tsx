import { useMemo, useState } from "react";
import { useCustomerActivityLog, type CustomerActivityLogEntry } from "@/hooks/useSupabaseData";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Plus, Pencil, Trash2, Calendar, UserCheck, UserMinus, CheckCircle2, XCircle,
  DollarSign, MapPin, FileText, AlertTriangle, Image, Package, User, ChevronDown, History,
} from "lucide-react";

interface Props {
  customerId: string;
}

type FilterKey = "all" | "jobs" | "services" | "photos" | "profile";

const EVENT_GROUPS: Record<FilterKey, string[]> = {
  all: [],
  jobs: [
    "job_created", "job_scheduled", "job_rescheduled", "job_assigned", "job_unassigned",
    "job_status_changed", "job_completed", "job_cancelled", "job_deleted",
    "job_payout_changed", "job_address_changed", "job_notes_changed", "job_urgency_changed",
  ],
  services: ["service_added", "service_updated", "service_removed"],
  photos: ["photo_added", "photo_removed"],
  profile: ["customer_created", "customer_updated"],
};

function eventIcon(type: string) {
  const cls = "h-4 w-4";
  switch (type) {
    case "job_created": return <Plus className={cls} />;
    case "job_scheduled":
    case "job_rescheduled": return <Calendar className={cls} />;
    case "job_assigned": return <UserCheck className={cls} />;
    case "job_unassigned": return <UserMinus className={cls} />;
    case "job_completed": return <CheckCircle2 className={cls} />;
    case "job_cancelled":
    case "job_deleted": return <XCircle className={cls} />;
    case "job_status_changed":
    case "job_urgency_changed": return <AlertTriangle className={cls} />;
    case "job_payout_changed": return <DollarSign className={cls} />;
    case "job_address_changed": return <MapPin className={cls} />;
    case "job_notes_changed": return <FileText className={cls} />;
    case "service_added":
    case "service_updated":
    case "service_removed": return <Package className={cls} />;
    case "photo_added":
    case "photo_removed": return <Image className={cls} />;
    case "customer_created":
    case "customer_updated": return <User className={cls} />;
    default: return <History className={cls} />;
  }
}

function relativeTime(iso: string): string {
  const d = new Date(iso);
  const diffMs = Date.now() - d.getTime();
  const sec = Math.floor(diffMs / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day}d ago`;
  return d.toLocaleDateString();
}

function ActivityItem({ entry }: { entry: CustomerActivityLogEntry }) {
  const [open, setOpen] = useState(false);
  const hasDetails = entry.details && Object.keys(entry.details).length > 0;

  return (
    <div className="flex gap-3 pb-4 border-b border-border last:border-0">
      <div className="mt-0.5 h-8 w-8 shrink-0 rounded-full bg-secondary flex items-center justify-center text-muted-foreground">
        {eventIcon(entry.event_type)}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground">{entry.summary}</p>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span title={new Date(entry.created_at).toLocaleString()}>{relativeTime(entry.created_at)}</span>
          {entry.actor_email && (
            <>
              <span>·</span>
              <span>{entry.actor_email}</span>
            </>
          )}
          {entry.actor_role && (
            <Badge variant="outline" className="text-[10px] py-0 px-1.5 h-4 capitalize">{entry.actor_role}</Badge>
          )}
        </div>
        {hasDetails && (
          <Collapsible open={open} onOpenChange={setOpen} className="mt-2">
            <CollapsibleTrigger asChild>
              <button className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                <ChevronDown className={`h-3 w-3 transition-transform ${open ? "rotate-180" : ""}`} />
                {open ? "Hide details" : "Show details"}
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-2">
              <pre className="text-[11px] bg-muted/50 rounded-md p-2 overflow-x-auto max-w-full whitespace-pre-wrap break-words">
                {JSON.stringify(entry.details, null, 2)}
              </pre>
            </CollapsibleContent>
          </Collapsible>
        )}
      </div>
    </div>
  );
}

export function CustomerActivityLog({ customerId }: Props) {
  const { data: entries = [], isLoading } = useCustomerActivityLog(customerId);
  const [filter, setFilter] = useState<FilterKey>("all");

  const filtered = useMemo(() => {
    if (filter === "all") return entries;
    const allowed = EVENT_GROUPS[filter];
    return entries.filter((e) => allowed.includes(e.event_type));
  }, [entries, filter]);

  const filters: { key: FilterKey; label: string }[] = [
    { key: "all", label: "All" },
    { key: "jobs", label: "Jobs" },
    { key: "services", label: "Services" },
    { key: "photos", label: "Photos" },
    { key: "profile", label: "Profile" },
  ];

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex flex-wrap gap-2 pb-4">
        {filters.map((f) => (
          <Button
            key={f.key}
            size="sm"
            variant={filter === f.key ? "default" : "outline"}
            onClick={() => setFilter(f.key)}
          >
            {f.label}
          </Button>
        ))}
      </div>
      <ScrollArea className="flex-1 -mx-6 px-6">
        {isLoading ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Loading activity…</p>
        ) : filtered.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            {entries.length === 0 ? "No activity recorded yet." : "No matching activity."}
          </p>
        ) : (
          <div className="space-y-4">
            {filtered.map((entry) => (
              <ActivityItem key={entry.id} entry={entry} />
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
