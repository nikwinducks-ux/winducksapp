## Goal

In the mobile week view, the date header row currently scrolls together with the time-grid below it, bounded to the current 7 days. Make the date header a separate, **infinitely scrollable** strip (past + future) that drives the visible week, and tighten the overall scroll feel of the week view.

## Problems today

1. The header row sits inside the same horizontal scroll container as the time grid, so it cannot scroll past the current week — it just snaps within 7 days.
2. The header pointer-handler treats any swipe ≥ 50px as a discrete week jump, which feels jumpy and competes with native scroll.
3. `scroll-snap: x mandatory` combined with `scroll-behavior: smooth` on the grid produces a sluggish, sticky feel when flicking; snap fights momentum scroll on iOS.

## Plan

### 1. New `WeekDateStrip` component (mobile only)

A standalone horizontal scroller above the time grid that is virtually infinite.

- Render a windowed range of days around `currentDate` (e.g. `currentDate - 28 days … currentDate + 28 days`, ~57 cells).
- Each day cell uses the same `dayMinWidthPx` as the grid columns so visual rhythm matches.
- Use native horizontal scroll with `scroll-snap-type: x proximity` and `scroll-snap-align: center` on each cell — proximity (not mandatory) keeps momentum flicks smooth.
- On scroll-end (debounced via `scrollend` with rAF fallback for Safari), determine the day closest to viewport center and call `onJumpToDate(thatDay)` so the grid below re-renders for the matching week.
- When `currentDate` changes (from grid snap, navigation buttons, or a settle), recenter the strip around it. If the user scrolls near either edge of the rendered window (within ~10 days), extend the window by another 28 days in that direction — giving true "infinite" scroll.
- Highlight today and the currently-selected day; tapping a cell jumps to that day.
- Remove the existing pointer-swipe-to-change-week handlers from the header — replaced by this scroller.

### 2. Decouple header from grid

- The grid below keeps its current 7-day horizontal scroll for time slots, but the header is no longer rendered inside that container.
- This means the header sits in its own div with its own scroll, while the time-grid stays as-is for vertical time scrolling and intra-week horizontal panning.

### 3. Improve grid scroll feel

- Change grid `scroll-snap-type` from `x mandatory` to `x proximity` so flicks aren't interrupted mid-swing.
- Remove `scroll-behavior: smooth` from the grid container — it interferes with native momentum on iOS. Keep smooth behavior only for programmatic `scrollIntoView` calls (e.g. snapping to "today" on mount).
- Add `overscroll-behavior-x: contain` (already present via class) and `scroll-padding-left: 56px` so snapped columns line up past the time-axis gutter.
- Use `requestAnimationFrame` throttling on the grid scroll handler if/where one exists; otherwise no JS scroll handlers needed.

### 4. Wire `onJumpToDate`

Both `AdminCalendar` and `SPCalendar` already track `currentDate` and have a `setCurrentDate` setter. Pass a new `onDateChange` prop into `JobCalendar` → `WeekView` → `WeekDateStrip` so the strip can update the parent's date when the user scrolls or taps a day.

## Technical details

**Files**

- `src/components/calendar/JobCalendar.tsx`
  - Extract a new `WeekDateStrip` component (mobile-only) handling the windowed infinite scroller.
  - In `WeekView`: render `WeekDateStrip` above the grid container on mobile; keep the existing in-grid header on desktop.
  - Remove the `onHeaderPointerDown/Move/Up/Cancel` handlers and the pointer-swipe affordance arrows — superseded by the strip.
  - Update grid scroll styles: `scroll-snap-type: x proximity`, drop `scroll-behavior: smooth`, add `scroll-padding-left: 56px`.
  - Add a new optional prop `onDateChange?: (d: Date) => void` to `JobCalendar` and thread it to `WeekView`.
- `src/pages/admin/AdminCalendar.tsx` and `src/pages/sp/SPCalendar.tsx`
  - Pass `onDateChange={setCurrentDate}` to `<JobCalendar />`.

**Strip implementation sketch**

- State: `windowStart: Date`, `windowEnd: Date` (default ±28 days from `currentDate`).
- Memoized `cells = eachDayOfInterval({ start: windowStart, end: windowEnd })`.
- After mount and when `currentDate` changes externally, scroll the cell matching `currentDate` to center using `scrollTo({ left: targetLeft })` (no smooth on initial mount; smooth on subsequent external changes).
- `onScroll`: schedule rAF; on settle (no scroll for ~120ms or `scrollend`), find centered cell and call `onDateChange(cellDate)` if it differs from `currentDate`.
- Edge detection in the same settle handler: if centered cell index is within 10 of either end, extend `windowStart -= 28d` or `windowEnd += 28d` and adjust `scrollLeft` to compensate so the visible position doesn't jump.

**Why this approach**

- Native scroll + windowed virtualization is far smoother than synthesized swipes.
- `scroll-snap: proximity` preserves flick momentum while still snapping to day boundaries when the user lets go near one.
- Decoupling header from grid is required for the header to scroll past the current week.

## Out of scope

- Month and Day views (no changes).
- Desktop week view: keeps current header inside the grid container — desktop already has wheel/trackpad horizontal scroll via `useHorizontalWheelScroll` and infinite scrolling there can be handled separately if requested.
