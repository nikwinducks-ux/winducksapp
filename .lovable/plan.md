## Fix: Admin desktop pages won't scroll

### What's happening

On desktop, `DashboardLayout` renders:

```text
<div class="flex min-h-screen w-full">     ← parent: min-h-screen, no max
  <aside class="sticky h-screen ...">      ← sidebar: viewport-tall
  <main class="flex-1 overflow-auto overscroll-contain">  ← scroller
</div>
```

The parent only has `min-h-screen`, not `h-screen`. So in a flex row, `<main>` stretches to its content height (taller than the viewport). With no bounded height, `overflow-auto` on `<main>` can't create an internal scroll area — and `overscroll-contain` + the recently-added `touchAction: "pan-y"` on the same element swallow wheel events without forwarding them to the window. Result: the body scrollbar appears (because the document is taller than the viewport) but the wheel/keys feel "stuck" because input lands on `<main>`, which refuses to scroll and refuses to bubble.

This regression came in with the pull-to-refresh wiring, when desktop `<main>` was given the same overflow/overscroll/touch-action attributes that mobile needs.

### Fix

Make `<main>` the single scroller on desktop by bounding the flex parent's height:

- Change the desktop wrapper from `flex min-h-screen w-full` to `flex h-screen w-full overflow-hidden`.
- Keep `<main>` as `flex-1 overflow-auto overscroll-contain`. Now it has a real height to scroll inside, and the wheel correctly drives the inner scrollbar.
- Remove the inline `style={{ touchAction: "pan-y" }}` from the desktop `<main>` (it's a mobile-touch concern; not needed when the desktop main owns the scroll). Keep it on the mobile `<main>`.
- Mobile branch is unchanged (it already uses `flex-col` + a single scrolling `<main>` and works correctly).

### What you'll see

- Mouse wheel, trackpad, Page Up/Down, and arrow keys all scroll admin pages normally on desktop.
- The sidebar stays put (still sticky / full height).
- Mobile pull-to-refresh and mobile scrolling are unaffected.
- No other layout, route, hook, or backend changes.

### Files touched

- **Edited**: `src/components/DashboardLayout.tsx` (desktop wrapper height + remove desktop `touchAction` inline style)
