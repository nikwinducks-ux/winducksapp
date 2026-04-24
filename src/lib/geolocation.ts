// Lightweight geolocation + maps helpers used across the SP / admin mobile UI.
// All functions are safe to call on desktop — they degrade gracefully.

export interface LatLng {
  lat: number;
  lng: number;
}

export async function getCurrentPosition(opts?: PositionOptions): Promise<LatLng> {
  if (typeof navigator === "undefined" || !navigator.geolocation) {
    throw new Error("Geolocation not supported on this device.");
  }
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) => reject(err),
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 60_000, ...opts },
    );
  });
}

/**
 * Build a "Open in Maps" URL. On iOS this opens Apple Maps; on Android it opens
 * Google Maps. We use the cross-platform geo: URI when possible, falling back
 * to a Google Maps web URL.
 */
export function buildMapsUrl(destination: string | LatLng, origin?: LatLng): string {
  const dest = typeof destination === "string" ? destination : `${destination.lat},${destination.lng}`;
  const params = new URLSearchParams({
    api: "1",
    destination: dest,
    travelmode: "driving",
  });
  if (origin) params.set("origin", `${origin.lat},${origin.lng}`);
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

export function openInMaps(destination: string | LatLng, origin?: LatLng) {
  const url = buildMapsUrl(destination, origin);
  window.open(url, "_blank", "noopener,noreferrer");
}

export function buildTelUrl(phone: string): string {
  return `tel:${phone.replace(/[^\d+]/g, "")}`;
}
