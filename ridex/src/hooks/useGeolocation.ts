// src/hooks/useGeolocation.ts
import { useEffect, useState } from 'react';

interface GeoState {
  lat: number | null;
  lng: number | null;
  accuracy: number | null;
  error: string | null;
  loading: boolean;
}

export function useGeolocation() {
  const [state, setState] = useState<GeoState>({
    lat: null, lng: null, accuracy: null, error: null, loading: true,
  });

  useEffect(() => {
    if (!navigator.geolocation) {
      setState(s => ({ ...s, error: 'Geolocation not supported', loading: false }));
      return;
    }

    const id = navigator.geolocation.watchPosition(
      pos => {
        setState({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          error: null,
          loading: false,
        });
      },
      err => {
        setState(s => ({ ...s, error: err.message, loading: false }));
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 5000 },
    );

    return () => navigator.geolocation.clearWatch(id);
  }, []);

  return state;
}
