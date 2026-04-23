

## SP "Unavailable" time-off via click-and-drag on the calendar

Let SPs paint unavailable time directly on their calendar (Day/Week views) by click-and-drag, then save it with an optional reason. These blocks render on their own calendar **and** the admin calendar, and they prevent the allocation engine from offering jobs that overlap them.

### Behavior

**1. Creating an unavailable block (SP Calendar — Day & Week views)**
- The SP presses on an empty area in the time grid and drags vertically to define a range. While dragging, a translucent gray overlay shows the range with a live label like *"Unavailable · 1:30 PM – 3:45 PM"*, snapped to 15-minute increments.
- On release, a small dialog opens prefilled with the date + start/end time and an optional **Reason** textarea (e.g., "Doctor appointment", "Family event"). Buttons: **Save** / **Cancel**.
- Save creates the block; cancel discards it. Minimum length is 15 minutes; dragging upward also works (auto-normalized).
- Drag is disabled in Month view (Month shows a small "Unavailable" pill on affected days instead).
- Drag does not start when the press lands on a job block, so existing job-click behavior is unchanged.

**2. Viewing & editing existing blocks**
- Blocks render as a striped gray band on the SP's calendar grid spanning their time range, labeled *"Unavailable"* + reason (truncated). Clicking opens a sheet showing date, range, reason, and **Edit** / **Delete** actions.
- A new **"Time Off"** section is added to `/availability` (Availability Settings) listing all upcoming blocks in a table (date, time range, reason, delete) for management without scrolling the calendar.

**3. Admin visibility**
- On the Admin Calendar (Day/Week), each SP's unavailable blocks render as the same striped gray band labeled *"{SP name} — Unavailable"* (+ reason on hover/click). Color uses the SP's calendar color at low opacity so admins can scan who's off.
- Filtering: the existing SP filter in `AdminCalendar` also filters unavailable blocks (when an SP is selected, only their blocks show).
- Admins can click a block to see details but cannot edit/delete (read-only on admin side, matching the "SP owns their availability" model already in place).

**4. Allocation impact**
- The deterministic allocation engine and broadcast eligibility both gain a **hard exclusion**: if a scheduled job's `[scheduled_time, scheduled_time + estimated_duration)` overlaps any of the SP's unavailable blocks on that date, the SP is excluded with reason *"Time off blocked"*.
- ASAP/Anytime jobs with no scheduled time are not blocked (no overlap to compute), matching how blackouts work today.
- The full-day `blackout_dates` mechanism on `sp_availability` continues to work as before; a single-day blackout is treated as a 24-hour unavailable block by the allocator.

### Technical design

**New table: `sp_unavailable_blocks`** (migration)
- Columns: `id uuid pk`, `sp_id uuid not null` (refs `service_providers`), `block_date date not null`, `start_time text not null` ("HH:MM"), `end_time text not null` ("HH:MM"), `reason text not null default ''`, `created_by_user_id uuid`, `created_at timestamptz default now()`, `updated_at timestamptz default now()`.
- Index on `(sp_id, block_date)`.
- Validation trigger: `end_time > start_time`, both in `HH:MM` format.
- RLS:
  - Admin/owner: full access (`is_admin_or_owner(auth.uid())`).
  - SP: select / insert / update / delete own rows where `sp_id = get_user_sp_id(auth.uid())`.
- An `availability_events` row is written via trigger on insert/update/delete for audit, mirroring the schedule-edit audit pattern already in use.

**New hook: `src/hooks/useSpUnavailable.ts`**
- `useSpUnavailableBlocks(spId | null, dateRange?)` — query, returns blocks for the SP (and optional date window).
- `useAllSpUnavailableBlocks(dateRange)` — admin variant, returns everyone's blocks for the visible range.
- `useCreateSpUnavailable()`, `useUpdateSpUnavailable()`, `useDeleteSpUnavailable()` mutations with `["sp_unavailable", spId]` invalidation.

