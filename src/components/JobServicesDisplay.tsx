import type { JobService } from "@/data/mockData";
import type { ServiceCategory } from "@/hooks/useSupabaseData";
import { Briefcase } from "lucide-react";

interface Props {
  services: JobService[];
  categories?: ServiceCategory[];
  compact?: boolean;
}

function getCode(name: string, categories?: ServiceCategory[]): string {
  if (!categories) return name;
  const cat = categories.find((c) => c.name === name);
  return cat?.code || name;
}

export function JobServicesDisplay({ services, categories, compact = false }: Props) {
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
              <span className="font-medium">
                {svc.service_category}
                {categories && <span className="text-muted-foreground ml-1 text-xs">({getCode(svc.service_category, categories)})</span>}
              </span>
              <span className="text-muted-foreground shrink-0">
                {svc.quantity > 1 ? `${svc.quantity} × ` : ""}
                {svc.unit_price != null ? formatCAD(svc.unit_price) : ""}
                {svc.line_total > 0 ? ` = ${formatCAD(svc.line_total)}` : ""}
              </span>
            </div>
            {svc.notes && <p className="text-xs text-muted-foreground mt-0.5">{svc.notes}</p>}
          </div>
        </div>
      ))}
    </div>
  );
}

/** Compact codes string for Jobs list: "wc + gc + pw" or "wc(2) + gc" */
export function JobServicesCodesSummary({ services, categories, fallbackCategory }: { services?: JobService[]; categories?: ServiceCategory[]; fallbackCategory?: string }) {
  if (!services || services.length === 0) {
    if (fallbackCategory) {
      const code = getCode(fallbackCategory, categories);
      return <span className="font-mono text-xs">{code}</span>;
    }
    return <span className="text-muted-foreground">—</span>;
  }
  const parts = services.map((svc) => {
    const code = getCode(svc.service_category, categories);
    return svc.quantity > 1 ? `${code}(${svc.quantity})` : code;
  });
  return <span className="font-mono text-xs">{parts.join(" + ")}</span>;
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
