import type { Address } from "@/data/mockData";

// Haversine formula for distance between two coordinates
export function haversineDistance(
  lat1: number, lon1: number,
  lat2: number, lon2: number
): number {
  const R = 6371; // Earth radius in km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

// Normalize address string for comparison
function normalizeAddr(s: string): string {
  return (s || "").trim().toLowerCase().replace(/\s+/g, " ");
}

// Check if two addresses match (case-insensitive, trimmed)
export function addressesMatch(a: Address, b: Address): boolean {
  return (
    normalizeAddr(a.street) === normalizeAddr(b.street) &&
    normalizeAddr(a.city) === normalizeAddr(b.city) &&
    normalizeAddr(a.province) === normalizeAddr(b.province) &&
    normalizeAddr(a.postalCode) === normalizeAddr(b.postalCode)
  );
}

export type DistanceSource = "coordinates" | "address_match" | "fallback";

export interface ProximityResult {
  distanceKm: number | null;
  score: number;
  source: DistanceSource;
}

// Compute proximity between an SP address and a job address
export function computeProximityResult(spAddr: Address, jobAddr: Address): ProximityResult {
  // 1. If both have coordinates, use Haversine
  if (spAddr.lat && spAddr.lng && jobAddr.lat && jobAddr.lng) {
    const d = haversineDistance(spAddr.lat, spAddr.lng, jobAddr.lat, jobAddr.lng);
    return { distanceKm: d, score: proximityScore(d), source: "coordinates" };
  }
  // 2. Exact address match fallback
  if (addressesMatch(spAddr, jobAddr)) {
    return { distanceKm: 0, score: 100, source: "address_match" };
  }
  // 3. Same-city fallback when coords are missing
  const spCity = normalizeAddr(spAddr.city);
  const jobCity = normalizeAddr(jobAddr.city);
  if (spCity && jobCity && spCity === jobCity) {
    return { distanceKm: null, score: 80, source: "fallback" };
  }
  // 4. No usable signal — different city or unknown
  return { distanceKm: null, score: 0, source: "fallback" };
}

// Proximity score mapping: closer = higher score
// 0km=100, 10km=90, 25km=70, 50km=40, 75km=10, >75km=0
export function proximityScore(distanceKm: number): number {
  if (distanceKm <= 0) return 100;
  if (distanceKm >= 75) return 0;
  // Piecewise linear interpolation
  const breakpoints = [
    { km: 0, score: 100 },
    { km: 10, score: 90 },
    { km: 25, score: 70 },
    { km: 50, score: 40 },
    { km: 75, score: 10 },
  ];
  for (let i = 0; i < breakpoints.length - 1; i++) {
    const a = breakpoints[i];
    const b = breakpoints[i + 1];
    if (distanceKm >= a.km && distanceKm <= b.km) {
      const t = (distanceKm - a.km) / (b.km - a.km);
      return Math.round(a.score + t * (b.score - a.score));
    }
  }
  return 0;
}

export const PROXIMITY_TOOLTIP =
  "Proximity scoring: 0km = 100, 10km = 90, 25km = 70, 50km = 40, 75km = 10, >75km = 0. Calculated using straight-line (Haversine) distance between SP base and job. When coordinates are missing: same-city fallback = 80, exact address match = 100, different city = 0.";

export const DISTANCE_SOURCE_LABELS: Record<DistanceSource, string> = {
  coordinates: "Coordinates",
  address_match: "Address match",
  fallback: "Fallback",
};
