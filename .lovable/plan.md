## Goal
In the week view of the calendar, display a **week total amount** (sum of SP payout shares across all 7 visible days) on the top-right of the calendar header row, alongside the existing prev/today/next navigation and date range label.

## Where to add it
Both calendar pages share the same nav row layout above `<JobCalendar>`:
- `src/pages/sp/SPCalendar.tsx` (lines ~283–297) — main target since user is on `/calendar`
- `src/pages/admin/AdminCalendar.tsx` (lines ~456–468) — same nav row, mirror the change for consistency

Current nav row:
```tsx
<div className="flex items-center gap-1">
  <Button>‹</Button>
  <Button>Today</Button>
  <Button>›</Button>
  <span className="ml-3 text-sm font-medium">{rangeLabel()}</span>
</div>
```

## Change
Wrap the row with `justify-between` (or use `ml-auto` on the new element) and append a right-aligned **Week Total** badge that only renders when `view === "week"`.

```tsx
<div className="flex items-center gap-1 justify-between flex-wrap">
  <div className="flex items-center gap-1">
    {/* prev / Today / next / rangeLabel — unchanged */}
  </div>
  {view === "week" && (
    <div className="text-sm font-medium text-muted-foreground">
      Week total:{" "}
      <span className="text-primary font-semibold">{formatCADWhole(weekTotal)}</span>
    </div>
  )}
</div>
```

## Computing the week total
Reuse the same logic already used for per-day totals in `JobCalendar.tsx` (`sumPayoutShare` — sums `payoutShare ?? payout`) so the weekly figure equals the sum of the seven daily badges shown in the header.

In `SPCalendar.tsx` and `AdminCalendar.tsx`, add a `useMemo`:

```ts
const weekTotal = useMemo(() => {
  const start = startOfWeek(currentDate, { weekStartsOn: 1 });
  const end = endOfWeek(currentDate, { weekStartsOn: 1 });
  return myCalendarJobs   // (or `jobs` in AdminCalendar)
    .filter((j) => {
      if (!j.scheduledDate) return false;
      try {
        const d = parseISO(j.scheduledDate);
        return isWithinInterval(d, { start, end });
      } catch { return false; }
    })
    .reduce((sum, j) => sum + (Number(j.payoutShare ?? j.payout) || 0), 0);
}, [myCalendarJobs, currentDate]);
```

Use `formatCADWhole` from `@/lib/currency` (already imported in JobCalendar; import it here).

## Note on week boundaries
The user said "Sunday to Saturday", but the calendar today uses **Monday–Sunday** (`weekStartsOn: 1`) consistently throughout the app. To keep the displayed total consistent with the seven day columns the user sees, this plan sums the **visible** week (Mon–Sun). If you'd like to switch the entire calendar to Sun–Sat instead, that's a separate change — say the word and I'll roll that in.

## Files to edit
- `src/pages/sp/SPCalendar.tsx` — add `weekTotal` memo + render badge in the nav row
- `src/pages/admin/AdminCalendar.tsx` — same change for parity

## Out of scope
- No DB or schema changes
- No changes to per-day totals (already SP payout share)
- No change to week start day (Mon-based) unless requested
