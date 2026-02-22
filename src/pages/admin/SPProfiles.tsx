import { serviceProviders } from "@/data/mockData";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useState } from "react";
import { ScoreBar } from "@/components/ScoreBar";
import { ChevronDown, ChevronUp } from "lucide-react";

export default function SPProfiles() {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [suspended, setSuspended] = useState<Record<string, boolean>>(
    Object.fromEntries(serviceProviders.map((sp) => [sp.id, sp.complianceStatus === "Suspended"]))
  );

  return (
    <div className="space-y-8 animate-fade-in">
      <div>
        <h1 className="page-header">Service Providers</h1>
        <p className="mt-1 text-sm text-muted-foreground">{serviceProviders.length} registered providers</p>
      </div>

      <div className="space-y-3">
        {serviceProviders.map((sp) => (
          <div key={sp.id} className="metric-card">
            <div
              className="flex items-center gap-4 cursor-pointer"
              onClick={() => setExpanded(expanded === sp.id ? null : sp.id)}
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold text-sm">
                {sp.avatar}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-semibold">{sp.name}</p>
                  <StatusBadge
                    label={suspended[sp.id] ? "Suspended" : sp.complianceStatus}
                    variant={suspended[sp.id] ? "error" : sp.complianceStatus === "Valid" ? "valid" : "warning"}
                  />
                </div>
                <p className="text-sm text-muted-foreground">{sp.serviceCategories.join(", ")}</p>
              </div>
              <div className="flex items-center gap-4 text-sm">
                <span>⭐ {sp.rating}</span>
                <span className="text-muted-foreground">{sp.totalJobsCompleted} jobs</span>
                {expanded === sp.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </div>
            </div>

            {expanded === sp.id && (
              <div className="mt-4 pt-4 border-t space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Email</p>
                    <p className="text-sm">{sp.email}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Phone</p>
                    <p className="text-sm">{sp.phone}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Insurance Expiry</p>
                    <p className="text-sm">{sp.insuranceExpiry}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Certifications</p>
                    <div className="flex flex-wrap gap-1">
                      {sp.certifications.map((c) => (
                        <span key={c} className="status-badge bg-secondary text-secondary-foreground">{c}</span>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <ScoreBar label="Reliability" value={sp.reliabilityScore} />
                  <ScoreBar label="Completion Rate" value={sp.completionRate} />
                  <ScoreBar label="Acceptance Rate" value={sp.acceptanceRate} />
                </div>

                <div className="flex items-center gap-4 pt-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">Suspended</span>
                    <Switch
                      checked={suspended[sp.id]}
                      onCheckedChange={(v) => setSuspended({ ...suspended, [sp.id]: v })}
                    />
                  </div>
                  <Button size="sm" variant="outline">Manual Allocation Override</Button>
                  <Button size="sm">Force Assign Job</Button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
