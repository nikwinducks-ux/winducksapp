# Fix SP Calendar: Accept button + pull-to-refresh conflict

## Issue 1 — Accept/Decline buttons missing for SP B's pending jobs (mobile)

In `src/pages/sp/SPCalendar.tsx`, the Accept/Reject UI only renders when **all** of these are true:
- `isPendingOffer` (job.dbId exists in `pendingOfferJobIds` from `useSpOffers`)
- `selectedOffer` is found
- `autoAcceptOn === false`

Two failure modes are likely hiding the button on SP B:
1. `useSpOffers` only returns offers in a "Pending" state. If the offer record for the tapped job is not present in that list (filtered out, race during refresh, or the job's offer status drifted to a non-pending state while still showing as `Offered` on the job), `isPendingOffer` is false and **nothing** renders.
2. SP B may have `auto_accept` enabled, so the banner replaces the buttons. Currently there is no way to "respond manually anyway" when auto-accept is on.

### Fix
Make pending-offer detection more permissive and always offer a manual fallback:
- Treat the job as a pending offer if **either** condition holds:
  - `pendingOfferJobIds.has(job.dbId)`, OR
  - `job.status === "Offered"` AND `job.assignedSpId !== spId` AND there is any offer record for this SP on the job (look up `spOffers` by `job_id`, including non-pending if needed — fall back to fetching the latest offer for this SP+job if missing).
- When `autoAcceptOn` is true and a manual offer exists, show the banner **plus** an "Accept now" / "Decline" pair so SPs can still respond from the calendar without leaving to toggle auto-accept off.
- Add a small empty-state line ("This offer is no longer available") if we identify it as an offer-job but cannot find any offer record, so the sheet never silently shows nothing.

### Files
- `src/pages/sp/SPCalendar.tsx` — broaden `isPendingOffer`/`selectedOffer` derivation; restructure the offer-response block; add manual-action fallback inside the auto-accept banner.

## Issue 2 — Pull-to-refresh blocks scrolling up in calendar time grid

`usePullToRefresh` (attached to the main scroll container in `DashboardLayout`) activates whenever the user starts a downward swipe while `main.scrollTop <= 0`. On the calendar route, after scrolling down within the page the user is no longer at top, so PTR shouldn't fire — but the user reports the refresh indicator appears and prevents scrolling back up. This happens because:
- The calendar grid renders at fixed `GRID_HEIGHT_PX` inside the main scroller, so the whole page scrolls (not the calendar itself).
- Once the page reaches the bottom, scrolling back up first goes through normal scroll, but any moment `scrollTop` reaches 0 the next downward touch is consumed by PTR — and on iOS the activation `preventDefault` can block the upward gesture mid-flick.

### Fix
Give the calendar precedence by opting it out of PTR entirely:
1. In `usePullToRefresh`, in `onTouchStart`, check if `e.target` is inside an element with `data-no-ptr="true"` (or matches `[data-no-ptr] *`). If so, set `startYRef.current = null` and bail — PTR will not engage for that gesture.
2. In `JobCalendar.tsx` (Day/Week/Month roots) wrap the calendar surface with `data-no-ptr="true"`. This ensures any swipe that begins on the calendar (grid, time axis, day headers) goes to native scroll, not to PTR.
3. Keep PTR active everywhere else (dashboard cards, lists, etc.).

This is a minimal, surgical change: PTR keeps working on every other SP and admin screen, and the calendar gets full control of vertical gestures.

### Files
- `src/hooks/usePullToRefresh.ts` — early-bail when touch starts inside `[data-no-ptr]`.
- `src/components/calendar/JobCalendar.tsx` — add `data-no-ptr="true"` to the outer wrappers of `DayView`, `WeekView`, `MonthView`.

## Out of scope
- No DB / RLS / edge-function changes.
- No changes to admin calendar logic (same `JobCalendar` wrapper picks up the PTR opt-out automatically).
