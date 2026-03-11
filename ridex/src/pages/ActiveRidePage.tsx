// src/pages/ActiveRidePage.tsx
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ExecutionMethod } from 'appwrite';
import { Phone, MessageSquare, Share2, AlertTriangle, ChevronDown, Star, Navigation } from 'lucide-react';
import { RideMap } from '../components/map/RideMap';
import { Button } from '../components/ui/Button';
import { useRide } from '../contexts/RideContext';
import { useRideRealtime } from '../hooks/useRideRealtime';
import { useToast } from '../components/ui/Toast';
import { formatFare } from '../lib/fare';
import { functions, tablesDB, DB_ID, TABLE, FN } from '../lib/appwrite';
import { useGeolocation } from '../hooks/useGeolocation';

const STATUS_LABELS: Record<string, { label: string; sub: string; color: string }> = {
  searching: {
    label: 'Finding your driver…',
    sub: 'We are matching you with the nearest driver',
    color: 'text-warning',
  },
  driver_assigned: {
    label: 'Driver assigned!',
    sub: 'Driver is on the way to pick you up',
    color: 'text-success',
  },
  driver_arriving: {
    label: 'Driver is arriving',
    sub: 'Your driver is almost here',
    color: 'text-brand',
  },
  in_progress: {
    label: 'On your way 🎉',
    sub: 'Sit back and enjoy the ride',
    color: 'text-success',
  },
  completed: {
    label: 'Ride completed',
    sub: 'Hope you had a great experience',
    color: 'text-success',
  },
};

