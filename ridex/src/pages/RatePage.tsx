// src/pages/RatePage.tsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ExecutionMethod } from 'appwrite';
import { CheckCircle, MessageSquare } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { StarRating } from '../components/ui/StarRating';
import { useRide } from '../contexts/RideContext';
import { useToast } from '../components/ui/Toast';
import { formatFare } from '../lib/fare';
import { functions, FN } from '../lib/appwrite';

const quickTags = [
  'Great driving', 'On time', 'Clean vehicle', 'Friendly', 'Safe ride',
  'Smooth trip', 'Professional', 'Would ride again',
];

export default function RatePage() {
  const { ride, clearRide } = useRide();
  const nav = useNavigate();
  const toast = useToast();
  const [rating, setRating] = useState(0);
  const [tags, setTags] = useState<string[]>([]);
  const [comment, setComment] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  function toggleTag(t: string) {
    setTags(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]);
  }

  async function submit() {
    if (rating === 0 || !ride) return;
    setLoading(true);
    try {
      await functions.createExecution(
        FN.SUBMIT_RATING,
        JSON.stringify({
          rideId:  ride.rideId,
          rating,
          comment: comment.trim(),
          tags,
        }),
        false,
        '/',
        ExecutionMethod.POST,
      );
      setSubmitted(true);
      setTimeout(() => {
        clearRide();
        nav('/home', { replace: true });
      }, 2000);
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to submit rating', 'error');
      setLoading(false);
    }
  }

  if (submitted) {
    return (
      <div className="min-h-dvh bg-surface flex flex-col items-center justify-center px-6 text-center">
        <motion.div
          initial={{ scale: 0.7, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', damping: 18, stiffness: 260 }}
        >
          <CheckCircle size={72} className="text-success mx-auto mb-5" />
          <h2 className="text-2xl font-black text-white mb-2">Thanks for your feedback!</h2>
          <p className="text-slate-400">Redirecting you home…</p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-surface text-white flex flex-col px-5 pt-10 pb-8">

      {/* Summary card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-surface-card border border-white/10 rounded-3xl p-5 mb-8 text-center"
      >
        <div className="w-16 h-16 rounded-2xl bg-brand/20 border border-brand/30 flex items-center justify-center text-3xl mx-auto mb-3">
          {ride?.driver?.photoUrl ? (
            <img src={ride.driver.photoUrl} alt="" className="w-full h-full rounded-2xl object-cover" />
          ) : '👤'}
        </div>
        <p className="font-bold text-white text-base">{ride?.driver?.name ?? 'Your Driver'}</p>
        <p className="text-sm text-slate-400 mb-3">{ride?.driver?.vehicle ?? ride?.vehicleType}</p>
        <div className="flex items-center justify-center gap-6 text-sm">
          <div>
            <p className="font-black text-white text-lg">{formatFare(ride?.fare ?? 0)}</p>
            <p className="text-xs text-slate-500">Fare</p>
          </div>
          <div className="w-px h-8 bg-white/10" />
          <div>
            <p className="font-black text-white text-lg">
              {ride?.vehicleType ? ride.vehicleType.charAt(0).toUpperCase() + ride.vehicleType.slice(1) : '—'}
            </p>
            <p className="text-xs text-slate-500">Vehicle</p>
          </div>
        </div>
      </motion.div>

      {/* Rating */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="text-center mb-6"
      >
        <h2 className="text-xl font-bold text-white mb-1">How was your ride?</h2>
        <p className="text-slate-400 text-sm mb-5">Rate your experience with {ride?.driver?.name?.split(' ')[0] ?? 'the driver'}</p>
        <div className="flex justify-center">
          <StarRating value={rating} onChange={setRating} size={40} />
        </div>
        {rating > 0 && (
          <motion.p
            key={rating}
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-sm text-slate-400 mt-2"
          >
            {['', 'Terrible 😤', 'Bad 😕', 'Okay 😐', 'Good 😊', 'Excellent! 🤩'][rating]}
          </motion.p>
        )}
      </motion.div>

      {/* Quick tags */}
      {rating >= 4 && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="mb-5"
        >
          <p className="text-sm text-slate-400 mb-2.5">What did you like?</p>
          <div className="flex flex-wrap gap-2">
            {quickTags.map(t => (
              <button
                key={t}
                onClick={() => toggleTag(t)}
                className={[
                  'px-3 py-1.5 rounded-full text-xs font-medium border transition-all',
                  tags.includes(t)
                    ? 'bg-brand border-brand text-white'
                    : 'bg-white/5 border-white/10 text-slate-400 hover:border-white/25',
                ].join(' ')}
              >
                {t}
              </button>
            ))}
          </div>
        </motion.div>
      )}

      {/* Comment */}
      <div className="mb-6">
        <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-2xl px-4 py-3">
          <MessageSquare size={15} className="text-slate-500 shrink-0" />
          <textarea
            value={comment}
            onChange={e => setComment(e.target.value)}
            placeholder="Add a comment… (optional)"
            rows={2}
            className="flex-1 bg-transparent text-sm text-white placeholder:text-slate-500 outline-none resize-none"
          />
        </div>
      </div>

      <Button
        fullWidth
        size="lg"
        loading={loading}
        onClick={submit}
        disabled={rating === 0}
      >
        Submit Rating
      </Button>

      <button
        onClick={() => { clearRide(); nav('/home', { replace: true }); }}
        className="mt-4 text-center text-sm text-slate-500 hover:text-slate-300 transition-colors w-full"
      >
        Skip for now
      </button>
    </div>
  );
}
