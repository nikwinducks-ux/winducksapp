import { useEffect } from "react";

/**
 * Captures horizontal trackpad / shift+wheel gestures inside `targetRef` and
 * translates them into `scrollLeft` updates on the same element. While the
 * element still has horizontal room to scroll, we call `preventDefault()` so
 * macOS / browser back/forward swipe-navigation doesn't hijack the gesture.
 *
 * Vertical scrolling is left untouched.
 */
export function useHorizontalWheelScroll<T extends HTMLElement>(
  targetRef: React.RefObject<T>,
  enabled: boolean = true,
) {
  useEffect(() => {
    const el = targetRef.current;
    if (!enabled || !el) return;

    const onWheel = (e: WheelEvent) => {
      const absX = Math.abs(e.deltaX);
      const absY = Math.abs(e.deltaY);
      const dominantHorizontal = absX > absY * 0.65;
      // Capture clear horizontal trackpad intent and shift+wheel desktop scrolling.
      if ((!dominantHorizontal && !e.shiftKey) || (absX < 1 && Math.abs(e.deltaY) < 1)) return;

      const max = el.scrollWidth - el.clientWidth;
      if (max <= 0) return;

      const current = el.scrollLeft;
      const delta = absX >= 1 ? e.deltaX : e.deltaY;
      const next = current + delta;

      e.preventDefault();
      e.stopPropagation();
      el.scrollLeft = Math.max(0, Math.min(max, next));
    };

    el.addEventListener("wheel", onWheel, { passive: false, capture: true });
    return () => {
      el.removeEventListener("wheel", onWheel, { capture: true });
    };
  }, [enabled, targetRef]);
}
