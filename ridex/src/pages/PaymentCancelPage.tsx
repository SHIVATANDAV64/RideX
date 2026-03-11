import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { XCircle } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { clearPendingBooking } from '../lib/booking';

export default function PaymentCancelPage() {
  const nav = useNavigate();

  useEffect(() => {
    clearPendingBooking();
  }, []);

  return (
    <div className="min-h-dvh bg-surface flex flex-col items-center justify-center px-6 text-center text-white">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
        <XCircle size={72} className="mx-auto mb-5 text-danger" />
        <h1 className="mb-2 text-2xl font-black">Payment cancelled</h1>
        <p className="mb-6 max-w-sm text-sm text-slate-400">
          Stripe checkout was cancelled, so your booking was not created.
        </p>
        <Button size="lg" onClick={() => nav('/home', { replace: true })}>Back to booking</Button>
      </motion.div>
    </div>
  );
}