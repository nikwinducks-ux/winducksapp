import { StatusBadge } from "@/components/StatusBadge";
import { Plug, Link2, Webhook, Activity } from "lucide-react";

const integrations = [
  {
    name: "Jobber Integration",
    desc: "Sync jobs, customers, and invoices with Jobber",
    status: "Not Connected",
    icon: Link2,
  },
  {
    name: "GHL Integration",
    desc: "GoHighLevel CRM and marketing automation",
    status: "Not Connected",
    icon: Link2,
  },
  {
    name: "Webhook Status",
    desc: "Outbound event webhooks for job lifecycle events",
    status: "Not Connected",
    icon: Webhook,
  },
  {
    name: "API Health",
    desc: "REST API endpoint status and latency",
    status: "Not Connected",
    icon: Activity,
  },
];

export default function Integrations() {
  return (
    <div className="space-y-8 animate-fade-in max-w-3xl">
      <div>
        <h1 className="page-header">Integrations</h1>
        <p className="mt-1 text-sm text-muted-foreground">External system connections (placeholders)</p>
      </div>

      <div className="space-y-3">
        {integrations.map((integration) => (
          <div key={integration.name} className="metric-card flex items-center gap-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-secondary">
              <integration.icon className="h-5 w-5 text-muted-foreground" />
            </div>
            <div className="flex-1">
              <p className="font-semibold">{integration.name}</p>
              <p className="text-sm text-muted-foreground">{integration.desc}</p>
            </div>
            <StatusBadge label={integration.status} variant="neutral" />
          </div>
        ))}
      </div>

      <div className="metric-card bg-muted/50">
        <div className="flex items-center gap-2 mb-2">
          <Plug className="h-4 w-4 text-muted-foreground" />
          <p className="text-sm font-medium text-muted-foreground">Integration Placeholders</p>
        </div>
        <p className="text-xs text-muted-foreground">
          These integration slots are for future backend connections. No actual API calls are made in this prototype.
        </p>
      </div>
    </div>
  );
}
