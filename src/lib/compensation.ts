// Shared compensation math used by both Admin and SP UIs.
//
// The compensation split for any given SP is resolved live from:
//   1. The SP's per-SP override (compPlatformFeePct / compMarketingPct / compSpPortionPct)
//   2. Falling back to the global defaults in the `app_settings` table
//      (defaultPlatformFeePct / defaultMarketingPct / defaultSpPortionPct)
//
// Because the split is derived live, any change to the global percentages
// (or to a per-SP override) is reflected on every job — past, present, and
// future — without requiring data migration.

import type { ServiceProvider } from "@/data/mockData";

export interface CompSplitPcts {
  platformPct: number;
  marketingPct: number;
  spPct: number;
  /** Whether each value came from the global default (true) or a per-SP override (false). */
  platformIsDefault: boolean;
  marketingIsDefault: boolean;
  spIsDefault: boolean;
}

export interface AppSettingsLike {
  defaultPlatformFeePct?: number;
  defaultMarketingPct?: number;
  defaultSpPortionPct?: number;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Resolve the effective compensation split for an SP.
 * If `sp` is null/undefined (e.g. unassigned job), we still return the global defaults
 * so admins can preview the math.
 */
export function effectiveCompSplit(
  sp: Pick<ServiceProvider, "compPlatformFeePct" | "compMarketingPct" | "compSpPortionPct"> | null | undefined,
  settings: AppSettingsLike | null | undefined,
): CompSplitPcts {
  const defPlatform = settings?.defaultPlatformFeePct ?? 15;
  const defMarketing = settings?.defaultMarketingPct ?? 20;
  const defSp = settings?.defaultSpPortionPct ?? 65;

  const platformIsDefault = sp?.compPlatformFeePct == null;
  const marketingIsDefault = sp?.compMarketingPct == null;
  const spIsDefault = sp?.compSpPortionPct == null;

  return {
    platformPct: platformIsDefault ? defPlatform : (sp!.compPlatformFeePct as number),
    marketingPct: marketingIsDefault ? defMarketing : (sp!.compMarketingPct as number),
    spPct: spIsDefault ? defSp : (sp!.compSpPortionPct as number),
    platformIsDefault,
    marketingIsDefault,
    spIsDefault,
  };
}

export interface InvoiceSplit {
  total: number;
  platform: number;
  marketing: number;
  sp: number;
  platformPct: number;
  marketingPct: number;
  spPct: number;
}

/**
 * Split a total invoice amount into the three compensation buckets using the
 * provided percentages. Returns dollar amounts rounded to 2 decimals.
 */
export function splitInvoice(total: number, pcts: CompSplitPcts): InvoiceSplit {
  const safeTotal = Number.isFinite(total) ? total : 0;
  return {
    total: round2(safeTotal),
    platform: round2((safeTotal * pcts.platformPct) / 100),
    marketing: round2((safeTotal * pcts.marketingPct) / 100),
    sp: round2((safeTotal * pcts.spPct) / 100),
    platformPct: pcts.platformPct,
    marketingPct: pcts.marketingPct,
    spPct: pcts.spPct,
  };
}

/**
 * Convenience helper: compute just the SP take-home share for a given total
 * invoice and SP. Used by SP-facing surfaces that only need to display "your
 * portion". For multi-SP crew jobs, divide the result by the crew size at the
 * call site (mirrors existing `payoutShare` behavior).
 */
export function spShareForJob(
  total: number,
  sp: Pick<ServiceProvider, "compPlatformFeePct" | "compMarketingPct" | "compSpPortionPct"> | null | undefined,
  settings: AppSettingsLike | null | undefined,
  crewSize = 1,
): number {
  const pcts = effectiveCompSplit(sp, settings);
  const split = splitInvoice(total, pcts);
  const safeCrew = Math.max(1, crewSize);
  return round2(split.sp / safeCrew);
}

export const MARKETING_RECIPIENTS = ["Winducks", "SP", "Third-party"] as const;
export type MarketingRecipient = (typeof MARKETING_RECIPIENTS)[number];

export function formatMarketingRecipient(
  recipient: string | null | undefined,
  name: string | null | undefined,
  spName?: string | null,
): string {
  const r = (recipient ?? "Winducks") as MarketingRecipient;
  if (r === "Winducks") return "Winducks";
  if (r === "SP") return spName ? `${spName} (SP)` : "Service Provider";
  if (r === "Third-party") return name && name.trim() ? name.trim() : "Third-party";
  return String(r);
}
