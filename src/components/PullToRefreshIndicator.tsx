import { RefreshCw } from "lucide-react";

interface Props {
  pullDistance: number;
  isRefreshing: boolean;
  threshold: number;
}

export function PullToRefreshIndicator({ pullDistance, isRefreshing, threshold }: Props) {
  const visible = pullDistance > 0 || isRefreshing;
  if (!visible) return null;

  const progress = Math.min(1, pullDistance / threshold);
  const translateY = isRefreshing ? threshold * 0.6 : pullDistance * 0.6;
  const rotation = isRefreshing ? 0 : progress * 360;
  const opacity = Math.min(1, progress + (isRefreshing ? 1 : 0));

  return (
    <div
      className="pointer-events-none fixed left-1/2 top-2 z-50 -translate-x-1/2"
      style={{
        transform: `translate(-50%, ${translateY}px)`,
        opacity,
        transition: isRefreshing ? "transform 200ms ease" : "none",
        willChange: "transform",
      }}
      aria-hidden="true"
    >
      <div className="flex h-10 w-10 items-center justify-center rounded-full border bg-background shadow-md">
        <RefreshCw
          className={`h-5 w-5 text-primary ${isRefreshing ? "animate-spin" : ""}`}
          style={!isRefreshing ? { transform: `rotate(${rotation}deg)` } : undefined}
        />
      </div>
    </div>
  );
}
