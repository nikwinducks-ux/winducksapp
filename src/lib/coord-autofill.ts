// City-based coordinate presets for Calgary metro area (prototype autofill)
const CITY_PRESETS: Record<string, { lat: number; lng: number }> = {
  calgary:     { lat: 51.0447, lng: -114.0719 },
  cochrane:    { lat: 51.1890, lng: -114.4670 },
  airdrie:     { lat: 51.2917, lng: -114.0144 },
  okotoks:     { lat: 50.7267, lng: -113.9750 },
  chestermere: { lat: 51.0350, lng: -113.8230 },
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

export const SUPPORTED_CITIES = Object.keys(CITY_PRESETS).map(
  (c) => c.charAt(0).toUpperCase() + c.slice(1)
);
