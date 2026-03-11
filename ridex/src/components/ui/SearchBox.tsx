// src/components/ui/SearchBox.tsx
import { useState, useRef, useEffect, type KeyboardEvent } from 'react';
import { searchPlaces, shortName } from '../../lib/nominatim';
import type { NominatimResult } from '../../lib/nominatim';
import { MapPin, X, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface Props {
  value: string;
  onChange: (val: string) => void;
  onSelect: (result: NominatimResult) => void;
  placeholder?: string;
  icon?: React.ReactNode;
  autoFocus?: boolean;
}

export function SearchBox({
  value,
  onChange,
  onSelect,
  placeholder = 'Search location…',
  icon,
  autoFocus = false,
}: Props) {
  const [results, setResults] = useState<NominatimResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus();
  }, [autoFocus]);

  function handleChange(v: string) {
    onChange(v);
    if (debounce.current) clearTimeout(debounce.current);
    if (v.trim().length < 3) { setResults([]); setOpen(false); return; }

    debounce.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await searchPlaces(v);
        setResults(res);
        setOpen(res.length > 0);
      } catch { /* network – ignore */ }
      finally { setLoading(false); }
    }, 350);
  }

  function pick(r: NominatimResult) {
    onSelect(r);
    onChange(shortName(r));
    setOpen(false);
    setResults([]);
  }

  function handleKey(e: KeyboardEvent) {
    if (e.key === 'Escape') { setOpen(false); inputRef.current?.blur(); }
  }

  return (
    <div className="relative">
      <div className="flex items-center bg-white/6 border border-white/10 rounded-xl h-12 px-3 gap-2 focus-within:border-brand/60 transition-colors">
        <span className="text-slate-400 shrink-0">
          {icon ?? <MapPin size={16} />}
        </span>
        <input
          ref={inputRef}
          value={value}
          onChange={e => handleChange(e.target.value)}
          onFocus={() => results.length > 0 && setOpen(true)}
          onKeyDown={handleKey}
          placeholder={placeholder}
          className="flex-1 bg-transparent text-white text-sm placeholder:text-slate-500 outline-none"
        />
        {loading && <Loader2 size={14} className="text-slate-400 animate-spin shrink-0" />}
        {value && !loading && (
          <button
            onClick={() => { onChange(''); setResults([]); setOpen(false); }}
            className="text-slate-500 hover:text-slate-300 transition-colors shrink-0"
          >
            <X size={14} />
          </button>
        )}
      </div>

      <AnimatePresence>
        {open && (
          <motion.ul
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
            className="absolute top-[calc(100%+6px)] left-0 right-0 z-50 bg-surface-card border border-white/10 rounded-2xl overflow-hidden shadow-2xl max-h-64 overflow-y-auto"
          >
            {results.map((r) => (
              <li key={r.place_id}>
                <button
                  onMouseDown={() => pick(r)}
                  className="w-full flex items-start gap-3 px-4 py-3 hover:bg-white/5 text-left transition-colors"
                >
                  <MapPin size={14} className="text-slate-500 mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    <div className="text-sm text-white font-medium truncate">{shortName(r)}</div>
                    <div className="text-xs text-slate-500 truncate">{r.display_name}</div>
                  </div>
                </button>
              </li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}
