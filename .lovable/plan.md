## Goal

On mobile in the week view of the calendar (admin + SP):

1. Make horizontal panning across the time-slot grid smoother and less likely to be hijacked (by the long-press unavailable gesture or by browser back/forward).
2. Add a horizontal swipe gesture on the **date header row** (the "Mon 21 / Tue 22 / …" strip at the top of week view) to advance to the next or previous week.

## Changes

### 1. `src/components/calendar/JobCalendar.tsx` — WeekView horizontal scroll polish

- Add `-webkit-overflow-scrolling: touch` and `scroll-snap-type: x proximity` on the horizontal scroll container so swipes feel native and momentum-scroll on iOS.
- Snap each day column to its left edge (`scroll-snap-align: start`) so a swipe naturally lands on a day boundary instead of mid-column.
- Bump mobile per-day min-width from `88px` → ~`110px` so day columns are wider and a one-finger horizontal pan is more deliberate (less jitter from vertical scroll attempts).
- Set `touchAction: "pan-x"` on the day-grid columns when there's real horizontal overflow (mobile, week view) so the browser routes ambiguous diagonal gestures to horizontal pan more readily, while still allowing vertical scroll on the inner `overflow-y-auto` track.

### 2. `src/components/calendar/JobCalendar.tsx` — Long-press grid no longer eats horizontal swipes

- In `DayGridDroppable`, change the grid container's `touch-action` from `pan-y` to `pan-x pan-y` so a horizontal swipe starting inside the grid is delivered to the parent scroll container instead of being captured for long-press.
- Already-implemented MOVE_CANCEL_PX (8px) cancels the long-press timer if the user pans — keep as-is (covers the swipe case).

### 3. `src/components/calendar/JobCalendar.tsx` — Swipe-the-date-header to switch weeks

- Add a new optional prop on `JobCalendarProps`:
  ```ts
  onNavigateWeek?: (direction: -1 | 1) => void;
  ```
- In `WeekView`, attach pointer handlers to the date-header strip (the row with day names/dates):
  - `onPointerDown`: record `{x, y, time}`.
  - `onPointerUp`: if total horizontal travel ≥ 50px AND `|dx| > |dy| * 1.5` AND elapsed < 600ms, call `onNavigateWeek(dx < 0 ? 1 : -1)` and trigger a short `navigator.vibrate(10)`.
  - Cancel on `onPointerCancel`/`onPointerLeave`.
- Add a subtle visual hint on mobile: small `‹ swipe ›` chevrons at the far ends of the header row (mobile only) so the affordance is discoverable.
- Ensure these handlers do **not** interfere with tapping a day header (admin's `onDayClick` still works via short tap detection — only fire navigation when movement > 50px).

### 4. Wire the new prop through pages

- `src/pages/sp/SPCalendar.tsx`: pass `onNavigateWeek={navigate}` to `<JobCalendar />`.
- `src/pages/admin/AdminCalendar.tsx`: pass `onNavigateWeek={navigate}` to `<JobCalendar />`.

Both pages already define `navigate(direction)` that does week±1 in week view, so we reuse it directly.

## Out of scope

- No swipe-to-change on the body grid itself (would conflict with the long-press unavailable gesture and inner vertical scroll). The header row is the dedicated target.
- No changes to month/day view navigation gestures.
