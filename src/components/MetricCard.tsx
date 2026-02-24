import { ReactNode } from "react";
import { useNavigate } from "react-router-dom";

interface MetricCardProps {
  label: string;
  value: string | number;
  icon?: ReactNode;
  subtitle?: string;
  trend?: "up" | "down" | "neutral";
  className?: string;
  to?: string;
}

export function MetricCard({ label, value, icon, subtitle, trend, className = "", to }: MetricCardProps) {
  const navigate = useNavigate();

  const handleClick = () => {
    if (to) navigate(to);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (to && (e.key === "Enter" || e.key === " ")) {
      e.preventDefault();
      navigate(to);
    }
  };

  return (
    <div
      className={`metric-card ${to ? "cursor-pointer hover:shadow-md hover:border-primary/30 transition-all" : ""} ${className}`}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      role={to ? "button" : undefined}
      tabIndex={to ? 0 : undefined}
    >
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
