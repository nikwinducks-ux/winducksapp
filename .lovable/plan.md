

## Add a Desktop / Mobile layout toggle

### Goal

Stop tying the layout to viewport width. Always render the **desktop sidebar layout** by default on every screen, and let the user opt into the **mobile top-bar layout** via a toggle in the top-right corner. The choice persists across reloads.

### How it works

1. **New `LayoutModeContext`** (`src/contexts/LayoutModeContext.tsx`)
   - State: `mode: "desktop" | "mobile"`, `setMode`, `toggle`.
   - Default: `"desktop"` for everyone (previous width-based auto-switch is removed).
   - Persisted to `localStorage` under `winducks:layoutMode`. Hydrates on mount.

2. **Wrap app** in `LayoutModeProvider` inside `src/App.tsx` (above the router so every page sees it).

3. **`DashboardLayout` becomes mode-driven, not breakpoint-driven** (`src/components/DashboardLayout.tsx`)
   - Read `mode` from context.
   - `mode === "desktop"`: render the existing left sidebar + main content. Sidebar visible at all widths (no `xl:` gating).
   - `mode === "mobile"`: render `MobileTopNav` + main content, no sidebar. Visible at all widths.
   - Remove the `xl:hidden` / `xl:flex` width-based switches.

4. **Layout toggle button**
   - Lives in the **top-right corner of every page**, in both layouts:
     - **Desktop layout**: small floating header strip at the top of `<main>` (right-aligned) containing the toggle. Sits above page content, doesn't disturb existing pages.
     - **Mobile layout**: added into `MobileTopNav` Row 1, just left of the avatar.
   - Icon-only button: `Monitor` icon when in mobile mode (click → switch to desktop), `Smartphone` icon when in desktop mode (click → switch to mobile). Tooltip: "Switch to mobile view" / "Switch to desktop view".

5. **Cleanup**
   - Drop the `xl:` breakpoint gymnastics added last round in `DashboardLayout.tsx` and `MobileTopNav.tsx` (`xl:hidden` on the header). The mode context decides visibility now.
   - `MobileTopBar.tsx` and `MobileBottomNav.tsx` remain unused (kept on disk for reference).

### Files touched

- `src/contexts/LayoutModeContext.tsx` — **new**.
- `src/App.tsx` — wrap with `LayoutModeProvider`.
- `src/components/DashboardLayout.tsx` — mode-driven render; add desktop-mode top-right toggle strip.
- `src/components/MobileTopNav.tsx` — drop `xl:hidden`; add toggle button next to avatar.

### Result

- Default experience on any device: the familiar **desktop sidebar layout**.
- One tap on the top-right toggle switches to the **mobile sticky top-bar layout** (and back). Choice is remembered.
- No automatic switching based on screen width — the user is in control.

