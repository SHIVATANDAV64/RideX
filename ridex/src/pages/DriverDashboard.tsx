// src/pages/DriverDashboard.tsx
import { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MapPin, TrendingUp, Clock, Star, Phone, X, Check } from 'lucide-react';
import { Channel, ExecutionMethod, Query, type Models } from 'appwrite';
import { RideMap } from '../components/map/RideMap';
import { Button } from '../components/ui/Button';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../components/ui/Toast';
import { formatFare, haversineKm } from '../lib/fare';
import { client, tablesDB, functions, DB_ID, TABLE, FN } from '../lib/appwrite';

type DriverProfile = Models.Row & {
  user_id: string;
  name: string;
  vehicle_type: string;
  vehicle_name: string;
  plate_number: string;
  rating: number;
  total_rides: number;
  is_online: boolean;
  current_lat: number | null;
  current_lng: number | null;
};

interface IncomingRide {
  offerId: string;
  rideId: string;
  riderName: string;
  pickup: string;
  dropoff: string;
  distanceKm: number;
  durationMin: number;
  fare: number;
  vehicleType: string;
}

type DriverRide = Models.Row & {
  rider_name: string;
  pickup_address: string;
  pickup_lat: number;
  pickup_lng: number;
  dropoff_address: string;
  dropoff_lat: number;
  dropoff_lng: number;
  estimated_fare: number;
  final_fare: number | null;
  payment_method: 'cash' | 'stripe_test';
  payment_status: 'pending' | 'paid' | 'failed' | 'refunded' | 'checkout_pending';
  vehicle_type: string;
  status: string;
};

