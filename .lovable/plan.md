

## Assign / Unassign jobs from the Jobs page

Add row-level **Assign** and **Unassign** actions, plus **bulk Assign / bulk Unassign** in the existing selection bar on `/admin/jobs`.

### What changes

**File edited: `src/pages/admin/JobManagement.tsx`**

1. **Per-row "Assign SP" control** in the existing "Assigned SP" column:
   - If `assigned_sp_id` is empty → show an inline `Select` of active SPs ("Assign to…"). Picking one calls `useAssignJob` and the row updates to "Assigned".
   - If a job is already assigned → show the SP name plus a small **Unassign** button (icon `UserX`). Clicking opens a confirm dialog ("Unassign {SP} from {Job#}?"). On confirm: clear `assigned_sp_id`, set status back to `Created`, cancel any pending offers for the job, and write a `job_status_events` audit row.
   - Both actions are blocked (with a tooltip-style disabled state) for jobs in `Completed`, `InProgress`, or `Cancelled` status.

2. **Bulk actions in the selection bar** (appears when ≥1 row is selected):
   - **Assign Selected →** opens a dialog with a single SP picker; assigns that SP to every selected eligible job (skips Completed/InProgress/Cancelled and shows a count of skipped).
   - **Unassign Selected →** confirm dialog; unassigns every selected job that currently has an SP (skips others). Cancels pending offers and writes audit rows.
   - Writes one `admin_audit_logs` entry per bulk run (`bulk_assign_jobs` / `bulk_unassign_jobs`).

3. **SP picker behavior**: lists Active providers only, sorted by name, with category match shown next to each SP name (small muted text) so admins can see compatibility at a glance — purely informational, not a hard filter (admin override is allowed).

**File edited: `src/hooks/useSupabaseData.ts`**

- Add `useUnassignJob()` hook:
  - Reads current job (status + assigned_sp_id).
  - Sets `assigned_sp_id = null`, sets `status = 'Created'`.
  - Updates any `Pending` offers for that job to `Cancelled`.
  - Inserts a `job_status_events` row (`old_status → 'Created'`, `note: 'Unassigned by admin'`).
  - Invalidates `["jobs"]` and `["offers"]`.

### Eligibility rules (enforced in UI)

| Current status | Assign allowed? | Unassign allowed? |
|---|---|---|
| Created, Offered | Yes | n/a (no SP) |
| Assigned, Accepted | Reassign (replaces SP) | Yes |
| InProgress | No | No |
| Completed, Cancelled, Archived | No | No |

When **reassigning** an already-assigned job, pending offers (if any) are cancelled and a fresh `job_assignments` audit row is inserted by `useAssignJob`.

### Acceptance

- From `/admin/jobs`, an admin can pick an SP from a row dropdown and the job becomes Assigned without leaving the page.
- An assigned job shows the SP name + Unassign button; clicking + confirming reverts the job to Created and clears the SP.
- Selecting multiple jobs and clicking **Assign Selected** assigns them all to one chosen SP in one action.
- Selecting multiple jobs and clicking **Unassign Selected** clears the SP from all eligible ones.
- Jobs in InProgress / Completed / Cancelled cannot be reassigned or unassigned from this page.
- All actions write audit entries (`job_assignments`, `job_status_events`, plus `admin_audit_logs` for bulk runs).

