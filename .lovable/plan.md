

## Republish + verify SP Month tab

### Issue 1 — Published URL is stale

Frontend changes (including the new Month-on-mobile + day drill-down work) only go live on `winducksapp.lovable.app` after you click **Publish → Update** in the editor. The preview URL (`id-preview--…lovable.app`) always shows the latest code, but the published URL is a separate snapshot.

**Action for you:** Click **Publish** (top-right) → **Update**. No code change needed for this.

### Issue 2 — "Month tab not visible for SP account"

I checked `src/pages/sp/SPCalendar.tsx` and the Month tab is already rendered for SPs on every viewport (only `Week` is gated to desktop):

```tsx
<TabsList>
  <TabsTrigger value="day">Day</TabsTrigger>
  {!isMobile && <TabsTrigger value="week">Week</TabsTrigger>}
  <TabsTrigger value="month">Month</TabsTrigger>
  <TabsTrigger value="availability">Availability</TabsTrigger>
</TabsList>
```

So in code it's there. The two realistic reasons you're not seeing it:

1. **Published URL is stale** (covered above) — most likely cause.
2. **TabsList overflow at narrow widths.** The header row is `flex-wrap` with the title on the left and `TabsList` on the right. With 4 triggers (`Day · Week · Month · Availability`) on a tablet-width SP layout, the list can wrap or push past the viewport edge so Month/Availability scroll out of view without an obvious scrollbar.

### Small fix to make tabs always reachable

Make the SP `TabsList` horizontally scrollable and full-width on small screens so all triggers are always tappable:

- `src/pages/sp/SPCalendar.tsx` — wrap `<TabsList>` in an overflow container and let it shrink:
  ```tsx
  <Tabs value={view} onValueChange={...} className="w-full sm:w-auto">
    <TabsList className="w-full sm:w-auto overflow-x-auto justify-start sm:justify-center">
      …
    </TabsList>
  </Tabs>
  ```
- Shorten the `Availability` trigger label to `Avail.` on mobile (optional) so all four fit without scrolling on most phones.

### Files touched

- **Edited**: `src/pages/sp/SPCalendar.tsx` (TabsList overflow + responsive width; optional shorter mobile label)

No schema, hook, or business-logic changes.

**After approval**, click **Publish → Update** so the change reaches `winducksapp.lovable.app`.

