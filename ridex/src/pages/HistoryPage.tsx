// src/pages/HistoryPage.tsx
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Star, MapPin, Filter } from 'lucide-react';
import { tablesDB, DB_ID, TABLE } from '../lib/appwrite';
import { useAuth } from '../contexts/AuthContext';
import { formatFare } from '../lib/fare';
import { Query } from 'appwrite';
import type { Models } from 'appwrite';

type RideDoc = Models.Row & {
  rider_id: string;
  pickup_address: string;
  dropoff_address: string;
  estimated_fare: number;
  final_fare?: number | null;
  status: string;
  vehicle_type: string;
  payment_method?: string;
  payment_status?: string;
  $createdAt: string;
  rating?: number;
};

const VEHICLE_EMOJI: Record<string, string> = {
  bike: '🏍️', auto: '🛺', mini: '🚗', sedan: '🚙', prime: '🚘',
};

const STATUS_COLOR: Record<string, string> = {
  completed: 'text-success bg-success/10',
  cancelled: 'text-danger bg-danger/10',
  in_progress: 'text-brand bg-brand/10',
};

export default function HistoryPage() {
  const { user } = useAuth();
  const nav = useNavigate();
  const [rides, setRides] = useState<RideDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'completed' | 'cancelled'>('all');

  useEffect(() => {
    if (!user) return;
    // Server-side filter: only fetch rides belonging to this rider (security fix)
    tablesDB.listRows<RideDoc>({
      databaseId: DB_ID,
      tableId: TABLE.RIDES,
      queries: [
        Query.equal('rider_id', user.$id),
        Query.orderDesc('$createdAt'),
        Query.limit(50),
      ],
    })
      .then(r => {
        setRides(r.rows);
        setLoadError(null);
      })
      .catch(() => {
        setRides([]);
        setLoadError('Could not load your ride history right now.');
      })
      .finally(() => setLoading(false));
  }, [user]);

  const filtered = rides.filter(r => filter === 'all' || r.status === filter);

  return (
    <div className="min-h-dvh bg-surface text-white pb-10">

      {/* Header */}
      <header className="sticky top-0 z-10 bg-surface/95 backdrop-blur-md border-b border-white/8 px-4 py-4">
        <div className="flex items-center gap-3 mb-3">
          <button onClick={() => nav(-1)} title="Go back" aria-label="Go back" className="p-1.5 rounded-xl hover:bg-white/8 transition-colors">
            <ArrowLeft size={20} />
          </button>
          <h1 className="text-lg font-bold">Your Rides</h1>
        </div>
        <div className="flex gap-2">
          {(['all', 'completed', 'cancelled'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={[
                'px-4 py-1.5 rounded-full text-xs font-medium transition-all capitalize',
                filter === f
                  ? 'bg-brand text-white'
                  : 'bg-white/5 text-slate-400 hover:bg-white/10',
              ].join(' ')}
            >
              {f}
            </button>
          ))}
          <button title="Filter rides" aria-label="Filter rides" className="ml-auto p-1.5 rounded-xl hover:bg-white/8 transition-colors text-slate-400">
            <Filter size={16} />
          </button>
        </div>
      </header>

      <div className="px-4 pt-4">
        {loading ? (
          <div className="flex flex-col gap-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="skeleton rounded-2xl h-28" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <span className="text-6xl mb-4">🛺</span>
            <p className="text-slate-400 text-sm">{loadError ?? 'No rides yet. Book your first one!'}</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {filtered.map((ride, i) => (
              <motion.div
                key={ride.$id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="bg-surface-card border border-white/8 rounded-2xl p-4"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{VEHICLE_EMOJI[ride.vehicle_type] ?? '🚗'}</span>
                    <div>
                      <p className="text-sm font-semibold text-white capitalize">{ride.vehicle_type}</p>
                      <p className="text-xs text-slate-500">
                        {new Date(ride.$createdAt).toLocaleDateString('en-IN', {
                          day: 'numeric', month: 'short', year: 'numeric',
                        })}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className="text-base font-black text-white">{formatFare(ride.final_fare ?? ride.estimated_fare)}</span>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full capitalize ${STATUS_COLOR[ride.status] ?? 'text-slate-400 bg-white/5'}`}>
                      {ride.status.replace('_', ' ')}
                    </span>
                  </div>
                </div>

                <div className="flex flex-col gap-1.5 bg-white/3 rounded-xl p-2.5 border border-white/6">
                  <div className="flex items-center gap-2 text-xs text-slate-400">
                    <MapPin size={11} className="text-brand shrink-0" />
                    <span className="truncate">{ride.pickup_address}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-300">
                    <MapPin size={11} className="text-white/40 shrink-0" />
                    <span className="truncate">{ride.dropoff_address}</span>
                  </div>
                </div>

                {(ride.payment_method || ride.payment_status) && (
                  <div className="mt-2.5 flex items-center justify-between border-t border-white/8 pt-2.5 text-xs text-slate-400">
                    <span className="capitalize">Payment: {(ride.payment_method ?? 'cash').replace('_', ' ')}</span>
                    <span className="capitalize">{(ride.payment_status ?? 'pending').replace('_', ' ')}</span>
                  </div>
                )}

                {ride.rating && (
                  <div className="flex items-center gap-1 mt-2.5 pt-2.5 border-t border-white/8">
                    <p className="text-xs text-slate-500 mr-1">You rated</p>
                    {[1, 2, 3, 4, 5].map(s => (
                      <Star
                        key={s}
                        size={13}
                        className={s <= ride.rating! ? 'fill-warning text-warning' : 'fill-transparent text-slate-700'}
                      />
                    ))}
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
