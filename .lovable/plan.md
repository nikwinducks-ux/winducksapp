# Show Day Total as SP Payout Share on Calendar

## Goal
The per-day total amount displayed in the top-right of each calendar day cell currently sums **total invoice** values (`job.payout`). Update it to sum the **SP payout share** (`job.payoutShare`) — matching the change just made to individual job blocks.

## Where
`src/components/calendar/JobCalendar.tsx` — two helpers both reduce on `j.payout`:

- `formatDayTotal` (line 106) — used in the larger month view
- `formatCompactCAD` (line 113) — used in the compact day cells

## Change
Replace both reducers to use `j.payoutShare ?? j.payout` (fallback preserves behavior for unassigned jobs where no share has been computed). Extract the sum into a small shared helper to keep both formatters in sync:

```tsx
function sumPayoutShare(jobs: Job[]): number {
  return jobs.reduce((sum, j) => sum + (Number(j.payoutShare ?? j.payout) || 0), 0);
}
```

Then have both `formatDayTotal` and `formatCompactCAD` call `sumPayoutShare(jobs)` instead of inlining the reduce.

## Files to edit
- `src/components/calendar/JobCalendar.tsx` (replace lines 106–120)

## Out of scope
- No DB or schema changes.
- No changes to admin Job Detail "Payout" line (that one intentionally shows the total invoice context).
