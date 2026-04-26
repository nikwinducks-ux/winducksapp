## Goal

Replace the SP "Mark In Progress" / "Mark Completed" CTAs with a Visit-tracking workflow: **Start Visit → End Visit → New Visit → Complete Job**. A job can have multiple visits; each visit logs start/end/duration. Job moves to "In Progress" on the first Start Visit and stays there until the SP explicitly taps **Complete Job**.

## User-facing behavior

- **Assigned/Accepted job**, no active visit: shows **Start Visit** (primary). Tapping it:
  - If job status is `Assigned`/`Accepted`, transitions job to `InProgress`.
  - Creates a `job_visits` row with `started_at = now()`.
  - A live running timer appears on the job (HH:MM:SS, ticks every second).
- **Visit in progress**: button becomes **End Visit** (destructive style). Tapping it sets `ended_at = now()` and stores the duration. Timer freezes to the final visit duration.
- **After End Visit**: two buttons appear side-by-side — **New Visit** (starts another visit, same flow) and **Complete Job** (closes the job → status `Completed`).
- **Visit history list** appears on the job once any visit exists: each row shows visit #, date, start–end time, and total duration. Total time across visits shown at the top.
- All of the above works identically inside the **SP Calendar side sheet** (mobile) and the **/sp/jobs/:id** full page, because both render `SPJobDetailContent`.
- "Mark Completed" copy is replaced everywhere with **Complete Job**.

## Database changes (migration)

New table `job_visits`:

```text
id             uuid pk
job_id         uuid not null  -- references jobs.id (no FK constraint per repo convention)
sp_id          uuid not null  -- the SP who performed the visit (get_user_sp_id(auth.uid()))
started_at     timestamptz not null default now()
ended_at       timestamptz null
duration_secs  int generated/maintained on end
notes          text default ''
created_at     timestamptz default now()
```

RLS:
- Admin/owner full access.
- SP can `SELECT` visits where `sp_id = get_user_sp_id(auth.uid())` OR job is one they're on (assigned or crew).
- SP can `INSERT` only with `sp_id = get_user_sp_id(auth.uid())` and only for jobs they're on.
- SP can `UPDATE` only their own open visits (to set `ended_at`).

Trigger: on first `INSERT` into `job_visits` for a job whose status is `Assigned`/`Accepted`, automatically transition the job to `InProgress` and write a `job_status_events` row. (Keeps client logic simple and atomic.)

No change to `jobs.completed_at` semantics — already handled by existing `enforce_sp_job_update` trigger when status flips to `Completed`.

## Code changes

**New hook** `useJobVisits` in `src/hooks/useSupabaseData.ts`:
- `useJobVisits(jobId)` — list visits ordered by `started_at`.
- `useStartVisit()` — inserts a visit with `started_at = now()`.
- `useEndVisit()` — updates the open visit setting `ended_at = now()`.

**New component** `src/components/sp/JobVisitsCard.tsx`:
- Renders the visit history list + total duration.
- Renders the action buttons (Start Visit / End Visit / New Visit + Complete Job).
- Owns the live ticking timer (1s `setInterval`, cleared on unmount / when no open visit).
- Mobile-first layout: full-width buttons stacked on `<sm`, side-by-side from `sm` up. Large 48px tap targets.

**`src/components/sp/SPJobDetailContent.tsx`**:
- Remove the existing "Update Status" inline card and the mobile sticky bottom CTA bar that contained "Mark In Progress" / "Mark Completed".
- Render `<JobVisitsCard job={job} variant={variant} />` in their place. The card itself handles the sticky-on-mobile placement (so the calendar side sheet and the full page stay in sync).
- Keep the "Job Completed" success card as-is for completed jobs.

**`src/pages/sp/SPCalendar.tsx`**:
- Delete the now-unused `markInProgress` / `markCompleted` helpers and the `useUpdateJobStatus` import they relied on (it's still used inside `SPJobDetailContent` indirectly via the new flow; keep imports clean).

**Copy sweep**: search for any remaining "Mark Completed" / "Mark In Progress" strings in the SP surface and replace with the new flow (none expected outside the file above based on the grep, but the implementation step will re-verify).

## Files

- New migration: `job_visits` table, RLS, auto-transition trigger.
- New: `src/components/sp/JobVisitsCard.tsx`
- Edit: `src/hooks/useSupabaseData.ts` (add visit hooks)
- Edit: `src/components/sp/SPJobDetailContent.tsx` (swap status buttons → `JobVisitsCard`)
- Edit: `src/pages/sp/SPCalendar.tsx` (remove dead helpers)

## Out of scope

- Editing/deleting past visits (admin can manage via DB if needed; can be added later).
- Showing visit history to admins on the admin job detail page (can be added in a follow-up — the data will already exist).
- Notifications/webhooks on visit start/end.