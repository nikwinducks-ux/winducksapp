

## Remove redundant date picker from "Mark unavailable" dialog

When an SP taps an empty time slot on the calendar, the `UnavailableDialog` opens with the date already prefilled from the tapped day. The current dialog still shows a **Date** input at the top, which is redundant and reads as a "please select a date" prompt. Remove that field — keep date editing accessible via the existing Start/End time inputs only.

### What you'll see

- Tap an empty time slot on the SP Day/Week calendar → dialog opens titled **"Mark unavailable"** with:
  - **Start** (prefilled, snapped to 15-min slot, editable)
  - **End** (prefilled to start + 1h, editable)
  - **Reason** (optional)
- No more standalone "Date" field at the top.
- The date is still bound internally to the tapped day (and to the existing block's date when editing).
- Edit mode for an existing block behaves the same — title becomes "Edit time off", no Date input shown.

### Implementation

**`src/components/calendar/UnavailableDialog.tsx`**:
- Remove the `<Label htmlFor="ua-date">Date</Label>` + `<Input id="ua-date" type="date" …>` block from the dialog body.
- Keep the `date` state and the `useEffect` that hydrates it from `initial.date` — `handleSave` still passes `date` through unchanged so the parent's create/update mutation gets the correct day.
- No prop or signature changes; `UnavailableDialogValue.date` stays in the contract.

### Files touched

- **Edited**: `src/components/calendar/UnavailableDialog.tsx` (remove Date input from JSX only)

No changes to `SPCalendar.tsx`, hooks, schema, RLS, or admin flows.

