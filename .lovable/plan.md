

## Bulk Job Actions: Delete & Broadcast

Add admin controls on the Jobs list to select multiple jobs and either delete them or broadcast them in one action. Deletions cascade to all related records so SP views update immediately.

### Admin UI — `src/pages/admin/JobManagement.tsx`

- Add a checkbox column (header + per-row) to the jobs table.
- Header checkbox = select-all-visible (respects current filters/search).
- When ≥1 row is selected, show a sticky **bulk action bar** above the table:
  - "N selected" + Clear button
  - **Broadcast Selected** (with radius input, default 100km, optional broadcast note)
  - **Delete Selected** (destructive, requires confirmation)
- Per-row **Delete** button (trash icon) added to the existing actions column for single-job delete.

### Confirmation dialogs

- **Delete confirmation** (`AlertDialog`): "Delete N job(s)? This permanently removes the job, its services, photos, offers, assignments, and history. This cannot be undone." Requires typing `DELETE` to confirm when N > 1.
- **Bulk broadcast dialog** (`Dialog`): radius slider/input + note textarea + "Broadcast N jobs" button. Skips jobs already in `Assigned`, `InProgress`, `Completed`, or `Cancelled` status (shows a count of skipped jobs in the result toast).

### Backend — cascade delete

A single `delete_job(_job_id uuid)` SECURITY DEFINER RPC that:
1. Verifies caller is admin/owner via `is_admin_or_owner(auth.uid())`.
2. Deletes all storage objects under `job-photos/{job_id}/` (loops `storage.objects` rows in the `job-photos` bucket).
3. Deletes from: `job_photos`, `job_services`, `job_status_events`, `job_assignments`, `offers`, `allocation_run_candidates` (via `allocation_runs.job_id`), `allocation_runs`, then `jobs`.
4. Returns `{ success: true }` or `{ error: "..." }`.

Bulk delete = client loops the RPC per job (keeps logic simple, atomic per-job, easy error reporting).

### Backend — bulk broadcast

Reuse existing `useGenerateBroadcastOffers()` hook from `src/hooks/useOfferData.ts` in a loop over selected eligible jobs. Each job's status flips to `Offered` and broadcast offers fan out to eligible SPs — already RLS-correct, so SP portals (`JobOffers`, `SPDashboard`) refresh on next query.

### Cache invalidation

After bulk actions, invalidate React Query keys: `["jobs"]`, `["offers"]`, `["job-photos"]`, `["job-services"]`, `["allocation-runs"]`. SP-side queries (`useJobs`, `useSpOffers`) re-run automatically and stale offers/jobs disappear from the SP UI.

### Audit

Insert one `admin_audit_logs` row per bulk action with `action = "bulk_delete_jobs"` or `"bulk_broadcast_jobs"` and `details = { job_ids, count, ... }`.

### Files

- **New migration**: `delete_job` RPC.
- **Edit** `src/pages/admin/JobManagement.tsx`: checkboxes, bulk bar, dialogs, delete handler, broadcast handler.
- **Edit** `src/hooks/useSupabaseData.ts`: add `useDeleteJob()` mutation calling the RPC + invalidating caches.
- No edits needed to SP pages — they already react to `jobs`/`offers` query invalidation.

### Acceptance

- Admin can check multiple jobs, click Delete, confirm, and all selected jobs vanish from the list.
- Deleted jobs no longer appear in any SP's My Jobs, Job Offers, or Dashboard (next refresh / 10s poll).
- Admin can check multiple `Created` jobs, click Broadcast, and they all appear as broadcast offers to eligible SPs.
- Single-row delete works via the trash icon in the Actions column.
- Non-admin users cannot call `delete_job` (RPC enforces).

