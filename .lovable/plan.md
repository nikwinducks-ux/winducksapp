## Problem

On macOS (Safari/Chrome) with a trackpad, swiping left/right with two fingers triggers browser back/forward navigation. This makes it impossible to horizontally scroll/swipe within the app (including future calendar swimlane scrolling) and also causes accidental page-aways from any view.

The user expects horizontal trackpad gestures inside the app — particularly on the calendar — to stay in the app instead of navigating browser history.

## Root cause

There is no `overscroll-behavior-x` set globally on `html`/`body`. The desktop main scroll container uses `overscroll-contain` (which only applies to its scrollable directions), but since `<main>` itself doesn't scroll horizontally, horizontal gestures bubble up to the browser → back/forward navigation fires.

## Fix

Disable the browser's horizontal swipe-to-navigate gesture globally so the app owns all left/right gestures. Then the calendar (and any other component) is free to handle horizontal scrolling.

### Changes

**`src/index.css`** — apply `overscroll-behavior-x: none` to `html, body` in the base layer:

```css
@layer base {
  html, body {
    overscroll-behavior-x: none;
  }
  body {
    @apply bg-background text-foreground antialiased;
    font-feature-settings: "cv02", "cv03", "cv04", "cv11";
  }
}
```

This single change:
- Stops macOS two-finger horizontal swipe from triggering browser back/forward on every page (admin + SP, desktop + mobile web).
- Preserves vertical scroll, pull-to-refresh on mobile, and existing `overscroll-contain` behavior on the main scroll regions.
- Allows any current/future horizontally scrollable region inside the calendar to receive the gesture instead of the browser.

**`src/components/DashboardLayout.tsx`** — upgrade the desktop `<main>` container from `overscroll-contain` to `overscroll-y-contain overscroll-x-none` for belt-and-suspenders coverage on browsers where the html-level rule isn't honored:

```tsx
<main
  ref={desktopMainRef}
  className="flex-1 overflow-auto overscroll-y-contain overscroll-x-none"
>
```

Apply the same `overscroll-x-none` to the mobile `<main>` container.

## Out of scope

- No new horizontal scrolling UI is being added. If the calendar later gains a wide swimlane that needs to scroll horizontally, that container can simply use `overflow-x-auto` and it will now work correctly without the browser hijacking the gesture.
- Browser keyboard back (Cmd+[) and the back button itself are unaffected — only the trackpad swipe gesture is suppressed.

## Files touched

- `src/index.css`
- `src/components/DashboardLayout.tsx`