export default function DriverDashboard() {
  const { user, logout } = useAuth();
  const toast = useToast();
  const [online, setOnline] = useState(false);
  const [driverProfile, setDriverProfile] = useState<DriverProfile | null>(null);
  const [incoming, setIncoming] = useState<IncomingRide | null>(null);
  const [activeRide, setActiveRide] = useState<DriverRide | null>(null);
  const [accepting, setAccepting] = useState(false);
  const [availabilityLoading, setAvailabilityLoading] = useState(false);
  const [tripActionLoading, setTripActionLoading] = useState(false);
  const locationIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const offersRealtimeUnsubRef = useRef<(() => void) | null>(null);
  const ridesRealtimeUnsubRef = useRef<(() => void) | null>(null);

  // Derived earnings — until payout reporting exists, keep this clearly tied to completed rides.
  const earnings = {
    today: (driverProfile?.total_rides ?? 0) * 180, // rough estimate
    trips: driverProfile?.total_rides ?? 0,
    rating: driverProfile?.rating ?? 5.0,
  };

  // ── Fetch driver profile on mount ───────────────────────────────────────
  useEffect(() => {
    if (!user) return;
    tablesDB.listRows<DriverProfile>({
      databaseId: DB_ID,
      tableId: TABLE.DRIVER_PROFILES,
      queries: [
        Query.equal('user_id', user.$id),
        Query.limit(1),
      ],
    })
      .then(r => {
        if (r.total > 0) {
          setDriverProfile(r.rows[0]);
          setOnline(r.rows[0].is_online);
        }
      })
      .catch(() => {
        // Profile may not exist yet — show offline state
      });
  }, [user]);

  const refreshPendingOffers = useCallback(async () => {
    if (!user || !online) return;

    try {
      const result = await tablesDB.listRows<Models.Row>({
        databaseId: DB_ID,
        tableId: TABLE.RIDE_OFFERS,
        queries: [
          Query.equal('driver_id', user.$id),
          Query.equal('status', 'pending'),
          Query.orderAsc('$createdAt'),
          Query.limit(1),
        ],
      });

      const row = result.rows[0] as (Models.Row & Record<string, unknown>) | undefined;
      if (!row) {
        setIncoming(null);
        return;
      }

      setIncoming({
        offerId: row.$id,
        rideId: String(row['ride_id'] ?? ''),
        riderName: String(row['rider_name'] ?? 'Rider'),
        pickup: String(row['pickup_address'] ?? ''),
        dropoff: String(row['dropoff_address'] ?? ''),
        distanceKm: Number(row['distance_km'] ?? 0),
        durationMin: Number(row['duration_min'] ?? 0),
        fare: Number(row['estimated_fare'] ?? 0),
        vehicleType: String(row['vehicle_type'] ?? ''),
      });
    } catch {
      toast('Failed to fetch incoming ride offers', 'error');
    }
  }, [online, toast, user]);

  const refreshActiveRide = useCallback(async () => {
    if (!user) return;

    try {
      const result = await tablesDB.listRows<DriverRide>({
        databaseId: DB_ID,
        tableId: TABLE.RIDES,
        queries: [
          Query.equal('driver_id', user.$id),
          Query.equal('status', ['driver_assigned', 'driver_arriving', 'in_progress']),
          Query.orderDesc('$updatedAt'),
          Query.limit(1),
        ],
      });

      setActiveRide(result.rows[0] ?? null);
    } catch {
      toast('Failed to fetch active ride', 'error');
    }
  }, [toast, user]);

  // ── Subscribe to ride offers when online ────────────────────────────────
  useEffect(() => {
    if (!online || !user) return;

    refreshPendingOffers();

    const channel = Channel.tablesdb(DB_ID).table(TABLE.RIDE_OFFERS).row().toString();
    const unsub = client.subscribe(channel, (response) => {
      const payload = response.payload as Record<string, unknown>;
      if (payload['driver_id'] !== user.$id) {
        return;
      }

      void refreshPendingOffers();
    });

    offersRealtimeUnsubRef.current = unsub;
    return () => {
      unsub();
      offersRealtimeUnsubRef.current = null;
    };
  }, [online, refreshPendingOffers, user]);

  // ── Subscribe to active ride updates ────────────────────────────────────
  useEffect(() => {
    if (!user) return;

    void refreshActiveRide();

    const channel = Channel.tablesdb(DB_ID).table(TABLE.RIDES).row().toString();
    const unsub = client.subscribe(channel, (response) => {
      const payload = response.payload as Record<string, unknown>;
      if (payload['driver_id'] !== user.$id) {
        return;
      }

      void refreshActiveRide();
    });

    ridesRealtimeUnsubRef.current = unsub;
    return () => {
      unsub();
      ridesRealtimeUnsubRef.current = null;
    };
  }, [refreshActiveRide, user]);

  // ── Location update loop when online ────────────────────────────────────
  useEffect(() => {
    if (!online || !driverProfile) return;

    const driverProfileId = driverProfile.$id;

    function updateLocation() {
      if (!navigator.geolocation) return;
      navigator.geolocation.getCurrentPosition(
        async ({ coords }) => {
          const latitude = coords.latitude;
          const longitude = coords.longitude;

          await tablesDB.updateRow({
            databaseId: DB_ID,
            tableId: TABLE.DRIVER_PROFILES,
            rowId: driverProfileId,
            data: {
              current_lat: latitude,
              current_lng: longitude,
            },
          }).catch(() => {});

          if (!activeRide) {
            return;
          }

          const ridePatch: Record<string, number | string> = {
            driver_lat: latitude,
            driver_lng: longitude,
          };

          if (activeRide.status !== 'in_progress') {
            const eta = Math.max(1, Math.round((haversineKm(latitude, longitude, activeRide.pickup_lat, activeRide.pickup_lng) / 25) * 60));
            ridePatch.driver_eta = eta;
            ridePatch.status = 'driver_arriving';
          }

          await tablesDB.updateRow({
            databaseId: DB_ID,
            tableId: TABLE.RIDES,
            rowId: activeRide.$id,
            data: ridePatch,
          }).catch(() => {});
        },
        () => {},
        { enableHighAccuracy: true, timeout: 5000 },
      );
    }

    updateLocation();
    locationIntervalRef.current = setInterval(updateLocation, 10_000);

    return () => {
      if (locationIntervalRef.current) {
        clearInterval(locationIntervalRef.current);
        locationIntervalRef.current = null;
      }
    };
  }, [activeRide, online, driverProfile]);

  async function setDriverAvailability(nextOnline: boolean) {
    if (!user || availabilityLoading) return;

    setAvailabilityLoading(true);
    try {
      await functions.createExecution(
        FN.DRIVER_TOGGLE,
        JSON.stringify({ driverId: user.$id, online: nextOnline }),
        false,
        '/',
        ExecutionMethod.POST,
      );
      setOnline(nextOnline);
      if (!nextOnline) {
        setIncoming(null);
      } else {
        await refreshPendingOffers();
      }
      await refreshActiveRide();
    } catch {
      toast(`Failed to go ${nextOnline ? 'online' : 'offline'}`, 'error');
    } finally {
      setAvailabilityLoading(false);
    }
  }

  async function goOffline() {
    await setDriverAvailability(false);
  }

  async function goOnline() {
    await setDriverAvailability(true);
  }

  async function acceptRide() {
    if (!incoming || !user || accepting) return;
    setAccepting(true);
    try {
      await functions.createExecution(
        FN.ACCEPT_RIDE,
        JSON.stringify({ rideId: incoming.rideId, offerId: incoming.offerId, driverId: user.$id }),
        false,
        '/',
        ExecutionMethod.POST,
      );
      toast('Ride accepted! Head to pickup location.', 'success');
      setIncoming(null);
      await refreshActiveRide();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to accept ride', 'error');
    } finally {
      setAccepting(false);
    }
  }

  async function declineRide() {
    if (!incoming) return;

    try {
      await tablesDB.updateRow({
        databaseId: DB_ID,
        tableId: TABLE.RIDE_OFFERS,
        rowId: incoming.offerId,
        data: { status: 'declined' },
      });
      setIncoming(null);
    } catch {
      toast('Failed to decline ride', 'error');
    }
  }

  async function startTrip() {
    if (!activeRide || !user || tripActionLoading) return;

    setTripActionLoading(true);
    try {
      await functions.createExecution(
        FN.START_TRIP,
        JSON.stringify({ rideId: activeRide.$id, driverId: user.$id }),
        false,
        '/',
        ExecutionMethod.POST,
      );
      toast('Trip started', 'success');
      await refreshActiveRide();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to start trip', 'error');
    } finally {
      setTripActionLoading(false);
    }
  }

  async function endTrip() {
    if (!activeRide || !user || tripActionLoading) return;

    setTripActionLoading(true);
    try {
      await functions.createExecution(
        FN.END_TRIP,
        JSON.stringify({
          rideId: activeRide.$id,
          driverId: user.$id,
          cashCollected: activeRide.payment_method === 'cash',
        }),
        false,
        '/',
        ExecutionMethod.POST,
      );
      toast('Trip completed', 'success');
      await refreshActiveRide();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to end trip', 'error');
    } finally {
      setTripActionLoading(false);
    }
  }

  return (
    <div className="relative h-dvh w-full overflow-hidden bg-surface">

      {/* Map background */}
      <div className="absolute inset-0 z-0 opacity-60">
        <RideMap center={[12.9716, 77.5946]} zoom={13} />
      </div>

      {/* Dark overlay when offline */}
      {!online && (
        <div className="absolute inset-0 z-10 bg-surface/70" />
      )}

      {/* Top bar */}
      <div className="absolute top-0 left-0 right-0 z-20 bg-gradient-to-b from-surface/90 to-transparent h-32 pointer-events-none" />
      <div className="absolute top-0 left-0 right-0 z-30 px-4 pt-5 flex items-center justify-between">
        <div>
          <p className="text-xs text-slate-400">Driver Mode</p>
          <p className="text-sm font-semibold text-white">{user?.name ?? 'Driver'}</p>
        </div>
        <button
          onClick={logout}
          className="text-xs text-slate-400 hover:text-white transition-colors border border-white/10 rounded-lg px-3 py-1.5"
        >
          Sign out
        </button>
      </div>

      {/* Main bottom panel */}
      <div className="absolute bottom-0 left-0 right-0 z-30">
        <div className="bg-surface-card rounded-t-[1.5rem] border-t border-white/10 shadow-2xl px-4 pt-3 pb-8">
          <div className="flex justify-center mb-3">
            <div className="w-10 h-1 rounded-full bg-white/20" />
          </div>

          {/* Online toggle */}
          <div className="flex items-center justify-between mb-5 bg-white/4 rounded-2xl px-4 py-3 border border-white/8">
            <div>
              <p className="font-semibold text-white">{online ? 'You are online' : 'You are offline'}</p>
              <p className="text-xs text-slate-400">
                {online ? 'Accepting ride requests' : 'Go online to start earning'}
              </p>
            </div>
            <button
              onClick={online ? goOffline : goOnline}
              disabled={availabilityLoading}
              aria-label={online ? 'Go offline' : 'Go online'}
              title={online ? 'Go offline' : 'Go online'}
              className={[
                'relative w-14 h-7 rounded-full transition-colors duration-300 disabled:opacity-60',
                online ? 'bg-success' : 'bg-white/15',
              ].join(' ')}
            >
              <motion.div
                animate={{ x: online ? 28 : 2 }}
                transition={{ type: 'spring', damping: 22, stiffness: 300 }}
                className="absolute top-[3px] w-[22px] h-[22px] rounded-full bg-white shadow-md"
              />
            </button>
          </div>

          {/* Earnings row */}
          <div className="grid grid-cols-3 gap-2.5 mb-5">
            {[
              { icon: TrendingUp, label: "Today's earnings", value: formatFare(earnings.today), color: 'text-success' },
              { icon: Clock, label: 'Trips', value: String(earnings.trips), color: 'text-brand' },
              { icon: Star, label: 'Rating', value: earnings.rating.toFixed(1), color: 'text-warning' },
            ].map(({ icon: Icon, label, value, color }) => (
              <div key={label} className="bg-white/4 border border-white/8 rounded-2xl p-3 text-center">
                <Icon size={15} className={`${color} mx-auto mb-1`} />
                <p className={`text-base font-black ${color}`}>{value}</p>
                <p className="text-[10px] text-slate-500 leading-tight mt-0.5">{label}</p>
              </div>
            ))}
          </div>

          {!online && (
            <Button fullWidth size="lg" variant="success" onClick={goOnline} loading={availabilityLoading}>
              Go Online
            </Button>
          )}
          {activeRide && (
            <div className="mb-4 rounded-3xl border border-brand/20 bg-brand/10 p-4">
              <div className="mb-3 flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-wide text-brand">Active ride</p>
                  <p className="text-lg font-bold text-white">{activeRide.rider_name || 'Current rider'}</p>
                  <p className="text-sm text-slate-400">{activeRide.pickup_address}</p>
                  <p className="text-sm text-slate-500">to {activeRide.dropoff_address}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-slate-500">Fare</p>
                  <p className="text-xl font-black text-white">
                    {formatFare(activeRide.final_fare ?? activeRide.estimated_fare ?? 0)}
                  </p>
                </div>
              </div>
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>Status: {activeRide.status.replace('_', ' ')}</span>
                <span>{activeRide.vehicle_type}</span>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3">
                {activeRide.status !== 'in_progress' ? (
                  <Button fullWidth variant="success" onClick={startTrip} loading={tripActionLoading}>
                    Start trip
                  </Button>
                ) : (
                  <Button fullWidth variant="success" onClick={endTrip} loading={tripActionLoading}>
                    {activeRide.payment_method === 'cash' ? 'Collect cash & end' : 'End trip'}
                  </Button>
                )}
                <Button fullWidth variant="secondary" icon={<Phone size={16} />} onClick={() => {}}>
                  Contact rider
                </Button>
              </div>
            </div>
          )}
          {online && !incoming && (
            <div className="flex items-center justify-center gap-2 py-3">
              <span className="flex gap-1">
                <span className="dot-1 w-2 h-2 rounded-full bg-brand" />
                <span className="dot-2 w-2 h-2 rounded-full bg-brand" />
                <span className="dot-3 w-2 h-2 rounded-full bg-brand" />
              </span>
              <p className="text-slate-400 text-sm">Looking for rides near you…</p>
            </div>
          )}
        </div>
      </div>

      {/* Incoming ride offer modal */}
      <AnimatePresence>
        {incoming && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.88, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: 'spring', damping: 22, stiffness: 280 }}
              className="w-full max-w-sm bg-surface-card rounded-3xl border border-white/15 shadow-2xl overflow-hidden"
            >
              {/* Header */}
              <div className="bg-brand/20 border-b border-brand/20 px-5 py-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-brand animate-pulse" />
                  <span className="text-sm font-semibold text-brand">New Ride Request!</span>
                </div>
                {/* Countdown ring (visual only) */}
                <div className="text-2xl font-black text-white">15</div>
              </div>

              <div className="p-5">
                {/* Rider */}
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 rounded-full bg-brand/20 border border-brand/30 flex items-center justify-center text-xl">
                    👤
                  </div>
                  <div className="flex-1">
                    <p className="font-bold text-white">{incoming.riderName}</p>
                    <div className="flex items-center gap-1">
                      <Star size={11} className="fill-warning text-warning" />
                      <span className="text-xs text-slate-400">4.6 · 23 trips</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-black text-success">{formatFare(incoming.fare)}</p>
                    <p className="text-xs text-slate-400">{incoming.vehicleType}</p>
                  </div>
                </div>

                {/* Route */}
                <div className="bg-white/4 rounded-2xl p-3 border border-white/8 mb-5">
                  <div className="flex items-stretch gap-2.5">
                    <div className="flex flex-col items-center gap-0.5 pt-1.5">
                      <div className="w-2.5 h-2.5 rounded-full bg-brand" />
                      <div className="w-px flex-1 bg-white/20 my-0.5" />
                      <div className="w-2.5 h-2.5 rounded bg-white/60" />
                    </div>
                    <div className="flex flex-col gap-3 flex-1 min-w-0">
                      <div>
                        <p className="text-[10px] text-slate-500 uppercase tracking-wide font-medium">Pickup</p>
                        <p className="text-sm text-white font-medium truncate">{incoming.pickup}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-slate-500 uppercase tracking-wide font-medium">Drop-off</p>
                        <p className="text-sm text-white font-medium truncate">{incoming.dropoff}</p>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 mt-3 pt-2.5 border-t border-white/8 text-sm text-slate-400">
                    <span className="flex items-center gap-1">
                      <MapPin size={12} className="text-brand" />
                      {incoming.distanceKm} km
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock size={12} />
                      ~{incoming.durationMin} min
                    </span>
                  </div>
                </div>

                {/* Actions */}
                <div className="grid grid-cols-2 gap-3">
                  <Button variant="secondary" size="md" icon={<X size={16} />} onClick={declineRide} fullWidth>
                    Decline
                  </Button>
                  <Button variant="success" size="md" icon={<Check size={16} />} onClick={acceptRide} loading={accepting} fullWidth>
                    Accept
                  </Button>
                </div>

                <button
                  onClick={() => {}}
                  className="mt-3 w-full flex items-center justify-center gap-2 text-slate-400 hover:text-white text-sm transition-colors py-1"
                >
                  <Phone size={13} />
                  Call rider
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
