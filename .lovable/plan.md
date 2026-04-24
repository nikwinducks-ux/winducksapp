## Goal

Let Service Providers accept or decline pending job offers directly from the **Calendar** (mobile + desktop) — but only when **Auto-Accept is OFF** in their account. When Auto-Accept is ON, the system handles offers automatically and manual accept/decline buttons should not appear.

---

## Current state

`src/pages/sp/SPCalendar.tsx` already opens a side sheet when an SP taps a job block. For pending offers it already shows **Accept** and **Reject** buttons, wired to `useAcceptOffer` / `useDeclineOffer`. What's missing is the **auto-accept gating**.

The SP's `autoAccept` flag is already loaded via `useServiceProviders()` (we read `providers` in the calendar) and is mapped from `service_providers.auto_accept`.

---

## Changes (one file)

**`src/pages/sp/SPCalendar.tsx`**

1. Look up the current SP record from the already-loaded `providers` list:
   ```ts
   const me = providers.find((p) => p.id === spId);
   const autoAcceptOn = !!me?.autoAccept;
   ```
2. In the sheet's "Respond to Offer" block, render the Accept / Reject buttons **only when `!autoAcceptOn`**.
3. When auto-accept IS on and the job is a pending offer, replace the action block with an **info banner** explaining the situation, with a link to Auto-Accept Settings:
   > "Auto-Accept is ON — offers are handled automatically. Turn it off in Account → Auto-Accept to respond manually."
   (Includes a `Link` to `/sp/auto-accept`.)
4. Apply the same `!autoAcceptOn` gate so accidental taps while auto-accept is on cannot manually accept/decline.

No layout changes elsewhere; the sheet already works on mobile and desktop. No new routes, no DB changes, no new hooks. Status update buttons (Start Job / End Job) are unaffected.

---

## Edge cases

- **SP record not yet loaded**: treat as auto-accept ON (hide buttons) until known, to avoid flashing the wrong UI. Optional: render a small "Loading…" placeholder.
- **Offer becomes stale** (expired/cancelled before tap): existing `selectedOffer` lookup already returns `null`, so the block won't render.
- **Job is assigned to me, not a pending offer**: unaffected — Start/End Job UI continues to render regardless of auto-accept state.

---

## Out of scope

- Job Offers page (already supports manual accept/decline) — no change.
- Auto-Accept Settings page — no change.
- Admin views — no change.
