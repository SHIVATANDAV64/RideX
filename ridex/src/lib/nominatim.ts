// src/lib/nominatim.ts — OpenStreetMap Nominatim geocoding (free, no API key)
export interface NominatimResult {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
  address?: {
    road?: string;
    suburb?: string;
    city?: string;
    state?: string;
    country?: string;
  };
}

/** Forward geocode — search text → [results] */
export async function searchPlaces(query: string, countrycodes = 'in'): Promise<NominatimResult[]> {
  if (!query.trim()) return [];
  const url = new URL('https://nominatim.openstreetmap.org/search');
  url.searchParams.set('q', query);
  url.searchParams.set('countrycodes', countrycodes);
  url.searchParams.set('format', 'json');
  url.searchParams.set('addressdetails', '1');
  url.searchParams.set('limit', '5');

  const res = await fetch(url.toString(), {
    headers: { 'Accept-Language': 'en', 'User-Agent': 'RideX/1.0' },
  });
  if (!res.ok) return [];
  return res.json();
}

/** Reverse geocode — lat/lng → display address */
export async function reverseGeocode(lat: number, lng: number): Promise<string> {
  const url = new URL('https://nominatim.openstreetmap.org/reverse');
  url.searchParams.set('lat', String(lat));
  url.searchParams.set('lon', String(lng));
  url.searchParams.set('format', 'json');

  try {
    const res = await fetch(url.toString(), {
      headers: { 'Accept-Language': 'en', 'User-Agent': 'RideX/1.0' },
    });
    if (!res.ok) return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
    const data: NominatimResult = await res.json();
    // Return short form: road + suburb/city
    const a = data.address ?? {};
    return [a.road, a.suburb ?? a.city].filter(Boolean).join(', ') || data.display_name;
  } catch {
    return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
  }
}

export function shortName(result: NominatimResult): string {
  const parts = result.display_name.split(',');
  return parts.slice(0, 2).join(', ').trim();
}
