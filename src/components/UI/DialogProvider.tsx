import { useEffect, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { AlertCircle, AlertTriangle, CheckCircle2, Info, X } from 'lucide-react';
import {
  dialogService,
  type AlertOptions,
  type ConfirmOptions,
  type ConfirmTone,
  type ToastOptions,
} from '../../lib/dialogService';

interface ConfirmRequest extends ConfirmOptions {
  id: number;
  resolve: (value: boolean) => void;
  isAlert?: boolean;
}

interface ToastItem extends ToastOptions {
  id: number;
}

const TONE_RING: Record<ConfirmTone, string> = {
  default: 'bg-blue-50 text-blue-600 ring-blue-100',
  danger: 'bg-rose-50 text-rose-600 ring-rose-100',
  warning: 'bg-amber-50 text-amber-600 ring-amber-100',
  success: 'bg-emerald-50 text-emerald-600 ring-emerald-100',
};

const TONE_BUTTON: Record<ConfirmTone, string> = {
  default: 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500/40',
  danger: 'bg-rose-600 hover:bg-rose-700 focus:ring-rose-500/40',
  warning: 'bg-amber-600 hover:bg-amber-700 focus:ring-amber-500/40',
  success: 'bg-emerald-600 hover:bg-emerald-700 focus:ring-emerald-500/40',
};

const ToneIcon = ({ tone }: { tone: ConfirmTone }) => {
  const cls = 'h-5 w-5';
  if (tone === 'danger') return <AlertCircle className={cls} />;
  if (tone === 'warning') return <AlertTriangle className={cls} />;
  if (tone === 'success') return <CheckCircle2 className={cls} />;
  return <Info className={cls} />;
};

const TOAST_TONE: Record<ConfirmTone, string> = {
  default: 'border-blue-200 bg-white text-gray-800',
  danger: 'border-rose-200 bg-white text-gray-800',
  warning: 'border-amber-200 bg-white text-gray-800',
  success: 'border-emerald-200 bg-white text-gray-800',
};

const TOAST_ICON_BG: Record<ConfirmTone, string> = {
  default: 'bg-blue-50 text-blue-600',
  danger: 'bg-rose-50 text-rose-600',
  warning: 'bg-amber-50 text-amber-600',
  success: 'bg-emerald-50 text-emerald-600',
};

const DialogProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [requests, setRequests] = useState<ConfirmRequest[]>([]);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const idRef = useRef(0);

  const dismissToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  useEffect(() => {
    dialogService.setHandlers({
      confirm: (opts) =>
        new Promise<boolean>((resolve) => {
          idRef.current += 1;
          setRequests((prev) => [
            ...prev,
            { ...opts, id: idRef.current, resolve },
          ]);
        }),
      alert: (opts) =>
        new Promise<void>((resolve) => {
          idRef.current += 1;
          setRequests((prev) => [
            ...prev,
            {
              ...opts,
              id: idRef.current,
              isAlert: true,
              resolve: () => resolve(),
            },
          ]);
        }),
      toast: (opts) => {
        idRef.current += 1;
        const id = idRef.current;
        const duration = opts.durationMs ?? 3500;
        setToasts((prev) => [...prev, { ...opts, id }]);
        if (duration > 0) {
          setTimeout(() => dismissToast(id), duration);
        }
      },
    });
  }, [dismissToast]);

  const handleResolve = (req: ConfirmRequest, value: boolean) => {
    req.resolve(value);
    setRequests((prev) => prev.filter((r) => r.id !== req.id));
  };

  // Close top dialog on Escape
  useEffect(() => {
    if (requests.length === 0) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        const top = requests[requests.length - 1];
        handleResolve(top, false);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [requests]);

  return (
    <>
      {children}
      {typeof document !== 'undefined' &&
        createPortal(
          <>
            {requests.map((req, idx) => {
              const tone: ConfirmTone = req.tone ?? (req.isAlert ? 'default' : 'default');
              const isTop = idx === requests.length - 1;
              return (
                <div
                  key={req.id}
                  className="fixed inset-0 z-[1000] flex items-center justify-center p-4"
                  role="dialog"
                  aria-modal="true"
                >
                  <div
                    className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px] animate-[fadeIn_120ms_ease-out]"
                    onClick={() => isTop && handleResolve(req, false)}
                  />
                  <div className="relative w-full max-w-sm rounded-2xl bg-white shadow-2xl ring-1 ring-black/5 overflow-hidden animate-[popIn_140ms_ease-out]">
                    <div className="px-5 pt-5 pb-4">
                      <div className="flex items-start gap-3">
                        <div
                          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ring-4 ${TONE_RING[tone]}`}
                        >
                          <ToneIcon tone={tone} />
                        </div>
                        <div className="min-w-0 flex-1 pt-0.5">
                          {req.title && (
                            <h3 className="text-base font-semibold text-gray-900">
                              {req.title}
                            </h3>
                          )}
                          <p
                            className={`text-sm text-gray-600 leading-relaxed ${
                              req.title ? 'mt-1' : ''
                            }`}
                          >
                            {req.message}
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center justify-end gap-2 px-5 py-3 bg-gray-50/70 border-t border-gray-100">
                      {!req.isAlert && (
                        <button
                          type="button"
                          onClick={() => handleResolve(req, false)}
                          className="inline-flex items-center justify-center rounded-lg border border-gray-200 bg-white px-3.5 py-1.5 text-xs font-semibold uppercase tracking-wide text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-300/40"
                        >
                          {req.cancelLabel || 'Cancel'}
                        </button>
                      )}
                      <button
                        type="button"
                        autoFocus
                        onClick={() => handleResolve(req, true)}
                        className={`inline-flex items-center justify-center rounded-lg px-3.5 py-1.5 text-xs font-semibold uppercase tracking-wide text-white shadow-sm focus:outline-none focus:ring-2 ${TONE_BUTTON[tone]}`}
                      >
                        {req.confirmLabel || (req.isAlert ? 'OK' : 'Confirm')}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}

            {toasts.length > 0 && (
              <div className="fixed top-4 right-4 z-[1100] flex w-full max-w-sm flex-col gap-2 pointer-events-none">
                {toasts.map((t) => {
                  const tone: ConfirmTone = t.tone ?? 'default';
                  return (
                    <div
                      key={t.id}
                      className={`pointer-events-auto flex items-start gap-3 rounded-xl border ${TOAST_TONE[tone]} px-3.5 py-2.5 shadow-lg ring-1 ring-black/5 animate-[slideIn_180ms_ease-out]`}
                    >
                      <div
                        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${TOAST_ICON_BG[tone]}`}
                      >
                        <ToneIcon tone={tone} />
                      </div>
                      <div className="min-w-0 flex-1 pt-0.5">
                        {t.title && (
                          <p className="text-sm font-semibold text-gray-900">
                            {t.title}
                          </p>
                        )}
                        <p className="text-xs text-gray-600 leading-relaxed">
                          {t.message}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => dismissToast(t.id)}
                        className="text-gray-400 hover:text-gray-600 -mr-1 -mt-1 p-1"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </>,
          document.body
        )}
    </>
  );
};

export default DialogProvider;
