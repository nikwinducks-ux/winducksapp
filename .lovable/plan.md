## Goals

1. Change how job statuses are **displayed** (labels only — DB values stay the same so existing logic doesn't break) and add two new lifecycle states tied to invoicing.
2. Build a **Customer Invoice** module (separate from existing SP payout invoices).

---

## Part 1 — Job status display labels

Underlying DB statuses stay: `Created | Offered | Assigned | Accepted | InProgress | Completed | Cancelled | Expired | Archived`. Two **new** DB statuses are added: `ConvertedToInvoice` and `InvoiceSent`.

Display label mapping (single source of truth in a new `src/lib/jobStatus.ts`):

| DB status | Display label |
|---|---|
| `Created` (no SP, no offer yet) | Created |
| `Offered` / `Assigned` / `Accepted` | Offered to SP |
| `Assigned`/`Accepted` AND has scheduled date in future AND no visit started | Upcoming |
| `InProgress` (visit timer started) | In Progress |
| `Completed` (all visits ended) | Completed |
| `ConvertedToInvoice` (new) | Converted to Invoice |
| `InvoiceSent` (new) | Invoice Sent |
| `Cancelled` / `Expired` / `Archived` | unchanged |

"Upcoming" is a derived label (computed from `Assigned/Accepted` + future `scheduledDate`). All status pills/badges across Admin Jobs list, Job Detail, SP My Jobs, Calendar tooltips, and Activity Log will read through the new helper.

## Part 2 — Customer Invoice module

A new admin module at `/admin/invoices` plus an "Convert to invoice" action on completed jobs.

### Features
- **Convert to invoice** button appears on Job Detail when status = `Completed`. Creates a draft `customer_invoice` from the job's services and flips job status to `ConvertedToInvoice`.
- **Invoice editor**: Pre-filled with line items from `job_services` (description, qty, unit price). Editable. Configurable GST tax line (default 5%, stored in `app_settings`). Notes / payment terms textarea.
- **Customer billing details**: Pulled from the customer record. Your company name/logo/address pulled from `app_settings` (new fields).
- **Send invoice**: Generates a PDF, emails it to the customer (Lovable Emails), and creates a public share link `/invoice/:token`. Job status flips to `InvoiceSent`.
- **Share link page**: Public route, no auth, shows the invoice and a "Download PDF" button.
- **Invoice list**: `/admin/invoices` with filters (Draft / Sent / Paid), search, totals.
- **Mark paid**: Manual button on each invoice.

### Numbering
Sequential `INV-1001` format (next number tracked in `app_settings`).

---

## Technical changes

### Database (migration)

**New table `customer_invoices`**
```
id uuid pk, invoice_number text unique, job_id uuid, customer_id uuid,
status text default 'Draft' check ('Draft','Sent','Paid','Void'),
subtotal numeric, tax_pct numeric, tax_amount numeric, total numeric,
notes text, payment_terms text,
share_token text unique, sent_at timestamptz, paid_at timestamptz,
created_by_user_id uuid, created_at, updated_at
```
RLS: admin full access; public SELECT only by `share_token` via security-definer function.

**New table `customer_invoice_line_items`**
```
id uuid pk, invoice_id uuid fk, description text, quantity numeric,
unit_price numeric, line_total numeric, display_order int
```

**`jobs.status`**: extend allowed values via a validation trigger to include `ConvertedToInvoice` and `InvoiceSent`.

**`app_settings`**: add `next_invoice_number int default 1001`, `default_tax_pct numeric default 5`, `company_name text`, `company_address text`, `company_email text`, `company_phone text`, `company_logo_url text`.

### Frontend

- `src/lib/jobStatus.ts` — `getDisplayStatus(job)` + `STATUS_LABEL_MAP` + variant mapping. Replaces inline label logic in `StatusBadge` callsites.
- Update callsites: `JobManagement.tsx`, `JobDetail.tsx`, `MyJobs.tsx`, `SPJobDetailContent.tsx`, `JobBlock.tsx` (calendar), `JobOffers.tsx`, `GlobalActivityLog.tsx`.
- `src/hooks/useCustomerInvoices.ts` — list/get/create/update/send/markPaid/delete hooks.
- `src/pages/admin/InvoicesList.tsx` — list view with filters and totals.
- `src/pages/admin/InvoiceDetail.tsx` — view + edit + send actions.
- `src/pages/admin/InvoiceEditor.tsx` — line-item editor (reuses `JobServiceLineItems` pattern).
- `src/pages/PublicInvoice.tsx` — public route `/invoice/:token` for customers.
- `src/components/admin/ConvertToInvoiceButton.tsx` — added to Job Detail when status=`Completed`.
- `src/components/admin/CompanyBrandingSettings.tsx` — new section in Payouts/Settings page for logo/company info.
- Sidebar nav: add "Invoices" entry under Admin.

### PDF + Email
- Edge function `send-customer-invoice` (Deno):
  - Inputs: `invoice_id`.
  - Renders invoice HTML → PDF using `pdf-lib` (no external services needed).
  - Uploads PDF to Supabase Storage bucket `customer-invoices` (private).
  - Sends email via Lovable Emails with the PDF attachment + share link.
  - Updates invoice `status='Sent'`, `sent_at=now()`, generates `share_token` if missing.
  - Updates job `status='InvoiceSent'`.
- Storage bucket `customer-invoices` (private; signed URL for downloads).
- Public download endpoint via security-definer RPC that issues a short-lived signed URL when given a valid `share_token`.

### Email template
New transactional template `customer-invoice` (React Email): branded with company logo, summary of invoice, "View invoice" CTA → share link, PDF attached.

---

## Out of scope for this iteration
- Online payment (Stripe) on the share link — flagged for a follow-up.
- Recurring invoices.
- Customer portal login.
- Editing an invoice after it's been sent (sent invoices become read-only; you'd need to "Void & re-issue").

## Open follow-ups (we can decide later)
- Should "Mark paid" on a customer invoice also auto-mark the related SP payout invoice paid? Default: no, they remain independent.
- Should customers be able to pay via Stripe link on the public invoice page?
