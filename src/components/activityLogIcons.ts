import {
  Plus, Pencil, Trash2, Calendar, UserCheck, UserMinus, CheckCircle2, XCircle,
  DollarSign, MapPin, FileText, AlertTriangle, Image, Package, User, History,
  type LucideIcon,
} from "lucide-react";

export type ActivityFilterKey = "all" | "jobs" | "services" | "photos" | "customers";

export const ACTIVITY_EVENT_GROUPS: Record<ActivityFilterKey, string[]> = {
  all: [],
  jobs: [
    "job_created", "job_scheduled", "job_rescheduled", "job_assigned", "job_unassigned",
    "job_status_changed", "job_completed", "job_cancelled", "job_deleted",
    "job_payout_changed", "job_address_changed", "job_notes_changed", "job_urgency_changed",
  ],
  services: ["service_added", "service_updated", "service_removed"],
  photos: ["photo_added", "photo_removed"],
  customers: ["customer_created", "customer_updated"],
};

export function getActivityIcon(type: string): LucideIcon {
  switch (type) {
    case "job_created": return Plus;
    case "job_scheduled":
    case "job_rescheduled": return Calendar;
    case "job_assigned": return UserCheck;
    case "job_unassigned": return UserMinus;
    case "job_completed": return CheckCircle2;
    case "job_cancelled":
    case "job_deleted": return XCircle;
    case "job_status_changed":
    case "job_urgency_changed": return AlertTriangle;
    case "job_payout_changed": return DollarSign;
    case "job_address_changed": return MapPin;
    case "job_notes_changed": return FileText;
    case "service_added":
    case "service_updated":
    case "service_removed": return Package;
    case "photo_added":
    case "photo_removed": return Image;
    case "customer_created":
    case "customer_updated": return User;
    default: return History;
  }
}

export function relativeTime(iso: string): string {
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
