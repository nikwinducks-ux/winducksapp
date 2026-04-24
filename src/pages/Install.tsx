import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Smartphone, Share, Plus, Download, CheckCircle2 } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export default function Install() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    const ua = window.navigator.userAgent;
    setIsIOS(/iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream);
    setIsStandalone(
      window.matchMedia("(display-mode: standalone)").matches ||
        (window.navigator as any).standalone === true,
    );

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);
    window.addEventListener("appinstalled", () => setInstalled(true));
    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
    };
  }, []);

  const triggerInstall = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") setInstalled(true);
    setDeferredPrompt(null);
  };

  return (
    <div className="mx-auto max-w-2xl space-y-8 animate-fade-in pb-24">
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Smartphone className="h-6 w-6" />
        </div>
        <div>
          <h1 className="page-header">Install Winducks</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Add Winducks to your home screen for a native app experience.
          </p>
        </div>
      </div>

      {isStandalone || installed ? (
        <div className="metric-card flex items-center gap-3 border-success/30 bg-success/5">
          <CheckCircle2 className="h-6 w-6 text-success" />
          <div>
            <p className="font-semibold text-foreground">Winducks is installed</p>
            <p className="text-sm text-muted-foreground">You're running the installed app.</p>
          </div>
        </div>
      ) : (
        <>
          {deferredPrompt && (
            <div className="metric-card space-y-3">
              <h2 className="section-title">One-tap install</h2>
              <p className="text-sm text-muted-foreground">
                Your browser supports direct install. Tap below to add Winducks to your home screen.
              </p>
              <Button onClick={triggerInstall} className="gap-2">
                <Download className="h-4 w-4" />
                Install Winducks
              </Button>
            </div>
          )}

          {isIOS ? (
            <div className="metric-card space-y-4">
              <h2 className="section-title">On iPhone / iPad (Safari)</h2>
              <ol className="space-y-3 text-sm">
                <li className="flex items-start gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-semibold">
                    1
                  </span>
                  <span>
                    Tap the <Share className="inline h-4 w-4 align-text-bottom" /> Share button at the
                    bottom of Safari.
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-semibold">
                    2
                  </span>
                  <span>
                    Scroll and tap <strong>"Add to Home Screen"</strong>{" "}
                    <Plus className="inline h-4 w-4 align-text-bottom" />.
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-semibold">
                    3
                  </span>
                  <span>Tap <strong>Add</strong> in the top-right corner.</span>
                </li>
              </ol>
              <p className="text-xs text-muted-foreground border-t pt-3">
                Push notifications on iOS require iOS 16.4+ <em>and</em> the app to be installed via
                "Add to Home Screen".
              </p>
            </div>
          ) : (
            <div className="metric-card space-y-4">
              <h2 className="section-title">On Android (Chrome / Edge)</h2>
              <ol className="space-y-3 text-sm">
                <li className="flex items-start gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-semibold">
                    1
                  </span>
                  <span>Open the browser menu (⋮) in the top-right.</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-semibold">
                    2
                  </span>
                  <span>
                    Tap <strong>"Install app"</strong> or <strong>"Add to Home screen"</strong>.
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-semibold">
                    3
                  </span>
                  <span>Confirm to add Winducks to your home screen.</span>
                </li>
              </ol>
            </div>
          )}
        </>
      )}

      <div className="metric-card space-y-2 text-sm text-muted-foreground">
        <p className="font-medium text-foreground">What you get when installed</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>Launch from your home screen — no browser bar</li>
          <li>Push notifications for new job offers (Android & iOS 16.4+)</li>
          <li>One-tap camera capture for job photos</li>
          <li>Faster load times via offline caching</li>
        </ul>
      </div>
    </div>
  );
}
