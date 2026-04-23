

## Quick-schedule a job from the Jobs list

Today, to set or change a job's scheduled date/time, an admin must open the job's full edit form. Add an inline "Schedule" action on each job row that opens a small dialog with just date + time pickers and saves immediately.

### What changes

**1. Row action — `src/pages/admin/JobManagement.tsx`**

Add a new **calendar icon button** in the per-row action group (next to View / Edit / Assign / Broadcast / Delete). Tooltip: "Schedule".

- Visible for all rows except `Completed`, `Cancelled`, `Archived`.
- Clicking opens a new `Schedule` dialog pre-filled with the job's existing `scheduledDate` and `scheduledTime` (or empty if `urgency` is ASAP / Anytime soon).

**2. New dialog — Schedule job**

Compact dialog showing:
- Job number + customer name (read-only header)
- **Date** input (`type="date"`)
- **Time** select with 15-minute increments (reuse the `TIME_OPTIONS` pattern from `JobForm.tsx`, formatted 12h)
- Helper note: "Setting a date/time will mark this job as Scheduled."
- Buttons: **Cancel**, **Clear schedule** (only if job currently has a date), **Save**

**3. Save behavior**

On Save:
- Require both date and time. Show inline validation if missing.
- Call `supabase.from("jobs").update({ scheduled_date, scheduled_time, urgency: "Scheduled" }).eq("id", jobDbId)` then invalidate the `jobs` query.
- Insert an `admin_audit_logs` entry: `action: "job.schedule"`, `details: { jobDbId, jobNumber, scheduledDate, scheduledTime, previousDate, previousTime }` (matches existing audit pattern in this file).
- Toast: "Job scheduled for {Mon, Apr 28 · 2:00 PM}".

On **Clear schedule**:
- Update with `scheduled_date: null, scheduled_time: ""`, set `urgency: "Anytime soon"`.
- Audit `action: "job.unschedule"`.
- Toast: "Schedule cleared".

**4. Bulk action (light)**

In the existing sticky "selected" bar, add a **Schedule** button that opens the same dialog in bulk mode — applies the same date/time to all selected jobs (excluding non-schedulable statuses, with a count summary). Reuses the same save path in a loop with a single toast at the end.

### Files touched

- `src/pages/admin/JobManagement.tsx` — new dialog component inline, row icon button, bulk button, save handlers, audit logging

No DB migration. No new RPC. The `jobs` table already has `scheduled_date`, `scheduled_time`, `urgency`, and existing admin RLS allows the update.

### Acceptance

- Each schedulable job row shows a calendar icon; clicking opens a Schedule dialog with current values prefilled
- Saving with valid date+time updates the job, flips urgency to Scheduled, refreshes the list, and shows a confirmation toast
- "Clear schedule" removes the date/time and flips urgency to Anytime soon
- Bulk Schedule applies the chosen slot to all selected schedulable jobs and reports `n scheduled, m skipped`
- Completed/Cancelled/Archived jobs do not show the Schedule action
- Every schedule/unschedule writes an entry to `admin_audit_logs`

