// src/components/map/RideMap.tsx
import { useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { Location, DriverInfo } from '../../contexts/RideContext';

// Fix Leaflet default icon assets (bundler issue)
delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const pickupIcon = L.divIcon({
  html: `<div style="
    width:18px;height:18px;border-radius:50%;
    background:#1D4ED8;border:3px solid #fff;
    box-shadow:0 2px 8px rgba(29,78,216,0.6)">
  </div>`,
  className: '',
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});

const dropoffIcon = L.divIcon({
  html: `<div style="
    width:26px;height:26px;display:flex;align-items:center;justify-content:center;
    background:#0F172A;border:2.5px solid #1D4ED8;border-radius:6px;
    box-shadow:0 2px 8px rgba(0,0,0,0.5)">
    <svg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 24 24' fill='#fff'>
      <path d='M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z'/>
    </svg>
  </div>`,
  className: '',
  iconSize: [26, 26],
  iconAnchor: [13, 26],
});

const driverIcon = L.divIcon({
  html: `<div style="
    width:40px;height:40px;border-radius:50%;
    background:#1D4ED8;border:3px solid #fff;
    box-shadow:0 0 0 6px rgba(29,78,216,0.25);
    display:flex;align-items:center;justify-content:center;
    font-size:20px;cursor:pointer">
    🚗
  </div>`,
  className: '',
  iconSize: [40, 40],
  iconAnchor: [20, 20],
});

// Smooth pan/zoom to fit bounds when locations change
function FitBounds({ pickup, dropoff }: { pickup?: Location; dropoff?: Location }) {
  const map = useMap();
  const prevKey = useRef('');

  useEffect(() => {
    const locs = [pickup, dropoff].filter(Boolean) as Location[];
    if (locs.length === 0) return;
    const key = locs.map(l => `${l.lat},${l.lng}`).join('|');
    if (key === prevKey.current) return;
    prevKey.current = key;

    if (locs.length === 1) {
      map.flyTo([locs[0].lat, locs[0].lng], 15, { animate: true, duration: 1 });
    } else {
      const bounds = L.latLngBounds(locs.map(l => [l.lat, l.lng]));
      map.flyToBounds(bounds, { padding: [60, 60], animate: true, duration: 1 });
    }
  }, [pickup, dropoff, map]);

  return null;
}

interface Props {
  center?: [number, number];
  zoom?: number;
  pickup?: Location;
  dropoff?: Location;
  driver?: DriverInfo;
  route?: [number, number][];
  className?: string;
}

export function RideMap({
  center = [12.9716, 77.5946], // Bangalore default
  zoom = 13,
  pickup,
  dropoff,
  driver,
  route,
  className = '',
}: Props) {
  return (
    <MapContainer
      center={center}
      zoom={zoom}
      className={`w-full h-full ${className}`}
      zoomControl={false}
      attributionControl={false}
    >
      <TileLayer
        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        attribution='&copy; <a href="https://carto.com/attributions">CARTO</a>'
      />

      {pickup && (
        <Marker position={[pickup.lat, pickup.lng]} icon={pickupIcon}>
          <Popup className="dark-popup">{pickup.address}</Popup>
        </Marker>
      )}

      {dropoff && (
        <Marker position={[dropoff.lat, dropoff.lng]} icon={dropoffIcon}>
          <Popup>{dropoff.address}</Popup>
        </Marker>
      )}

      {driver && (
        <Marker position={[driver.lat, driver.lng]} icon={driverIcon}>
          <Popup>{driver.name} • ⭐ {driver.rating}</Popup>
        </Marker>
      )}

      {route && route.length > 1 && (
        <Polyline
          positions={route}
          color="#1D4ED8"
          weight={4}
          opacity={0.85}
          dashArray="10 6"
        />
      )}

      <FitBounds pickup={pickup} dropoff={dropoff} />
    </MapContainer>
  );
}
