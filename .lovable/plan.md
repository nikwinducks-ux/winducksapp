# Show Payout Amount on Calendar Overview

## Goal
On the calendar's job blocks, display the **SP payout amount** (the SP's net portion after platform + marketing fees) instead of the **Total Invoice** amount.

## Where
`src/components/calendar/JobBlock.tsx` — line 223 currently renders:
```tsx
<span className="font-semibold shrink-0">{formatCAD(job.payout)}</span>
```

This component is shared by both the Admin Calendar and the SP Calendar.

## Change
Swap `job.payout` for `job.payoutShare`, falling back to `job.payout` when no share has been computed yet (e.g. unassigned job):

```tsx
<span className="font-semibold shrink-0">
  {formatCAD(job.payoutShare ?? job.payout)}
</span>
```

`payoutShare` is already computed live by the `useJobs` hook (`src/hooks/useSupabaseData.ts`) using `spShareForJob`, so:
- Admin sees the SP's take-home for each job on the calendar.
- SPs see their own portion (consistent with the rest of the SP portal).
- Past and future jobs both reflect current global/per-SP split percentages automatically.

## Files to edit
- `src/components/calendar/JobBlock.tsx` (1-line change)

## Out of scope
- No DB or schema changes.
- No changes to admin Job Detail / Job Management (those already show full breakdown / both values).
- Tooltip/secondary label not added — keeping the block compact as today.
