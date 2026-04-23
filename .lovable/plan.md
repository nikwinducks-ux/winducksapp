

## Assign multiple Service Providers to one job (Crew model)

Today each job has a single `assigned_sp_id`. We'll add a crew model so admins can put 2+ SPs on one job, every assigned SP sees it on their My Jobs / calendar / job detail with an equally split payout, and any of them can move the status forward.

### Behavior

**1. Admin assigns a crew (Job Detail → Dispatch Actions)**
- The "Assign SP Directly" panel becomes a multi-select: a checklist of active SPs (with city + radius) and a Confirm button.
- Selecting 1 SP behaves like today. Selecting 2+ creates a crew. A small helper line shows the per-SP split: "Each SP will be paid $40.00 (=$120 ÷ 3)".
- One SP is implicitly the **Lead** (first-selected, or admin can mark a star). Lead is informational only — every member has equal status powers.

**2. Add or remove crew members later**
- A new "Crew" section on the Job Detail page (above Dispatch Actions, visible whenever the job has ≥1 assigned SP) lists current crew members with avatar, name, "Lead" star, and a Remove button (× confirm).
- An "+ Add SP to crew" button opens the same picker filtered to SPs not already on the crew. Adding/removing is allowed up through `InProgress`; blocked once `Completed` / `Cancelled`.
- Removing the last crew member returns the job to `Created` and clears assignment (mirrors current Unassign).

**3. SP experience**
- **My Jobs**: a job appears for every SP on the crew, not just the lead. A small "Crew (3)" pill is shown next to the status badge so the SP knows others are on it.
- **SP Job Detail**: a "Crew" card lists all members (name, avatar, Lead star). Payout shown to the SP is **their split** ("$40.00 — your share of $120"), not the headline figure.
- **SP Calendar**: same job appears on every assigned SP's calendar; admin calendar still shows it once but tinted to the lead's color (with a small "+2" chip if crew > 1).

**4. Status changes (any-SP-can-act)**
- Start / Complete buttons appear for every assigned SP. The first to tap moves the whole job. Status events are audited with the acting SP's id (existing `job_status_events` already supports this).

**5. Offers and broadcast**
- No change to offer logic — offers still target one SP at a time. When an SP accepts an offer, they're added to the crew (instead of overwriting). Cancellation of pending offers on direct assign still applies.
- Auto-accept rules continue to apply per-SP.

**6. Backwards compatibility**
- Existing single-SP jobs keep working unchanged. The legacy `jobs.assigned_sp_id` is mirrored to "the lead" and is auto-maintained when crew membership changes (so existing queries, RLS policies, and triggers keep working with zero changes).

### Technical design

**Database (new migration)**
- New table `job_crew_members`:
  - `id uuid PK default gen_random_uuid()`
  - `job_id uuid NOT NULL`
  - `sp_id uuid NOT NULL`
  - `is_lead boolean NOT NULL default false`
  - `added_by_user_id uuid NULL`
  - `added_at timestamptz NOT NULL default now()`
  - `UNIQUE(job_id, sp_id)`
- RLS:
  - Admin full access (`is_admin_or_owner(auth.uid())`).
  - SP select rows where `sp_id = get_user_sp_id(auth.uid())`.
- Trigger `sync_job_lead_on_crew_change`: after insert/delete on `job_crew_members`, set `jobs.assigned_sp_id` to the current lead (or first member if no lead, or NULL if empty) and adjust `jobs.status` (`Created` ↔ `Assigned`) when membership transitions to/from zero. Keeps existing RLS policies, triggers (`enforce_sp_job_update`), and offer flow working as-is.
- Update RLS on `jobs`, `job_services`, `job_photos`, `job_status_events`, `customers` SP-select policies to also include rows where the SP is a crew member:
  - `assigned_sp_id = get_user_sp_id(auth.uid()) OR EXISTS (SELECT 1 FROM job_crew_members c WHERE c.job_id = jobs.id AND c.sp_id = get_user_sp_id(auth.uid()))`
  - Wrap that check in a small SECURITY DEFINER helper `sp_on_job_crew(_sp_id, _job_id)` to keep policies tidy and avoid recursion.
- Update `enforce_sp_job_update`: an SP is allowed to update status if they're either the assigned SP or a crew member.
- Backfill: for every existing job where `assigned_sp_id IS NOT NULL`, insert one `job_crew_members` row with `is_lead = true`.

**Hooks (`src/hooks/useSupabaseData.ts`)**
- New `useJobCrew(jobId)` — fetches crew rows joined with `service_providers`.
- New `useAssignCrew()` — replaces the body of the current direct-assign flow; takes `{ jobId, spIds: string[], leadSpId, userId }`, inserts crew rows in a single batch, marks lead, cancels pending offers.
- New `useAddCrewMember()` / `useRemoveCrewMember()` / `useSetCrewLead()`.
- Job mapper (`dbToJob`) gains `crew: { spId, isLead }[]` and a derived `payoutShare` (= `payout / crew.length`, rounded to 2dp).
- `useAcceptJobOffer` now inserts a `job_crew_members` row instead of overwriting `assigned_sp_id` (the trigger updates it).

**UI**
- `src/pages/admin/JobDetail.tsx`:
  - Replace single-select Assign panel with a multi-select crew picker (`Checkbox` list + lead star). Show live "$X.XX per SP" helper.
  - Add a new "Crew" card showing members + add/remove/lead controls.
- `src/pages/sp/MyJobs.tsx`: filter by `j.assignedSpId === user?.spId || j.crew?.some(c => c.spId === user?.spId)`. Add "Crew (n)" pill.
- `src/pages/sp/SPJobDetail.tsx`: add "Crew" card; payout label shows "$share — your share of $total" when `crew.length > 1`.
- `src/pages/sp/SPCalendar.tsx`: same crew-aware filter.
- `src/components/calendar/JobBlock.tsx` (admin colorMode `sp`): if crew > 1, append a small `+N` chip.

**Files touched**
- New migration in `supabase/migrations/` (table, helper fn, RLS updates, trigger, backfill).
- `src/integrations/supabase/types.ts` (auto-regenerated).
- `src/data/mockData.ts` (`Job.crew?: { spId: string; isLead: boolean }[]`, `Job.payoutShare?: number`).
- `src/hooks/useSupabaseData.ts` (new hooks + mapper changes + offer-accept change).
- `src/pages/admin/JobDetail.tsx`, `src/pages/sp/MyJobs.tsx`, `src/pages/sp/SPJobDetail.tsx`, `src/pages/sp/SPCalendar.tsx`.
- `src/components/calendar/JobBlock.tsx`.

### Acceptance

- Admin can pick 2+ SPs from the Assign panel and confirm; the job is `Assigned` with all selected SPs in the Crew card.
- Each selected SP sees the job on My Jobs, on their SP Calendar, and on the SP Job Detail page, with their payout shown as the equal split.
- Any crew member can mark the job InProgress / Completed and it reflects everywhere.
- Admin can add/remove crew members on a live job and re-assign Lead; offers stay coherent (existing pending offers cancelled on first crew assignment, just like today).
- Removing all crew members reverts the job to `Created`.
- Existing single-SP jobs continue to work without any data changes (backfilled into a 1-member crew with that SP as Lead).

