## Estimates module — build plan

A complete quote/estimate system that mirrors the existing Invoices module pattern (admin list → editor → public token view → convert action), extended for multi-package variations, optional/required line items, discount codes, deposits, and a new Products catalog.

---

### 1. Sidebar + routing

- Add **Estimates** link in `DashboardLayout` admin nav (between Jobs and Invoices), icon `FileSignature`.
- Add **Discount Codes** link under Estimates section (or as a sub-page from the Estimates list — simpler, ship as sub-page).
- Add **Products** link (or fold into Service Categories page as a tab).
- New routes in `App.tsx`:
  - `/admin/estimates` → list
  - `/admin/estimates/new` → builder (creates draft, redirects)
  - `/admin/estimates/:id` → editor / builder
  - `/admin/discount-codes` → discount code manager
  - `/admin/products` → product catalog
  - `/estimate/:token` → public customer view (unauth, like `/invoice/:token`)

---

### 2. Database schema (new migration)

```text
products
  id, name, sku, description, unit_price numeric, taxable bool,
  active bool, image_url text, display_order, created_at, updated_at

discount_codes
  id, code text unique, kind text ('percent'|'fixed'),
  value numeric, applies_to text ('all'|'services'|'products'),
  min_subtotal numeric, max_uses int, uses_count int,
  active bool, expires_at timestamptz, notes text

estimates
  id, estimate_number text,
  customer_id, customer_property_id (nullable),
  job_id (nullable — supports both standalone & attached),
  assigned_sp_id (nullable),
  created_by_user_id,
  status text ('Draft'|'Sent'|'Viewed'|'Accepted'|'Declined'|'Expired'|'Converted'|'Archived'),
  estimate_date date, expires_at date,
  internal_notes, customer_notes, terms text,
  share_token text unique,
  deposit_kind text ('none'|'fixed'|'percent'), deposit_value numeric,
  accepted_package_id uuid (nullable),
  accepted_at timestamptz, accepted_total numeric,
  viewed_at timestamptz, declined_at timestamptz,
  converted_job_id uuid (nullable), converted_at timestamptz,
  snapshot_json jsonb  -- frozen state at send/accept time
  created_at, updated_at

estimate_packages
  id, estimate_id, name, description,
  display_order, is_recommended bool,
  is_selected bool  -- which one customer picked
  package_discount_kind, package_discount_value, package_discount_reason

estimate_line_items
  id, package_id, item_type ('service'|'product'),
  catalog_ref_id (nullable — points to product or service_category_line_items),
  name, description, quantity numeric, unit_price numeric,
  taxable bool, is_optional bool, is_selected bool,
  discount_allowed bool, image_url text, display_order

estimate_discounts  -- manual whole-estimate or whole-package discounts
  id, estimate_id, package_id (nullable for estimate-wide),
  kind ('percent'|'fixed'), value numeric, reason text, scope text

estimate_applied_codes
  id, estimate_id, discount_code_id, code_snapshot text,
  amount_applied numeric, applied_at

estimate_events  -- audit trail (sent, viewed, accepted, declined, converted, archived)
  id, estimate_id, event_type, actor_user_id (nullable),
  customer_ip text, details jsonb, created_at
```

Add `next_estimate_number int default 2001` to `app_settings`.

**RLS**: Mirror invoices — admin/owner full access; SPs `SELECT` where `assigned_sp_id = get_user_sp_id(auth.uid())`. Public access via `SECURITY DEFINER` RPCs only (no direct anon SELECT).

**RPCs (SECURITY DEFINER)**:
- `create_estimate(p_customer_id, p_job_id, ...)` → returns id + number (uses `app_settings.next_estimate_number`).
- `get_estimate_by_token(_token)` → returns estimate + packages + items + discounts as JSON; also stamps `viewed_at` + inserts `estimate_events` row on first view.
- `customer_accept_estimate(_token, _package_id, _selected_line_item_ids[])` → validates package belongs to estimate, recomputes accepted_total from selected items + applicable discounts + tax, freezes `snapshot_json`, sets status `Accepted`.
- `customer_decline_estimate(_token, _reason)`.
- `convert_estimate_to_job(_estimate_id, _mode 'new'|'attach', _job_id?)` → if `'new'`: create job (status `Created`) with customer/address; if `'attach'`: replace `job_services` of the supplied job. In both cases copy accepted package's selected items into `job_services`, set `estimates.status='Converted'`, `converted_job_id`.
- `archive_estimate(_id)`, `duplicate_estimate(_id)`.
- `apply_discount_code(_estimate_id, _code)` → validates active/expiry/max-uses/min-subtotal/applies-to, inserts `estimate_applied_codes`.

