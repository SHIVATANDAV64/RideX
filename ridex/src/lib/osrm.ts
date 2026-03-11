import { ROUTING_ENV } from './env';

export interface RoutePoint {
  lat: number;
  lng: number;
}

export interface RouteSummary {
  distanceKm: number;
  durationMin: number;
  coordinates: [number, number][];
}

const OSRM_BASE_URL = ROUTING_ENV.OSRM_BASE_URL;

export async function getDrivingRoute(
  pickup: RoutePoint,
  dropoff: RoutePoint,
  stops: RoutePoint[] = [],
): Promise<RouteSummary> {
  const waypoints = [pickup, ...stops, dropoff]
    .map(point => `${point.lng},${point.lat}`)
    .join(';');

  const url = new URL(`/route/v1/driving/${waypoints}`, OSRM_BASE_URL);
  url.searchParams.set('overview', 'full');
  url.searchParams.set('geometries', 'geojson');
  url.searchParams.set('steps', 'false');

  const res = await fetch(url.toString(), {
    headers: { Accept: 'application/json' },
  });

  if (!res.ok) {
    throw new Error('Unable to fetch road route');
  }

  const data = await res.json() as {
    code?: string;
    routes?: Array<{
      distance: number;
      duration: number;
      geometry?: { coordinates?: [number, number][] };
    }>;
  };

  const route = data.routes?.[0];
  if (data.code !== 'Ok' || !route) {
    throw new Error('No drivable route found');
  }

  const coordinates = (route.geometry?.coordinates ?? []).map(([lng, lat]) => [lat, lng] as [number, number]);

  return {
    distanceKm: route.distance / 1000,
    durationMin: Math.max(1, Math.round(route.duration / 60)),
    coordinates,
  };
}
