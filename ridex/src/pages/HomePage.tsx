import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { BadgePercent, CreditCard, MapPin, Navigation, ChevronDown, Clock, Search } from 'lucide-react';
import { ExecutionMethod, Query } from 'appwrite';
import { RideMap } from '../components/map/RideMap';
import { VehicleCard } from '../components/ui/VehicleCard';
import { SearchBox } from '../components/ui/SearchBox';
import { Button } from '../components/ui/Button';
import { useRide, type PaymentMethod } from '../contexts/RideContext';
import { useGeolocation } from '../hooks/useGeolocation';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../components/ui/Toast';
import { estimateFares, haversineKm, type FareEstimate } from '../lib/fare';
import { reverseGeocode, shortName, type NominatimResult } from '../lib/nominatim';
import { getDrivingRoute, type RouteSummary } from '../lib/osrm';
import { clearPendingBooking, savePendingBooking, type PendingBooking } from '../lib/booking';
import { functions, tablesDB, DB_ID, TABLE, FN } from '../lib/appwrite';

type BookingStep = 'search' | 'pick-vehicle' | 'confirming';

export default function HomePage() {
  const { user, profile } = useAuth();
  const { lat, lng } = useGeolocation();
  const {
    pickup, dropoff, selectedVehicle,
    setPickup, setDropoff, setSelectedVehicle, startRide,
  } = useRide();

  const [step, setStep] = useState<BookingStep>('search');
  const [pickupText, setPickupText] = useState('');
  const [dropoffText, setDropoffText] = useState('');
  const [searchFocused, setSearchFocused] = useState<'pickup' | 'dropoff' | null>(null);
  const [fares, setFares] = useState<FareEstimate[]>([]);
  const [routeSummary, setRouteSummary] = useState<RouteSummary | null>(null);
  const [booking, setBooking] = useState(false);
  const [bookingRequestId, setBookingRequestId] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [promoCode, setPromoCode] = useState('');
  const [promoApplying, setPromoApplying] = useState(false);
  const [promoResult, setPromoResult] = useState<{ promoCode: string; discount: number; discountedFare: number } | null>(null);

  const nav = useNavigate();
  const toast = useToast();

  const myLocation = lat && lng ? { lat, lng } : null;
  const selectedFare = fares.find(f => f.vehicleType === selectedVehicle);
  const baseFare = selectedFare?.fareMin ?? 0;
  const payableFare = promoResult?.discountedFare ?? baseFare;

  useEffect(() => {
    if (!user || !profile?.preferred_payment_method_id) return;

    const currentUser = user;
    const preferredPaymentMethodId = profile.preferred_payment_method_id;

    let active = true;

    async function applyPreferredMethod() {
      try {
        const methods = await tablesDB.listRows({
          databaseId: DB_ID,
          tableId: TABLE.PAYMENT_METHODS,
          queries: [
            Query.equal('$id', preferredPaymentMethodId),
            Query.equal('user_id', currentUser.$id),
            Query.limit(1),
          ],
        });

        const preferred = methods.rows[0];
        if (!active || !preferred || !preferred.is_active) return;

        if (preferred.type === 'cash') {
          setPaymentMethod('cash');
          return;
        }

        if (preferred.type === 'stripe_test_card') {
          setPaymentMethod('stripe_test');
        }
      } catch {
        // Ignore preference lookup failures on home screen.
      }
    }

    void applyPreferredMethod();

    return () => {
      active = false;
    };
  }, [profile?.preferred_payment_method_id, user]);

  useEffect(() => {
    setBookingRequestId(null);
  }, [pickup, dropoff, selectedVehicle, paymentMethod, promoResult?.promoCode]);

  function getBookingPayload(requestId: string): PendingBooking | null {
    if (!pickup || !dropoff) return null;

    return {
      requestId,
      pickup,
      dropoff,
      vehicleType: selectedVehicle,
      estimatedFare: payableFare,
      routeDistanceKm: routeSummary?.distanceKm ?? null,
      routeDurationMin: routeSummary?.durationMin ?? null,
      paymentMethod,
      promoCode: promoResult?.promoCode ?? null,
      discountAmount: promoResult?.discount ?? 0,
    };
  }

  async function refreshRoute(nextPickup = pickup, nextDropoff = dropoff) {
    if (!nextPickup || !nextDropoff) return;

    try {
      const route = await getDrivingRoute(nextPickup, nextDropoff);
      setRouteSummary(route);
      setFares(estimateFares(route.distanceKm, route.durationMin));
      setPromoResult(null);
      setStep('pick-vehicle');
    } catch {
      const distKm = haversineKm(nextPickup.lat, nextPickup.lng, nextDropoff.lat, nextDropoff.lng);
      const durationMin = Math.max(1, Math.round((distKm / 25) * 60));
      setRouteSummary({ distanceKm: distKm, durationMin, coordinates: [] });
      setFares(estimateFares(distKm, durationMin));
      setPromoResult(null);
      setStep('pick-vehicle');
      toast('Road route unavailable. Using straight-line estimate.', 'info');
    }
  }

  async function applyPromoCode() {
    if (!promoCode.trim() || baseFare <= 0 || promoApplying) return;

    setPromoApplying(true);
    try {
      const execution = await functions.createExecution(
        FN.APPLY_PROMO,
        JSON.stringify({ promoCode: promoCode.trim(), fare: baseFare }),
        false,
        '/',
        ExecutionMethod.POST,
      );

      const response = JSON.parse(execution.responseBody || '{}') as {
        ok?: boolean;
        message?: string;
        promoCode?: string;
        discount?: number;
        discountedFare?: number;
      };

      if (!response.ok || typeof response.discount !== 'number' || typeof response.discountedFare !== 'number') {
        throw new Error(response.message || 'Promo code could not be applied');
      }

      setPromoResult({
        promoCode: response.promoCode ?? promoCode.trim().toUpperCase(),
        discount: response.discount,
        discountedFare: response.discountedFare,
      });
      toast(`Promo applied. You saved ₹${response.discount.toFixed(0)}.`, 'success');
    } catch (err) {
      setPromoResult(null);
      toast(err instanceof Error ? err.message : 'Failed to apply promo code', 'error');
    } finally {
      setPromoApplying(false);
    }
  }

  // Use my GPS as pickup by default
  async function resolveMyLocation() {
    if (!lat || !lng) { toast('Enable location to use current position', 'info'); return; }
    const address = await reverseGeocode(lat, lng);
    const nextPickup = { lat, lng, address };
    setPickup(nextPickup);
    setPickupText(address.split(',').slice(0, 2).join(','));
    if (dropoff) {
      void refreshRoute(nextPickup, dropoff);
    }
  }

  function handlePickupSelect(r: NominatimResult) {
    const nextPickup = { lat: parseFloat(r.lat), lng: parseFloat(r.lon), address: r.display_name };
    setPickup(nextPickup);
    setPickupText(shortName(r));
    setSearchFocused(null);
    if (dropoff) {
      void refreshRoute(nextPickup, dropoff);
    }
  }

  function handleDropoffSelect(r: NominatimResult) {
    const nextDropoff = { lat: parseFloat(r.lat), lng: parseFloat(r.lon), address: r.display_name };
    setDropoff(nextDropoff);
    setDropoffText(shortName(r));
    setSearchFocused(null);

    if (pickup) {
      void refreshRoute(pickup, nextDropoff);
    }
  }

  function handleVehicleSelect(nextVehicle: FareEstimate['vehicleType']) {
    setSelectedVehicle(nextVehicle);
    setPromoResult(null);
  }

  async function confirmRide() {
    if (!pickup || !dropoff || !user) return;
    setBooking(true);

    const requestId = bookingRequestId ?? crypto.randomUUID();
    if (!bookingRequestId) {
      setBookingRequestId(requestId);
    }

    const bookingPayload = getBookingPayload(requestId);
    if (!bookingPayload) {
      setBooking(false);
      return;
    }

    try {
      if (paymentMethod === 'stripe_test') {
        savePendingBooking(bookingPayload);

        const execution = await functions.createExecution(
          FN.CREATE_STRIPE_CHECKOUT,
          JSON.stringify({
            baseUrl: window.location.origin,
            riderEmail: user.email,
            booking: bookingPayload,
          }),
          false,
          '/',
          ExecutionMethod.POST,
        );

        const response = JSON.parse(execution.responseBody || '{}') as {
          ok?: boolean;
          message?: string;
          url?: string;
        };

        if (!response.ok || !response.url) {
          throw new Error(response.message || 'Stripe checkout could not be created');
        }

        window.location.href = response.url;
        return;
      }

      const execution = await functions.createExecution(
        FN.CREATE_CASH_BOOKING,
        JSON.stringify({
          riderId: user.$id,
          riderName: user.name,
          booking: bookingPayload,
        }),
        false,
        '/',
        ExecutionMethod.POST,
      );

      const response = JSON.parse(execution.responseBody || '{}') as {
        ok?: boolean;
        message?: string;
        rideId?: string;
        status?: 'searching';
        estimatedFare?: number;
      };

      if (!response.ok || !response.rideId) {
        throw new Error(response.message || 'Ride could not be created');
      }

      startRide({
        rideId: response.rideId,
        status: response.status ?? 'searching',
        pickup,
        dropoff,
        vehicleType: selectedVehicle,
        fare: response.estimatedFare ?? bookingPayload.estimatedFare,
        paymentMethod: bookingPayload.paymentMethod,
        paymentStatus: 'pending',
      });
      clearPendingBooking();
      setBookingRequestId(null);
      nav('/ride');
    } catch (err: unknown) {
      if (paymentMethod === 'stripe_test') {
        clearPendingBooking();
      }
      toast(err instanceof Error ? err.message : 'Failed to book ride', 'error');
      setBooking(false);
    }
  }

  const mapCenter: [number, number] = myLocation
    ? [myLocation.lat, myLocation.lng]
    : [12.9716, 77.5946];

  return (
    <div className="relative h-dvh w-full overflow-hidden bg-surface">

      {/* Full-screen map */}
      <div className="absolute inset-0 z-0">
        <RideMap
          center={mapCenter}
          zoom={14}
          pickup={pickup ?? undefined}
          dropoff={dropoff ?? undefined}
          route={routeSummary?.coordinates}
        />
      </div>

      {/* Top gradient + user greeting */}
      <div className="absolute top-0 left-0 right-0 z-10 bg-gradient-to-b from-surface/80 to-transparent pointer-events-none h-28" />

      <div className="absolute top-0 left-0 right-0 z-20 px-4 pt-5 flex items-center justify-between">
        <div>
          <p className="text-xs text-slate-400">Good {greeting()},</p>
          <p className="text-sm font-semibold text-white">{user?.name?.split(' ')[0] ?? 'Rider'} 👋</p>
        </div>
        <button
          onClick={() => nav('/profile')}
          aria-label="Open profile"
          title="Open profile"
          className="w-10 h-10 rounded-full bg-brand flex items-center justify-center text-white font-bold text-sm border-2 border-white/20 shadow-lg"
        >
          {(user?.name?.[0] ?? 'R').toUpperCase()}
        </button>
      </div>

      {/* My location btn */}
      <button
        onClick={resolveMyLocation}
        aria-label="Use my location"
        title="Use my location"
        className="absolute bottom-80 right-4 z-20 w-11 h-11 rounded-full bg-surface-card border border-white/10 shadow-xl flex items-center justify-center"
      >
        <Navigation size={18} className="text-brand" />
      </button>

      {/* Bottom sheet: booking panel */}
      <div className="absolute bottom-0 left-0 right-0 z-30">
        <AnimatePresence mode="wait">

          {/* Step 1: Search */}
          {step === 'search' && (
            <motion.div
              key="search"
              initial={{ y: 60, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 60, opacity: 0 }}
              transition={{ type: 'spring', damping: 28, stiffness: 300 }}
              className="bg-surface-card rounded-t-[1.5rem] border-t border-white/10 px-4 pt-3 pb-8 shadow-2xl"
            >
              <div className="flex justify-center mb-3">
                <div className="w-10 h-1 rounded-full bg-white/20" />
              </div>

              <h2 className="text-base font-bold text-white mb-3 flex items-center gap-2">
                <Search size={16} className="text-brand" />
                Where to?
              </h2>

              {/* Pickup */}
              <div className="flex items-center gap-2 mb-2">
                <div className="flex flex-col items-center gap-1 py-0.5">
                  <div className="w-3 h-3 rounded-full bg-brand border-2 border-white/30" />
                  <div className="w-px h-5 bg-white/20" />
                  <div className="w-3 h-3 rounded bg-white/60" />
                </div>
                <div className="flex-1 flex flex-col gap-1.5">
                  <div className="relative">
                    <SearchBox
                      value={pickupText}
                      onChange={setPickupText}
                      onSelect={handlePickupSelect}
                      placeholder="Pickup location"
                      icon={<MapPin size={14} className="text-brand" />}
                      autoFocus={searchFocused === 'pickup'}
                    />
                    {!pickupText && (
                      <button
                        onClick={resolveMyLocation}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-brand font-medium"
                      >
                        Use GPS
                      </button>
                    )}
                  </div>
                  <SearchBox
                    value={dropoffText}
                    onChange={setDropoffText}
                    onSelect={handleDropoffSelect}
                    placeholder="Drop-off destination"
                    icon={<MapPin size={14} className="text-slate-400" />}
                    autoFocus={searchFocused === 'dropoff'}
                  />
                </div>
              </div>

              {/* Recent / Saved places */}
              <div className="mt-4">
                <p className="text-xs text-slate-500 mb-2 font-medium flex items-center gap-1.5">
                  <Clock size={11} />
                  Recent
                </p>
                <div className="flex flex-col gap-0.5">
                  {[
                    { icon: '🏢', name: 'Office', sub: 'Marathahalli Bridge, Bengaluru' },
                    { icon: '🏠', name: 'Home', sub: 'Koramangala 7th Block, Bengaluru' },
                  ].map(p => (
                    <button
                      key={p.name}
                      onClick={() => setDropoffText(p.name)}
                      className="flex items-center gap-3 py-2.5 px-2 rounded-xl hover:bg-white/5 text-left transition-colors"
                    >
                      <span className="text-xl w-8 text-center">{p.icon}</span>
                      <div>
                        <div className="text-sm font-medium text-white">{p.name}</div>
                        <div className="text-xs text-slate-500">{p.sub}</div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {/* Step 2: Pick vehicle */}
          {step === 'pick-vehicle' && (
            <motion.div
              key="vehicles"
              initial={{ y: 60, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 60, opacity: 0 }}
              transition={{ type: 'spring', damping: 28, stiffness: 300 }}
              className="bg-surface-card rounded-t-[1.5rem] border-t border-white/10 shadow-2xl"
            >
              <div className="flex justify-center pt-3 pb-0.5">
                <div className="w-10 h-1 rounded-full bg-white/20" />
              </div>
              <div className="px-4 pb-1">
                <div className="flex items-center justify-between py-2">
                  <button
                    onClick={() => setStep('search')}
                    className="flex items-center gap-1 text-slate-400 hover:text-white text-sm transition-colors"
                  >
                    <ChevronDown size={16} />
                    Change route
                  </button>
                  <div className="text-sm text-slate-400">
                    {routeSummary && (
                      <span className="font-medium text-white">
                        {routeSummary.distanceKm.toFixed(1)} km
                      </span>
                    )}
                    {' '}away
                  </div>
                </div>

                {/* Route summary */}
                <div className="flex items-stretch gap-2 mb-4 bg-white/4 rounded-2xl px-3 py-2.5 border border-white/8">
                  <div className="flex flex-col items-center gap-0.5 pt-1">
                    <div className="w-2 h-2 rounded-full bg-brand" />
                    <div className="w-px flex-1 bg-white/15 my-0.5" />
                    <div className="w-2 h-2 rounded bg-white/50" />
                  </div>
                  <div className="flex flex-col gap-1.5 flex-1 min-w-0">
                    <p className="text-xs text-slate-400 truncate">{pickupText || 'Pickup'}</p>
                    <p className="text-xs text-white font-medium truncate">{dropoffText || 'Destination'}</p>
                  </div>
                </div>

                {/* Vehicle list */}
                <div className="flex flex-col gap-2 max-h-64 overflow-y-auto">
                  {fares.map(f => (
                    <VehicleCard
                      key={f.vehicleType}
                      estimate={f}
                      selected={selectedVehicle === f.vehicleType}
                      onSelect={handleVehicleSelect}
                    />
                  ))}
                </div>

                <div className="mt-4 rounded-2xl border border-white/8 bg-white/4 p-3">
                  <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-white">
                    <CreditCard size={15} className="text-brand" />
                    Payment method
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { id: 'cash', label: 'Cash', sub: 'Pay at drop-off' },
                      { id: 'stripe_test', label: 'Stripe test', sub: 'Hosted checkout before booking' },
                    ].map((option) => (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => setPaymentMethod(option.id as PaymentMethod)}
                        className={[
                          'rounded-2xl border px-3 py-3 text-left transition-colors',
                          paymentMethod === option.id
                            ? 'border-brand bg-brand/12 text-white'
                            : 'border-white/10 bg-white/3 text-slate-300 hover:border-white/20',
                        ].join(' ')}
                      >
                        <p className="text-sm font-semibold">{option.label}</p>
                        <p className="mt-0.5 text-xs text-slate-400">{option.sub}</p>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="mt-4 rounded-2xl border border-white/8 bg-white/4 p-3">
                  <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-white">
                    <BadgePercent size={15} className="text-warning" />
                    Promo code
                  </div>
                  <div className="flex gap-2">
                    <input
                      value={promoCode}
                      onChange={(event) => setPromoCode(event.target.value.toUpperCase())}
                      placeholder="Enter code"
                      className="h-11 flex-1 rounded-xl border border-white/10 bg-surface px-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-brand"
                    />
                    <Button
                      type="button"
                      variant="secondary"
                      size="md"
                      onClick={applyPromoCode}
                      loading={promoApplying}
                      disabled={!promoCode.trim() || baseFare <= 0}
                    >
                      Apply
                    </Button>
                  </div>
                  {promoResult && (
                    <p className="mt-2 text-xs text-success">
                      {promoResult.promoCode} applied. Discount ₹{promoResult.discount.toFixed(0)}.
                    </p>
                  )}
                </div>

                <div className="mt-4 rounded-2xl border border-white/8 bg-surface px-4 py-3">
                  <div className="flex items-center justify-between text-sm text-slate-400">
                    <span>Ride estimate</span>
                    <span>{baseFare > 0 ? `₹${baseFare.toFixed(0)}` : '—'}</span>
                  </div>
                  {promoResult && (
                    <div className="mt-1 flex items-center justify-between text-sm text-success">
                      <span>Promo savings</span>
                      <span>-₹{promoResult.discount.toFixed(0)}</span>
                    </div>
                  )}
                  <div className="mt-2 flex items-center justify-between text-base font-bold text-white">
                    <span>Total payable</span>
                    <span>₹{payableFare.toFixed(0)}</span>
                  </div>
                </div>

                <div className="pt-3 pb-6">
                  <Button fullWidth size="lg" onClick={confirmRide} loading={booking}>
                    {paymentMethod === 'stripe_test'
                      ? 'Pay with Stripe →'
                      : `Book ${selectedVehicle.charAt(0).toUpperCase() + selectedVehicle.slice(1)} →`}
                  </Button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'morning';
  if (h < 17) return 'afternoon';
  return 'evening';
}
