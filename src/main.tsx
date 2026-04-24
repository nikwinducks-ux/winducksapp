import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// PWA / iframe guard: never let a service worker run inside the Lovable preview iframe
// or on preview hosts. In production (published app) the SW from vite-plugin-pwa
// auto-registers and provides install + offline shell.
const isInIframe = (() => {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
})();
const host = window.location.hostname;
const isPreviewHost =
  host.includes("id-preview--") ||
  host.includes("lovableproject.com") ||
  host.includes("lovable.dev");

if (isInIframe || isPreviewHost) {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.getRegistrations().then((regs) => {
      regs.forEach((r) => r.unregister());
    });
  }
}

createRoot(document.getElementById("root")!).render(<App />);
