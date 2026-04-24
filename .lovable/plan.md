

## Add daily total payout to calendar headers

Show a clean **$ total of all jobs scheduled on each day** at the top of every day column, across Day / Week / Month views — same logic for admin and SP, same logic on mobile and desktop (the calendar component is shared, so one change covers every viewport).

### What you'll see

- **Day view**: existing header (`Monday, April 28, 2025 · 3 job(s)`) gains a right-aligned `$1,240` chip.
- **Week view**: each weekday header cell shows the weekday + date as today, plus a small `$` total on a third line. Days with no jobs show nothing (no `$0`).
- **Month view**: each cell shows the date number top-left and a small muted `$` total top-right when there are jobs.

### How totals are computed

Sum `job.payout` across all jobs returned by the existing `jobsOnDate(jobs, date)` helper for that day. Format with `Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })` so `$1,240` (not `$1,240.00`) — keeps the chip compact on narrow week columns.

A tiny `formatDayTotal(jobs: Job[]): string | null` helper lives at the top of `JobCalendar.tsx` and returns `null` when the list is empty so views can skip rendering the chip.

### Files touched

- `src/components/calendar/JobCalendar.tsx` — add `formatDayTotal` helper; render the total in `DayView` header, `WeekView` weekday header cells, and `MonthCell`.

No other files change. Admin Calendar, SP Calendar, mobile shell, and desktop shell all consume this single component, so the totals appear everywhere automatically.

