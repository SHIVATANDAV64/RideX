// src/components/ui/VehicleCard.tsx
import { motion } from 'framer-motion';
import type { VehicleType, FareEstimate } from '../../lib/fare';
import { formatFare } from '../../lib/fare';
import { Users, Clock } from 'lucide-react';

interface Props {
  estimate: FareEstimate;
  selected: boolean;
  onSelect: (type: VehicleType) => void;
}

export function VehicleCard({ estimate, selected, onSelect }: Props) {
  return (
    <motion.button
      whileTap={{ scale: 0.97 }}
      onClick={() => onSelect(estimate.vehicleType)}
      className={[
        'relative flex items-center gap-3 rounded-2xl px-4 py-3.5',
        'border transition-all duration-200 text-left w-full',
        selected
          ? 'bg-brand/15 border-brand/60 shadow-lg shadow-brand/10'
          : 'bg-white/4 border-white/8 hover:border-white/20',
      ].join(' ')}
    >
      {/* Emoji icon */}
      <span className="text-3xl leading-none shrink-0">{estimate.icon}</span>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="font-semibold text-white capitalize">{estimate.label}</span>
          {estimate.surgeMultiplier > 1 && (
            <span className="text-[10px] font-bold bg-warning/20 text-warning px-1.5 py-0.5 rounded-full">
              {estimate.surgeMultiplier.toFixed(1)}x
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 mt-0.5 text-xs text-slate-400">
          <span className="flex items-center gap-1">
            <Clock size={11} />
            {estimate.etaMin} min away
          </span>
          <span className="flex items-center gap-1">
            <Users size={11} />
            {estimate.capacity}
          </span>
        </div>
      </div>

      <div className="text-right shrink-0">
        <div className="font-bold text-white text-base">{formatFare(estimate.fareMin)}</div>
        {estimate.fareMin !== estimate.fareMax && (
          <div className="text-xs text-slate-500">–{formatFare(estimate.fareMax)}</div>
        )}
      </div>

      {selected && (
        <motion.div
          layoutId="vehicle-selected-ring"
          className="absolute inset-0 rounded-2xl border-2 border-brand pointer-events-none"
        />
      )}
    </motion.button>
  );
}
