

## Global Activity Log (admin dashboard)

Add a system-wide history feed accessible from the top-right of the Admin Dashboard, showing every customer/job/service/photo/profile change across the platform.

### Where it lives

- New header row on `src/pages/admin/AdminDashboard.tsx`: page title on the left, **History** button (outline, `History` icon, with an unread count badge) pinned top-right.
- Clicking opens a right-side `Sheet` titled "Activity History" containing the new `<GlobalActivityLog />` component.

### Data source

Reuse the existing `customer_activity_log` table — it already records every job lifecycle event, schedule/payout/address/notes/urgency change, service line edits, photo uploads, and customer profile updates via the triggers shipped last turn. No schema or trigger changes needed.

### New hook

`src/hooks/useSupabaseData.ts` → `useGlobalActivityLog(limit = 200)`
- `select` from `customer_activity_log` ordered by `created_at desc`, limit 200.
- Joins customer name + job number client-side via the cached `useCustomers()` and `useJobs()` data so each row can show context ("ACME Corp · JOB-1027").
- React Query key `["global-activity", limit]`; realtime subscription on `customer_activity_log` INSERT to invalidate the key (so the feed updates live as admins/SPs make changes).

### New component

`src/components/GlobalActivityLog.tsx`
- Reuses the same icon map / event styling as `CustomerActivityLog.tsx` (extract the icon+color helpers into a small shared module `src/components/activityLogIcons.ts` so both components stay in sync).
- Header row with filter chips: **All / Jobs / Services / Photos / Customers** plus a search box (matches summary text, customer name, job number).
- Each row: icon, summary line, secondary line `Customer · Job · Actor email (role)`, relative timestamp; click row → navigate to `/admin/customers/:id` (and close sheet).
- Expandable raw `details` JSON (collapsed by default).
- Empty/loading/error states.

### Unread badge

- Track "last seen" timestamp in `localStorage` under `winducks.activity.lastSeen`.
- Badge count = rows with `created_at > lastSeen` (cap display at `99+`).
- Opening the sheet sets `lastSeen = new Date().toISOString()` and clears the badge.

### Files touched

- `src/components/activityLogIcons.ts` — new shared icon/label/color helpers.
- `src/components/CustomerActivityLog.tsx` — switch to shared helpers (no UI change).
- `src/components/GlobalActivityLog.tsx` — new global feed component.
- `src/hooks/useSupabaseData.ts` — `useGlobalActivityLog` hook + realtime invalidation.
- `src/pages/admin/AdminDashboard.tsx` — top-right History button + Sheet wiring + unread badge.

### Notes

- Admin/owner only — RLS already restricts `customer_activity_log` reads to admins (SPs only see their own job rows), so the global feed is naturally admin-scoped.
- No backend or migration work; this is purely a new presentation layer over the existing log.

