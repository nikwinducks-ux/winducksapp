import { CheckCircle, AlertTriangle, XCircle } from "lucide-react";

type BadgeVariant = "valid" | "warning" | "error" | "info" | "neutral";

interface StatusBadgeProps {
  label: string;
  variant: BadgeVariant;
}

const variantStyles: Record<BadgeVariant, string> = {
  valid: "status-valid",
  warning: "status-warning",
  error: "status-error",
  info: "bg-info/10 text-info",
  neutral: "bg-secondary text-secondary-foreground",
};

const icons: Record<BadgeVariant, React.ReactNode> = {
  valid: <CheckCircle className="h-3 w-3" />,
  warning: <AlertTriangle className="h-3 w-3" />,
  error: <XCircle className="h-3 w-3" />,
  info: null,
  neutral: null,
};

export function StatusBadge({ label, variant }: StatusBadgeProps) {
  return (
    <span className={`status-badge ${variantStyles[variant]}`}>
      {icons[variant]}
      {label}
    </span>
  );
}
