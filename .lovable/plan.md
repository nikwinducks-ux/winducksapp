

## Remove Start/End time inputs from "Mark unavailable" dialog

The dialog currently shows Start and End time scrollers. Remove both — the times are already prefilled from the tapped slot (start = tap, end = start + 1h). The dialog will only show the **Reason** field plus Save/Cancel/Delete actions.

### What you'll see

- Tap an empty time slot on the SP Day/Week calendar → dialog opens titled **"Mark unavailable"** with:
  - A read-only summary line showing the prefilled date + time range (e.g. "Mon, Apr 28 · 2:00 PM – 3:00 PM") so the user knows what they're blocking.
  - **Reason** (optional textarea)
  - Cancel / Save buttons (Delete in edit mode)
- No Start input. No End input. No Date input.
- Saving uses the prefilled date/start/end from the tap (or the original values when editing).

### Implementation

**`src/components/calendar/UnavailableDialog.tsx`**:
- Remove the Start `<Input type="time">` and End `<Input type="time">` block (the two-column grid).
- Remove the `toMin` helper and the time-format / 15-min validation in `handleSave` — no user-editable times to validate. Keep `start`/`end` state and the `useEffect` hydration so saved values pass through unchanged.
- Add a small read-only summary line above the Reason field showing the formatted date and time range (12-hour format, e.g. "Mon, Apr 28 · 2:00 PM – 3:00 PM"), derived from `date`/`start`/`end`.
- Keep `UnavailableDialogValue` shape and all props/callbacks unchanged.

### Files touched

- **Edited**: `src/components/calendar/UnavailableDialog.tsx`

No changes to `SPCalendar.tsx`, `JobCalendar.tsx`, hooks, schema, or admin flows.

