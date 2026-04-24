

## Mobile nav: sticky top menu bar (replace hamburger drawer)

### Goal

On mobile (`<lg`, i.e. <1024px), replace the hamburger-opens-side-drawer pattern with a **sticky top bar** that exposes navigation directly — and **also raise the mobile breakpoint** so tablets and small laptops get the mobile shell.

### Changes

**1. Raise the mobile/desktop breakpoint**
- Swap every `lg:` in `DashboardLayout.tsx`, `MobileTopBar.tsx`, and `MobileBottomNav.tsx` from `lg` (1024px) → `xl` (1280px). That way iPad-class and small laptop widths (like your current 1035px preview) get the mobile shell, and only true desktops keep the side rail.

**2. New `MobileTopNav` component (`src/components/MobileTopNav.tsx`)**
- Sticky at top (`sticky top-0 z-30`), respects `env(safe-area-inset-top)`.
- Two rows:
  - **Row 1 (header)**: Winducks logo + page title (left), History button for admins + profile/account avatar (right). No hamburger.
  - **Row 2 (nav)**: horizontally scrollable pill/tab strip with every link from `spLinks` or `adminLinks` (Dashboard, Jobs, Calendar, Offers, etc.). Active tab is highlighted with the primary color underline; tap to navigate. Uses `overflow-x-auto` + `scroll-smooth` + snap so all items remain reachable on narrow screens without a drawer.
- Logout moves into a small dropdown on the avatar (top-right).

**3. Remove the bottom tab bar on mobile**
- With nav now at the top, `MobileBottomNav` becomes redundant. Delete its render from `DashboardLayout` (keep the file for now in case you want to revert). Page padding `pb-24` on mobile drops back to normal.

**4. Remove the side drawer**
- The `Sheet`-based drawer in `DashboardLayout` and the hamburger button in the old `MobileTopBar` are no longer needed; both removed.

**5. Tablet/desktop unchanged**
- At `xl` and above, the existing collapsible left sidebar continues to render exactly as today.

### Files touched
- `src/components/DashboardLayout.tsx` — swap `lg:` → `xl:`, drop drawer + bottom nav, mount new `MobileTopNav`.
- `src/components/MobileTopNav.tsx` — **new**.
- `src/components/MobileTopBar.tsx` — deprecated/removed.
- `src/components/MobileBottomNav.tsx` — no longer rendered (file kept).

### How to preview after the change
Use the device toolbar above the Lovable preview (phone/tablet icon) or resize the preview narrower than 1280px to see the new top nav. On a real phone it will always show.

