

## Replace drag-to-block with tap-to-block on SP calendar

The current SP "drag empty time to mark unavailable" gesture in `DayGridDroppable` captures pointer events on the entire day grid, which hijacks vertical scroll on mobile. Replace it with a single **tap** that opens the existing `UnavailableDialog` prefilled with start = tapped time and end = start + 1 hour. The user then adjusts the end time in the dialog and saves.

### What you'll see

- On the SP Day/Week view, tap any empty area of a day's hourly grid → the existing "Mark unavailable" dialog opens with:
  - **Date**: that day
  - **Start**: snapped to the nearest 15‑min slot at the tap point (e.g. tap at 2:07pm → 2:00pm)
  - **End**: start + 1:00 (clamped to 9:00pm day‑end)
  - **Reason**: empty
- Adjust the end time (and reason) in the dialog, save → block appears on the calendar.
- Tapping an existing unavailable block still opens the dialog in **edit** mode (unchanged).
- Tapping a job block still opens the job sheet (unchanged).
- No more pointer capture on the day grid → vertical scroll on mobile works normally.
- The hint copy on the SP calendar header changes from "Drag empty time to mark yourself unavailable." to **"Tap empty time to mark yourself unavailable."**

### Implementation

**`src/components/calendar/JobCalendar.tsx`** — `DayGridDroppable`:
- Remove `onPointerDown` / `onPointerMove` / `onPointerUp` / `onPointerCancel` handlers, the `drag` state, `dragStateRef`, and the in‑progress drag overlay block.
- Replace with a single `onClick` handler on the grid container:
  - Ignore clicks that originated on a job block (`[data-jobblock]`) or existing unavailable block (`[data-unavailable-block]`).
  - Compute Y within the grid via `e.currentTarget.getBoundingClientRect()`.
  - `startMin = yToSnappedMinutes(y)` (already exists in `useCalendarDnd.ts`).
  - `endMin = Math.min(startMin + 60, DAY_END_HOUR * 60)`; if that yields `< startMin + 15`, fall back to `startMin + 15`.
  - Call `onCreateUnavailable?.(date, minutesToHHMM(startMin), minutesToHHMM(endMin))`.
- Change cursor class from `cursor-crosshair` → `cursor-pointer` when `createEnabled`.
- Keep all other logic (droppable for admin DnD job rescheduling, blocks rendering, now line, jobs) exactly as is. Admin drag‑to‑reschedule jobs is unaffected.

**`src/pages/sp/SPCalendar.tsx`**:
- Update the subheader copy: "Drag empty time…" → **"Tap empty time to mark yourself unavailable."**
- No other changes; `handleCreateUnavailable(date, start, end)` already opens the dialog with these values, and `UnavailableDialog` already lets the user edit start/end before saving.

### Notes / non‑goals

- Admin calendar's drag‑to‑reschedule jobs (a separate dnd‑kit flow on `JobBlock`) is untouched.
- No DB, RLS, hook, or schema changes.
- Month view is unaffected (no grid taps there).
- The `UnavailableDialog` already validates `end - start ≥ 15min`, so users can shorten the prefilled hour if desired.

### Files touched

- **Edited**: `src/components/calendar/JobCalendar.tsx` (replace drag handlers in `DayGridDroppable` with `onClick`)
- **Edited**: `src/pages/sp/SPCalendar.tsx` (update subheader copy)

