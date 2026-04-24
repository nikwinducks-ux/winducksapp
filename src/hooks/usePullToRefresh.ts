import { useEffect, useRef, useState } from "react";

interface Options {
  enabled: boolean;
  onRefresh: () => Promise<void> | void;
  threshold?: number;
  maxPull?: number;
}

export function usePullToRefresh<T extends HTMLElement>(
  targetRef: React.RefObject<T>,
  { enabled, onRefresh, threshold = 70, maxPull = 120 }: Options,
) {
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const startYRef = useRef<number | null>(null);
  const activeRef = useRef(false);

  useEffect(() => {
    const el = targetRef.current;
    if (!enabled || !el) return;

    const onTouchStart = (e: TouchEvent) => {
      if (isRefreshing) return;
      if (el.scrollTop > 0) {
        startYRef.current = null;
        return;
      }
      startYRef.current = e.touches[0].clientY;
      activeRef.current = false;
    };

    const onTouchMove = (e: TouchEvent) => {
      if (isRefreshing || startYRef.current === null) return;
      const dy = e.touches[0].clientY - startYRef.current;
      if (dy <= 0) {
        if (activeRef.current) setPullDistance(0);
        activeRef.current = false;
        return;
      }
      if (el.scrollTop > 0) {
        startYRef.current = null;
        setPullDistance(0);
        activeRef.current = false;
        return;
      }
      activeRef.current = true;
      const damped = Math.min(maxPull, dy * 0.5);
      setPullDistance(damped);
      if (e.cancelable && damped > 5) e.preventDefault();
    };

    const onTouchEnd = async () => {
      const dist = pullDistanceRef.current;
      startYRef.current = null;
      activeRef.current = false;
      if (dist >= threshold && !isRefreshing) {
        setIsRefreshing(true);
        setPullDistance(threshold);
        try {
          await Promise.race([
            Promise.resolve(onRefresh()),
            new Promise((r) => setTimeout(r, 10000)),
          ]);
        } finally {
          setIsRefreshing(false);
          setPullDistance(0);
        }
      } else {
        setPullDistance(0);
      }
    };

    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    el.addEventListener("touchend", onTouchEnd, { passive: true });
    el.addEventListener("touchcancel", onTouchEnd, { passive: true });

    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
      el.removeEventListener("touchcancel", onTouchEnd);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, isRefreshing, onRefresh, threshold, maxPull]);

  // Mirror pullDistance into a ref so onTouchEnd sees latest without re-binding listeners.
  const pullDistanceRef = useRef(0);
  useEffect(() => {
    pullDistanceRef.current = pullDistance;
  }, [pullDistance]);

  return { pullDistance, isRefreshing, threshold };
}
