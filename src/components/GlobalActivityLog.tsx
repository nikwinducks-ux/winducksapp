import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  useGlobalActivityLog,
  useCustomers,
  useJobs,
  type CustomerActivityLogEntry,
} from "@/hooks/useSupabaseData";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, Search } from "lucide-react";
import {
  ACTIVITY_EVENT_GROUPS,
  getActivityIcon,
  relativeTime,
  type ActivityFilterKey,
} from "@/components/activityLogIcons";

interface Props {
  onNavigate?: () => void;
}

interface EnrichedEntry extends CustomerActivityLogEntry {
  customerName: string;
  jobNumber: string;
}

export function GlobalActivityLog({ onNavigate }: Props) {
  const navigate = useNavigate();
  const { data: entries = [], isLoading, error } = useGlobalActivityLog(200);
  const { data: customers = [] } = useCustomers();
  const { data: jobs = [] } = useJobs();
  const [filter, setFilter] = useState<ActivityFilterKey>("all");
  const [search, setSearch] = useState("");

  const customerMap = useMemo(
    () => new Map(customers.map((c) => [c.id, c.name])),
    [customers],
  );
  const jobMap = useMemo(
    () => new Map(jobs.map((j) => [j.dbId, j.id])),
    [jobs],
  );

  const enriched: EnrichedEntry[] = useMemo(
    () =>
      entries.map((e) => ({
        ...e,
        customerName: customerMap.get(e.customer_id) ?? "",
        jobNumber: e.job_id ? jobMap.get(e.job_id) ?? "" : "",
      })),
    [entries, customerMap, jobMap],
  );

  const filtered = useMemo(() => {
    let rows = enriched;
    if (filter !== "all") {
      const allowed = ACTIVITY_EVENT_GROUPS[filter];
      rows = rows.filter((e) => allowed.includes(e.event_type));
    }
    const q = search.trim().toLowerCase();
    if (q) {
      rows = rows.filter(
        (e) =>
          e.summary.toLowerCase().includes(q) ||
          e.customerName.toLowerCase().includes(q) ||
          e.jobNumber.toLowerCase().includes(q) ||
          e.actor_email.toLowerCase().includes(q),
      );
    }
    return rows;
  }, [enriched, filter, search]);

  const filters: { key: ActivityFilterKey; label: string }[] = [
    { key: "all", label: "All" },
    { key: "jobs", label: "Jobs" },
    { key: "services", label: "Services" },
    { key: "photos", label: "Photos" },
    { key: "customers", label: "Customers" },
  ];

  const handleRowClick = (entry: EnrichedEntry) => {
    if (!entry.customer_id) return;
    navigate(`/admin/customers/${entry.customer_id}`);
    onNavigate?.();
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="space-y-3 pb-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search summary, customer, job, actor…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex flex-wrap gap-2">
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
      </div>
      <ScrollArea className="flex-1 -mx-6 px-6">
        {isLoading ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Loading activity…</p>
        ) : error ? (
          <p className="py-8 text-center text-sm text-destructive">Failed to load activity.</p>
        ) : filtered.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            {entries.length === 0 ? "No activity recorded yet." : "No matching activity."}
          </p>
        ) : (
          <div className="space-y-4">
            {filtered.map((entry) => (
              <ActivityRow key={entry.id} entry={entry} onClick={() => handleRowClick(entry)} />
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}

function ActivityRow({ entry, onClick }: { entry: EnrichedEntry; onClick: () => void }) {
  const [open, setOpen] = useState(false);
  const Icon = getActivityIcon(entry.event_type);
  const hasDetails = entry.details && Object.keys(entry.details).length > 0;
  const contextParts = [entry.customerName, entry.jobNumber].filter(Boolean);

  return (
    <div className="flex gap-3 pb-4 border-b border-border last:border-0">
      <div className="mt-0.5 h-8 w-8 shrink-0 rounded-full bg-secondary flex items-center justify-center text-muted-foreground">
        <Icon className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0">
        <button
          onClick={onClick}
          className="text-left text-sm font-medium text-foreground hover:text-primary hover:underline"
        >
          {entry.summary}
        </button>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          {contextParts.length > 0 && <span>{contextParts.join(" · ")}</span>}
          {contextParts.length > 0 && <span>·</span>}
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
