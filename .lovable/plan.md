

## Add titles, switch to CAD, and wire line items into Jobs

Three connected changes to the catalog + job editor:

### 1. Add a Title to line items

New `title` column on `service_category_line_items` (text, nullable). The existing `description` becomes optional long-form detail; `title` is the short label shown everywhere.

- **Migration**: `alter table service_category_line_items add column title text not null default '';` then backfill `title = description` for existing rows so nothing looks empty.
- **Hook (`useSupabaseData.ts`)**: extend `ServiceCategoryLineItem` with `title: string`; accept `title` in `useCreateLineItem` / `useUpdateLineItem`.
- **`CategoryDetail.tsx`**: add a Title field above Description in the add form and inline edit row. List rendering shows `title` as the bold primary text and `description` as smaller muted text underneath. Title is required, description optional.

### 2. Switch currency display to CAD everywhere visible

Replace ad‑hoc `$X` strings with a shared CAD formatter so amounts read e.g. `CA$1,240.00`.

- New helper `src/lib/currency.ts`:
  ```ts
  export const cadFormatter = new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD" });
  export const cadFormatterWhole = new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD", maximumFractionDigits: 0 });
  export const formatCAD = (n: number) => cadFormatter.format(Number(n) || 0);
  export const formatCADWhole = (n: number) => cadFormatterWhole.format(Number(n) || 0);
  ```
- Update places that display money to use `formatCAD`:
  - `CategoryDetail.tsx` (replace the existing USD `currency` constant)
  - `JobServiceLineItems.tsx` (per-line total + grand total)
  - `JobServicesDisplay.tsx` (unit price + line_total)
  - `JobDetail.tsx` (payout, per-SP split, debug sums)
  - `JobOfferDetail.tsx` (payout)
  - `JobManagement.tsx` (payout column)
  - `AdminCalendar.tsx` (selected job payout)
  - `CrewPicker.tsx` (per-SP split text)
  - `JobBlock.tsx` (calendar block payout)
  - `JobCalendar.tsx` (day-total chip — switch the existing `dayTotalFormatter` to CAD)
  - `JobForm.tsx` (auto-calc placeholder)

  Input field labels stay simple (`Amount`, `Unit Price`) but helper text says "(CAD)".

### 3. Wire catalog line items into Jobs

Today `JobServiceLineItems` lets you pick a category and free-type unit price + notes. Add a **"Line item from catalog"** picker per row.

- **`ServiceLineItem` type** gains an optional `line_item_id?: string` (kept in component state only — not persisted to `job_services`, since that table has no FK; we only use it to drive the picker UI).
- **Per row UI** becomes a 5-column grid: `Category` · `Line item ▾` · `Qty` · `Unit Price (CAD)` · (delete).
  - The Line item dropdown is populated by fetching active items where `category_id = chosen category`. Use a new `useCategoryLineItemsByName(categoryName, categories)` hook (resolves name→id then calls existing `useCategoryLineItems`), or a small inline `useQuery` keyed by category id.
  - Picking a line item **auto-fills** `unit_price` from `price` and pre-fills the row `notes` with the line item's `title` (description appended in parens if present). Both remain editable.
  - Free-form entry still works: leave the Line item dropdown on "— Custom —".
  - When the user changes Category, reset `line_item_id` and clear unit_price/notes.
- **Empty state**: if the selected category has no line items yet, show a small inline link "No saved items — manage in Service Categories" pointing to `/admin/categories/:id`.
- No DB schema change for `job_services`; line items act as a typing aid that writes plain values into the existing columns.

### Files touched

- New migration: add `title` column to `service_category_line_items` + backfill.
- New `src/lib/currency.ts`.
- `src/hooks/useSupabaseData.ts` — add `title` to type/hooks.
- `src/pages/admin/CategoryDetail.tsx` — Title field + CAD.
- `src/components/JobServiceLineItems.tsx` — catalog picker per row + CAD.
- Currency display swaps in: `JobServicesDisplay.tsx`, `JobDetail.tsx`, `JobOfferDetail.tsx`, `JobManagement.tsx`, `AdminCalendar.tsx`, `CrewPicker.tsx`, `JobBlock.tsx`, `JobCalendar.tsx`, `JobForm.tsx`.

### Result

- Each catalog line item has a clear **Title** plus optional description and a **CAD** price.
- The Job editor lets admins pick from saved catalog items per service row (one-click fill of price + title), or keep typing freely.
- Every $ amount in the app is displayed as CAD using a single shared formatter.

