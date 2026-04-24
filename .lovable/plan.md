## Problem

On mobile week view the date header (`WeekDateStrip`) is its own horizontal scroller with ~57 days, while the time grid below only renders the 7 days of the current week. Swiping the date header slides the date labels independently of the time columns underneath, so the date "Tue 23" no longer sits above the Tue 23 time column. The user wants the date label and its time column to move together.

## Root cause

The strip and the grid live in two separate scroll containers and render different ranges:
- Strip: windowed ±28 days, scrolls freely.
- Grid: only the 7 days around `currentDate`, scrolls within those 7.

There is no per-pixel link between them — only a debounced "settle" callback that re-anchors the week.

## Fix: render dates inline above each time column

Remove the independent strip and bring the date header back inside the same horizontal scroll container as the time grid, on mobile as well as desktop. To preserve the "infinite past/future scroll" behavior the strip provided, widen the grid's rendered range to the same windowed ±N days, and let one shared scroller move both header and columns in lockstep.

### Changes in `src/components/calendar/JobCalendar.tsx`

1. **Delete `WeekDateStrip`** and its mobile-only render block.
2. **In `WeekView`**, replace `days = eachDayOfInterval(start..end of week)` (mobile only) with a windowed range anchored on `currentDate`:
   - `windowedDays`: `addDays(currentDate, -half)` … `addDays(currentDate, +half)` with `half` starting at 28.
   - Keep desktop on the existing 7-day week.
3. **Render a single header row** (mobile + desktop) inside the existing `hScrollRef` container, above the time grid, using the same `dayMinWidthPx` and the same `days` array as the columns. Each header cell is a button that calls `onDateChange?.(d)` so tapping a date still selects it. This guarantees the header cell and its time column share the same x-position because they live in the same flex row width.
4. **Infinite scroll**: on mobile, attach a debounced scroll handler to `hScrollRef`. When the centered column index falls within ~7 of either end of `windowedDays`, grow `half` by 28 and adjust `scrollLeft` to compensate so the visible position does not jump. On settle, call `onDateChange?.(centeredDay)` so the parent's `currentDate` follows the user's position (used for the navigation label and "Today" button).
5. **Initial centering**: on mount and whenever `currentDate` changes from outside (Today button, arrows), use `scrollTo({ left: targetLeft })` on `hScrollRef` to center the matching column. Suppress the settle callback briefly so the programmatic scroll does not echo back into `onDateChange`.
6. **Scroll feel**: keep `scroll-snap-type: x proximity` and `scroll-padding-left: 56px` on the shared container. Drop `scrollSnapAlign` on day cells in favor of `scroll-snap-align: start` so a single flick lands cleanly on a day boundary. Keep the existing zoom buttons (`fit` / `comfortable` / `large`) — `fit` mode disables horizontal scroll the same way it does today.
7. **`useHorizontalWheelScroll`**: enable on mobile too now that there is a real horizontal scroller for the windowed range (still no-op when `isFit`).

### Net behavior

- Header cell "Tue 23" and the time column for Tue 23 are the same flex item width inside the same scroll container — they cannot detach.
- Swiping the header swipes the columns (and vice-versa) because there is one scroller.
- Past/future is still effectively infinite via window growth on edge approach.
- Navigation arrows, "Today", zoom in/out, and tap-to-select all keep working.

### Files

- `src/components/calendar/JobCalendar.tsx` — remove `WeekDateStrip`, restructure `WeekView` per above.
- No changes needed in `AdminCalendar.tsx` / `SPCalendar.tsx` — `onDateChange` wiring stays the same.

## Out of scope

- Desktop week view layout (already inline; only gains windowed range if we choose to — kept on 7-day week for now to avoid changing desktop UX).
- Day and Month views.
