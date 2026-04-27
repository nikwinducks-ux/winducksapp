## Overview

Today's invoices are a thin shell (description / qty / price / one tax / Draft|Sent|Paid|Overdue|Cancelled). We will rebuild them to match the depth of the Estimates module while keeping existing rows working: invoice_packages as variations, rich line items, discount codes + manual discounts, deposits, multiple payments, a full status lifecycle, and conversion from accepted estimates as well as jobs.

## Status lifecycle

`Draft → Sent → Viewed → Partially Paid → Paid` plus `Overdue` (auto when due_date passes with balance > 0), `Void`, `Archived`. Overdue is computed on read; Void/Archived are explicit admin actions.

## Database changes (one migration)

**Extend `customer_invoices`**

- `due_date date`, `payment_terms_days int default 15`
- `service_address_*` columns (street/city/region/postal/country) + `billing_address_same_as_service bool default true`
- `assigned_sp_id uuid`, `source_estimate_id uuid`, `source_estimate_package_id uuid`, `parent_invoice_id uuid` (for sibling variations — kept even though we also use packages, so a "Deposit invoice" can live as a separate document if needed later)
- `selected_package_id uuid` (which package is the active/sent one)
- `services_subtotal numeric`, `products_subtotal numeric`, `discount_total numeric`, `deposit_applied numeric`, `amount_paid numeric`, `balance_due numeric`
- `snapshot_json jsonb` (frozen at send), `sent_by_user_id uuid`, `viewed_at timestamptz`, `voided_at timestamptz`, `archived_at timestamptz`
- New statuses allowed: add `Viewed`, `Partially Paid`, `Void`, `Archived` (validation trigger, not CHECK)

**New tables (mirroring estimates)**

- `invoice_packages` — id, invoice_id, name, description, display_order, is_selected, is_recommended, package_discount_kind/value/reason
- `invoice_line_items` — id, package_id, item_type (`service`|`product`), catalog_ref_id, name, description, quantity, unit_price, taxable, is_optional, is_selected, discount_allowed, image_url, display_order
- `invoice_discounts` — manual discounts; scope (`invoice`|`package`|`line`), kind (`fixed`|`percent`), value, reason, package_id/line_item_id nullable
- `invoice_applied_codes` — discount_code_id, code_snapshot, kind, value, applies_to, amount_applied
- `invoice_payments` — id, invoice_id, amount, payment_date, method, reference, notes, recorded_by_user_id, created_at
- `invoice_events` — audit log (created/sent/viewed/payment_recorded/voided/archived/etc.)

All with RLS: admin/owner full access; SP `SELECT` on rows where `assigned_sp_id = get_user_sp_id(auth.uid())` (mirrors estimates). Public read continues via the existing token RPC.

**Update `customer_invoice_line_items`** — keep table for backward compatibility but stop writing to it for new invoices. Existing rows readable via a view if needed; `InvoiceDetail` falls back to legacy lines when no `invoice_packages` exist.

**New / updated RPCs**

- `create_invoice` — blank invoice + one default package
- `convert_estimate_to_invoice(_estimate_id)` — only if estimate `Accepted`; copies accepted package + selected line items + applied codes + manual discounts + deposit_applied (from `accepted_deposit`); sets `source_estimate_id` / `source_estimate_package_id`; preserves snapshot
- Replace `convert_job_to_invoice` to use new packages/line_items model and prefer the job's `source_estimate_id` if present
- `duplicate_invoice_package(_package_id)` — for variations
- `apply_invoice_discount_code(_invoice_id, _code)` / `remove_invoice_discount_code`
- `record_invoice_payment(_invoice_id, _amount, _method, _reference, _notes, _date)` — inserts into `invoice_payments`, recomputes `amount_paid`/`balance_due`/status (`Partially Paid` / `Paid`)
- `mark_customer_invoice_sent` — extend to freeze snapshot of selected package + totals, set `sent_by_user_id`, `due_date` if null
- `mark_invoice_viewed_by_token` — public RPC called from `PublicInvoice`
- `void_invoice` / `archive_invoice` / `unarchive_invoice`
- `get_customer_invoice_by_token` — extend to return packages, line items, discounts, payments, deposit_applied, balance_due, company payment instructions

## Totals engine

New `src/lib/invoiceTotals.ts` mirroring `estimateTotals.ts` exactly:

```
selectedItems = items where !is_optional || is_selected
servicesSubtotal / productsSubtotal split by item_type
- line discounts (manual, on lines flagged discount_allowed)
- package discount
+ tax on taxable portion (after pro-rated discount)
- whole-invoice discount + applied codes
= invoiceTotal
- depositApplied
- sum(invoice_payments.amount)
= balanceDue
```

