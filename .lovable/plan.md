## Problem

On the SP calendar (Day/Week views), tapping any empty spot in the time grid immediately opens the "Mark unavailable" dialog. On mobile this fires accidentally while scrolling, panning, or just trying to tap a job nearby.

## Goal

Require a deliberate **long-press (~500ms)** on an empty grid area before the unavailable dialog opens. Quick taps and scroll gestures should do nothing.

## Approach

Replace the `onClick` handler on the day-grid droppable in `src/components/calendar/JobCalendar.tsx` (the `DayGridDroppable` component, around lines 539–556) with pointer-based long-press detection:

1. On `onPointerDown` over an empty area (not on a job block or unavailable block):
   - Record start position, time, and the snapped start minute.
   - Start a 500ms timer.
   - When the timer fires: trigger a short haptic vibration (`navigator.vibrate?.(15)`), add a brief visual "press" highlight, and call `onCreateUnavailable(date, start, end)`.
2. On `onPointerMove`: if the pointer moves more than ~8px from the start position, cancel the timer (user is scrolling/panning).
3. On `onPointerUp`, `onPointerCancel`, or `onPointerLeave`: cancel the timer if it hasn't fired. Do **not** fall back to opening the dialog — short taps now do nothing on empty grid space.
4. Remove the existing `onClick={onGridClick}` so quick taps no longer trigger creation.
5. Apply this only when `createEnabled` (i.e. SP mode where `onCreateUnavailable` is provided). Admin mode is unaffected.

Desktop behavior: long-press with mouse also works (press and hold 500ms). This is acceptable and matches mobile behavior — admins don't use this handler so desktop SPs are the only group affected, and the gesture is still discoverable.

## Files to change

- `src/components/calendar/JobCalendar.tsx` — replace tap handling in `DayGridDroppable` with long-press logic. Keep job-block and unavailable-block click handlers untouched.

## Out of scope

- Month view (already uses `onDayClick`, not the time grid).
- Drag-to-create unavailable ranges.
- Visual onboarding/tooltip explaining the new gesture (can add later if users are confused).