**Trigger**: nightly (or on-read) `expire_old_estimates()` flips `Sent` past `expires_at` → `Expired`. Simple version: check on read inside `get_estimate_by_token` and the list query (compute virtual status).

---

### 3. Frontend — admin pages

**`src/hooks/useEstimates.ts`** — mirrors `useCustomerInvoices.ts`:
- `useEstimates()`, `useEstimate(id)`, `useEstimatePackages(id)`, `useEstimateLineItems(packageId)`, `useEstimateDiscounts(id)`
- Mutations: `useSaveEstimate`, `useCreateEstimate`, `useDuplicatePackage`, `useReorderPackages`, `useArchiveEstimate`, `useConvertEstimateToJob`, `useSendEstimateEmail`, `useApplyDiscountCode`, `useMarkRecommended`
- `fetchEstimateByToken(token)` for public view.

**`src/hooks/useProducts.ts`** + **`src/hooks/useDiscountCodes.ts`** — standard CRUD.

**Pages**:

1. `src/pages/admin/EstimatesList.tsx` — table: number, customer, status badge, total, created, expires, assigned SP, linked job. Filter by status, search by # / customer. KPI cards: Outstanding (Sent+Viewed), Accepted, Conversion rate.

2. `src/pages/admin/EstimateDetail.tsx` — the builder. Layout:
   - **Header card**: estimate # (read-only), customer picker, property picker, job link (optional, with "Attach to existing job" toggle), assigned SP, dates, salesperson (auto = current user, editable).
   - **Packages section** — tabs or vertical stack of `<EstimatePackageCard />` components, each with:
     - name, description, "Recommended" star toggle, duplicate, delete, drag handle (display_order).
     - Line items editor (`<EstimateLineItemEditor />`): item type radio (service/product), pick from catalog OR free-form, qty, unit price, taxable, **Optional** toggle, **Selected by default** toggle, discount-allowed toggle, image URL, reorder/delete.
     - Package discount controls (kind + value + reason).
     - Live `<PackageTotals />`: services subtotal, products subtotal, optional-selected subtotal, line discounts, package discount, applied code share, tax, total.
   - **Estimate-wide section**: discount codes input (apply/remove), manual whole-estimate discount, deposit config (none/fixed/percent), customer notes, terms, internal notes.
   - **Action bar** (status-aware): Save draft · Send email · Copy public link · Mark sent · Mark accepted manually · Mark declined manually · Duplicate · Archive · Convert to Job (with modal: "Create new job" vs "Attach to existing job [picker]").
   - Status badge with color (Draft=neutral, Sent=info, Viewed=info, Accepted=valid, Declined=error, Expired=warning, Converted=valid, Archived=neutral).

3. `src/pages/admin/DiscountCodes.tsx` — list + create/edit dialog: code, kind, value, applies_to, min_subtotal, max_uses, expiry, active, notes.

4. `src/pages/admin/Products.tsx` — list + create/edit dialog: name, SKU, description, unit_price, taxable, active, image URL, order.

**Reusable components** in `src/components/estimates/`:
- `EstimatePackageCard.tsx`
- `EstimateLineItemEditor.tsx`
- `EstimateLineItemRow.tsx` (single row, used in admin and public view)
- `PackageTotals.tsx` (pure calc + display, takes items + discounts)
- `DiscountCodeInput.tsx`
- `DepositConfig.tsx`
- `ConvertEstimateDialog.tsx`

**Pure totals helper** `src/lib/estimateTotals.ts`:
```ts
computePackageTotals({ items, packageDiscount, appliedCodes, taxPct, depositKind, depositValue })
  → { servicesSubtotal, productsSubtotal, optionalSelectedSubtotal,
      lineDiscountTotal, packageDiscountAmount, codeDiscountAmount,
      taxableBase, taxAmount, total, depositDue, balanceDue }
```
Used by both admin builder, public view, and the `customer_accept_estimate` RPC validation (re-implemented in SQL there to be authoritative — frontend value is just for display).

---

### 4. Public customer view

