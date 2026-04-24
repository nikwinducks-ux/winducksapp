

## Add line items to Service Categories

Make each row in `/admin/categories` clickable, opening a detail page where admins manage reusable **line items** (description + price) for that category. These can later be picked when building jobs.

### What you'll see

- **List page (`/admin/categories`)**: each category row becomes clickable (chevron on the right). Click → navigates to the category detail page. Edit / Activate / Deactivate buttons keep working and stop click propagation.
- **Detail page (`/admin/categories/:id`)**: header with category name + code + back link. Below: a **Line Items** section listing each item (description, price), with inline add/edit/delete. Empty state prompts "Add your first line item."

### Data model

New table `service_category_line_items`:
- `id uuid pk`
- `category_id uuid` (references `service_categories.id`, not enforced as FK per project convention)
- `description text not null`
- `price numeric not null default 0`
- `display_order int not null default 0`
- `active boolean not null default true`
- `created_at`, `updated_at timestamptz`

RLS: same pattern as `service_categories` — `Admin full access` (admin/owner) + `SP select active` so SPs can read items for active categories during job flows later.

### Files

- **Migration**: create `service_category_line_items` + RLS + `update_updated_at_column` trigger.
- **`src/hooks/useSupabaseData.ts`**: add `ServiceCategoryLineItem` type and hooks `useCategoryLineItems(categoryId)`, `useCreateLineItem()`, `useUpdateLineItem()`, `useDeleteLineItem()`.
- **`src/pages/admin/ServiceCategories.tsx`**: wrap each row in a `Link` to `/admin/categories/:id`; keep edit/toggle buttons with `e.stopPropagation()`; add a `ChevronRight`.
- **`src/pages/admin/CategoryDetail.tsx`** (new): header + back link + line-item editor (add row, inline edit description/price, delete, currency formatting).
- **`src/App.tsx`**: register route `/admin/categories/:id` → `CategoryDetail` (admin/owner only).

### Out of scope (for a follow-up if wanted)

- Wiring line items into the Job multi-service editor as a "pick from catalog" picker (today line items in `JobServiceLineItems` are free-form). Happy to add this next.

