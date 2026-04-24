# Fix customer contact icons not opening phone/SMS

## Problem

The Phone and Message icons render correctly in the SP calendar's job sheet, but clicking them only shows the focus state ("turn orange") and never opens the phone dialer or SMS app.

Root cause: the buttons use `<Button asChild><a href="tel:..."></a></Button>`. Inside the Lovable preview iframe (and many sandboxed iframes), navigating to non-`http(s)` schemes like `tel:` / `sms:` from an inline `<a>` is silently blocked. The teammate buttons in `CrewTeammates` have the same latent issue but aren't usually noticed because users test them less.

The fix is to (a) intercept the click and explicitly route the navigation to the top-level window, and (b) surface the phone number itself so the user has a fallback to copy.

## Changes

### `src/components/sp/CustomerContactActions.tsx` (rewrite)

- Replace the `<Button asChild><a href>` pattern with real `<button>` elements that handle the click via JS.
- New helper `openContactUrl(url)` that:
  1. Tries `window.top.location.href = url` (escapes the preview iframe).
  2. Falls back to `window.open(url, "_top")`.
  3. Final fallback: `window.location.href = url`.
- Wrap each icon in a small `ContactIconButton` that calls `openContactUrl` with `tel:` / `sms:` and stops event propagation so the surrounding Sheet doesn't swallow it.
- Display the resolved phone number under the customer name so the SP can copy it manually if their device can't follow the link.
- When no phone is on file, render a clear "no phone on file" state instead of nothing (so the SP knows why icons are absent).
- Keep the same public API (`customerId`, `customerName`, `variant`) so the existing `SPCalendar.tsx` integration keeps working with no changes.

## Technical detail

```tsx
function openContactUrl(url: string) {
  try {
    if (window.top && window.top !== window) {
      window.top.location.href = url;
      return;
    }
  } catch { /* cross-origin top — fall through */ }
  const opened = window.open(url, "_top");
  if (!opened) window.location.href = url;
}
```

No other files need to change — `SPCalendar.tsx` already renders `<CustomerContactActions />` and the props stay the same.
