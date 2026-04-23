import { useState, useEffect, useCallback } from 'react';

// ─── Toast Context ────────────────────────────────────────────────────────────
// Simple self-contained toast — no external library needed.
// Usage:
//   const { addToast, ToastContainer } = useToast();
//   addToast('Something went wrong', 'error');
//   <ToastContainer />

const ICONS = {
  error:   '⚠️',
  success: '✅',
  info:    'ℹ️',
  warning: '🔔',
};

const STYLES = {
  error:   'bg-red-500/15 border-red-500/30 text-red-300',
  success: 'bg-purple-500/15 border-purple-500/30 text-purple-300',
  info:    'bg-brand-500/15 border-brand-500/30 text-brand-300',
  warning: 'bg-amber-500/15 border-amber-500/30 text-amber-300',
};

let _toastId = 0;

/**
 * Hook that provides `addToast(message, type?, durationMs?)` and `<ToastContainer />`.
 * Render `<ToastContainer />` once inside the component that uses this hook.
 */
export function useToast() {
  const [toasts, setToasts] = useState([]);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback(
    (message, type = 'info', duration = 4000) => {
      const id = ++_toastId;
      setToasts((prev) => [...prev, { id, message, type }]);
      setTimeout(() => removeToast(id), duration);
    },
    [removeToast]
  );

  const ToastContainer = useCallback(
    () => (
      <div className="fixed top-5 right-5 z-[9999] flex flex-col gap-2 max-w-sm w-full">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`flex items-start gap-3 px-4 py-3 rounded-xl border backdrop-blur-sm
                        shadow-lg animate-slide-up text-sm font-medium
                        ${STYLES[toast.type] ?? STYLES.info}`}
          >
            <span className="text-base flex-shrink-0 mt-0.5">{ICONS[toast.type]}</span>
            <span className="flex-1 leading-snug">{toast.message}</span>
            <button
              onClick={() => removeToast(toast.id)}
              className="flex-shrink-0 opacity-60 hover:opacity-100 transition-opacity ml-1"
              aria-label="Dismiss"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        ))}
      </div>
    ),
    [toasts, removeToast]
  );

  return { addToast, ToastContainer };
}
