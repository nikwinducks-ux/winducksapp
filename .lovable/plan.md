
## Why the calendar looks empty in your screenshot

This is not a backend fetch failure. The database does have scheduled jobs, and the frontend is loading them.

What the data shows:
- There are **no scheduled jobs between Apr 20 and Apr 26, 2026**
- The next scheduled jobs are:
  - **JOB-1004** — Apr 27, 2026 at 09:00
  - **JOB-1026** — Apr 27, 2026 at 10:00
- Older scheduled jobs exist on **Feb 23–27**
- Your screenshot is on **Week view: Apr 20–Apr 26**, so the grid is correctly empty for that range

That is also why turning debug on shows nothing in the grid: the current debug badge only renders **on job cards**, and there are no job cards in that visible week.

## Fix the discoverability problem so the UI explains this clearly

### 1. Add a real empty-state inside the calendar grid
Update `src/components/calendar/JobCalendar.tsx` so Day and Week views show a centered empty state when:
- there are no jobs in the visible day/week range, and
- there are still filtered scheduled jobs outside the current range

The empty state should say:
- “No scheduled jobs in this week”
- “Next scheduled job: Mon Apr 27 at 9:00 AM” when available
- buttons for:
  - `Jump to next scheduled`
  - `Jump to previous scheduled`

This solves the current confusion where the grid looks broken even though it is just empty.

### 2. Make debug useful even when there are no visible cards
Update `src/pages/admin/AdminCalendar.tsx` so debug mode also renders a lightweight diagnostics panel above the calendar listing:
- current visible range
- total filtered scheduled jobs
- jobs inside current range
- first previous scheduled date
- first next scheduled date

When debug is on, this should immediately explain:
- “0 jobs in Apr 20–Apr 26”
- “Next job is Apr 27”

This is the missing piece in the current debug approach.

### 3. Pass “nearest scheduled job” metadata into the calendar
In `src/pages/admin/AdminCalendar.tsx`, compute:
- `visibleJobs`
- `previousVisibleCandidate`
- `nextVisibleCandidate`

Then pass those into `JobCalendar` so the empty-state CTA can jump directly to the correct date.

### 4. Improve the top out-of-view banner copy
Keep the existing banner, but make it more specific:
- instead of only “11 scheduled jobs are not in this view”
- also show “Nearest next: Apr 27, 2026” and “Nearest previous: Feb 27, 2026”

That makes the message actionable at a glance.

### 5. Keep current rendering logic unchanged
Do not change:
- date parsing
- job placement logic
- SP color coding
- customer-name titles
- filters
- sheet behavior

Those are not the source of the empty screenshot.

## Files to update

- `src/pages/admin/AdminCalendar.tsx`
  - compute visible-range diagnostics
  - compute previous/next scheduled jobs
  - pass empty-state/debug metadata into calendar
  - improve out-of-view banner copy

- `src/components/calendar/JobCalendar.tsx`
  - render explicit empty states in Day/Week
  - add jump actions for nearest previous/next scheduled jobs
  - optionally show compact debug summary when `showDebug` is on and there are no visible cards

## Acceptance criteria

- On the Apr 20–Apr 26 week shown in your screenshot, the calendar no longer looks mysteriously blank
- The page clearly states that there are **0 jobs in the current week**
- The UI shows that the **next scheduled jobs are on Apr 27**
- A single click jumps the user to the next scheduled day/week so jobs appear immediately
- With debug on, the screen shows range-level scheduling diagnostics even when there are no visible job cards
- Existing job rendering still works unchanged when the selected day/week actually contains jobs
