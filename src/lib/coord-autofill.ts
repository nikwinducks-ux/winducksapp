// City-based coordinate presets (prototype autofill)
const CITY_PRESETS: Record<string, { lat: number; lng: number }> = {
  // Calgary metro
  calgary:        { lat: 51.0447, lng: -114.0719 },
  cochrane:       { lat: 51.1890, lng: -114.4670 },
  airdrie:        { lat: 51.2917, lng: -114.0144 },
  okotoks:        { lat: 50.7267, lng: -113.9750 },
  chestermere:    { lat: 51.0350, lng: -113.8230 },
  // Edmonton metro
  edmonton:       { lat: 53.5461, lng: -113.4938 },
  "st. albert":   { lat: 53.6305, lng: -113.6256 },
  "st albert":    { lat: 53.6305, lng: -113.6256 },
  "sherwood park":{ lat: 53.5413, lng: -113.2958 },
  leduc:          { lat: 53.2594, lng: -113.5492 },
  spruce_grove:   { lat: 53.5450, lng: -113.9180 },
  "spruce grove": { lat: 53.5450, lng: -113.9180 },
  beaumont:       { lat: 53.3553, lng: -113.4156 },
  fort_saskatchewan: { lat: 53.7125, lng: -113.2186 },
  "fort saskatchewan": { lat: 53.7125, lng: -113.2186 },
  // Other major AB
  "red deer":     { lat: 52.2681, lng: -113.8112 },
  lethbridge:     { lat: 49.6956, lng: -112.8451 },
  "medicine hat": { lat: 50.0405, lng: -110.6764 },
  "fort mcmurray":{ lat: 56.7264, lng: -111.3803 },
  "grande prairie": { lat: 55.1707, lng: -118.7947 },
  banff:          { lat: 51.1784, lng: -115.5708 },
  canmore:        { lat: 51.0884, lng: -115.3479 },
};

/** Returns preset coords + small jitter for a city, or null if unsupported */
export function autofillCoords(city: string): { lat: number; lng: number } | null {
  const key = city.trim().toLowerCase();
  const preset = CITY_PRESETS[key];
  if (!preset) return null;
  // ±0.01 degree jitter (~1 km) so same-city records differ
  const jitter = () => (Math.random() - 0.5) * 0.02;
  return {
    lat: Math.round((preset.lat + jitter()) * 10000) / 10000,
    lng: Math.round((preset.lng + jitter()) * 10000) / 10000,
  };
}

/** Lookup without jitter — used for backfill/deterministic checks. */
export function getCityPreset(city: string): { lat: number; lng: number } | null {
  const key = city.trim().toLowerCase();
  return CITY_PRESETS[key] ?? null;
}

export const SUPPORTED_CITIES = Array.from(
  new Set(
    Object.keys(CITY_PRESETS).map(
      (c) => c.split(" ").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ")
    )
  )
);
