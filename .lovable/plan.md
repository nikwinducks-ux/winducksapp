

## Customer Activity Log

Add a per-customer audit trail capturing every meaningful event tied to a customer (job lifecycle, scheduling, pricing, line-item edits, photo uploads, customer profile edits) and surface it from a new **Log** button on the customer detail page.

### Backend

**New table** `customer_activity_log`
- `id uuid pk`
- `customer_id uuid not null` (indexed)
- `job_id uuid null` (indexed, nullable for non-job events)
- `event_type text not null` — e.g. `job_created`, `job_scheduled`, `job_rescheduled`, `job_assigned`, `job_unassigned`, `job_status_changed`, `job_completed`, `job_cancelled`, `job_deleted`, `job_payout_changed`, `job_address_changed`, `job_notes_changed`, `service_added`, `service_removed`, `service_updated`, `photo_added`, `photo_removed`, `customer_created`, `customer_updated`
- `summary text not null` — short human-readable line ("Payout changed $200 → $250")
- `details jsonb` — structured before/after, line-item diffs, etc.
- `actor_user_id uuid null`, `actor_email text`, `actor_role text`
- `created_at timestamptz default now()` (indexed desc)

**RLS**
- Admin/owner: full access.
- SP: select rows where the related job is theirs (`assigned_sp_id` or crew) — read-only.

**Triggers (SECURITY DEFINER, capture `auth.uid()` and join `user_roles` for role/email):**
1. `jobs` AFTER INSERT → `job_created` (+ `job_scheduled` if date set, + `job_assigned` if SP set).
2. `jobs` AFTER UPDATE → diff old/new and emit one row per material field: `scheduled_date`/`scheduled_time` → `job_rescheduled`; `assigned_sp_id` → `job_assigned`/`job_unassigned`; `status` → `job_status_changed` (with `job_completed` / `job_cancelled` specializations); `payout` → `job_payout_changed`; address fields → `job_address_changed`; `notes` → `job_notes_changed`; `urgency` → `job_urgency_changed`.
3. `jobs` AFTER DELETE → `job_deleted` (capture `customer_id` from OLD).
4. `job_services` AFTER INSERT/UPDATE/DELETE → `service_added` / `service_updated` / `service_removed` with category, qty, unit_price, line_total in `details`.
5. `job_photos` AFTER INSERT/DELETE → `photo_added` / `photo_removed`.
6. `customers` AFTER INSERT/UPDATE → `customer_created` / `customer_updated` (diff name, phone, email, address, tags, notes).

All triggers resolve `customer_id` from the row (or via `jobs.customer_id` lookup for service/photo events) and skip writing when `customer_id` is null.

### Frontend

**`src/hooks/useSupabaseData.ts`** — add `useCustomerActivityLog(customerId)` returning rows ordered by `created_at desc`, with React Query cache key `["customer-activity", customerId]`.

**New component** `src/components/CustomerActivityLog.tsx`
- Renders a vertical timeline: icon per event type, summary, actor email + role chip, relative time, expandable JSON for `details` (collapsed by default).
- Filter chips: All / Jobs / Services / Photos / Profile.
- Empty state: "No activity recorded yet."

**`src/pages/admin/CustomerDetail.tsx`**
- Add **Log** button (variant `outline`, `History` icon from lucide) next to **Edit**.
- Clicking opens a `Sheet` (right side, wide) titled "{customer.name} — Activity Log" containing `<CustomerActivityLog customerId={customer.id} />`.

### Files touched

- `supabase/migrations/<timestamp>_customer_activity_log.sql` — table, indexes, RLS, all triggers + helper to insert rows.
- `src/hooks/useSupabaseData.ts` — `useCustomerActivityLog` hook + invalidations on customer/job mutations.
- `src/components/CustomerActivityLog.tsx` — new timeline component.
- `src/pages/admin/CustomerDetail.tsx` — Log button + Sheet wiring.

### Notes

- Triggers are the single source of truth, so any path that mutates jobs/services/photos/customers (admin UI, RPCs, edge functions, future imports) is logged automatically — no per-mutation code changes needed.
- Existing historical data is not backfilled; the log starts from migration time. If you want a one-time seed from `job_status_events` / `job_assignments` / `admin_audit_logs`, say so and I'll add it.

