import { useMemo, useState } from "react";
import { useCustomerActivityLog, type CustomerActivityLogEntry } from "@/hooks/useSupabaseData";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown } from "lucide-react";
import { ACTIVITY_EVENT_GROUPS, getActivityIcon, relativeTime, type ActivityFilterKey } from "@/components/activityLogIcons";

interface Props {
  customerId: string;
}

type FilterKey = Exclude<ActivityFilterKey, "customers"> | "profile";

const LOCAL_GROUPS: Record<FilterKey, string[]> = {
  all: [],
  jobs: ACTIVITY_EVENT_GROUPS.jobs,
  services: ACTIVITY_EVENT_GROUPS.services,
  photos: ACTIVITY_EVENT_GROUPS.photos,
  profile: ACTIVITY_EVENT_GROUPS.customers,
};

function ActivityItem({ entry }: { entry: CustomerActivityLogEntry }) {
  const [open, setOpen] = useState(false);
  const hasDetails = entry.details && Object.keys(entry.details).length > 0;
  const Icon = getActivityIcon(entry.event_type);

  return (
    <div className="flex gap-3 pb-4 border-b border-border last:border-0">
      <div className="mt-0.5 h-8 w-8 shrink-0 rounded-full bg-secondary flex items-center justify-center text-muted-foreground">
        <Icon className="h-4 w-4" />
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
    const allowed = LOCAL_GROUPS[filter];
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
