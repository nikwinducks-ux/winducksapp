## Fix pull-to-refresh activating from anywhere on mobile

### The bug

Pull-to-refresh fires no matter where you are on the page — even halfway down — instead of only when the page is scrolled to the very top.

### Root cause

In `DashboardLayout.tsx`, the **mobile** layout uses:

```text
<div class="flex min-h-screen w-full flex-col">   ← min-h-screen, not h-screen
  <MobileTopNav />
  <main class="flex-1 overflow-auto ...">         ← never actually overflows
    {children}
  </main>
</div>
```

Because the outer container is `min-h-screen` (not a fixed height) and is `flex-col`, the inner `<main>` with `flex-1` has no bounded height. Its content grows freely and the **document** (`<html>`/`<body>`) becomes the scroller — `<main>` itself never scrolls, so `mainEl.scrollTop` is always `0`.

The pull-to-refresh hook checks `el.scrollTop <= 0` against that `<main>` ref. Since it's always 0, the "at top" guard always passes and the gesture activates from any scroll position.

(The desktop layout was already fixed previously to use `h-screen overflow-hidden`, which is why this wasn't caught there.)

### Fix

Mirror the desktop fix on the mobile branch so `<main>` is the actual scroll container:

- Change the mobile wrapper from `flex min-h-screen w-full flex-col` to `flex h-screen w-full flex-col overflow-hidden`.
- Keep `<main>` as `flex-1 overflow-auto overscroll-contain` with `touchAction: "pan-y"` (mobile pull-to-refresh needs this).

This bounds `<main>`'s height to viewport-minus-topnav, so `<main>` becomes the real scroller and `scrollTop` accurately reflects the user's position. The `atTop()` check then correctly only returns true at the very top.

### Files touched

- **Edited**: `src/components/DashboardLayout.tsx` (one className change on the mobile wrapper div)

No changes to `usePullToRefresh.ts`, the indicator, or any pages.
