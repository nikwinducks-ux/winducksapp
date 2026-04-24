

## Show full line item description

In `src/pages/admin/CategoryDetail.tsx`, the line item description is currently clipped to one line with `truncate`. Remove the truncation so the full description wraps and is fully visible.

### Change

In the read-only row (around lines 179–185):

- Remove `truncate` from the title `<p>` and let it wrap naturally (`break-words`).
- Remove `truncate` from the description `<p>` and add `whitespace-pre-wrap break-words` so multi-line descriptions render in full and preserve line breaks the user typed.
- Switch the row container from `items-center` to `items-start` so the price + action buttons align cleanly to the top of a tall, multi-line description.

### Files touched

- `src/pages/admin/CategoryDetail.tsx` — single block edit on the display row.

### Result

Long line item descriptions are shown in full, wrapped across as many lines as needed, instead of being cut off with an ellipsis.

