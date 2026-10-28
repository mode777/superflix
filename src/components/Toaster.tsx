import { useEffect, useState } from 'react';
import { subscribeToasts, type ToastMessage } from '@/lib/toast';
import { cn } from '@/lib/cn';

const ICONS: Record<ToastMessage['kind'], string> = {
  info: 'info',
  success: 'check_circle',
  error: 'error',
};

export function Toaster() {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  useEffect(() => {
    const unsubscribe = subscribeToasts(setToasts);
    return () => {
      unsubscribe();
    };
  }, []);

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-6 z-50 flex flex-col items-center gap-2 px-4">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          role="status"
          className={cn(
            'pointer-events-auto flex max-w-md items-center gap-2 rounded-xl border px-4 py-2.5 text-body-md shadow-2xl backdrop-blur-xl',
            toast.kind === 'error'
              ? 'border-error/30 bg-error-container/80 text-on-error-container'
              : toast.kind === 'success'
                ? 'border-favorite/30 bg-[#052e1b]/90 text-favorite'
                : 'border-white/10 bg-surface-container-high/90 text-on-surface',
          )}
        >
          <span className="material-symbols-outlined text-[20px]" aria-hidden="true">
            {ICONS[toast.kind]}
          </span>
          <span>{toast.message}</span>
        </div>
      ))}
    </div>
  );
}
