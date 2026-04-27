## What changes

Today `job.payout` is treated as a single number representing what the SP receives. We will reframe it as the **Total Invoice** (what the customer pays), and derive the three compensation parts from the assigned SP's effective compensation split (per-SP override → falls back to global defaults on the Payouts page).

Because the split is derived live from current settings, **all past jobs will automatically reflect any change** to the global %, with no data backfill needed.

### Terminology (UI labels)

- **Total Invoice** — what the customer is billed (the value stored as `jobs.payout`)
- **Winducks (Platform Fee)** — `total × platform_fee_pct`
- **Marketing** — `total × marketing_pct`, paid to the *marketing recipient*
- **SP Portion** — `total × sp_portion_pct` (e.g. SPB at 70% → $70 on a $100 job)

The three percentages come from the assigned SP's compensation row, falling back to the global defaults set on the Payouts page.

## Marketing recipient (new per-job field)

Add a new `marketing_recipient` column to `jobs` so the admin can record who the marketing % goes to:

- `Winducks` (default for back-filled & new jobs)
- `SP` (the assigned SP keeps the marketing portion)
- `Third-party` (free-text label captured in `marketing_recipient_name`)

This is informational/attribution only — it does not change the math, just labels the marketing line and drives reporting later.

DB migration:
- `ALTER TABLE jobs ADD COLUMN marketing_recipient text NOT NULL DEFAULT 'Winducks'`
- `ALTER TABLE jobs ADD COLUMN marketing_recipient_name text NOT NULL DEFAULT ''`

## Admin views (full breakdown)

**Job Detail (`src/pages/admin/JobDetail.tsx`)**
Replace the single "Payout" tile with a new **Compensation Breakdown** card showing:

```text
Total Invoice            $100.00
  − Winducks (15%)       −$15.00
  − Marketing (20%) → Winducks   −$20.00
  = SP Portion (65%)      $65.00   ← what SP "SPB" receives
```

Includes:
- An inline marketing-recipient selector (Winducks / SP / Third-party + name)
- Hint showing whether the % values are SP overrides or global defaults
- A "View compensation settings" link to that SP's compensation tab

For multi-SP crew jobs, the SP Portion row is split per crew member as it is today.

**Jobs list (`src/pages/admin/JobManagement.tsx`)**
Keep the single $ column but rename header to "Total Invoice" and add a small subline showing the SP's portion when assigned (e.g. `$100.00` / `SP gets $65.00`).

**Job Create / Edit form**
Re-label the "Payout" input to "Total Invoice ($)" and add the marketing-recipient field.

## SP-facing views (only their portion)

In **all SP surfaces** (`SPJobDetailContent`, `JobOffers`, `JobOfferDetail`, `MyJobs`, `SPDashboard`, `PerformancePage`, `Earnings`):
- Compute `spShare = totalInvoice × effectiveSpPortionPct / 100`
- For crew jobs, divide by crew size (existing logic preserved)
- Display `spShare` everywhere it currently shows `job.payout`
- Remove or relabel any "Total invoice" hints — SPs only see their take-home

The effective SP portion comes from the assigned SP's `comp_sp_portion_pct` (or global default).

## Technical changes

**Migration**
```sql
ALTER TABLE jobs
  ADD COLUMN marketing_recipient text NOT NULL DEFAULT 'Winducks',
  ADD COLUMN marketing_recipient_name text NOT NULL DEFAULT '';
```

**`src/hooks/useSupabaseData.ts`**
- Map new fields on the Job type: `marketingRecipient`, `marketingRecipientName`
- Add a helper `computeJobSplit(job, sp, settings)` returning `{ total, platform, marketing, sp, platformPct, marketingPct, spPct }`
- Wire create/update job mutations to accept the two new fields

**New shared util `src/lib/compensation.ts`**
- `effectiveCompSplit(sp, settings)` → `{ platformPct, marketingPct, spPct }`
- `splitInvoice(total, split)` → dollar amounts
- Used by both admin and SP UI to keep the math in one place

**Admin components**
- `JobDetail.tsx`: new Compensation Breakdown card + recipient selector
- `JobForm.tsx`: relabel input, add recipient field
- `JobManagement.tsx`: column header rename + SP-portion sub-line
- `CrewPicker.tsx`: pass SP-share (not total) for per-crew display

**SP components**
- `SPJobDetailContent.tsx`, `JobOffers.tsx`, `JobOfferDetail.tsx`, `MyJobs.tsx`, `SPDashboard.tsx`, `PerformancePage.tsx`: replace `job.payout` displays with computed SP share via `splitInvoice`
- `Earnings.tsx`: continue to use `sp_invoices.net_amount` where set, otherwise computed share

## Behavior on past jobs

No data is modified. Because the breakdown is derived from each SP's current compensation %, every past job is shown with the new split immediately. Sealed `sp_invoices` (already paid/marked) keep their stored `gross_sp_amount` / `net_amount` — they are historical and not recomputed.

## Out of scope

- Recomputing already-issued `sp_invoices`
- Reporting/aggregation by marketing recipient (UI shows the field; rollups can come later)
