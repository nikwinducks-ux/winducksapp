# Compensation Tab — Flexible Structure with Expenses

Add a new **Compensation** tab to the Service Provider profile (`SPDetail.tsx`) that lets Owner/Admin configure a per-SP compensation breakdown plus a list of expenses. Service Providers see the same tab in read-only mode (in their `AccountPage`). All settings apply only to **future** completed jobs — existing invoices are untouched.

## Compensation Model

Each SP gets three percentage fields that must sum to **100%**:
- **Global Platform Fee %** (e.g. 15)
- **Marketing %** (e.g. 20)
- **Service Provider Portion %** (e.g. 65)

Plus a list of **Expenses**, each with:
- Name (e.g. "Insurance fee")
- Type: `percent_of_sp` (deducted from SP portion per job) OR `monthly_fixed` (tracked monthly, not per-job)
- Value (number)
- Active toggle

## Per-Job Payout Math (applied at job completion)

```text
gross           = job.payout
platform_fee    = gross * platform_fee_pct / 100
marketing       = gross * marketing_pct / 100
gross_sp        = gross * sp_portion_pct / 100
percent_expense = sum(active percent_of_sp expenses) / 100 * gross_sp
net_sp          = gross_sp - percent_expense
```

Monthly fixed expenses are NOT subtracted from per-job invoices — they appear only in the preview as a separate "monthly deductions" line and are stored for future monthly reporting.

## Database changes (migration)

Add columns to `service_providers`:
- `comp_platform_fee_pct numeric` (nullable — falls back to app default when null)
- `comp_marketing_pct numeric` (nullable)
- `comp_sp_portion_pct numeric` (nullable)

New table `sp_compensation_expenses`:
- `id uuid pk`, `sp_id uuid not null`, `name text`, `expense_type text check in ('percent_of_sp','monthly_fixed')`, `value numeric`, `active boolean default true`, `created_at`, `updated_at`
- RLS: Admin/Owner full access; SP can SELECT own rows.

Extend `app_settings` with global defaults so the system has fallbacks:
- `default_platform_fee_pct numeric default 15`
- `default_marketing_pct numeric default 20`
- `default_sp_portion_pct numeric default 65`

Update the invoice-generation trigger `tg_generate_invoices_on_complete`:
- Read SP comp percentages (fallback to app defaults).
- Compute platform_fee, marketing, gross_sp.
- Sum active `percent_of_sp` expenses, deduct from gross_sp → net_sp.
- Store on `sp_invoices` via new columns: `platform_fee_amount`, `marketing_amount`, `gross_sp_amount`, `expense_deduction_amount`. Keep existing `gross_amount`/`fee_amount`/`net_amount` populated for backward compatibility (`fee_amount` = platform_fee + marketing for legacy Payouts UI; `net_amount` = net_sp).
- Trigger only fires on the transition to `Completed`, so it naturally applies to future jobs only.

## Frontend changes

**`src/pages/admin/SPDetail.tsx`**
- Add `<TabsTrigger value="compensation">Compensation</TabsTrigger>` after Performance.
- Add `<TabsContent value="compensation">` rendering a new `<SPCompensationTab spId={sp.id} readOnly={false} />`.

**New `src/components/admin/SPCompensationTab.tsx`**
Two cards matching the existing `metric-card` profile layout:

1. **Compensation Split card**
   - View mode: three labeled rows showing each % and a total. Edit/Save/Cancel buttons match SP profile pattern.
   - Edit mode: three numeric inputs. Live-computed total badge:
     - Green "Total: 100%" when valid
     - Red "Total: 97% (must equal 100%)" otherwise
   - Save disabled when total ≠ 100. On save, writes the three columns to `service_providers`.

2. **Expenses card**
   - Table of expenses (Name · Type · Value · Active toggle · Edit · Delete).
   - "Add expense" button opens an inline row / dialog with name, type select (Percentage of SP portion / Monthly fixed $), value, active.
   - Admins can add/edit/delete and toggle active. SPs see read-only list.

3. **Job Payout Preview card** (always visible)
   - Input: "Sample invoice amount" (default $100).
   - Renders breakdown table:
     ```
     Total invoice                 $100.00
     − Global Platform Fee (15%)  −$15.00
     − Marketing (20%)            −$20.00
     = Gross SP portion            $65.00
     − Expense deductions (8%)    −$5.20
     = Final SP earnings           $59.80
     ```
   - Below the per-job block, a "Monthly fixed deductions" section lists each `monthly_fixed` expense with totals (informational, not deducted from job preview).

**Read-only mode for SPs**
- In `src/pages/sp/AccountPage.tsx`, add a Compensation section/tab using the same `SPCompensationTab` with `readOnly`. Hides edit buttons, add-expense button, and active toggles become static badges.

**Permissions**
- Reuse existing pattern: Admin RLS on tables already enforces server-side. UI gates edit affordances with `useRole()` (`role === "admin"`).

## Hooks (in `src/hooks/useSupabaseData.ts`)

- `useSPCompensation(spId)` — selects the three pct columns from `service_providers` plus app-settings defaults.
- `useUpdateSPCompensation()` — mutation patching the three columns.
- `useSPExpenses(spId)` / `useUpsertSPExpense()` / `useDeleteSPExpense()` — CRUD for `sp_compensation_expenses`.
- Extend `useAppSettings` / `useUpdateAppSettings` to include the three new global default columns.

## Validation & Edge Cases

- Percentages restricted to 0–100 numeric inputs; sum validated client-side and (optionally) via a CHECK trigger server-side.
- If any of the three SP pct columns is null, fall back to app-settings defaults so older SPs keep working.
- Expense value must be ≥ 0; for `percent_of_sp`, capped at 100.
- The trigger only runs on the `Created/InProgress → Completed` transition, so already-Completed jobs and existing invoices are never recalculated.
- Existing `Payouts.tsx` page continues to work because legacy `fee_percent`/`fee_amount`/`net_amount` columns stay populated.

## Files Touched

- New migration: schema columns, new table, RLS, updated invoice trigger.
- `src/hooks/useSupabaseData.ts` — new hooks + extended app settings.
- `src/pages/admin/SPDetail.tsx` — new tab.
- `src/components/admin/SPCompensationTab.tsx` — new (single component, used by both admin and SP read-only).
- `src/pages/sp/AccountPage.tsx` — embed read-only Compensation view.
