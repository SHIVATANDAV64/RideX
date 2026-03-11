// src/components/ui/StarRating.tsx
import { useState } from 'react';
import { Star } from 'lucide-react';

interface Props {
  value: number;
  onChange?: (v: number) => void;
  size?: number;
  readonly?: boolean;
}

export function StarRating({ value, onChange, size = 28, readonly = false }: Props) {
  const [hover, setHover] = useState(0);
  const display = hover || value;

  return (
    <div className="flex gap-1" role={readonly ? 'img' : 'radiogroup'}>
      {[1, 2, 3, 4, 5].map(s => (
        <button
          key={s}
          type="button"
          disabled={readonly}
          onMouseEnter={() => !readonly && setHover(s)}
          onMouseLeave={() => !readonly && setHover(0)}
          onClick={() => !readonly && onChange?.(s)}
          className={readonly ? 'cursor-default' : 'cursor-pointer transition-transform hover:scale-110'}
          aria-label={`${s} star${s !== 1 ? 's' : ''}`}
        >
          <Star
            size={size}
            className={`transition-colors duration-100 ${
              s <= display ? 'fill-warning text-warning' : 'fill-transparent text-slate-600'
            }`}
          />
        </button>
      ))}
    </div>
  );
}
