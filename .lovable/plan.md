

## Why JOB-1002 isn't showing — and how to fix discoverability

### Root cause

JOB-1002's `scheduled_date` in the database is **2026-02-23** (February 23), not April 23. The calendar code is correctly parsing and placing it — it just lives two months in the past relative to today (2026-04-23), so it's not visible on the current Day/Week/Month view unless the user navigates back.

The DB also confirms the only jobs scheduled on or after today are JOB-1026 and JOB-1004 (both 2026-04-27). All other scheduled jobs (1001, 1002, 1003, 1005–1011) are in February.

So nothing is broken in the rendering pipeline. The problem is the calendar gives no hint that there are 10 scheduled jobs sitting two months back, and the auto-focus skips them.

### What to change

**1. `src/pages/admin/AdminCalendar.tsx` — smarter initial focus + "jump to job" hints**

- **Auto-focus rule, revised**: pick the date with the *most* scheduled jobs within ±30 days of today. If none in that window, fall back to the nearest job (past or future, whichever is closer). This keeps today as the default when there's near-term activity, but doesn't strand the admin on an empty week when all data sits in another month.
- **"Out of view" banner**: when `filteredJobs` contains scheduled jobs that fall entirely outside the currently visible date range (Day/Week/Month window), render a small inline banner above the calendar:
  > *"12 scheduled jobs aren't in this view. [Jump to earliest] [Jump to latest]"*
  Buttons set `currentDate` to the earliest / latest scheduled job date.

**2. `src/pages/admin/JobManagement.tsx` — "Show on calendar" row action**

The Schedule cell already shows the date. Add a tiny calendar icon next to scheduled dates that links to `/admin/calendar?date=YYYY-MM-DD`. Clicking it opens the calendar focused on that exact day.

**3. `src/pages/admin/AdminCalendar.tsx` — read `?date=` query param**

On mount, if `?date=YYYY-MM-DD` is present, parse it via `parseLocalDate` and use it as `currentDate` (overriding auto-focus). This makes the new "Show on calendar" link land directly on the right day.

### Files touched

- `src/pages/admin/AdminCalendar.tsx` — revised auto-focus, query-param support, out-of-view banner
- `src/pages/admin/JobManagement.tsx` — "Show on calendar" link icon in the Scheduled cell

No DB changes. No changes to `JobCalendar.tsx` rendering.

### Acceptance

- Opening `/admin/calendar` today (2026-04-23) lands on a date that has actual scheduled jobs (Feb 23–27 cluster, since no jobs in the last/next 30 days)
- A banner appears whenever there are scheduled jobs outside the current Day/Week/Month window, with one-click jump to earliest / latest
- Clicking the new calendar icon next to JOB-1002's date in the Jobs list opens the calendar on Feb 23, 2026 with JOB-1002 visible at 1:00 PM
- All existing filters, debug toggle, sheet, reschedule, and reassign behaviors continue to work unchanged

