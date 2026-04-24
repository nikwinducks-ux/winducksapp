

## Mobile calendar Week view + Samsung $ clipping fix + iOS pull-to-refresh fix

Three small, targeted fixes for the SP mobile experience.

---

### 1. Enable Week view on mobile (SP calendar)

Right now `SPCalendar.tsx` hides the **Week** tab on mobile and force-switches to **Day** if a user lands on Week with a small viewport. Bring Week back as a first-class option.

**Changes in `src/pages/sp/SPCalendar.tsx`:**
- Remove the `{!isMobile && <TabsTrigger value="week">}` guard — show **Day / Week / Month / Avail.** on every viewport.
- Remove the `useEffect` that auto-flips Week → Day on mobile.
- The existing `WeekView` in `JobCalendar.tsx` already uses `flex-1 min-w-0` columns + horizontal time axis, so it fits at 360–414px wide. The day-header date totals already use `truncate` and a smaller font, so they degrade gracefully.

No changes to admin calendar (admins already get Week on mobile).

---

### 2. Fix clipped daily $ total on Samsung (Month view)

On a 360px-wide Samsung viewport, the Month cell header packs the day number and total into a single flex row separated by `justify-between`. With totals like `$1,250` and `gap-1 px-0.5`, the amount truncates mid-character.

**Changes in `src/components/calendar/JobCalendar.tsx` (`MonthCell`):**
- On mobile, **stack** the day number and total vertically inside the cell header (column layout, total on its own line, full-width, centered or right-aligned, no `truncate`).
- On mobile, render the total using a **compact format** (`$1.2k`, `$950`, `$12k`) so it always fits even on the narrowest Android viewports.
- Add a tiny helper `formatCompactCAD(n: number)`:
  - `< 1000` → `$950`
  - `1000–9999` → `$1.2k`
  - `≥ 10000` → `$12k`
- Desktop continues to show the full `formatCADWhole` value.

Result: the $ total is always fully readable on every device, including 360px Samsung screens.

---

### 3. Fix pull-to-refresh on iPhone

iOS Safari's native rubber-band overscroll competes with our gesture. Specifically:
- On iOS, `<main className="overflow-auto">` still lets the document body bounce, so `scrollTop===0` checks pass but iOS hijacks the touchmove and we never get reliable `e.preventDefault()` cycles.
- Our `touchmove` listener is registered on the scroll container. On iOS, when the gesture starts at the very top, Safari pre-emptively starts the bounce animation before our handler decides to call `preventDefault()`.

**Changes:**

**`src/components/DashboardLayout.tsx`:**
- Add `overscroll-behavior: contain` (`overscroll-contain` Tailwind class) and `touch-action: pan-y` to both the mobile and desktop `<main>` scroll containers. This tells iOS we'll handle the vertical gesture and stops body-level rubber-banding.
- Add `-webkit-overflow-scrolling: touch` is no longer needed (modern iOS), but ensure no `position: fixed` ancestor is constraining scroll height.

**`src/hooks/usePullToRefresh.ts`:**
- Track gesture state with **two** thresholds: a small `activationThreshold` (~6px) to claim the gesture before iOS bounce kicks in. Once a downward intent is detected at `scrollTop === 0`, immediately call `e.preventDefault()` on subsequent moves (not just when `damped > 5`) to suppress iOS bounce.
- Detect iOS via `/iP(hone|ad|od)/.test(navigator.userAgent)` or feature-test, and on iOS:
  - Always call `e.preventDefault()` on touchmove once the gesture is "active", regardless of distance.
  - Use a slightly looser `scrollTop` check (`<= 0`) since iOS can briefly report negative values during bounce — treat negative as "at top".
- Keep current Android behavior intact.
- Add a fallback: if `touchend` doesn't fire (interrupted by tab switch), `touchcancel` already resets — verified.

**`src/components/PullToRefreshIndicator.tsx`:**
- No logic change, but add `will-change: transform` to avoid jank on iOS during the spring animation.

---

### Files touched

- **Edited**: `src/pages/sp/SPCalendar.tsx` (re-enable Week tab on mobile)
- **Edited**: `src/components/calendar/JobCalendar.tsx` (`MonthCell` mobile header layout + compact $ formatter)
- **Edited**: `src/components/DashboardLayout.tsx` (`overscroll-contain` + `touch-action: pan-y` on main)
- **Edited**: `src/hooks/usePullToRefresh.ts` (iOS-aware preventDefault + activation threshold)
- **Edited**: `src/components/PullToRefreshIndicator.tsx` (`will-change: transform`)

No schema, RLS, hook-API, or admin-side changes.

