/// <reference lib="webworker" />
// Winducks Service Worker
// - Handles web push notifications (existing behavior)
// - Pre-caches the built app shell via vite-plugin-pwa's injectManifest
// - CACHE_VERSION is bumped on each publish to force fresh bundles for returning users

const CACHE_VERSION = 'v2';

import { precacheAndRoute, cleanupOutdatedCaches } from "workbox-precaching";

// Workbox replaces self.__WB_MANIFEST at build time with the precache manifest.
// The cast keeps the file valid as plain JS (no TS) while still parsing in editors.
precacheAndRoute((self.__WB_MANIFEST || []).map(entry => {
  // Append cache version to URLs for cache-busting
  const url = typeof entry === 'string' ? entry : entry.url;
  const revision = typeof entry === 'string' ? CACHE_VERSION : (entry.revision || CACHE_VERSION);
  return typeof entry === 'string' ? { url, revision } : { ...entry, url, revision };
}));
cleanupOutdatedCaches();

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (_e) {
    data = { title: "Winducks", body: event.data ? event.data.text() : "New notification" };
  }

  const title = data.title || "Winducks";
  const options = {
    body: data.body || "",
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    tag: data.tag || "winducks-offer",
    data: { url: data.url || "/" },
    requireInteraction: data.requireInteraction || false,
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || "/";
  event.waitUntil((async () => {
    const allClients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const client of allClients) {
      if ("focus" in client) {
        await client.focus();
        if ("navigate" in client) {
          try { await client.navigate(targetUrl); } catch (_e) { /* cross-origin */ }
        }
        return;
      }
    }
    if (self.clients.openWindow) {
      await self.clients.openWindow(targetUrl);
    }
  })());
});
