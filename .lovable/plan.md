

## SP Performance Page — Add Totals + Timeframe Toggle

Add two new KPI cards (Total Jobs Completed, Total Revenue Produced) and a timeframe selector that filters the metrics on `src/pages/sp/PerformancePage.tsx`.

### What changes

**File edited:** `src/pages/sp/PerformancePage.tsx`

1. **Timeframe selector** at the top right of the header
   - Options: `Last 7 days`, `Last 30 days` (default), `Last 12 months`, `Custom`
   - Uses existing `Select` component
   - Selecting `Custom` reveals two date pickers (Start / End) using existing `Popover` + `Calendar` components

2. **Two new KPI cards** in a row above the existing metric grid
   - **Total Jobs Completed** — count of jobs where `assigned_sp_id = me`, `status = 'Completed'`, and `completed_at` falls inside the selected window. Icon: `CheckCircle2`.
   - **Total Revenue Produced** — sum of `payout` for the same filtered set, formatted as `$X,XXX`. Icon: `DollarSign`.

3. **Data source**
   - New hook usage: reuse existing `useJobs()` from `useSupabaseData.ts` (already returns `assignedSpId`, `status`, `payout`, and `completed_at` mapped via `dbToJob`).
   - Filter client-side by `user.spId` and the timeframe window — no schema or RPC changes.
   - If `dbToJob` does not currently expose `completed_at`, extend the mapper to include it (small, additive change in `useSupabaseData.ts`).

4. **Behavior details**
   - Empty window → show `0` and `$0` (no spinner flicker).
   - Custom range requires both dates; otherwise falls back to last 30 days.
   - Existing rate cards (Completion, On-Time, Cancellation, Rating, Response time, Reliability, Fairness) remain — they continue to show the SP's lifetime/30-day stats from the `service_providers` row (unchanged), since those are pre-aggregated and not per-window.
   - Charts (Weekly Completions, Rating Trend) remain as-is for now.

### Layout

```
Performance                                  [ Last 30 days ▾ ]
                                             [ Start ▾ ] [ End ▾ ]   (only if Custom)

┌──────────────────────────┬──────────────────────────┐
│ Total Jobs Completed     │ Total Revenue Produced   │
│   23                     │   $4,820                 │
└──────────────────────────┴──────────────────────────┘

(existing 4 rate cards row)
(existing 3 secondary cards row)
(existing 2 charts)
```

### Files

- **Edit** `src/pages/sp/PerformancePage.tsx` — add selector, custom date pickers, two KPI cards, filter logic.
- **Edit** `src/hooks/useSupabaseData.ts` — ensure `dbToJob` exposes `completedAt` (only if missing).

No DB migration. No new dependencies.

### Acceptance

- SP Performance page shows two new KPI cards above existing metrics.
- Timeframe dropdown switches the totals between 7d / 30d / 12mo windows instantly.
- Choosing `Custom` shows two date pickers; setting both updates the totals.
- Totals reflect only the signed-in SP's completed jobs; revenue equals sum of `payout` for those jobs.
- Existing charts and other metric cards continue to render unchanged.

