## Goal

From the SP **My Jobs → Past Jobs** view, allow a Service Provider to:
1. **Re-open** a completed job (revert it to an active status).
2. **Schedule one or more follow-up visits** (date + time + duration) under the same job, which then appear on the SP's calendar alongside the original job.

---

## UX

### My Jobs → Past Jobs card
- Each completed job card gets a **"Re-open job"** button (and a kebab/secondary "Schedule follow-up visit" action).
- Clicking **Re-open** opens a small confirm dialog: "Re-open JOB-1234? It will move back to your Active jobs." On confirm, status flips Completed → **Assigned** (the SP can then start a new visit / mark complete again normally).
- Clicking **Schedule follow-up visit** opens a dialog (date, start time, duration, optional note) that creates a new scheduled-visit record, even if the job stays Completed.

### SP Job Detail (panel + page)
- New **"Follow-up visits"** section on completed (and active) jobs that lists scheduled follow-ups with edit/cancel actions and an **"Add follow-up visit"** button.

### SP Calendar (`SPCalendar.tsx`)
- Pull scheduled follow-up visits and render them as additional blocks on the calendar (same color as the parent job, with a small "follow-up" tag).
- Clicking a follow-up block opens the existing job sheet, scrolled to the Follow-up visits section.

---

## Data model

New table **`job_scheduled_visits`** (separate from `job_visits`, which stays a clock-in/out log):

```text
id              uuid pk
job_id          uuid not null
sp_id           uuid not null         -- which SP this visit is for
visit_date      date not null
start_time      text not null          -- "HH:MM"
duration_min    int  not null default 60
status          text not null default 'Scheduled'  -- Scheduled | Completed | Cancelled
note            text not null default ''
created_by_user_id uuid
created_at, updated_at timestamptz
```

RLS:
- Admin/Owner: full access.
- SP: select / insert / update / delete rows where `sp_id = get_user_sp_id(auth.uid())` AND they are on the job (`assigned_sp_id` or `job_crew_members`).

### Re-open transition
The current `enforce_sp_job_update` trigger does **not** allow `Completed → Assigned` for SPs. We will extend the allowed SP transitions to include:
- `Completed → Assigned` (re-open)

`completed_at` will be cleared when the job leaves Completed, and re-set the next time the job is completed (already handled).

---

## Code changes

**Migration**
- Create `job_scheduled_visits` + RLS policies + `updated_at` trigger.
- Update `enforce_sp_job_update` to allow `Completed → Assigned`, and clear `completed_at` when transitioning out of Completed.

**Hooks** (`src/hooks/useSupabaseData.ts`)
- `useJobScheduledVisits(jobId?)` — list for one job.
- `useSPScheduledVisits(spId?)` — list across all my jobs (for calendar).
- `useCreateScheduledVisit`, `useUpdateScheduledVisit`, `useDeleteScheduledVisit`.
- `useReopenJob({ jobDbId, spId })` — wraps the existing status update + audit event with note "Re-opened by SP".

**New components**
- `src/components/sp/ScheduledVisitDialog.tsx` — date / start time / duration / note, used for create + edit.
- `src/components/sp/JobScheduledVisitsCard.tsx` — list + add/edit/cancel UI for a single job.

**Edited components**
- `src/pages/sp/MyJobs.tsx` — Past Jobs cards: add **Re-open** button (with confirm) and **Schedule follow-up** action that opens the dialog. Stop the parent `Link` from intercepting button clicks.
- `src/components/sp/SPJobDetailContent.tsx` — Render `JobScheduledVisitsCard` for the SP, and on Completed jobs also show a **Re-open job** button next to the "Job Completed" banner.
- `src/pages/sp/SPCalendar.tsx` — Fetch `useSPScheduledVisits(spId)` and merge them into the calendar feed as synthetic blocks tied to their parent job (use parent job's color). Clicking opens the same job sheet that's already wired up.
- `src/components/calendar/JobCalendar.tsx` — Accept an optional `extraBlocks` prop (or extend the jobs array with virtual entries flagged `kind: "follow-up"`) so the calendar renders them with a subtle "+visit" badge.

---

## Out of scope
- No changes to invoicing — re-opening a Completed job does not auto-void the existing invoice. Admin can adjust manually if needed (we'll surface a small inline note in the Re-open confirm dialog).
- No SMS/push notifications for scheduled follow-ups in this pass.
