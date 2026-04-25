# Fix: Sticky Time Axis on Android Chrome (Week Calendar)

## Why the previous fix worked on iOS but not Android

The earlier change unified scrolling onto a single container, which makes `position: sticky; left: 0` resolve correctly on iOS Safari. On Android Chrome, sticky-left inside a horizontally scrolling flex container has additional, well-documented quirks that the previous fix didn't address:

1. **Sticky inside an intermediate flex/wrapper child is unreliable.** The TimeAxis is currently wrapped in `<div className="sticky left-0 z-20 bg-card shrink-0">` — the sticky div is a *flex child*, and Android Chrome sometimes resolves `left: 0` against the flex container's content box (which itself is inside the wider scroll content) instead of the scroll port. iOS Safari computes this against the scroll port, hence the difference.
2. **`scroll-snap-type: x proximity` on the scroll container conflicts with sticky children on Android Chrome.** Snap re-anchoring can cause the sticky element to "jump" off-screen mid-scroll or stay glued to the snapped column.
3. **`min-width` (vs explicit `width`) on the scroll content** can leave Android computing the wrong containing-block width for sticky resolution when the inner box is wider than the scroll port.

## Fix

All changes are confined to the `WeekView` block of `src/components/calendar/JobCalendar.tsx` (and a small refactor of `TimeAxis`).

### 1. Make `TimeAxis` accept a `sticky` prop and apply sticky directly on its root element

Replace the current `TimeAxis` (lines ~355–378) so it can be rendered as a sticky flex child without an intermediate wrapper:

```tsx
function TimeAxis({ sticky = false }: { sticky?: boolean }) {
  return (
    <div
      className={cn(
        "w-14 shrink-0 border-r bg-muted/20 text-[10px] text-muted-foreground select-none",
        sticky && "z-20 bg-card"
      )}
      style={sticky ? { position: "sticky", left: 0 } : undefined}
    >
      {/* ... existing hour cells ... */}
    </div>
  );
}
```

Update the only other caller (`<TimeAxis />` in `DayView`, line ~814) — no `sticky` prop, default `false`, behaviour unchanged.

### 2. In `WeekView`, drop the wrapper around `<TimeAxis />` and pass `sticky`

Replace lines ~1097–1100:

```tsx
<div className="relative flex">
  <TimeAxis sticky />
  {days.map(...)}
</div>
```

This removes the extra wrapper that was breaking sticky resolution on Android Chrome.

### 3. Apply the same direct-sticky pattern to the header's left spacer

The header spacer at line ~1042 is fine in principle but it sits inside another flex row. Keep it but make sticky inline so Android resolves it the same way:

```tsx
<div
  className="w-14 shrink-0 border-r bg-muted/30 z-30"
  style={{ position: "sticky", left: 0 }}
/>
```

### 4. Use explicit `width` instead of `min-width` on the scroll content

Change line ~1036 from `minWidth` to `width` so Android can compute the sticky containing block reliably:

```tsx
<div style={{ width: `${AXIS_PX + dayMinWidthPx * days.length}px` }}>
```

(Behaviour identical on iOS / desktop; `width` is only stricter and avoids the `min-width` ambiguity on Android.)

### 5. Disable `scroll-snap-type` on the outer container

Remove `scrollSnapType` from the outer `hScrollRef` style (line ~1031). Also remove `scrollSnapAlign` from the day-column wrappers (lines ~1080 and ~1107). The center-on-date logic in `useLayoutEffect` already actively scrolls to the active day, so we don't lose UX, and we eliminate the snap/sticky conflict on Android.

### 6. Add `isolation: isolate` on the inner scroll content wrapper

Add `style={{ isolation: 'isolate' }}` (alongside the new `width`) on the inner wrapper at line ~1036. This creates a new stacking context that prevents Android Chrome from promoting any child layer in a way that breaks sticky.

## What stays the same

- All zoom logic, infinite-window growth, centering on date change, header rendering, JobBlock layout, drag-and-drop.
- iOS / desktop behaviour — these changes are strictly more compatible, not different.
- `AXIS_PX = 56` and `w-14` width.

## Files touched

- `src/components/calendar/JobCalendar.tsx` only — `TimeAxis` (lines 355–378), `DayView`'s `<TimeAxis />` call site (line ~814), and the `WeekView` JSX block (lines ~1031–1141).

No backend, no other component, no new dependencies.

## Verification (after implementation)

On Android Chrome, in the published app, log in and open the Week calendar:
- Switch to 5-day mode → swipe horizontally → time axis stays pinned on the left.
- Switch to 3-day mode → swipe horizontally → same.
- Vertical scroll inside the grid still works; header stays pinned on top.
- Tap a date in the header → grid centers on that day; time axis remains visible throughout.

Also verify on iOS Safari that nothing regressed (it should look identical to today's working behaviour).
