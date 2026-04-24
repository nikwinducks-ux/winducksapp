

## Make Jobs rows clickable (view + quick edit)

Make each row in `/admin/jobs` open the job detail page when clicked, and add a clearer link affordance — without breaking the existing inline controls (checkbox, broadcast switch, inline-assign select, schedule/calendar link, action buttons).

### What you'll see

- **Hover**: row gets a subtle highlight + pointer cursor.
- **Click anywhere on the row** (except interactive controls) → navigates to `/admin/jobs/:dbId` (the existing View page, which already has an "Edit Job" button).
- **Job # column**: rendered as a primary-colored link to the same detail page so the click target is obvious and works with keyboard/middle-click/open-in-new-tab.
- **Customer name**: also linked to the detail page for convenience.
- **Existing Actions column** (View / Edit / Assign / Schedule / Delete) stays as-is — the dedicated **Edit** (pencil) button continues to deep-link to `/admin/jobs/:dbId/edit`.

### How clicks are routed safely

The row click handler navigates to detail, but interactive cells stop propagation so they keep working:

- Selection checkbox cell
- Broadcast switch + label
- Inline "Assign to…" Select / Unassign button
- Scheduled date "show on calendar" link (already has `stopPropagation`)
- Actions column buttons/links

Implementation approach:

- Wrap row content interactions: add `onClick` on the `<tr>` that calls `navigate(`/admin/jobs/${job.dbId}`)`, plus `role="button"` and `tabIndex={0}` with an Enter/Space handler for accessibility.
- Add `cursor-pointer hover:bg-muted/40` to the row className.
- Wrap the Job # and Customer cell contents in `<Link to={`/admin/jobs/${job.dbId}`} onClick={(e) => e.stopPropagation()}>` so middle-click / open-in-new-tab works.
- Add `onClick={(e) => e.stopPropagation()}` to: the checkbox `<td>`, the broadcast `<td>` inner div, the assigned-SP `<td>`, and the actions `<td>`. (The calendar icon link already stops propagation.)

### Files touched

- `src/pages/admin/JobManagement.tsx` — single block in the `<tbody>` row render (lines ~713–896): add row click/keyboard handler + hover styles, link the Job # and Customer cells, and add `stopPropagation` guards on the interactive cells. Import `useNavigate` from `react-router-dom` if not already present.

No route, hook, or schema changes — `/admin/jobs/:dbId` (view) and `/admin/jobs/:dbId/edit` already exist.

