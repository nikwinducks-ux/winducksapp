

## Add drag-and-drop rescheduling to the calendar

Let admins reschedule jobs by dragging job blocks across days and time slots, and reassign jobs by dragging them onto an SP "swimlane" header. SP portal stays read-only.

### Behaviors

**1. Drag a job within Day or Week view (admin only)**
- Grabbing any timed job block lets the admin drop it onto any 15-minute slot on any day in the visible Day/Week grid.
- On drop: the job's `scheduledDate` and `scheduledTime` update to the drop target. Duration is preserved.
- Untimed and "outside hours" jobs in the top strip are also draggable; dropping into the grid assigns them a time.

**2. Drag a job across days in Month view (admin only)**
- Admin can drag a month-cell chip onto another day cell.
- On drop: only `scheduledDate` changes; `scheduledTime` is preserved (if untimed, stays untimed).

**3. Visual feedback during drag**
- Dragged block gets reduced opacity + ring outline.
- Hovered drop target (day column or month cell) gets a soft `bg-primary/10` highlight.
- A floating "ghost time" label follows the cursor in Day/Week showing the snapped target time (e.g. "Wed 1:15 PM").
- Snap increments: 15 minutes (matches existing scheduling UX).

**4. Optimistic UI + persistence**
- On drop, the calendar updates immediately (optimistic React Query cache mutation on the `["jobs"]` key) and a single PATCH-style call is sent via the existing `useUpdateJob` mutation, sending the full required field set with new `scheduledDate` / `scheduledTime` and `urgency: "Scheduled"`.
- On success: small toast "Rescheduled JOB-XXXX to {date} at {time}".
- On failure: toast error + cache invalidation rolls back the move.

**5. Confirmation guard for risky moves**
- If the job's current status is `InProgress` or `Completed`, the drag is blocked with a toast "Cannot reschedule a job that has already started." (matches existing job-edit guards.)
- If the job is `Cancelled` / `Expired`, drag is blocked silently (the block is not draggable).
- `Created` / `Offered` / `Assigned` / `Accepted` are freely draggable.

**6. SP portal**
- `JobCalendar` receives a new `enableDnd` prop. `AdminCalendar` passes `true`, `SPCalendar` passes `false` (default). SP portal behavior is unchanged.

**7. Keyboard / accessibility**
- Drag is mouse/touch only (HTML5 DnD via pointer events). Existing click-to-open-sheet behavior is preserved — single click still opens the reschedule/reassign sheet, providing a fully keyboard-accessible alternative.

### Implementation approach

Use **`@dnd-kit/core`** (already a common pattern in this stack; small, accessible, no jQuery-style hacks). It supports custom drop sensors, snap-to-grid via `modifiers`, and works cleanly with our absolute-positioned JobBlocks.

- New file `src/components/calendar/useCalendarDnd.ts` — hook that wraps `DndContext`, exposes a `handleDragEnd(event)` that resolves drop target → `{ date, time? }` and calls a passed-in `onReschedule(job, date, time?)`.
- `JobCalendar.tsx`:
  - When `enableDnd` is true, wrap the whole calendar in `<DndContext>`.
  - Day/Week grid: each `DayColumn` registers its hour grid as a droppable. The grid container listens for pointer position to compute the snapped minute (using `event.activatorEvent` + the column's bounding rect). Actual drop math happens in `handleDragEnd`.
  - Month view: each day cell becomes a droppable; payload is just the date.
  - `JobBlock` becomes a `useDraggable` element when `enableDnd` is true; otherwise renders unchanged. Drag handle = entire block.
- `AdminCalendar.tsx`:
  - Pass `enableDnd` to `JobCalendar`.
  - Provide `onReschedule(job, dateISO, timeHHmm?)` which calls `updateJob.mutateAsync(...)` with the same field set used by `saveSchedule()` today, then surfaces a toast.
  - Block the call up-front for InProgress/Completed jobs.

### Files touched

- `package.json` — add `@dnd-kit/core`
- `src/components/calendar/useCalendarDnd.ts` — new helper hook
- `src/components/calendar/JobCalendar.tsx` — wire `DndContext`, droppables on Day/Week hour grid + Month cells, snap-to-15min math, ghost time indicator, accept new `enableDnd` and `onReschedule` props
- `src/components/calendar/JobBlock.tsx` — make block draggable when `enableDnd`; add visual states (`isDragging`, `dragHandleProps`)
- `src/pages/admin/AdminCalendar.tsx` — pass `enableDnd` + `onReschedule` handler; reuse existing `useUpdateJob` mutation; status guard + toasts
- `src/pages/sp/SPCalendar.tsx` — no change (omits `enableDnd`, default `false`)

### Acceptance

- Admin can drag a job in Day or Week view to a new day/time; release snaps to 15-minute increments and the job persists at the new slot
- Admin can drag a chip in Month view to a different day; date persists, time preserved
- Drop highlights, drag opacity, and a "ghost time" label appear during drag
- Toast confirms success; failures roll back the optimistic move
- Jobs with status `InProgress`, `Completed`, `Cancelled`, or `Expired` cannot be dragged (blocked + explanatory toast for active states)
- Single click still opens the existing reschedule/reassign sheet — drag does not interfere
- SP portal calendar (`/sp/calendar`) is unchanged

