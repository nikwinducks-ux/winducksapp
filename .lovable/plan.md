## Goal

Add a **Global default marketing %** field on the Payouts page that works exactly like the existing **Global default platform fee** field. Saving it updates the same global setting that flows into every Service Provider's **Marketing %** in their Compensation tab — both in the admin SP profile and the SP's read-only Account → Compensation view.

If a Service Provider has a per-SP override for marketing, that override continues to take precedence (same behavior as platform fee).

## What changes for the user

**Payouts page** (`/admin/payouts`):
- The existing "Global default platform fee" card is renamed/extended to **"Global default compensation splits"** containing two side-by-side fields:
  - Default platform fee % (existing)
  - Default marketing % (new)
- Each field has its own input + Save button (independent saves), matching the current platform fee UX, and a small "Currently: X%" indicator.
- Helper copy clarifies that both percentages are applied to every Service Provider's Compensation split unless that SP has a custom override, and that changes apply to future jobs only.

**SP profile → Compensation tab** and **SP Account → Compensation** (read-only):
- The Marketing % field gains the same "Global default — set on Payouts page" / "Per-SP override" caption that the Platform Fee field already shows.
- No change to the underlying logic — `SPCompensationTab` already falls back to `settings.defaultMarketingPct` when the SP has no override.

## Technical details

- **`src/pages/admin/Payouts.tsx`**
  - Add a second input bound to `settings.defaultMarketingPct`, with its own local input state (`marketingInput`) and a Save button calling `updateSettings.mutate({ defaultMarketingPct: <number> })`.
  - Reorganize the card so the two fields sit in a responsive 2-column grid; keep section title and helper copy clear that these are global defaults applied to all SPs without overrides.
  - No changes to the legacy `defaultPayoutFeePercent` field.

- **`src/components/admin/SPCompensationTab.tsx`**
  - Add `marketingUsesDefault = sp?.compMarketingPct == null`.
  - Pass a `hint` to the Marketing `Field` and `PctInput`, mirroring the existing platform-fee hint:
    - View mode: `"Global default — set on Payouts page"` vs `"Per-SP override"`.
    - Edit mode: `"Default {x}% from Payouts. Saving will create a per-SP override."` vs `"Per-SP override. Clear by matching the global default on the Payouts page."`

- **No database changes.** `app_settings.default_marketing_pct` and the `useAppSettings` / `useUpdateAppSettings` hooks already support this value. The invoice-generation trigger already snapshots either the SP's override or the global default at job completion, so future jobs automatically pick up the new value.

- **No changes to completed jobs or already-generated payouts** — consistent with the existing compensation rules.

## Files to edit

- `src/pages/admin/Payouts.tsx`
- `src/components/admin/SPCompensationTab.tsx`