import { useEffect, useRef, useState } from "react";

interface Options {
  enabled: boolean;
  onRefresh: () => Promise<void> | void;
  threshold?: number;
  maxPull?: number;
  activationThreshold?: number;
}

const isIOS = (): boolean => {
  if (typeof navigator === "undefined") return false;
  return /iP(hone|ad|od)/.test(navigator.userAgent);
};

export function usePullToRefresh<T extends HTMLElement>(
  targetRef: React.RefObject<T>,
  {
    enabled,
    onRefresh,
    threshold = 70,
    maxPull = 120,
    activationThreshold = 6,
  }: Options,
) {
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const startYRef = useRef<number | null>(null);
  const activeRef = useRef(false);
  const pullDistanceRef = useRef(0);
  const iosRef = useRef(false);

  useEffect(() => {
    iosRef.current = isIOS();
  }, []);

  useEffect(() => {
    pullDistanceRef.current = pullDistance;
  }, [pullDistance]);

  useEffect(() => {
    const el = targetRef.current;
    if (!enabled || !el) return;

    const atTop = () => el.scrollTop <= 0;

    const onTouchStart = (e: TouchEvent) => {
      if (isRefreshing) return;
      // Allow descendants (e.g. the calendar grid) to opt out of PTR so their
      // own scrolling/gesture handling takes precedence.
      const target = e.target as Element | null;
      if (target && target.closest && target.closest('[data-no-ptr="true"]')) {
        startYRef.current = null;
        return;
      }
      if (!atTop()) {
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

      if (!atTop() && !activeRef.current) {
        startYRef.current = null;
        setPullDistance(0);
        return;
      }

      // Claim the gesture early — before iOS can start the rubber-band animation.
      if (!activeRef.current && dy < activationThreshold) {
        // On iOS, preventDefault as soon as we see downward intent at top
        // to suppress native bounce that would otherwise hijack the gesture.
        if (iosRef.current && e.cancelable) e.preventDefault();
        return;
      }

      activeRef.current = true;
      const damped = Math.min(maxPull, dy * 0.5);
      setPullDistance(damped);

      // Always preventDefault while gesture is active to stop iOS bounce.
      if (e.cancelable) e.preventDefault();
    };

    const onTouchEnd = async () => {
      const dist = pullDistanceRef.current;
      const wasActive = activeRef.current;
      startYRef.current = null;
      activeRef.current = false;
      if (wasActive && dist >= threshold && !isRefreshing) {
        setIsRefreshing(true);
        setPullDistance(threshold);
        try {
          const result = onRefresh();
          await Promise.race([
            Promise.resolve(result),
            new Promise((r) => setTimeout(r, 10000)),
          ]);
        } catch (err) {
          console.error("[PullToRefresh] onRefresh threw:", err);
        } finally {
          // Small delay so the user sees the spin complete
          setTimeout(() => {
            setIsRefreshing(false);
            setPullDistance(0);
          }, 300);
        }
      } else {
        setPullDistance(0);
      }
    };

    // touchstart non-passive on iOS so we can preventDefault from move reliably
    const startOpts: AddEventListenerOptions = iosRef.current
      ? { passive: false }
      : { passive: true };
    el.addEventListener("touchstart", onTouchStart, startOpts);
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
  }, [enabled, isRefreshing, onRefresh, threshold, maxPull, activationThreshold]);

  return { pullDistance, isRefreshing, threshold };
}
