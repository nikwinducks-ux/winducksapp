import { useEffect, useState } from "react";
import { Bell, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  isPushSupported,
  getCurrentSubscription,
  subscribeToPush,
} from "@/lib/push";

const DISMISS_KEY = "winducks.push.banner.dismissed";

export function NotificationsBanner() {
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!isPushSupported()) return;
      if (typeof Notification === "undefined") return;
      if (Notification.permission === "granted") return;
      if (Notification.permission === "denied") return;
      if (localStorage.getItem(DISMISS_KEY) === "1") return;
      const existing = await getCurrentSubscription();
      if (cancelled) return;
      if (!existing) setShow(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!show) return null;

  const handleEnable = async () => {
    setBusy(true);
    try {
      await subscribeToPush();
      toast.success("Notifications enabled");
      setShow(false);
    } catch (err: any) {
      toast.error(err?.message || "Could not enable notifications");
    } finally {
      setBusy(false);
    }
  };

  const handleDismiss = () => {
    localStorage.setItem(DISMISS_KEY, "1");
    setShow(false);
  };

  return (
    <div className="mb-4 flex items-center gap-3 rounded-lg border border-border bg-accent/40 p-3">
      <Bell className="h-5 w-5 shrink-0 text-primary" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground">Get notified about new job offers</p>
        <p className="text-xs text-muted-foreground">
          Allow push notifications to hear about offers even when the app is closed.
        </p>
      </div>
      <Button size="sm" onClick={handleEnable} disabled={busy}>
        {busy ? "Enabling..." : "Enable"}
      </Button>
      <button
        onClick={handleDismiss}
        className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
        aria-label="Dismiss"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