**`src/pages/PublicEstimate.tsx`** at `/estimate/:token`:
- Branded header (uses `app_settings` company logo/name like PublicInvoice).
- Customer + service address block.
- Estimate metadata (number, dates, expiry warning if near expiry).
- Package selector — tabs or stacked cards. "Recommended" badge highlighted. One package selectable via radio.
- For the currently-selected package: render line items grouped by type. Required items locked, optional items have checkboxes that update totals live (client-side using `computePackageTotals`).
- Totals panel sticky on side (desktop) / bottom (mobile) with full breakdown including deposit due and balance.
- Terms/disclaimer collapsible.
- **Accept** button → calls `customer_accept_estimate` with selected package + selected optional item IDs → success screen.
- **Decline** button → small modal with optional reason → `customer_decline_estimate`.
- Print-friendly CSS (mirrors PublicInvoice).
- Add route to public-routes block in `App.tsx` (both unauth and auth route lists).

---

### 5. Convert to Job behavior

- `<ConvertEstimateDialog />` on estimate detail (only enabled when `status='Accepted'`):
  - Mode A: **Create new job** — runs `convert_estimate_to_job(id, 'new', null)` → navigates to new job.
  - Mode B: **Attach to job** — autocomplete picker of existing jobs for that customer → `convert_estimate_to_job(id, 'attach', job_id)`.
- RPC copies accepted package's `is_selected=true` items into `job_services` rows (mapping `item_type` + name into `service_category` + `notes`, preserving qty/price/line_total).
- Stores `snapshot_json` on the estimate so the accepted version is immutable even if someone re-edits the estimate later (we'll lock editing of converted/accepted estimates in the UI too).

---

### 6. Email sending

New edge function `supabase/functions/send-customer-estimate/index.ts` modeled on `send-customer-invoice`:
- Accepts `{ estimate_id }`, validates admin caller, fetches estimate + customer email.
- Renders new template `supabase/functions/_shared/transactional-email-templates/customer-estimate.tsx` (React Email): branded header, summary of packages with totals, "View & accept" CTA → `${SITE_URL}/estimate/${token}`.
- Registers in `registry.ts`.
- On success: `estimates.status='Sent'`, inserts `estimate_events` row.

---

### 7. Status lifecycle (enforced by RPCs + UI guards)

```
Draft → Sent → Viewed → Accepted → Converted
                ↓          ↓
             Declined   (Archived from any non-Converted)
                ↓
             Expired (auto from Sent/Viewed past expires_at)
```
- Edits allowed only in `Draft` (mirrors invoice behavior).
- `Accepted` estimates can only be Converted, Archived, or duplicated.
- `Converted` is terminal except for Archive.

---

### 8. Permissions

- Owner/Admin: full CRUD + send + convert + manual accept/decline + archive.
- SP: `SELECT` only on estimates where they're the `assigned_sp_id` (read-only view added later under `/sp/estimates`; **out of scope for this build** — mention as next step).
- Customer: anon access only via `share_token` RPCs.

---

### Files to create

```text
supabase/migrations/<ts>_estimates_schema.sql
supabase/migrations/<ts>_estimates_rpcs.sql
supabase/functions/send-customer-estimate/index.ts
supabase/functions/_shared/transactional-email-templates/customer-estimate.tsx
src/hooks/useEstimates.ts
src/hooks/useProducts.ts
src/hooks/useDiscountCodes.ts
src/lib/estimateTotals.ts
src/components/estimates/EstimatePackageCard.tsx
src/components/estimates/EstimateLineItemEditor.tsx
src/components/estimates/EstimateLineItemRow.tsx
src/components/estimates/PackageTotals.tsx
src/components/estimates/DiscountCodeInput.tsx
src/components/estimates/DepositConfig.tsx
src/components/estimates/ConvertEstimateDialog.tsx
src/pages/admin/EstimatesList.tsx
src/pages/admin/EstimateDetail.tsx
src/pages/admin/DiscountCodes.tsx
src/pages/admin/Products.tsx
src/pages/PublicEstimate.tsx
```

### Files to edit

```text
src/App.tsx                       (routes)
src/components/DashboardLayout.tsx (sidebar links)
supabase/functions/_shared/transactional-email-templates/registry.ts
```

---

### Out of scope (deferred)

- Online deposit collection (Stripe) — fields & UI built; payment integration is a follow-up.
- SP read-only estimates page in `/sp/*`.
- PDF generation for estimates (public view is print-friendly; PDF export can be added later).
- Customer e-signature image (typed name/drawn signature) — not needed per your answer.
- Auto-expire cron — handled by virtual status on read; can add a real cron later.