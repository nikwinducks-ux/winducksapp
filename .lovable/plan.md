## Goal

Stitch the existing Estimate → Job → SP → Completion → Invoice pieces into one cohesive, visible end-to-end workflow. The data plumbing (RPCs, snapshots, conversions) is already in place; this plan focuses on closing the UX gaps that make the flow feel disconnected today.

## Current state (already built)

- Estimate creation, packages, line items (services/products), discounts, taxes, deposit, snapshots on send/accept — DONE
- Public estimate page (accept / decline / select package / select optional items) — DONE
- `convert_estimate_to_job` RPC (carries customer, address, package, selected line items, totals, deposit, links job → estimate) — DONE
- "Convert to job" button on EstimateDetail — DONE
- Job detail with deposit recording, crew, offers, status — DONE
- SP can mark visits / completion via `JobVisitsCard` — DONE
- `convert_job_to_invoice` RPC (routes through source estimate when present, otherwise builds from job_services) — DONE
- Invoices list, detail, packages, payments, public invoice — DONE

## Gaps to close

1. No "Ready to Invoice" intermediate status — only `Completed`
2. SP `JobVisitsCard` exists but `SPJobDetailContent` doesn't expose a clear "Mark Job Complete" CTA on `panel` variant
3. JobDetail's "Convert to invoice" only appears once status is exactly `Completed` — admins can't trigger it from `Ready to Invoice`
4. No workflow timeline on EstimateDetail / JobDetail / InvoiceDetail (events tables exist but aren't displayed)
5. CustomerDetail shows jobs only — no estimates or invoices
6. SPJobDetail doesn't show which line items came from the accepted estimate package vs ad-hoc
7. No clear visual workflow stepper showing where a record sits in the pipeline

## Plan

### 1. Workflow status alignment

- Add `'ReadyToInvoice'` as a recognized job status alongside existing `Completed`, `ConvertedToInvoice`, `InvoiceSent`
- `convert_job_to_invoice` RPC: also accept `ReadyToInvoice` (currently `Completed`/`ConvertedToInvoice`/`InvoiceSent`)
- `getJobDisplayStatus` mapping: render as "Ready to invoice"
- Job status filter chips in `JobManagement` updated to include the new bucket

### 2. SP completion UX

- In `SPJobDetailContent` (panel + page variants), add prominent "Mark Job Complete" button when `status` is `Assigned`/`Accepted`/`InProgress` and SP is on the job
- Use existing `useUpdateJobStatus` hook to transition `→ Completed`
- After completion, show a follow-up card: "Awaiting admin invoicing"
- Optional: completion notes textarea, persisted via `job_status_events.note`

### 3. Admin Job → Invoice CTA

- In `JobDetail.tsx`, broaden the gate from `["Completed","ConvertedToInvoice","InvoiceSent"]` to also include `ReadyToInvoice`
- Add an admin-only "Mark Ready to Invoice" button when status is `Completed` (signals completion was reviewed)
- Keep existing "Convert to invoice" wired to `useConvertJobToInvoice`

### 4. Workflow stepper component

- New `src/components/workflow/WorkflowStepper.tsx`: horizontal pill stepper with 7 stages — Estimate Drafted · Sent · Accepted · Job Created · Assigned · Completed · Invoiced
- Stage states: `done` / `current` / `upcoming` / `skipped`
- Mount at top of `EstimateDetail`, `JobDetail`, `InvoiceDetail` driven by record's status + linked IDs
- Click a completed stage → navigate to that record (estimate → job → invoice)

### 5. Activity timeline component

- New `src/components/workflow/ActivityTimeline.tsx`
- Reads from `estimate_events` (for estimate page), `job_status_events` + `job_assignments` (for job page), `invoice_events` + `invoice_payments` (for invoice page)
- Renders a vertical timeline with icon, title, actor, timestamp, optional details JSON
- Add new hooks: `useEstimateEvents`, `useJobTimeline`, `useInvoiceEvents`
- Place in collapsible card on each detail page

### 6. CustomerDetail cross-links

- Query estimates and customer_invoices by `customer_id`
- Add three side-by-side cards (or stacked on mobile): "Estimates", "Jobs", "Invoices"
- Each row links to the appropriate detail page with status badge and total
- Show running totals: total quoted / total billed / outstanding balance

### 7. SP job detail clarifications

- In `SPJobDetailContent`, surface line items from `job_services` clearly labelled with category, qty, unit price (price visibility gated by SP financial-permission flag if applicable; otherwise show qty + description only)
- Banner if job came from an accepted estimate: "From estimate ESTxxxx — accepted by customer on <date>"

### 8. Validation hardening (server)

Single new migration:

- `convert_estimate_to_job`: explicitly forbid running again if estimate already has `converted_job_id` (return error unless an `_allow_duplicate` flag is true; UI doesn't pass it)
- `convert_job_to_invoice`: accept `ReadyToInvoice` status; refuse jobs that already have an `Invoiced` linked invoice unless reusing the existing draft (already handled)
- Add `job_status_events` row whenever admin marks a job Ready to Invoice

## Technical details

**Files to create**

- `src/components/workflow/WorkflowStepper.tsx`
- `src/components/workflow/ActivityTimeline.tsx`
- `src/hooks/useWorkflowEvents.ts` (estimate/job/invoice event hooks)
- `supabase/migrations/<ts>_workflow_polish.sql`

**Files to edit**

- `src/pages/admin/EstimateDetail.tsx` — mount stepper + timeline
- `src/pages/admin/JobDetail.tsx` — stepper + timeline + Ready-to-Invoice button + relax convert gate
- `src/pages/admin/InvoiceDetail.tsx` — stepper + timeline
- `src/pages/admin/CustomerDetail.tsx` — add Estimates and Invoices cards
- `src/pages/admin/JobManagement.tsx` — include `ReadyToInvoice` bucket
- `src/pages/sp/SPJobDetailContent.tsx` (or sibling) — add "Mark Job Complete" CTA + estimate-source banner
- `src/lib/jobStatus.ts` — extend `getJobDisplayStatus` with `ReadyToInvoice`
- `src/hooks/useSupabaseData.ts` — extend `useUpdateJobStatus` allowed values if gated

**Out of scope** (already shipped or separate request)

- Stripe / online payment processing (kept as "Request payment instructions")
- Customer e-signature capture (acceptance click-through is the current confirmation)
- Change orders / extras after acceptance
- PDF email send transport (uses share link + browser print today)

## Result

After this work, every stage of the lifecycle is reachable with one click from the previous stage, every detail page shows where it sits in the pipeline and what happened, and the customer page becomes the single hub linking estimates, jobs, and invoices.
