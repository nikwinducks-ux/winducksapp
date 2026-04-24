

## Make Customer rows clickable

Mirror the Jobs-list pattern on `/admin/customers`: clicking anywhere on a customer row opens their detail page, while existing action buttons keep working.

### What you'll see

- **Hover**: row gets a subtle highlight + pointer cursor.
- **Click anywhere on the row** (except the Actions buttons) → navigates to `/admin/customers/:id` (existing detail page, which already has an Edit button).
- **Name column**: rendered as a link to the same detail page so middle-click / open-in-new-tab works and the affordance is obvious.
- **Actions column** (View / Edit / Archive) stays as-is.

### Implementation

In `src/pages/admin/CustomerManagement.tsx`:

- Import `useNavigate` from `react-router-dom`.
- On the `<tr>`: add `onClick={() => navigate(`/admin/customers/${c.id}`)}`, `role="button"`, `tabIndex={0}`, an `onKeyDown` handler for Enter/Space, and `cursor-pointer hover:bg-muted/40 transition-colors`.
- Wrap the Name cell content in `<Link to={`/admin/customers/${c.id}`} onClick={(e) => e.stopPropagation()}>` so middle-click works.
- Add `onClick={(e) => e.stopPropagation()}` to the Actions `<td>` so the View/Edit/Archive buttons don't double-trigger row navigation.

### Files touched

- `src/pages/admin/CustomerManagement.tsx` — single `<tbody>` row block.

No route, hook, or schema changes — `/admin/customers/:id` already exists.

