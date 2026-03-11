import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { CheckCircle, LoaderCircle } from 'lucide-react';
import { ExecutionMethod } from 'appwrite';
import { Button } from '../components/ui/Button';
import { clearPendingBooking, getPendingBooking } from '../lib/booking';
import { functions, FN } from '../lib/appwrite';
import { useRide } from '../contexts/RideContext';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../components/ui/Toast';

export default function PaymentSuccessPage() {
  const [searchParams] = useSearchParams();
  const nav = useNavigate();
  const toast = useToast();
  const { user } = useAuth();
  const { startRide } = useRide();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const sessionId = searchParams.get('session_id');
    const pendingBooking = getPendingBooking();

    if (!sessionId || !pendingBooking || !user) {
      setError('Missing Stripe session or booking context.');
      return;
    }

    const booking = pendingBooking;
    const currentUser = user;

    let cancelled = false;

    async function completeBooking() {
      try {
        const execution = await functions.createExecution(
          FN.COMPLETE_STRIPE_BOOKING,
          JSON.stringify({
            sessionId,
            riderId: currentUser.$id,
            riderName: currentUser.name,
            booking,
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
          throw new Error(response.message || 'Stripe payment verification failed');
        }

        if (cancelled) return;

        startRide({
          rideId: response.rideId,
          status: response.status ?? 'searching',
          pickup: booking.pickup,
          dropoff: booking.dropoff,
          vehicleType: booking.vehicleType,
          fare: response.estimatedFare ?? booking.estimatedFare,
          paymentMethod: 'stripe_test',
          paymentStatus: 'paid',
        });
        clearPendingBooking();
        toast('Payment confirmed. Finding your driver now.', 'success');
        nav('/ride', { replace: true });
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Payment verification failed');
      }
    }

    void completeBooking();

    return () => {
      cancelled = true;
    };
  }, [nav, searchParams, startRide, toast, user]);

  return (
    <div className="min-h-dvh bg-surface flex flex-col items-center justify-center px-6 text-center text-white">
      {error ? (
        <>
          <CheckCircle size={72} className="mb-5 text-warning" />
          <h1 className="mb-2 text-2xl font-black">Payment needs attention</h1>
          <p className="mb-6 max-w-sm text-sm text-slate-400">{error}</p>
          <Button size="lg" onClick={() => nav('/home', { replace: true })}>Back to booking</Button>
        </>
      ) : (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          <LoaderCircle size={64} className="mx-auto mb-5 animate-spin text-brand" />
          <h1 className="mb-2 text-2xl font-black">Confirming payment</h1>
          <p className="text-sm text-slate-400">Stripe checkout completed. We are creating your ride.</p>
        </motion.div>
      )}
    </div>
  );
}