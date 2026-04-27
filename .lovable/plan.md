## Goal

Today the Payouts page has a field called **"Global default platform fee"** that edits a legacy setting (`default_payout_fee_percent`) which is **not** the value shown in each Service Provider's Compensation section. The Compensation section reads a different default (`default_platform_fee_pct`), so changing the Payouts field has no effect on SP compensation.

We will link them together: the Payouts page will edit the same global Platform Fee % that flows into every SP's Compensation tab. Increasing or decreasing it on Payouts will instantly be reflected as the global default in every SP profile (and on each SP's Account → Compensation read-only view), unless that SP has a per-SP override.

## What changes for the user

**Payouts page** (`/admin/payouts`):
- The existing card "Global default platform fee" gets a clearer label and explanation: this percentage is the global default of the total invoice that goes to the platform fee. It is automatically applied to every Service Provider's compensation split unless that SP has a custom override.
- A small helper line shows what it's currently set to and confirms it will apply to all SPs without overrides.
- Saving updates the same value used by SP Compensation immediately (no page refresh needed).

**SP profile → Compensation tab** (`/admin/sp/:id`) and **SP Account → Compensation** (read-only):
- The "Global Platform Fee %" field continues to display the per-SP override if one is set, otherwise the global default from Payouts.
- A small caption next to the field clarifies "Global default — set on Payouts page" when no override exists, so admins know where to change it for everyone.

## Technical details

- `src/pages/admin/Payouts.tsx`
  - Replace the input bound to `settings.defaultPayoutFeePercent` with one bound to `settings.defaultPlatformFeePct` (already exists in `useAppSettings` / `useUpdateAppSettings`).
  - Save calls `updateSettings.mutate({ defaultPlatformFeePct: <number> })`.
  - Update copy: title stays "Global default platform fee"; subtitle clarifies it drives every SP's Compensation split.
  - Leave `defaultPayoutFeePercent` intact in the hook for backward compatibility, but it is no longer surfaced (we can revisit removal later).

- `src/components/admin/SPCompensationTab.tsx`
  - No logic change needed — it already reads `settings.defaultPlatformFeePct` as the fallback when the SP has no `compPlatformFeePct` override.
  - Add a tiny helper caption under the Platform Fee field (view + edit modes) when the SP is using the global default, e.g. "Global default — change on the Payouts page."

- No database migration required. No trigger change required (the invoice-generation trigger already snapshots either the SP's override or the global `default_platform_fee_pct` at job completion, so future jobs automatically pick up the new value).

- Existing completed jobs and already-generated payouts are not recalculated, matching the original compensation requirement that changes apply to future jobs only.
