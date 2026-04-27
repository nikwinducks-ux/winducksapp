// Single source of truth for how raw job statuses are presented to users.
// The underlying DB values stay the same (so allocation, RLS, triggers all work);
// this helper only controls labels + visual variant.

import type { Job } from "@/data/mockData";

export type BadgeVariant = "valid" | "warning" | "error" | "info" | "neutral";

// Two new lifecycle states added beyond the base DB enum.
export type ExtendedJobStatus =
  | "Created"
  | "Offered"
  | "Assigned"
  | "Accepted"
  | "InProgress"
  | "Completed"
  | "Cancelled"
  | "Expired"
  | "Archived"
  | "ConvertedToInvoice"
  | "InvoiceSent";

export interface DisplayStatus {
  label: string;
  variant: BadgeVariant;
}

/**
 * Returns the user-facing label and badge variant for a job's lifecycle state.
 *
 * Display rules:
 *  - Created                 → "Created"
 *  - Offered/Assigned/Accepted, no future schedule → "Offered to SP"
 *  - Assigned/Accepted with a future scheduled date → "Upcoming"
 *  - InProgress              → "In Progress"
 *  - Completed               → "Completed"
 *  - ConvertedToInvoice      → "Converted to Invoice"
 *  - InvoiceSent             → "Invoice Sent"
 *  - Cancelled / Expired / Archived → unchanged
 */
export function getJobDisplayStatus(
  job: Pick<Job, "status"> & { scheduledDate?: string | null },
): DisplayStatus {
  const status = job.status as ExtendedJobStatus;

  switch (status) {
    case "Created":
      return { label: "Created", variant: "neutral" };

    case "Offered":
      return { label: "Offered to SP", variant: "info" };

    case "Assigned":
    case "Accepted": {
      if (isFutureScheduled(job.scheduledDate)) {
        return { label: "Upcoming", variant: "info" };
      }
      return { label: "Offered to SP", variant: "info" };
    }

    case "InProgress":
      return { label: "In Progress", variant: "warning" };

    case "Completed":
      return { label: "Completed", variant: "valid" };

    case "ConvertedToInvoice":
      return { label: "Converted to Invoice", variant: "info" };

    case "InvoiceSent":
      return { label: "Invoice Sent", variant: "valid" };

    case "Cancelled":
      return { label: "Cancelled", variant: "error" };

    case "Expired":
      return { label: "Expired", variant: "error" };

    case "Archived":
      return { label: "Archived", variant: "neutral" };

    default:
      return { label: String(status), variant: "neutral" };
  }
}

/** Convenience for callsites that only need the label. */
export function getJobStatusLabel(
  job: Pick<Job, "status"> & { scheduledDate?: string | null },
): string {
  return getJobDisplayStatus(job).label;
}

function isFutureScheduled(date?: string | null): boolean {
  if (!date) return false;
  // YYYY-MM-DD compared lexicographically against today is reliable for dates.
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, "0");
  const dd = String(today.getDate()).padStart(2, "0");
  const todayStr = `${yyyy}-${mm}-${dd}`;
  return date >= todayStr;
}