**Calendar drag-to-create (`JobCalendar.tsx` → new optional prop `onCreateUnavailable?(date, start, end)`)**
- Add a new `useCreateUnavailableDrag` helper that wires `onPointerDown` / `onPointerMove` / `onPointerUp` on the day grid background (only when the prop is provided and the press did not originate on a `JobBlock`).
- Snaps Y → minutes via existing `yToSnappedMinutes` from `useCalendarDnd.ts`.
- During drag, renders a positioned overlay div with the live range label.
- On `pointerup`, calls `onCreateUnavailable(date, "HH:MM", "HH:MM")`.
- Coexists with existing DnD: `JobBlock` mousedown stops propagation so admin DnD reschedule continues to work; the new drag is mutually exclusive with that (only enabled in SP mode).

**Rendering blocks (`JobCalendar.tsx`)**
- New optional prop `unavailableBlocks: { id; spId; date; start; end; reason; spName?; spColor? }[]` and `onUnavailableClick?(block)`.
- For each day column, blocks whose date matches are rendered as positioned absolute divs underneath job blocks, using a striped background (`bg-[repeating-linear-gradient(...)]`) and the SP's color at low opacity in admin mode, gray in SP mode.
- Month view: a single small "Off" pill in the day cell when any block exists.

**SP Calendar page (`SPCalendar.tsx`)**
- Adds: `useSpUnavailableBlocks(spId)`, drag-to-create overlay, a new `<UnavailableDialog />` for create/edit, and a click handler that opens the same dialog in edit mode.
- Mutations call the new hooks; toast on success.

**Admin Calendar page (`AdminCalendar.tsx`)**
- Adds: `useAllSpUnavailableBlocks(visibleRange)`, passes `unavailableBlocks` to `<JobCalendar mode="admin" />`.
- Filter: respect the existing SP filter when present.
- Click on a block opens a small read-only popover (date, SP name, range, reason).

**Availability Settings (`SPAvailabilityEditor.tsx`)**
- New section *"Time Off"* below "Blackout Dates" listing upcoming `sp_unavailable_blocks` for the SP with a delete button per row, and an "Add time off" button that opens the same dialog (defaulting to today). Existing blackout-dates UI is unchanged.

**Allocation engine (`src/lib/allocation-engine.ts`)**
- Add a hard constraint check in the eligibility step: when a job has `scheduledDate` + `scheduledTime`, compute `[start, start+duration)` and exclude any SP whose `sp_unavailable_blocks` for that date overlaps. Reason string: `"Time off blocked"`.
- Engine reads pre-fetched blocks passed in via the existing data context (the QA harness and offer-generator already pass the SP list; we add `unavailableBlocks: Map<spId, Block[]>`).
- For broadcast eligibility, mirror this check inside `sp_eligible_for_broadcast_job` SQL function in the same migration (overlap test against `sp_unavailable_blocks` for the job's `scheduled_date`/`scheduled_time` + `estimated_duration` parsed in SQL — straightforward since duration is already stored as text and the engine parses the same way; for SQL we add a small `parse_duration_minutes(text)` helper function and an `unavailable_overlap(_sp_id, _date, _start_minutes, _end_minutes)` helper).

**Files**
- New: `supabase/migrations/<timestamp>_sp_unavailable_blocks.sql` (table + RLS + helper SQL fns + `sp_eligible_for_broadcast_job` update).
- New: `src/hooks/useSpUnavailable.ts`.
- New: `src/components/calendar/UnavailableDialog.tsx`.
- Edit: `src/components/calendar/JobCalendar.tsx`, `src/components/calendar/useCalendarDnd.ts` (export-only helpers), `src/pages/sp/SPCalendar.tsx`, `src/pages/admin/AdminCalendar.tsx`, `src/components/admin/SPAvailabilityEditor.tsx`, `src/lib/allocation-engine.ts`.

### Acceptance

- An SP can drag on their Day or Week calendar to paint a range, name an optional reason, and save. The block appears immediately on their calendar.
- The block also appears on the Admin Calendar labeled with the SP's name and reason; admins cannot edit or delete it from there.
- The block shows up in the SP's *Time Off* list under `/availability` and can be deleted from either place.
- Editing an existing block (click → Edit) updates the time range / reason; deleting removes it everywhere.
- Running allocation on a scheduled job whose time overlaps any SP's block excludes that SP with the reason "Time off blocked"; broadcasts hide the job from that SP.
- Clicks on existing job blocks still open the job sheet — drag-to-create only fires on empty grid space.

