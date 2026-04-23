

## Time-aware Day & Week calendar views

Today the Day and Week views just stack jobs as a vertical list per day, sorted by `scheduledTime`. There's no visible time axis, so a 8:00 AM job and a 3:00 PM job look identical in spacing. Month view shows date cells but jobs don't render their time. This update adds a real time grid to Day/Week and shows the time on Month chips, while keeping the existing filters, click behavior, and SP-mode rendering.

### What changes

**1. `src/components/calendar/JobCalendar.tsx` — Day & Week become a time grid**

Replace the current list-style `DayView` and `WeekView` with an hour-grid layout:

- Time axis on the left: hours from **6 AM to 9 PM** (configurable constants `DAY_START_HOUR = 6`, `DAY_END_HOUR = 21`), with 1-hour rows. Each hour row is `60px` tall (so 1 minute = 1px, easy math for absolute positioning).
- Each day column renders horizontal hour gridlines + a relative-positioned container.
- Each scheduled job becomes an **absolutely positioned `JobBlock`** inside its day column:
  - `top` = `(hour - DAY_START_HOUR) * 60 + minutes` px
  - `height` = parsed `estimatedDuration` in minutes (default 60 if unparseable), min 30px
  - Width 100% of the column with small inset padding
- Jobs **before 6 AM or after 9 PM** are pinned in a small "Outside hours" strip at the top of the day column (still clickable, with their time shown).
- Jobs with **no `scheduledTime`** go into an "All-day / Unscheduled time" strip at the top of each day column.
- A faint "now" line is drawn on today's column when the current time is within the visible window.

Overlap handling (simple, good enough for this app's volume):
- Group jobs whose intervals overlap; split the column width evenly across the group (e.g., two overlapping jobs each take 50%, side by side). No fancy lane packing beyond that.

Click and styling reuse the existing `JobBlock` component (compact mode in week, full in day).

**2. Month view — show time on each chip**

`MonthView` already renders up to 3 `JobBlock`s per day in compact mode. Compact `JobBlock` currently hides time. Add a tiny time prefix on the compact block (e.g., `"9:00a · JOB-0123"`) so the Month view communicates timing at a glance. This is done by passing a new optional `showTime` prop to `JobBlock` and rendering a formatted 12h short time (e.g., `9a`, `2:30p`) next to the job number when present. Day/Week blocks keep their existing layout.

**3. `src/components/calendar/JobBlock.tsx` — small additions**

- New optional `showTime?: boolean` prop. When true and `job.scheduledTime` exists, prepend a short time (e.g., `9:00a`) to the job number line in compact mode.
- Add a small `formatShortTime(hhmm: string)` helper inside the file.
- No behavior change for existing call sites that don't pass `showTime`.

**4. Ensure all scheduled jobs render correctly across views**

Audit and fix the data path so a job appears in Day/Week/Month if and only if it has a `scheduled_date`:

- `AdminCalendar.tsx` already filters to `!!j.scheduledDate` (correct).
- `SPCalendar.tsx` filter (`scheduled + (assigned to me OR has pending offer)`) is left as-is.
- In `JobCalendar.tsx`, `jobsOnDate` currently compares `new Date(j.scheduledDate)` with `isSameDay`. `scheduled_date` is a Postgres `date` (no time) — `new Date("2026-04-28")` parses as UTC midnight, which can shift to the previous day in negative-UTC timezones (e.g., MDT). Replace with a **local-date parse** helper (`parseLocalDate("YYYY-MM-DD")` → `new Date(y, m-1, d)`) so jobs land on the correct calendar day regardless of timezone. Apply everywhere `j.scheduledDate` is converted to a `Date` in the calendar component.

**5. Minor polish**

- Day view header keeps its summary; the body becomes the time grid (scrollable if needed, max-height ~`70vh`).
- Week view header (existing weekday strip) is unchanged; the grid below is replaced.
- "Add" / "Schedule a job" affordances for empty days remain in admin mode — placed in the unscheduled strip area instead of full-cell click target.

### Files touched

- `src/components/calendar/JobCalendar.tsx` — rewrite Day & Week as hour-grid, add timezone-safe date parsing, wire `showTime` for Month chips
- `src/components/calendar/JobBlock.tsx` — add `showTime` prop + `formatShortTime` helper

No DB migration. No changes to filters, mutations, or `AdminCalendar.tsx` / `SPCalendar.tsx` logic.

### Acceptance

- Day view shows an hour grid (6 AM–9 PM) with each scheduled job positioned at its real start time and sized by `estimatedDuration`
- Week view shows the same hour grid across 7 day columns; jobs appear in the correct day **and** the correct time slot
- Two jobs that overlap in time render side-by-side in the same column without obscuring each other
- Jobs outside 6 AM–9 PM, or without a `scheduledTime`, appear in a small strip at the top of their day column and remain clickable
- Month view chips show a short time prefix (e.g., `9a JOB-0123`) for jobs that have a `scheduledTime`
- A job scheduled for 2026-04-28 appears on April 28 in all three views, regardless of the viewer's timezone (no off-by-one day)
- All existing filters (SP, status), click-to-open sheet, reschedule, and reassign behaviors continue to work unchanged

