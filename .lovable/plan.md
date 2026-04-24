

## Replace teammate phone text with phone + SMS icon buttons

In the SP portal's "Working with" teammate list, replace the visible phone number with two compact icon buttons: a **phone** icon (tap-to-call via `tel:`) and a **message** icon (tap-to-SMS via `sms:`). The teammate's name and "Lead" star stay visible; the number itself is no longer shown.

### What you'll see

In every place the `CrewTeammates` card renders (SP Calendar job sheet, SP Job Detail, Job Offer Detail), each teammate row will show:

```text
[Avatar]  Jane Smith ★ Lead          [📞]  [💬]
```

- **📞 Phone button** — `<a href="tel:+1...">` with `Phone` icon, opens dialer.
- **💬 Message button** — `<a href="sms:+1...">` with `MessageSquare` icon, opens SMS composer prefilled to teammate's number.
- Both rendered as small `Button variant="outline" size="icon"` (h-8 w-8) so they're easy to tap on mobile.
- If the teammate has no phone on file, both buttons are hidden and a small "— no phone on file" hint is shown instead.
- Tooltip on hover: "Call Jane" / "Text Jane".

The inline variant (used in `MyJobs` list) already shows names only — no change needed.

### Implementation

Edit only `src/components/sp/CrewTeammates.tsx`:

- Replace the current `<a href={tel:...}>{phone}</a>` block with two icon buttons side-by-side.
- Add an `smsHref(phone)` helper next to the existing `telHref(phone)` (same digit-stripping, `sms:` scheme).
- Import `MessageSquare` from `lucide-react` alongside the existing `Phone`.
- Wrap each icon in the `Tooltip` component (already in the UI kit) for accessibility.

### Files touched

- **Edited**: `src/components/sp/CrewTeammates.tsx` (only the `card` variant's phone rendering)

No schema, RLS, hook, or other-page changes. Admin pages are unaffected.

