

## Mobile-friendly Month view for SP Calendar

Enable the **Month** tab on mobile for the SP calendar, optimize the month grid for narrow screens, and make tapping a day jump into the **Day** view for that date. Day totals (already implemented in `MonthCell`) will remain visible.

### What you'll see (mobile, SP `/calendar`)

- **Day / Month / Availability** tabs (Week stays desktop-only — its 7-column hourly grid is unusable at <768px).
- **Month grid** sized for small screens:
  - Smaller cell min-height (~64px instead of 110px) so the full month fits without huge vertical scroll.
  - Day number top-left, **dollar total top-right** (e.g. `$420`) in primary color when the day has jobs.
  - Up to **2 colored dots** per day (one per job, status-colored) instead of full job blocks; `+N` if more. Keeps cells legible at ~50px wide.
  - Today highlighted; out-of-month days dimmed.
  - Weekday header shortened to single letters (M T W T F S S) on mobile.
- **Tap a day** → switches to `Day` view for that date (works on both mobile and desktop). Tapping a job dot still opens the existing job sheet.
- The existing "Other scheduled jobs not in this view" chip strip continues to work.

### Implementation

**`src/components/calendar/JobCalendar.tsx`**
- Add an optional `onDayClick?: (date: Date) => void` prop on `JobCalendarProps`, threaded through `MonthView` → `MonthCell`.
- `MonthCell`:
  - Wrap the cell in a `button` (or add an `onClick` to the root div with `role="button"`) that calls `onDayClick(date)` when provided. Stop propagation on inner job-dot clicks so they still call `onJobClick`.
  - Use `useIsMobile()` to switch rendering:
    - Desktop: keep current `JobBlock` rows (up to 3) + `+N more`.
    - Mobile: render a row of small status-colored dots (max 2) + `+N` text. Use `getJobAppearance(job)` for the color class (reuse status palette already used by `JobBlock`).
  - Reduce `min-h-[110px]` to `min-h-[64px] sm:min-h-[110px]`, tighten padding to `p-0.5 sm:p-1`.
  - Day total: keep `formatDayTotal(dayJobs)` chip; on mobile shrink to `text-[9px]` and truncate.
- `MonthView` weekday header: render `["M","T","W","T","F","S","S"]` on mobile, full `Mon…Sun` on desktop (via `useIsMobile`).

**`src/pages/sp/SPCalendar.tsx`**
- Remove the `!isMobile` guard on the `<TabsTrigger value="month">` so Month is selectable on mobile. Keep Week desktop-only.
- Remove the `useEffect` that forces `view="day"` when on mobile + week (replace with: only force off `week` if mobile, leave `month` alone).
- Pass `onDayClick={(date) => { setCurrentDate(date); setView("day"); }}` to `<JobCalendar>`.

**`src/pages/admin/AdminCalendar.tsx`** (small parity win, no behavior change for admin desktop)
- Also pass `onDayClick` so admins on mobile/tablet can drill in the same way. Optional but trivial — keeps the prop consistent.

### Files touched

- **Edited**: `src/components/calendar/JobCalendar.tsx` (MonthView/MonthCell mobile rendering, new `onDayClick` prop, weekday header)
- **Edited**: `src/pages/sp/SPCalendar.tsx` (enable Month on mobile, wire `onDayClick` → switch to Day)
- **Edited**: `src/pages/admin/AdminCalendar.tsx` (optional: pass `onDayClick` for parity)

No schema, hook, or data-model changes. Day totals already render in `MonthCell` via the existing `formatDayTotal` helper.

