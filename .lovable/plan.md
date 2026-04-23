

## Add ability to restore archived Service Providers

Currently SPs can be archived (`status = "Archived"`) but the list filters them out with no way to view or restore them. Add an "Archived" view + restore action.

### Behavior

**1. Toggle to view archived SPs**
On `/admin/providers`, add a small toggle / tab next to the search bar: **Active** (default) | **Archived**. Switching to Archived shows only `status === "Archived"` providers.

**2. Restore action**
On rows in the Archived view, replace the Archive icon with a **Restore** button (rotate-ccw icon, "Restore" tooltip). Clicking it sets `status` back to **Active** and shows a toast "Provider restored". Row disappears from the Archived view (and reappears in Active).

**3. Confirmation**
Wrap Restore in an `AlertDialog` confirming "Restore {sp.name}? They will become Active and eligible for job allocation again." — matches existing destructive-action pattern.

**4. Archive action gets confirmation too (small UX improvement)**
While here, also wrap the existing Archive button in a confirmation dialog so it's no longer a one-click destructive action.

**5. Empty state**
When the Archived tab has zero rows, show "No archived providers" centered in the table area.

**6. Counts in the header**
Update the page sub-header to reflect the active view: "12 active providers" or "3 archived providers".

### Files to update

- `src/hooks/useSupabaseData.ts` — add `useRestoreSP()` mutation that sets `status = "Active"` and invalidates `["service_providers"]` (mirrors `useArchiveSP`).
- `src/pages/admin/SPManagement.tsx`:
  - Add `view: "active" | "archived"` state + `Tabs` (or two-button toggle) above the table.
  - Filter rows by `view`.
  - In Archived view: show Restore button (with `AlertDialog` confirm) instead of Archive; hide Suspend/Edit/Login actions to keep the row focused (View stays available).
  - Wrap existing Archive button in `AlertDialog` confirm.
  - Update header count + add empty state.

No DB schema changes — `service_providers.status` already accepts `"Active" | "Suspended" | "Archived"`. No RLS changes needed (admin full access already covers this).

### Acceptance

- Admin can switch between Active and Archived views from `/admin/providers`
- Archived view lists every SP with `status = "Archived"`
- Each archived row has a Restore action with confirmation
- Restoring sets status to Active, the row leaves Archived view, the SP reappears in Active and becomes allocation-eligible
- Archiving from Active view now requires confirmation
- Header counts and empty states reflect the current view

