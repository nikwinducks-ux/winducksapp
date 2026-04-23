

## Root cause

The `useJobs` hook is **gated** on `useCustomers()` resolving:

```ts
enabled: customersReady || customersError
```

When SPB loads the page, `useCustomers` is briefly in the `loading` state (neither success nor error). During that window, `useJobs` is **disabled**, so React Query returns empty data with `isLoading=false`. The diagnostic strip then reports `jobs returned by query: 0` — not because RLS blocked anything, but because the query never ran.

There's also a secondary risk: the `customers` SELECT policy for SPs only returns customers tied to jobs they're already assigned to. That's a circular dependency — fine in steady state, but fragile.

## Fix

**1. Decouple `useJobs` from `useCustomers`**

Remove the `enabled` gate. Run jobs immediately. Resolve `customerName` from whatever customers data is available at render time; if customers haven't arrived yet, fall back to the address city (or "Loading…") instead of "Unknown". When customers data updates, React Query re-renders the consumer and names fill in.

**2. Make customer name resolution non-blocking**

Move `dbToJob`'s customer lookup out of the query function and into a derived selector inside `useJobs`, so a late-arriving `customers` query immediately repaints names without refetching jobs.

**3. Keep diagnostics + add fetch-state line**

Update `SPVisibilityDiagnostics` to also show:
- `query state` (idle / loading / success / error)
- last error message (if any)

So if this ever recurs we see `state=idle` (disabled) vs `state=success, count=0` (RLS) vs `state=error` (network/policy throw).

**4. Verify on live URL**

After Publish, SPB should see all 4 jobs (JOB-1003 Offered, JOB-1027 Assigned, JOB-1026 Assigned, JOB-1004 Completed) — 3 active + 1 past in My Jobs, and the two on Apr 24 + two on Apr 27 in Calendar.

## Files touched

- `src/hooks/useSupabaseData.ts` — remove `enabled` gate on `useJobs`; resolve `customerName` in a `select` transform that re-runs when `customers` updates.
- `src/components/sp/SPVisibilityDiagnostics.tsx` — add query-state + error fields (accepts optional `queryState` / `queryError` props).
- `src/pages/sp/MyJobs.tsx` and `src/pages/sp/SPCalendar.tsx` — pass the new diagnostic props through.

No DB / RLS changes needed — the policies are correct.

