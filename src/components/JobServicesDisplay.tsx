import type { JobService } from "@/data/mockData";
import { Briefcase } from "lucide-react";

interface Props {
  services: JobService[];
  compact?: boolean;
}

export function JobServicesDisplay({ services, compact = false }: Props) {
  if (!services || services.length === 0) return null;

  if (compact) {
    if (services.length === 1) {
      return <span>{services[0].service_category}</span>;
    }
    return (
      <span>
        {services[0].service_category}
        <span className="text-muted-foreground ml-1">+{services.length - 1} more</span>
      </span>
    );
  }

  return (
    <div className="space-y-2">
      {services.map((svc, i) => (
        <div key={svc.id || i} className="flex items-start gap-3 text-sm">
          <Briefcase className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium">{svc.service_category}</span>
              <span className="text-muted-foreground shrink-0">
                {svc.quantity > 1 ? `${svc.quantity} × ` : ""}
                {svc.unit_price != null ? `$${svc.unit_price}` : ""}
                {svc.line_total > 0 ? ` = $${svc.line_total}` : ""}
              </span>
            </div>
            {svc.notes && <p className="text-xs text-muted-foreground mt-0.5">{svc.notes}</p>}
          </div>
        </div>
      ))}
    </div>
  );
}

export function JobServicesSummary({ services }: { services: JobService[] }) {
  if (!services || services.length === 0) return <span className="text-muted-foreground">—</span>;
  if (services.length === 1) return <span>{services[0].service_category}</span>;
  return (
    <span>
      {services[0].service_category}
      <span className="text-muted-foreground ml-1">+{services.length - 1}</span>
    </span>
  );
}
