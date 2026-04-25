# Calendar Time-Label Alignment Fix

## Problem
In Day and Week views, the left-hand time column currently centers each label vertically on the hour grid line (using `-top-2` offset and a `border-t` on each hourly cell). This makes the horizontal divider lines visually run *through* the time labels (e.g. the line crosses through "7AM").

## Goal
- Keep the appointment-area grid lines exactly where they are.
- Move each time label slightly upward so the **top of the text sits just underneath** the corresponding horizontal grid line.
- Remove the horizontal divider lines from the time-label column so labels look clean.

## Scope
Only one component is touched: `TimeAxis` in `src/components/calendar/JobCalendar.tsx` (lines 348–370).

The appointment-area grid lines are rendered separately inside `DayGridDroppable` (the right-side day columns), so changes to `TimeAxis` cannot affect them.

## Changes

In `src/components/calendar/JobCalendar.tsx`, rewrite the `TimeAxis` component:

1. **Drop the half-hour top spacer** (`<div style={{ height: HOUR_PX / 2 }} />`). It existed to vertically center labels on lines; we no longer want centering.
2. **Remove `border-t` from each hourly cell** in the axis so no horizontal lines pass through the label area.
3. **Remove the `-mt-px` and the absolute `-top-2` positioning** on the label span. Instead, position the label at the very top of its hour cell (with a tiny `pt` like `pt-0.5`) so the top of the text sits just below the grid line that the appointment area draws at the same Y coordinate.
4. **Drop the small `bg-muted/20 px-1` background pill** on the span — it was needed only to mask the line crossing through the text. With no line, the pill is unnecessary.
5. Keep the column width (`w-14`), the right-hand border (`border-r`) that separates the axis from the day columns, and the muted background.

The total axis height stays at `GRID_HEIGHT_PX` (15 hours × 60px), matching the appointment grid exactly, so nothing in the appointment area shifts.

## Result
- Appointment cards: unchanged position, unchanged size.
- Appointment grid lines: unchanged.
- Left time column: each hour label (e.g. "7AM") now sits just under its corresponding grid line, with no line cutting through the text and no divider lines visible inside the label column.

## Files Changed
- `src/components/calendar/JobCalendar.tsx` — `TimeAxis` component only (~20 lines).
