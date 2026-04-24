

## Fix: Mobile-view toggle missing on phones

### Problem

The Monitor/Smartphone toggle button in `MobileTopNav` Row 1 sits to the **left of the avatar**, alongside the optional History button. On narrow phone widths (e.g. 375–414px), Row 1 runs out of horizontal space and the toggle gets pushed off-screen or hidden behind the avatar, especially when the page title is long ("Service Categories", "Allocation Control", etc.). The flex children aren't allowed to shrink, so the title eats the available space and the toggle disappears.

### Fix

Make Row 1 of `src/components/MobileTopNav.tsx` resilient on narrow screens:

1. **Force the title to shrink, not the controls**
   - Add `min-w-0` and keep `truncate` on the title `<h1>`. Right-side controls get `shrink-0` so they always render.

2. **Always-visible toggle**
   - Keep the layout-mode toggle (`Monitor` / `Smartphone` icon) as a dedicated `Button` in Row 1, immediately left of the avatar, with `shrink-0`. Tooltip + `aria-label` retained.

3. **Tighten Row 1 on small screens**
   - Reduce horizontal padding (`px-2 sm:px-3`), reduce gap (`gap-1.5`), and shrink the logo to `h-7 w-7` on mobile so all controls fit on a 360px-wide device.

4. **Verify in both roles**
   - Same `MobileTopNav` is used by SP and Admin, so this single fix covers both. The History button (admin-only, optional) already has `shrink-0`; confirm and keep.

5. **Sanity check the Mobile-mode header in `DashboardLayout`**
   - Confirm `MobileTopNav` is the only top element when `mode === "mobile"` (no extra desktop toggle strip rendering on top of it). No change expected — just verify the conditional render.

### Files touched

- `src/components/MobileTopNav.tsx` — width-resilient Row 1 layout, `shrink-0` on all right-side controls, smaller logo/padding on mobile.

### Result

The Desktop/Mobile toggle is visible and tappable in the top-right of the mobile shell on every phone size, for both SP and Admin accounts.

