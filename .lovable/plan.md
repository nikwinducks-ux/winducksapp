# SP Invoice & Payout Tracking

Auto-create one invoice per SP per completed job, with a configurable platform fee, and a simple Unpaid/Paid status that admins toggle manually.

## Data model

New table `sp_invoices`:
- `id`, `job_id`, `sp_id`, `customer_id`
- `gross_amount` (job payout, or crew share if multi-SP)
- `fee_percent` (snapshot of fee % at time of invoice)
- `fee_amount`, `net_amount` (gross − fee)
- `status` — `Unpaid` | `Paid`
- `paid_at`, `paid_by_user_id`, `payment_method` (free text), `payment_reference` (free text)
- `notes`, `created_at`, `updated_at`
- Unique on `(job_id, sp_id)` so each SP gets exactly one invoice per job

Add to `service_providers`: `payout_fee_percent numeric default null` (per-SP override). Add a global default in a new `app_settings` row (or reuse existing config table) — fallback to 0 if unset.

RLS:
- Admin/owner: full access
- SP: SELECT own invoices only (`sp_id = get_user_sp_id(auth.uid())`)
- No SP insert/update/delete

## Auto-generation

Trigger on `jobs` AFTER UPDATE when `status` transitions to `Completed`:
- For each crew member (or just `assigned_sp_id` if no crew): insert one `sp_invoices` row
- `gross_amount` = `payout / crew_size` (matches existing UI math)
- `fee_percent` = SP's `payout_fee_percent` ?? global default ?? 0
- `fee_amount` = round(gross × fee_percent / 100, 2)
- `net_amount` = gross − fee
- `status` = `Unpaid`
- Skip if a row already exists for that `(job_id, sp_id)` (idempotent)

If a completed job is reverted (rare) we leave invoices alone — admin can delete manually.

## Admin UI

New page `src/pages/admin/Payouts.tsx` (route `/admin/payouts`, link in admin nav):
- Filters: status (All / Unpaid / Paid), SP, date range
- Table columns: Job #, SP, Customer, Completed date, Gross, Fee %, Fee, Net, Status, Actions
- Totals row: outstanding (Unpaid net) and paid (Paid net) for current filter
- Row actions: **Mark Paid** (opens dialog: payment method, reference, notes → sets status, paid_at, paid_by_user_id) and **Mark Unpaid** (revert)
- Bulk select + bulk Mark Paid

On the Admin Job Detail page, add a small "Payouts" card listing the invoice(s) for that job with the same Mark Paid action.

Settings: add a "Payouts" section in admin settings (or on SP profile) for `payout_fee_percent` — global default + per-SP override field on the SP form.

## SP UI

New page `src/pages/sp/Earnings.tsx` (route `/sp/earnings`, link in SP bottom nav or account menu):
- Top KPIs: **Outstanding** (sum of Unpaid net), **Paid this month**, **Paid all-time**
- Tabs: Unpaid / Paid
- List of invoice cards: Job #, customer, completed date, gross → fee → **net (bold)**, status badge, paid date/method when Paid
- Tap card → opens existing job detail
- Read-only — SPs cannot change status

On the existing SP Job Detail page (and the calendar side panel), add a small "Payout" line under the existing Payout field showing `Net: $X · Status: Unpaid/Paid` once an invoice exists.

## Hooks

In `src/hooks/useSupabaseData.ts`:
- `useSpInvoices(filters?)` — admin: all, SP: scoped by RLS automatically
- `useSpInvoiceTotals(spId?)` — outstanding / paid sums
- `useMarkInvoicePaid()` / `useMarkInvoiceUnpaid()` — admin only

## Out of scope (can add later)

- Payment processor integration
- Batched/period invoices
- PDF invoice export
- Disputes / approvals workflow
- SP-editable invoices

## Files

New:
- `supabase/migrations/...sql` — table, fee column, trigger, RLS
- `src/pages/admin/Payouts.tsx`
- `src/pages/sp/Earnings.tsx`
- `src/components/admin/MarkPaidDialog.tsx`
- `src/components/sp/SPInvoiceCard.tsx`

Edited:
- `src/hooks/useSupabaseData.ts` — invoice hooks
- `src/App.tsx` — routes
- `src/components/MobileBottomNav.tsx` + admin nav — links
- `src/pages/admin/SPForm.tsx` — fee % field
- `src/pages/admin/JobDetail.tsx` — payouts card
- `src/components/sp/SPJobDetailContent.tsx` — net/status line
