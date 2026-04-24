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
      // Only act on predominantly-horizontal intent.
      if (absX <= absY || absX < 1) return;

      const max = el.scrollWidth - el.clientWidth;
      if (max <= 0) return;

      const current = el.scrollLeft;
      const next = current + e.deltaX;

      // If the user is trying to swipe further past an edge, let the browser
      // decide (still suppressed globally by overscroll-behavior-x: none).
      const atLeftEdge = current <= 0 && e.deltaX < 0;
      const atRightEdge = current >= max && e.deltaX > 0;
      if (atLeftEdge || atRightEdge) return;

      e.preventDefault();
      el.scrollLeft = Math.max(0, Math.min(max, next));
    };

    el.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      el.removeEventListener("wheel", onWheel);
    };
  }, [enabled, targetRef]);
}
