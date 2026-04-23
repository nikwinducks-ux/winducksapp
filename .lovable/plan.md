

## Show customer names + color-code SPs on calendar blocks

Replace the job-number title on every calendar block with the customer name, and tint each block based on the assigned SP so it's easy to scan who's doing what across the day/week/month.

### What changes

**1. `src/components/calendar/JobBlock.tsx` — title becomes customer name**

- The first line of every block currently shows `[time] JOB-1234`. Change it to `[time] {job.customerName}` (fall back to `"Unassigned customer"` if missing).
- Job number is still useful — move it to a small muted line below the customer name in non-compact mode (Day / Week). In compact mode (Month chips) it's dropped to keep the chip clean.
- Payout stays in the top-right.

**2. SP color coding**

Add a deterministic color per SP (independent of status):

- New helper `getSpColor(spId?: string)` in a new file `src/components/calendar/spColors.ts`. It hashes the SP UUID into one of ~10 distinct hues and returns Tailwind-friendly classes for background tint, border, and text (e.g., `bg-blue-100 border-blue-400 text-blue-900`). Unassigned jobs get a neutral gray.
- Palette uses calm, professional hues (blue, teal, violet, amber, rose, emerald, indigo, orange, cyan, fuchsia) — all light backgrounds with darker borders to keep text legible on the white calendar canvas.
- Same SP always gets the same color across Day/Week/Month and across sessions (hash-based, no state).

**3. `JobBlock` color logic**

`getJobAppearance` currently colors blocks by **status** (pending = dashed primary, accepted = solid primary, in-progress = accent, completed = green, cancelled = muted). Replace this with a layered approach:

- **Base color** = SP color (from `getSpColor(job.assignedSpId)`).
- **Status overlays** are kept as visual modifiers, not full color swaps:
  - `Created` / `Offered` → keep the dashed border + reduced opacity (still SP-tinted)
  - `Completed` → add a subtle green left border accent + checkmark-style opacity
  - `Cancelled` / `Expired` → grayscale + line-through (SP color suppressed, since the job is dead)
  - `InProgress` → solid SP color with a small pulsing dot indicator
  - `Assigned` / `Accepted` → solid SP color, no overlay

This keeps status legible while making SP identity the dominant visual signal.

**4. Legend in `AdminCalendar.tsx`**

Add a compact, collapsible "SP colors" legend strip below the filter row (admin mode only). It lists each SP currently visible in `filteredJobs` with their color swatch + name. Hidden when SP filter is set to a single SP (redundant). Unassigned swatch shown if any unassigned jobs are visible.

**5. SP portal calendar (`SPCalendar.tsx`)**

In SP mode every job belongs to the same SP, so color-coding by SP is pointless. Keep status-based coloring there. Implementation: `JobBlock` accepts a new `colorMode?: "sp" | "status"` prop (default `"status"` for backward compat). `JobCalendar` passes `colorMode="sp"` only when `mode="admin"`.

### Files touched

- `src/components/calendar/spColors.ts` — new helper: hash → palette entry
- `src/components/calendar/JobBlock.tsx` — customer name as title, job number demoted, SP color base + status overlays, new `colorMode` prop
- `src/components/calendar/JobCalendar.tsx` — thread `colorMode` through Day/Week/Month based on `mode`
- `src/pages/admin/AdminCalendar.tsx` — render SP color legend below the filter bar

No changes to `SPCalendar.tsx`, no DB changes, no changes to filters / sheet / debug behavior.

### Acceptance

- Each calendar block shows the customer name as its primary title (with optional time prefix), in Day / Week / Month
- The job number appears as a small muted secondary line in Day and Week views; hidden in Month chips
- Every block in admin views is tinted with a unique, stable color per SP; the same SP gets the same color across sessions and views
- Unassigned jobs are visibly neutral (gray)
- Pending (Created / Offered) blocks remain dashed and semi-transparent but still carry the SP tint
- Cancelled / Expired blocks remain grayed-out with strikethrough
- Admin calendar shows a legend mapping color swatches to SP names for SPs visible in the current view
- SP portal calendar (`/sp/calendar`) is unchanged — still status-colored

