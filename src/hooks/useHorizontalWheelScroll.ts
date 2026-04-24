import { useEffect } from "react";

function getHorizontalScrollableTarget(boundary: HTMLElement, origin: EventTarget | null) {
  const isScrollable = (node: HTMLElement) => {
    const max = node.scrollWidth - node.clientWidth;
    if (max <= 0) return false;
    const overflowX = window.getComputedStyle(node).overflowX;
    return overflowX === "auto" || overflowX === "scroll" || overflowX === "overlay";
  };

  let node = origin instanceof HTMLElement ? origin : null;
  while (node) {
    if (isScrollable(node)) return node;
    if (node === boundary) break;
    node = node.parentElement;
  }

  return isScrollable(boundary) ? boundary : null;
}

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

      const scrollTarget = getHorizontalScrollableTarget(el, e.target) ?? el;
      const max = scrollTarget.scrollWidth - scrollTarget.clientWidth;
      if (max <= 0) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }

      const current = scrollTarget.scrollLeft;
      const delta = absX >= 1 ? e.deltaX : e.deltaY;
      const next = current + delta;

      e.preventDefault();
      e.stopPropagation();
      scrollTarget.scrollLeft = Math.max(0, Math.min(max, next));
    };

    el.addEventListener("wheel", onWheel, { passive: false, capture: true });
    return () => {
      el.removeEventListener("wheel", onWheel, { capture: true });
    };
  }, [enabled, targetRef]);
}
