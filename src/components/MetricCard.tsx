import { ReactNode } from "react";

interface MetricCardProps {
  label: string;
  value: string | number;
  icon?: ReactNode;
  subtitle?: string;
  trend?: "up" | "down" | "neutral";
  className?: string;
}

export function MetricCard({ label, value, icon, subtitle, trend, className = "" }: MetricCardProps) {
  return (
    <div className={`metric-card ${className}`}>
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="text-2xl font-bold tracking-tight">{value}</p>
          {subtitle && (
            <p className={`text-xs font-medium ${
              trend === "up" ? "text-success" : trend === "down" ? "text-destructive" : "text-muted-foreground"
            }`}>
              {subtitle}
            </p>
          )}
        </div>
        {icon && (
          <div className="rounded-lg bg-accent p-2.5 text-accent-foreground">
            {icon}
          </div>
        )}
      </div>
    </div>
  );
}
