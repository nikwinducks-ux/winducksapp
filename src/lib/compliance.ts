export type ComplianceState = "valid" | "expiring" | "expired" | "none";

export const EXPIRING_DAYS_THRESHOLD = 30;

export function complianceStateForDate(expiresOn: string | null | undefined): ComplianceState {
  if (!expiresOn) return "none";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const exp = new Date(expiresOn + "T00:00:00");
  const diffDays = Math.floor((exp.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return "expired";
  if (diffDays <= EXPIRING_DAYS_THRESHOLD) return "expiring";
  return "valid";
}

export function complianceLabel(state: ComplianceState): string {
  switch (state) {
    case "valid": return "Valid";
    case "expiring": return "Expiring";
    case "expired": return "Expired";
    default: return "No expiry";
  }
}

export function complianceBadgeVariant(state: ComplianceState): "valid" | "warning" | "error" | "neutral" {
  switch (state) {
    case "valid": return "valid";
    case "expiring": return "warning";
    case "expired": return "error";
    default: return "neutral";
  }
}

/** Worst status across docs — used to roll up overall SP compliance */
export function worstComplianceState(states: ComplianceState[]): ComplianceState {
  if (states.includes("expired")) return "expired";
  if (states.includes("expiring")) return "expiring";
  if (states.includes("valid")) return "valid";
  return "none";
}
