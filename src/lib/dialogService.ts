export type ConfirmTone = 'default' | 'danger' | 'warning' | 'success';

export interface ConfirmOptions {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: ConfirmTone;
}

export interface AlertOptions {
  title?: string;
  message: string;
  confirmLabel?: string;
  tone?: ConfirmTone;
}

export interface ToastOptions {
  title?: string;
  message: string;
  tone?: ConfirmTone;
  durationMs?: number;
}

type ConfirmHandler = (opts: ConfirmOptions) => Promise<boolean>;
type AlertHandler = (opts: AlertOptions) => Promise<void>;
type ToastHandler = (opts: ToastOptions) => void;

let confirmHandler: ConfirmHandler | null = null;
let alertHandler: AlertHandler | null = null;
let toastHandler: ToastHandler | null = null;

export const dialogService = {
  setHandlers(handlers: {
    confirm: ConfirmHandler;
    alert: AlertHandler;
    toast: ToastHandler;
  }) {
    confirmHandler = handlers.confirm;
    alertHandler = handlers.alert;
    toastHandler = handlers.toast;
  },

  confirm(message: string | ConfirmOptions): Promise<boolean> {
    const opts: ConfirmOptions =
      typeof message === 'string' ? { message } : message;
    if (confirmHandler) return confirmHandler(opts);
    if (typeof window !== 'undefined') {
      return Promise.resolve(window.confirm(opts.message));
    }
    return Promise.resolve(false);
  },

  alert(message: string | AlertOptions): Promise<void> {
    const opts: AlertOptions =
      typeof message === 'string' ? { message } : message;
    if (alertHandler) return alertHandler(opts);
    if (typeof window !== 'undefined') {
      window.alert(opts.message);
    }
    return Promise.resolve();
  },

  toast(message: string | ToastOptions): void {
    const opts: ToastOptions =
      typeof message === 'string' ? { message } : message;
    if (toastHandler) {
      toastHandler(opts);
      return;
    }
    if (typeof window !== 'undefined') {
      console.log('[toast]', opts.message);
    }
  },

  success(message: string): void {
    this.toast({ message, tone: 'success' });
  },

  error(message: string): void {
    this.toast({ message, tone: 'danger' });
  },
};

export const showConfirm = (msg: string | ConfirmOptions) =>
  dialogService.confirm(msg);
export const showAlert = (msg: string | AlertOptions) =>
  dialogService.alert(msg);
export const showToast = (msg: string | ToastOptions) =>
  dialogService.toast(msg);
