

## Add pull-to-refresh on mobile

Add a native-feeling pull-to-refresh gesture on mobile screens that re-fetches the current page's data (jobs, offers, calendar, etc.) and shows a spinner while refreshing.

### What you'll see (mobile only)

- On any page, when scrolled to the top, pulling down reveals a circular spinner that grows/rotates with the pull distance.
- Releasing past the threshold (~70px) triggers a refresh: spinner locks in, React Query invalidates all active queries, and the spinner retracts when data settles.
- Releasing before threshold snaps back with no refresh.
- Desktop (≥768px) is unaffected — gesture is disabled.
- Works inside the existing `DashboardLayout` scroll container, so every authenticated page (SP + Admin) gets it for free.

### How it works

- New hook `src/hooks/usePullToRefresh.ts`:
  - Attaches `touchstart` / `touchmove` / `touchend` to a target ref.
  - Only engages when `scrollTop === 0` and the gesture is a downward pull.
  - Applies dampening (pull distance × 0.5) and exposes `pullDistance` + `isRefreshing` state.
  - Calls an `onRefresh: () => Promise<void>` callback when threshold is crossed.
- New component `src/components/PullToRefreshIndicator.tsx`:
  - Fixed-position spinner using `lucide-react`'s `RefreshCw`, rotates proportional to pull distance, opacity fades in.
- Wire into `src/components/DashboardLayout.tsx`:
  - Use `useIsMobile()` to gate.
  - Get `useQueryClient()` and refresh via `await queryClient.invalidateQueries()` (refetches all active queries — covers jobs, offers, crew, providers, etc.).
  - Attach the hook to the `<main>` scroll container ref and render `<PullToRefreshIndicator>` at top.

### Edge cases handled

- Disabled when any modal/sheet is interacting (gesture only fires on the main scroll area, not portaled overlays).
- Doesn't interfere with horizontal scrolls (e.g. TabsList) — only triggers on vertical pull when scrollY is 0.
- Auto-times-out after 10s if a query hangs, so spinner never gets stuck.
- No-op on desktop — zero overhead.

### Files touched

- **New**: `src/hooks/usePullToRefresh.ts`
- **New**: `src/components/PullToRefreshIndicator.tsx`
- **Edited**: `src/components/DashboardLayout.tsx` (attach hook + indicator on mobile)

No schema, RLS, or data-model changes.

