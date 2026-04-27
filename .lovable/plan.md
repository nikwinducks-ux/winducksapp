## Goal

Add a new **Global default subscription fee** ($/month) on the Payouts page, mirroring the existing platform fee and marketing global defaults. This value flows into every Service Provider's **Compensation → Expenses** area as an automatically-shown **Subscription** line item with type "Monthly fixed $" — auto-populated at $0/mo for now (the global default starts at $0).

## What changes for the user

**Payouts page** (`/admin/payouts`):
- The "Global default compensation splits" card gains a third field: **Default monthly subscription fee ($/mo)**.
- Same UX as the other two fields: numeric input, independent Save button, "Currently: $X/mo" label.
- Helper copy notes that this monthly fee appears on every SP's Compensation → Expenses as a "Subscription" line and is tracked as a monthly fixed deduction (not per-job).

**SP Compensation tab** (admin and SP read-only):
- The **Expenses** table always shows a **Subscription** row that reflects the global default (auto-populated at $0/mo until the admin changes it on Payouts).
- The Subscription row is read-only (no edit/delete/toggle on the row itself) — it's controlled centrally on the Payouts page. Other custom expenses keep working exactly as before.
- The row is labeled with a small "Global default — set on Payouts page" caption so admins know where to change it.
- Because it's a `monthly_fixed` type with value $0 by default, it has no effect on per-job payouts. It does appear in the Job Payout Preview's "Monthly fixed deductions" list (as $0/mo) so admins can see it's accounted for.

## Technical details

- **Database (`app_settings`)**: add a single nullable column `default_subscription_fee_monthly numeric not null default 0`. Migration is additive only; no data backfill needed.

- **`src/hooks/useSupabaseData.ts`** (`useAppSettings`, `useUpdateAppSettings`):
  - Read `default_subscription_fee_monthly` and expose it as `defaultSubscriptionFeeMonthly: number` (default 0).
  - Accept `defaultSubscriptionFeeMonthly?: number` in the update mutation.

- **`src/pages/admin/Payouts.tsx`**:
  - Add a third field in the global defaults card with its own input state `subscriptionInput` and Save button calling `updateSettings.mutate({ defaultSubscriptionFeeMonthly: <number> })`.
  - Display "Currently: $X/mo".

- **`src/components/admin/SPCompensationTab.tsx`** (`ExpensesCard`):
  - Inject a synthetic, virtual "Subscription" row at the top of the expenses list, sourced from `settings.defaultSubscriptionFeeMonthly` (read via `useAppSettings`).
  - The row renders with `name = "Subscription"`, `expenseType = "monthly_fixed"`, value = global default, `active = true`.
  - The row has no Edit / Delete / Toggle controls; instead a small caption reads "Global default — set on Payouts page".
  - Update `PayoutPreview` so its `monthlyFixed` list also includes this synthetic global subscription row alongside the SP's own monthly_fixed expenses (so the monthly total reflects it).

- **No trigger / invoice changes**: monthly fixed expenses are not deducted per job, so the existing job-completion trigger does not need to read this new global default. The trigger continues to snapshot only `percent_of_sp` expenses for per-job deductions, exactly as today. Tracking of monthly fixed totals is purely a UI/reporting concern (matches the existing behavior).

## Files to edit

- New migration adding `app_settings.default_subscription_fee_monthly`
- `src/hooks/useSupabaseData.ts`
- `src/pages/admin/Payouts.tsx`
- `src/components/admin/SPCompensationTab.tsx`