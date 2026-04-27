## Root cause

The job is in DB status `Offered`, but the SP is using the Visits card to start/end a timer and then click **Complete Job**. The visit hooks only touch the `job_visits` table — they never advance the parent job's status. The DB trigger that guards SP-driven status changes only permits:

- `Assigned`/`Accepted` → `InProgress`
- `Assigned`/`Accepted`/`InProgress` → `Completed`
- `Completed` → `Assigned`

So `Offered → Completed` is rejected with the exact error shown in the toast.

There are two separate problems that produced this:

1. **Starting a visit doesn't move the job into `InProgress`.** A visit is the SP's "I'm doing the work now" signal, so the job should atomically transition `Assigned`/`Accepted` → `InProgress` when the first visit starts.
2. **The SP can start a visit on a job that hasn't been accepted yet.** If the job is still `Offered`, the SP must accept it first (or the visit start should implicitly accept + start it).

## Fix

### 1. Make `useStartVisit` advance the job status

When a visit is created and the job's current status is `Assigned` or `Accepted`, transition the job to `InProgress` in the same flow (set `started_at` is already handled by the trigger on line 150–152). Do this server-side via a small RPC `start_visit_and_progress_job(job_id, sp_id)` so the visit insert + status update are atomic and respect RLS.

### 2. Make `useEndVisit` / Complete Job behave correctly

- `Complete Job` should only fire `Assigned`/`Accepted`/`InProgress` → `Completed`. Today the handler in `JobVisitsCard.handleComplete` passes `job.status` as `oldStatus`; if the job is somehow still `Offered`, surface a clearer toast ("Accept this job before completing it") instead of letting the trigger reject it.
- Disable the **Complete Job** button when `job.status === "Offered"` (and show a hint).

### 3. Heal the currently-broken job (one-off)

The job in the screenshot is stuck in `Offered` with a recorded visit. After the code fix, an admin can either:
- accept the offer on the SP's behalf via the existing offer workflow, or
- we add a tiny "Force-accept (admin)" action on the Job Detail page for this kind of orphan.

Recommend the first path — no schema change needed.

### 4. Verify the offer-acceptance path actually flips status

Audit `accept_offer` RPC to confirm it sets the job from `Offered` → `Assigned`/`Accepted`. If the SP truly accepted the offer earlier and the status didn't change, that's a separate bug to patch in the same migration.

## Technical changes

**New migration**
- `start_visit_and_progress_job(p_job_id uuid, p_sp_id uuid)` SECURITY DEFINER RPC:
  - Verifies caller is the assigned SP (or crew member).
  - Inserts into `job_visits`.
  - If job status ∈ (`Assigned`,`Accepted`), updates to `InProgress` (trigger sets `started_at`).
  - Returns the new visit row.
- (Optional) `complete_job_for_sp(p_job_id uuid)` RPC that closes any open visit and sets status to `Completed` in one transaction, returning a structured error if status is `Offered`.

**Frontend**
- `src/hooks/useSupabaseData.ts` → `useStartVisit` calls the new RPC instead of a raw insert.
- `src/components/sp/JobVisitsCard.tsx`:
  - `canAct` becomes `false` when `job.status === "Offered"`; show inline message: *"Accept this offer before tracking visits."*
  - Disable **Complete Job** button when `job.status === "Offered"`.
  - In `handleComplete`, if `job.status === "Offered"` short-circuit with a clearer toast.

**No UI rework** to existing offer/accept flow — only the visit + complete paths.

## Out of scope

- Renaming or restructuring the job status enum.
- Changes to admin-side status overrides.