Used identically by admin builder and customer public view so numbers always match.

## Frontend changes

**Reusable components (new in `src/components/invoices/`)**

- `InvoicePackageCard.tsx` — package header, line item rows with type/name/desc/qty/price/taxable/optional/selected/discount_allowed, reorder/duplicate/delete, "Add product from catalog" / "Add service" / "Add free-form line"
- `InvoiceLineItemRow.tsx`
- `InvoiceTotals.tsx` — services/products subtotals, discounts, tax, total, deposit applied, payments received, balance due
- `DiscountCodeInput.tsx` — reuse the estimates one (extract to `src/components/shared/` and re-export from both modules)
- `ManualDiscountDialog.tsx`
- `RecordPaymentDialog.tsx` — amount, date, method, reference, notes; defaults amount to `balance_due`
- `InvoiceVariationsBar.tsx` — package tabs (Full / Deposit / Progress / Final / Product-only / Service-only); duplicate & rename; pick "active" (the one that's sent)
- `ConvertEstimateToInvoiceDialog.tsx` — preview totals/deposit carryover

**Hooks (extend `src/hooks/useCustomerInvoices.ts`)**

Add `useInvoicePackages`, `useInvoiceLineItems`, `useInvoicePayments`, `useInvoiceDiscounts`, `useInvoiceAppliedCodes`, `useConvertEstimateToInvoice`, `useRecordInvoicePayment`, `useDuplicateInvoicePackage`, `useVoidInvoice`, `useArchiveInvoice`, `useApplyInvoiceCode`. Keep current hooks compatible.

**Pages**

- `src/pages/admin/InvoicesList.tsx` — add columns: Amount paid, Balance due, Due date, Estimate (link), Job (link), SP. Add status filters for Viewed / Partially Paid / Void / Archived; "Show archived" toggle (default off). Bulk actions remain View/Edit. Row actions menu: View, Edit, Duplicate, Send, Record Payment, Copy link, Void, Archive.
- `src/pages/admin/InvoiceDetail.tsx` — full rebuild around packages: header (customer, billing/service address, dates, terms, SP, related estimate/job, internal/customer notes, T&Cs), variations bar, package builder, totals card, payments list with "Record payment" CTA, deposit carry-over banner, send/copy-link/print actions. Print stylesheet drives the PDF.
- `src/pages/PublicInvoice.tsx` — rewrite to use new RPC payload: package summary, selectable add-ons read-only display, totals breakdown with deposit/payments, balance due big, "Request payment instructions" button (reveals dialog with `app_settings` payment instructions: e-Transfer email, mailing address, etc.), "Download PDF" → `window.print()`. On load, call `mark_invoice_viewed_by_token` once.
- `src/pages/admin/JobDetail.tsx` — update "Convert to invoice" button: if job has `source_estimate_id` and that estimate is Accepted, route through `convert_estimate_to_invoice`; otherwise current job→invoice path (now using new schema).
- `src/pages/admin/EstimateDetail.tsx` — when status `Accepted`, show "Create invoice from estimate" CTA using the new dialog.

**Settings**

Add `payment_instructions text` to `app_settings` (e.g., e-Transfer recipient, mailing address). Surface on Payouts/Settings page and in PublicInvoice "Request payment instructions" dialog.

## Permissions

- Admin/Owner: full CRUD, send, void, archive, record payment.
- SP: SELECT only on invoices where `assigned_sp_id = their sp_id` (RLS).
- Customer: existing token-based public view; no auth needed.

## Backward compatibility

- Existing invoices keep their legacy `customer_invoice_line_items`. `InvoiceDetail` detects "no packages → legacy mode" and renders the old simple editor (read-only after this release; offers "Upgrade to packages" button that creates a default package and copies legacy lines).
- `convert_job_to_invoice` keeps the same name + signature so existing UI keeps working; internals upgraded.

## Out of scope (called out)

- No real online payment processing. Pay Now shows manual payment instructions only.
- No SMS sending (button is hidden until SMS provider exists).
- PDF is browser print-to-PDF; no edge-rendered PDF storage.

## Verification

- TypeScript build (`tsc --noEmit`).
- Run Supabase linter post-migration.
- Manual sanity: create blank invoice → add package + lines → apply code + manual discount → send → open public link (status flips to Viewed) → record partial payment (status → Partially Paid, balance updates) → record remaining (status → Paid). Then: accept an estimate with deposit → "Create invoice from estimate" → confirm deposit shows as already applied and balance is correct.
