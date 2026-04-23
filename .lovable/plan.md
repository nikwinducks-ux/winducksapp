

## Require a decline reason when an SP declines a job offer

The decline-with-reason flow already exists on the offer detail page (`src/pages/sp/JobOfferDetail.tsx`) — a dropdown of reasons must be picked before "Confirm Decline" enables, and the reason is saved server-side via the `decline_offer` RPC. To make it more accessible and to enforce the requirement everywhere, add an inline **Decline** button to each pending offer card on the offers list, opening a modal that requires a reason before submission.

### What changes

**File edited: `src/pages/sp/JobOffers.tsx`**

1. Convert each pending offer card from a single `<Link>` into a card with two regions:
   - The clickable area (still routes to the offer detail page for full review + Accept).
   - A small action row at the bottom-right with two buttons: **View / Accept** (links to detail page) and **Decline** (opens the new modal).
2. Add a `DeclineOfferDialog` component that:
   - Shows the job number + customer for context.
   - Renders a required `Select` populated from `declineReasons` (`src/data/mockData.ts`).
   - Shows a warning banner: "Declining may affect your acceptance rate and reliability score."
   - Disables **Confirm Decline** until a reason is selected (cannot be bypassed).
   - On confirm, calls `useDeclineOffer().mutate({ offerId, declineReason })` and closes the modal on success. The list auto-refreshes (existing query invalidation + 10s poll).

**File edited: `src/pages/sp/JobOfferDetail.tsx`** (small reinforcement)

- Keep the existing decline flow exactly as-is. No functional change — just verify the empty-string guard still blocks submit (it does: `disabled={!declineReason || declineOffer.isPending}`).

### Why no DB / RPC changes

- `offers.decline_reason` column already exists.
- `decline_offer(_offer_id, _reason)` RPC already persists the reason and validates ownership/status.
- `declineReasons` list is already exported from `mockData.ts` and used on the detail page; reusing it keeps reasons consistent across both surfaces.

### Acceptance

- On `/jobs` (SP portal), every pending offer row shows a **Decline** button alongside the existing tap-to-view behavior.
- Clicking **Decline** opens a modal that cannot be submitted without selecting a reason from the dropdown.
- Submitting saves the reason to `offers.decline_reason`, flips the offer to `Declined`, and removes it from the pending list.
- The existing in-detail decline flow continues to work and also enforces a required reason.
- No way (UI-side) to decline an offer without choosing a reason.