export default function ActiveRidePage() {
  const { ride, clearRide } = useRide();
  const nav = useNavigate();
  const toast = useToast();
  const { lat, lng } = useGeolocation();
  const [showSosConfirm, setShowSosConfirm] = useState(false);
  const [sosSending, setSosSending] = useState(false);
  const [panelOpen, setPanelOpen] = useState(true);
  const [cancelling, setCancelling] = useState(false);

  useRideRealtime(ride?.rideId ?? null);

  useEffect(() => {
    if (!ride || ride.status !== 'searching') {
      return;
    }

    const interval = window.setInterval(() => {
      void functions.createExecution(
        FN.MATCH_DRIVER,
        JSON.stringify({ rideId: ride.rideId }),
        false,
        '/',
        ExecutionMethod.POST,
      ).catch(() => {
        // Retry silently while the rider is on the active searching screen.
      });
    }, 20_000);

    return () => {
      window.clearInterval(interval);
    };
  }, [ride]);

  // If no active ride, go home
  useEffect(() => {
    if (!ride) nav('/home', { replace: true });
  }, [ride, nav]);

  // On completion, go to rating
  useEffect(() => {
    if (ride?.status === 'completed') {
      setTimeout(() => nav('/rate'), 1800);
    }
  }, [ride?.status, nav]);

  async function sendSos() {
    if (!ride || sosSending) return;
    setSosSending(true);
    try {
      const execution = await functions.createExecution(
        FN.SEND_SOS,
        JSON.stringify({ rideId: ride.rideId, lat: lat ?? null, lng: lng ?? null }),
        false,
        '/',
        ExecutionMethod.POST,
      );

      const response = JSON.parse(execution.responseBody || '{}') as {
        ok?: boolean;
        message?: string;
        contactsNotified?: number;
      };

      if (!response.ok) {
        throw new Error(response.message || 'SOS could not be sent');
      }

      const notifiedCount = response.contactsNotified ?? 0;
      toast(
        notifiedCount > 0
          ? `SOS alert sent. ${notifiedCount} emergency contact${notifiedCount === 1 ? '' : 's'} notified.`
          : (response.message || 'SOS alert sent. Help is on the way.'),
        'success',
      );
    } catch {
      toast('Failed to send SOS. Please call 112 directly.', 'error');
    } finally {
      setSosSending(false);
      setShowSosConfirm(false);
    }
  }

  async function cancelRide() {
    if (!ride || cancelling) return;
    setCancelling(true);
    try {
      await tablesDB.updateRow({
        databaseId: DB_ID,
        tableId: TABLE.RIDES,
        rowId: ride.rideId,
        data: { status: 'cancelled' },
      });
    } catch {
      // Best-effort — still clear locally
    } finally {
      clearRide();
      nav('/home');
    }
  }

  if (!ride) return null;

  const currentRide = ride;

  const statusInfo = STATUS_LABELS[currentRide.status] ?? STATUS_LABELS.searching;
  const navigationTarget = currentRide.status === 'in_progress' || !currentRide.driver
    ? currentRide.dropoff
    : { lat: currentRide.driver.lat, lng: currentRide.driver.lng, address: currentRide.driver.vehicle };

  async function shareTrip() {
    const details = [
      'RideX live trip',
      `Status: ${statusInfo.label}`,
      `Pickup: ${currentRide.pickup.address}`,
      `Drop-off: ${currentRide.dropoff.address}`,
      currentRide.driver ? `Driver: ${currentRide.driver.name} (${currentRide.driver.vehicle} · ${currentRide.driver.plate})` : 'Driver: matching in progress',
      `Ride ID: ${currentRide.rideId}`,
    ].join('\n');

    try {
      if (navigator.share) {
        await navigator.share({
          title: 'RideX trip details',
          text: details,
        });
        return;
      }

      await navigator.clipboard.writeText(details);
      toast('Trip details copied to clipboard.', 'success');
    } catch {
      toast('Unable to share trip details.', 'error');
    }
  }

  function openNavigation() {
    const url = new URL('https://www.google.com/maps/dir/');
    url.searchParams.set('api', '1');
    url.searchParams.set('destination', `${navigationTarget.lat},${navigationTarget.lng}`);
    window.open(url.toString(), '_blank', 'noopener,noreferrer');
  }

  function messageDriver() {
    if (!currentRide.driver) return;

    const smsBody = encodeURIComponent(`Hi ${currentRide.driver.name}, I am waiting for RideX trip ${currentRide.rideId}.`);
    window.open(`sms:${currentRide.driver.phone}?body=${smsBody}`, '_self');
  }

  const mapCenter: [number, number] = currentRide.driver
    ? [currentRide.driver.lat, currentRide.driver.lng]
    : [currentRide.pickup.lat, currentRide.pickup.lng];

  return (
    <div className="relative h-dvh w-full overflow-hidden bg-surface">

      {/* Map */}
      <div className="absolute inset-0 z-0">
        <RideMap
          center={mapCenter}
          zoom={15}
          pickup={currentRide.status !== 'in_progress' ? currentRide.pickup : undefined}
          dropoff={currentRide.dropoff}
          driver={currentRide.driver}
        />
      </div>

      {/* Top overlay: status badge */}
      <div className="absolute top-0 left-0 right-0 z-20 bg-gradient-to-b from-surface/90 to-transparent pointer-events-none h-36" />
      <div className="absolute top-5 left-0 right-0 z-30 flex justify-center px-4">
        <motion.div
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="bg-surface-card/90 backdrop-blur-md border border-white/10 rounded-2xl px-5 py-3 flex items-center gap-3 shadow-xl"
        >
          {currentRide.status === 'searching' ? (
            <span className="flex gap-1">
              <span className="dot-1 w-2 h-2 rounded-full bg-warning" />
              <span className="dot-2 w-2 h-2 rounded-full bg-warning" />
              <span className="dot-3 w-2 h-2 rounded-full bg-warning" />
            </span>
          ) : (
            <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
          )}
          <span className={`text-sm font-semibold ${statusInfo.color}`}>
            {statusInfo.label}
          </span>
        </motion.div>
      </div>

      {/* SOS button */}
      <button
        onClick={() => setShowSosConfirm(true)}
        className="sos-btn absolute top-5 right-4 z-30 w-12 h-12 rounded-full bg-danger flex items-center justify-center shadow-lg text-white font-bold text-xs"
      >
        SOS
      </button>

      {/* Share / navigate */}
      <div className="absolute right-4 top-20 z-30 flex flex-col gap-2">
        {[
          { icon: Share2, label: 'Share', action: shareTrip },
          { icon: Navigation, label: 'Nav', action: openNavigation },
        ].map(({ icon: Icon, label, action }) => (
          <button
            key={label}
            onClick={action}
            title={label}
            className="w-11 h-11 rounded-full bg-surface-card border border-white/10 flex items-center justify-center text-slate-300 hover:text-white shadow-lg transition-colors"
            aria-label={label}
          >
            <Icon size={17} />
          </button>
        ))}
      </div>

      {/* Bottom panel */}
      <div className="absolute bottom-0 left-0 right-0 z-30">
        <div className="bg-surface-card rounded-t-[1.5rem] border-t border-white/10 shadow-2xl">
          <button
            className="flex w-full justify-center pt-3 pb-1"
            onClick={() => setPanelOpen(o => !o)}
            aria-label={panelOpen ? 'Collapse ride details' : 'Expand ride details'}
            title={panelOpen ? 'Collapse ride details' : 'Expand ride details'}
          >
            <div className="w-10 h-1 rounded-full bg-white/20" />
          </button>

          <AnimatePresence initial={false}>
            {panelOpen && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.22 }}
                className="overflow-hidden"
              >
                <div className="px-4 pb-8">
                  {/* Driver card */}
                  {currentRide.driver ? (
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-14 h-14 rounded-2xl bg-brand/20 border border-brand/30 flex items-center justify-center text-2xl shrink-0">
                        {currentRide.driver.photoUrl
                          ? <img src={currentRide.driver.photoUrl} alt={currentRide.driver.name} className="w-full h-full object-cover rounded-2xl" />
                          : '👤'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-white">{currentRide.driver.name}</p>
                        <p className="text-sm text-slate-400">{currentRide.driver.vehicle} · {currentRide.driver.plate}</p>
                        <div className="flex items-center gap-1 mt-0.5">
                          <Star size={12} className="fill-warning text-warning" />
                          <span className="text-xs text-slate-300">{currentRide.driver.rating.toFixed(1)}</span>
                        </div>
                      </div>
                      <div className="text-right">
                        {currentRide.driver.eta > 0 && (
                          <div className="bg-brand/15 border border-brand/30 rounded-xl px-3 py-1.5 text-center">
                            <p className="text-2xl font-black text-white leading-tight">{currentRide.driver.eta}</p>
                            <p className="text-[10px] text-brand">min</p>
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3 mb-4 animate-pulse">
                      <div className="w-14 h-14 rounded-2xl skeleton shrink-0" />
                      <div className="flex-1 space-y-2">
                        <div className="h-4 skeleton rounded-lg w-32" />
                        <div className="h-3 skeleton rounded-lg w-24" />
                      </div>
                    </div>
                  )}

                  {/* Fare + OTP */}
                  <div className="flex gap-3 mb-4">
                    <div className="flex-1 bg-white/4 rounded-2xl p-3 border border-white/8">
                      <p className="text-xs text-slate-400 mb-0.5">Estimated fare</p>
                      <p className="text-xl font-black text-white">{formatFare(currentRide.fare)}</p>
                    </div>
                    {currentRide.otp && (
                      <div className="flex-1 bg-brand/10 rounded-2xl p-3 border border-brand/30">
                        <p className="text-xs text-brand mb-0.5">Share OTP</p>
                        <p className="text-xl font-black text-white tracking-widest">{currentRide.otp}</p>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  {currentRide.driver && (
                    <div className="flex gap-3">
                      <Button
                        variant="secondary"
                        size="md"
                        fullWidth
                        icon={<Phone size={16} />}
                        onClick={() => currentRide.driver && window.open(`tel:${currentRide.driver.phone}`)}
                      >
                        Call
                      </Button>
                      <Button
                        variant="secondary"
                        size="md"
                        fullWidth
                        icon={<MessageSquare size={16} />}
                        onClick={messageDriver}
                      >
                        Message
                      </Button>
                    </div>
                  )}

                  {currentRide.status === 'searching' && (
                    <Button
                      variant="ghost"
                      size="sm"
                      fullWidth
                      className="mt-3 text-slate-400"
                      icon={<ChevronDown size={14} />}
                      loading={cancelling}
                      onClick={cancelRide}
                    >
                      Cancel ride
                    </Button>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* SOS confirm modal */}
      <AnimatePresence>
        {showSosConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-end"
            onClick={() => setShowSosConfirm(false)}
          >
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 26, stiffness: 280 }}
              className="w-full bg-surface-card rounded-t-[1.5rem] border-t border-danger/30 p-6"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-full bg-danger/20 border border-danger/30 flex items-center justify-center">
                  <AlertTriangle size={22} className="text-danger" />
                </div>
                <div>
                  <h3 className="font-bold text-white">Emergency SOS</h3>
                  <p className="text-sm text-slate-400">Alert will notify emergency contacts and police</p>
                </div>
              </div>
              <Button fullWidth size="lg" variant="danger" className="mb-3" loading={sosSending} onClick={sendSos}>
                🚨 Send SOS Alert
              </Button>
              <Button fullWidth size="md" variant="ghost" onClick={() => setShowSosConfirm(false)}>
                Cancel
              </Button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
