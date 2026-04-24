import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";

// https://vitejs.dev/config/
//
// PWA setup notes:
// - We keep the existing custom service worker at `public/sw.js` (it handles
//   web-push notifications). vite-plugin-pwa is configured in `injectManifest`
//   mode pointing at that same file so we end up with ONE service worker that
//   both shows push notifications AND advertises the web app manifest for
//   installability. Workbox precaching is intentionally minimal — we mainly
//   want the install prompt + standalone display.
// - Service worker registration is disabled at the iframe / preview level by
//   `src/main.tsx` so the editor preview never caches stale builds.
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
    VitePWA({
      registerType: "autoUpdate",
      injectRegister: "auto",
      strategies: "injectManifest",
      srcDir: "public",
      filename: "sw.js",
      devOptions: { enabled: false },
      includeAssets: ["favicon.ico", "robots.txt", "icons/*.png"],
      injectManifest: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,webp,woff2}"],
        // Keep the SW small — large precache would slow first install
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
      },
      manifest: {
        name: "Winducks",
        short_name: "Winducks",
        description: "Winducks Allocation Platform for Service Providers",
        theme_color: "#0A84E0",
        background_color: "#ffffff",
        display: "standalone",
        scope: "/",
        start_url: "/",
        orientation: "portrait",
        icons: [
          { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
    }),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
