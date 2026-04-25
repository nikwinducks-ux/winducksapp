# Mobile Week View — fix 5-day & 3-day zoom

Two scoped fixes inside `src/components/calendar/JobCalendar.tsx` (`WeekView`). 7-day ("fit") behavior stays exactly the same. Day view, Month view, and desktop Week view are not touched.

## Issues

1. **Time axis disappears.** In 5-day / 3-day mode the calendar becomes a wide horizontal scroller. The `<TimeAxis />` element (rendered once at the start of the day-grid row) scrolls off-screen along with the day columns, so once the user scrolls right the hour labels are gone. Only the header's 56-px axis spacer is `sticky left-0` — the axis itself is not.
2. **Wrong number of columns visible.** Column widths for the zoomed modes are hard-coded:
   - `large` (3-day) → 132 px
   - `comfortable` (5-day) → 84 px
   On a ~360–414 px wide phone, after the 56 px axis only ~300–360 px is available, so 132 × 3 ≈ 396 px and 84 × 5 = 420 px both overflow → only ~2.5 / ~4 days fit.

## Fix

### 1. Pin the left time axis in Week view

In the day-grid row (around line 1091), wrap `<TimeAxis />` so it sits in a sticky container at `left: 0` with a higher `z-index` than the day columns. Mirror the styling used by the existing sticky header spacer (`sticky left-0 z-10 bg-muted/30` → use `bg-card` for the body so opaque pixels cover scrolling content).

The header spacer already exists and is already sticky, so the column above the axis stays aligned automatically.

Day columns must keep `min-w-0` and not extend under the axis. Because the axis is rendered first in flex order and now sticks to the left edge of the scroll viewport, the columns naturally start to its right — but to be safe also add `scroll-padding-left: 56px` (already present) and ensure the snap target on the first day still lands flush with the axis's right edge.

### 2. Size day columns so exactly N fit

Change `dayMinWidthPx` to compute width from container width for all mobile zoom modes, not just `fit`:

```ts
const AXIS_PX = 56;
const dayMinWidthPx = useMemo(() => {
  if (!isMobile) return 160;
  const avail = Math.max(0, containerWidth - AXIS_PX);
  if (avail <= 0) return 84; // initial paint fallback
  const cols = weekZoom === "fit" ? 7 : weekZoom === "comfortable" ? 5 : 3;
  return Math.max(36, Math.floor(avail / cols));
}, [isMobile, containerWidth, weekZoom]);
```

Replace the magic constant `56` already used in the centering / scroll handlers with the shared `AXIS_PX` so future tweaks stay consistent.

Effect:
- 7-day: unchanged (already used `avail / 7`).
- 5-day: each column = avail / 5 → 5 full days visible.
- 3-day: each column = avail / 3 → 3 full days visible.

### 3. Keep zoom behavior consistent

- `useHorizontalWheelScroll` / horizontal scrolling stays enabled for 5/3-day so the user can still pan to other dates; the centering effect already keeps `currentDate` in the middle.
- Scroll-snap (`scrollSnapAlign: "start"`) on each day column is preserved so dragging snaps cleanly to a day boundary.
- The axis being sticky means it never participates in horizontal scroll math; existing `axis = 56` offset in `handleScroll` and the centering `useLayoutEffect` continues to work because we still reserve 56 px in the inner `minWidth` (`56 + dayMinWidthPx * days.length`).

## Files changed

- `src/components/calendar/JobCalendar.tsx` — `WeekView` only:
  - Update `dayMinWidthPx` memo to divide available width by 3 / 5 / 7 based on zoom.
  - Wrap `<TimeAxis />` in a `sticky left-0 z-20 bg-card` container inside the day-grid row.
  - Extract `AXIS_PX = 56` constant and reuse it in the existing `handleScroll` and centering effect.

## Out of scope

- Desktop Week view (`!isMobile` branch) — unchanged.
- Day view, Month view — unchanged.
- Time-label vertical alignment (already done previously).
- Availability tab / settings icon — unchanged.
