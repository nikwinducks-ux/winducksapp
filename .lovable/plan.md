# Fix: Sticky Time Axis in Mobile Week Calendar (5-day / 3-day zoom)

## Root cause

In `src/components/calendar/JobCalendar.tsx` (`WeekView`), the calendar grid is split across two scroll containers:

- **Outer wrapper** (`hScrollRef`, line ~1021): handles **horizontal** scrolling (`overflow-x-auto`).
- **Inner body row** (line ~1094): wraps `<TimeAxis />` + day columns and applies `overflow-y: auto` with `maxHeight: 70vh` for vertical scrolling.

The time axis uses `position: sticky; left: 0` to stay pinned on the left. However, per CSS spec, when an element gets `overflow-y: auto`, its `overflow-x` is implicitly promoted to `auto` (it can no longer be `visible`). That makes the **inner body row its own horizontal scroll container**, so `sticky left-0` sticks the time axis to *that* container's left edge — not to the visible viewport. Since the inner container itself never scrolls horizontally (the outer one does), the axis gets carried off-screen along with the day columns when the user pans sideways in 5-day / 3-day mode.

The header row above does not have this bug because it has no `overflow-y`, so its sticky child correctly sticks to the outer horizontal scroller.

## Fix

Unify scrolling onto a single container so `sticky left-0` resolves against the same element that scrolls horizontally.

### Change in `src/components/calendar/JobCalendar.tsx` (WeekView render, lines ~1021–1140)

1. Move `maxHeight: 70vh` and vertical scrolling onto the outer `hScrollRef` container:
   - Replace the current `overflow-y-hidden overscroll-x-contain` on the outer container with `overflow-y-auto overscroll-contain` (keeping `overflow-x-auto` / `overflow-x-hidden` toggle as today).
   - Add `maxHeight: "70vh"` to the outer container's inline style.

2. Remove the inner body wrapper's own scroll container behavior:
   - Change the inner body row (currently `<div className="relative flex overflow-y-auto" style={{ maxHeight: "70vh" }}>`) to just `<div className="relative flex">` (no `overflow-y`, no `maxHeight`).

3. Make the header row sticky to the **top** of the outer scroller so it stays visible during vertical scroll (small bonus, prevents losing day labels):
   - Add `sticky top-0 z-30` to the existing header row (`<div className="flex border-b bg-muted/30 relative">`). Bump time-axis sticky `z-20` to `z-20` (header takes z-30) so the time axis still sits above day columns but under the header corner.
   - Ensure the header's left spacer keeps `sticky left-0 z-30` (raised from z-20) so the top-left corner stays clean above both axes.

4. Keep the `<TimeAxis />` wrapper as `sticky left-0 z-20 bg-card shrink-0`. With scrolling now unified on the outer container, this will correctly pin the axis to the visible left edge during horizontal scrolling at every zoom level (7-day, 5-day, 3-day).

### What stays the same

- `AXIS_PX = 56` and `w-14` width on `TimeAxis` (no shrinking).
- Day-column widths, scroll snap, infinite window, centering logic, zoom buttons, and `JobBlock` rendering.
- Desktop behavior (`isMobile === false`) — desktop already uses comfortable widths and was not affected, but this change improves it consistently.
- The "fit" 7-day mode (no horizontal scrolling) — still works; the axis simply sits at left:0 with no scroll to track.

### Why this is safe

- The outer container already manages horizontal scroll, scroll-snap, and the centering / "infinite" effects (`handleScroll`, `useLayoutEffect` on `currentDate`). Adding vertical scroll to the same element does not affect any of that logic — `el.scrollLeft`, `clientWidth`, and scroll snap on the X axis are independent of Y scrolling.
- Removing `overflow-y` from the inner body row eliminates the implicit `overflow-x: auto`, restoring `sticky left-0` to resolve against the outer (horizontally scrolling) container — which is exactly what we need.
- Touch behavior (`touchAction: "pan-x pan-y"` on the outer container) already permits both-axis panning, so vertical drag continues to work on mobile.

## Files touched

- `src/components/calendar/JobCalendar.tsx` (only the `WeekView` JSX block, ~20 lines changed).

No other components, hooks, styles, or backend changes required. No new dependencies.

## Verification checklist (after implementation)

- Mobile 7-day ("fit"): time axis visible, no horizontal scroll, vertical scroll works inside 70vh.
- Mobile 5-day ("comfortable"): swipe horizontally — time axis stays pinned on the left, day columns slide underneath header; vertical scroll still works.
- Mobile 3-day ("large"): same as 5-day.
- Desktop week view: unchanged visual; horizontal trackpad scroll still pans columns; time axis remains visible.
- Job blocks render in the correct row positions at all zoom levels (no row-misalignment regressions).
