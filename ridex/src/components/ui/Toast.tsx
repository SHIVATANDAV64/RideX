// src/components/ui/Toast.tsx
import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, AlertCircle, Info, X } from 'lucide-react';

type ToastType = 'success' | 'error' | 'info';

interface ToastItem {
  id: number;
  message: string;
  type: ToastType;
}

interface ToastContextType {
  toast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextType | null>(null);

let _id = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const toast = useCallback((message: string, type: ToastType = 'info') => {
    const id = ++_id;
    setToasts(t => [...t, { id, message, type }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3500);
  }, []);

  const remove = (id: number) => setToasts(t => t.filter(x => x.id !== id));

  const icons: Record<ToastType, ReactNode> = {
    success: <CheckCircle size={16} className="text-success" />,
    error: <AlertCircle size={16} className="text-danger" />,
    info: <Info size={16} className="text-brand" />,
  };

  const colors: Record<ToastType, string> = {
    success: 'border-success/30',
    error: 'border-danger/30',
    info: 'border-brand/30',
  };

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[9999] flex flex-col gap-2 w-[calc(100%-2rem)] max-w-sm pointer-events-none">
        <AnimatePresence>
          {toasts.map(t => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: -12, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.93 }}
              className={[
                'flex items-center gap-3 px-4 py-3 rounded-2xl pointer-events-auto',
                'bg-surface-card/95 backdrop-blur-md border shadow-xl',
                colors[t.type],
              ].join(' ')}
            >
              {icons[t.type]}
              <p className="flex-1 text-sm text-white">{t.message}</p>
              <button
                onClick={() => remove(t.id)}
                className="text-slate-500 hover:text-slate-300 transition-colors"
              >
                <X size={14} />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside ToastProvider');
  return ctx.toast;
}
