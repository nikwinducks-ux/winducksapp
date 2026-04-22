

## Toggle Broadcast Status from the Jobs Page

Add inline broadcast on/off control on the Admin Jobs list, plus a bulk "Stop Broadcast" action — without leaving the page.

### What changes in the UI — `src/pages/admin/JobManagement.tsx`

**New "Broadcast" column** (between Status and Assigned SP):
- Shows a small switch + label:
  - `On` (with radius badge, e.g. "On · 80km") when `is_broadcast = true`
  - `Off` when `is_broadcast = false`
- Toggle is disabled (read-only badge) for jobs in `Assigned`, `InProgress`, `Completed`, `Cancelled`, `Archived` — those can't be re-broadcast.

**Toggle behavior:**
- **Off → On**: opens a small popover/dialog asking for radius (default current value or 100km) + optional note → on confirm, runs the existing broadcast generation (same as the bulk Broadcast dialog) so offers fan out to eligible SPs. Job status moves to `Offered`.
- **On → Off** ("Stop Broadcast"): confirmation `AlertDialog` → sets `is_broadcast = false`, cancels all `Pending` offers for the job (`status = 'Cancelled'`), and if the job's status is `Offered` (no acceptance yet) reverts it to `Created`. Audit row written.

**Bulk action bar** (already present when rows are selected) gains a third button:
- **Stop Broadcast** — runs the same Off action for every selected job currently `is_broadcast = true`. Skips ineligible jobs and reports counts in toast.

### Backend

New SECURITY DEFINER RPC `stop_broadcast(_job_id uuid)`:
1. Check `is_admin_or_owner(auth.uid())`.
2. `UPDATE offers SET status = 'Cancelled', responded_at = now() WHERE job_id = _job_id AND status = 'Pending'`.
3. `UPDATE jobs SET is_broadcast = false, status = CASE WHEN status = 'Offered' AND assigned_sp_id IS NULL THEN 'Created' ELSE status END WHERE id = _job_id`.
4. Insert a `job_status_events` row if status changed.
5. Returns `{ success: true, cancelled_offer_count }`.

The "turn On" path reuses the existing `useGenerateBroadcastOffers` hook + a direct `is_broadcast = true` update (same code path already used in `JobDetail.tsx`).

### New hooks — `src/hooks/useSupabaseData.ts`

- `useStopBroadcast()` → calls the RPC, invalidates `["jobs"]`, `["offers"]`.
- `useStartBroadcast()` (thin wrapper) → flips `is_broadcast = true`, sets new `broadcast_radius_km` / `broadcast_note`, then calls `useGenerateBroadcastOffers`. Invalidates the same caches.

### Audit

- Single-row toggle: insert `admin_audit_logs` with `action = 'start_broadcast'` or `'stop_broadcast'`, `details = { job_id, radius_km?, note?, cancelled_offer_count? }`.
- Bulk stop: one row with `action = 'bulk_stop_broadcast'`, `details = { job_ids, count, ok, fail }`.

### SP-side propagation

No SP-side code changes required. RLS already hides non-broadcast / non-eligible jobs, and the SP `JobOffers` page polls every 10s and respects offer status — cancelled offers vanish automatically.

### Files

- **New migration**: `stop_broadcast` RPC.
- **Edit** `src/pages/admin/JobManagement.tsx`: Broadcast column, start/stop dialogs, bulk Stop Broadcast button.
- **Edit** `src/hooks/useSupabaseData.ts`: `useStopBroadcast`, `useStartBroadcast`.

### Acceptance

- A `Created` job shows "Off" switch in the Broadcast column; flipping it on opens a radius prompt and immediately broadcasts.
- A broadcast `Offered` job shows "On · Nkm"; flipping it off cancels all pending offers and returns the job to `Created`.
- Selecting multiple broadcast jobs and clicking "Stop Broadcast" stops all of them in one action.
- Jobs in `Assigned`/`InProgress`/`Completed` show a static badge and cannot be toggled.
- SP portals stop seeing the job/offer on next refresh.

