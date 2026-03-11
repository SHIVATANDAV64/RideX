// src/components/ui/BottomSheet.tsx
import { useEffect, type ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface Props {
  open: boolean;
  onClose?: () => void;
  children: ReactNode;
  title?: string;
  height?: 'auto' | 'half' | 'tall' | 'full';
  showHandle?: boolean;
  className?: string;
}

const heightMap = {
  auto: 'max-h-[85dvh]',
  half: 'h-[50dvh]',
  tall: 'h-[72dvh]',
  full: 'h-[90dvh]',
};

export function BottomSheet({
  open,
  onClose,
  children,
  title,
  height = 'auto',
  showHandle = true,
  className = '',
}: Props) {
  // Lock body scroll when sheet is open
  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          {onClose && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 z-40"
              onClick={onClose}
            />
          )}
          {/* Sheet */}
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 320 }}
            className={[
              'fixed bottom-0 left-0 right-0 z-50',
              'bg-surface-card border-t border-white/10',
              'rounded-t-[1.5rem] overflow-hidden',
              'flex flex-col',
              heightMap[height],
              className,
            ].join(' ')}
          >
            {showHandle && (
              <div className="flex justify-center pt-3 pb-1 shrink-0">
                <div className="w-10 h-1 rounded-full bg-white/20" />
              </div>
            )}
            {title && (
              <div className="px-5 py-3 border-b border-white/10 shrink-0">
                <h2 className="text-base font-semibold text-white">{title}</h2>
              </div>
            )}
            <div className="flex-1 overflow-y-auto overscroll-contain">
              {children}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
