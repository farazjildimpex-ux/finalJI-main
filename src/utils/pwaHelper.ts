export interface PWAStatus {
  isInstallable: boolean;
  isInstalled: boolean;
  isRunningAsPWA: boolean;
  canPromptInstall: boolean;
}

let deferredPrompt: BeforeInstallPromptEvent | null = null;

export function initPWA() {
  if (typeof window === 'undefined') return;

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e as BeforeInstallPromptEvent;
    console.log('PWA: Install prompt is ready');
  });

  window.addEventListener('appinstalled', () => {
    console.log('PWA: App installed successfully');
    deferredPrompt = null;
  });
}

export function getPWAStatus(): PWAStatus {
  if (typeof window === 'undefined') {
    return {
      isInstallable: false,
      isInstalled: false,
      isRunningAsPWA: false,
      canPromptInstall: false,
    };
  }

  const isRunningAsPWA =
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as any).standalone === true ||
    document.referrer.includes('android-app://');

  return {
    isInstallable: !!deferredPrompt,
    isInstalled: isRunningAsPWA,
    isRunningAsPWA,
    canPromptInstall: !!deferredPrompt && !isRunningAsPWA,
  };
}

export async function promptInstall(): Promise<boolean> {
  if (!deferredPrompt) {
    console.warn('PWA: Install prompt not available');
    return false;
  }

  try {
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    const installed = outcome === 'accepted';

    if (installed) {
      deferredPrompt = null;
    }

    return installed;
  } catch (error) {
    console.error('PWA: Install prompt failed', error);
    return false;
  }
}

export function checkServiceWorkerSupport(): boolean {
  return typeof navigator !== 'undefined' && 'serviceWorker' in navigator && 'caches' in window;
}

export async function unregisterServiceWorker(): Promise<void> {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;

  const registrations = await navigator.serviceWorker.getRegistrations();
  for (const registration of registrations) {
    await registration.unregister();
  }
  console.log('PWA: Service Worker unregistered');
}

export function isOnline(): boolean {
  return typeof window !== 'undefined' ? navigator.onLine : true;
}

export function addOnlineListener(callback: (isOnline: boolean) => void): () => void {
  const onlineHandler = () => callback(true);
  const offlineHandler = () => callback(false);
  window.addEventListener('online', onlineHandler);
  window.addEventListener('offline', offlineHandler);

  return () => {
    window.removeEventListener('online', onlineHandler);
    window.removeEventListener('offline', offlineHandler);
  };
}

// ── New helpers for notifications & SW registration ──
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
    console.warn('PWA: serviceWorker not supported');
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.register('/sw.js');
    console.log('PWA: Service worker registered', registration);
    return registration;
  } catch (err) {
    console.error('PWA: Service worker registration failed', err);
    return null;
  }
}

export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (typeof Notification === 'undefined') return 'default';
  try {
    const result = await Notification.requestPermission();
    console.log('PWA: Notification permission', result);
    return result;
  } catch (err) {
    console.error('PWA: requestNotificationPermission failed', err);
    return 'default';
  }
}

export function getNotificationStatus(): { permission: NotificationPermission; granted: boolean } {
  if (typeof Notification === 'undefined') return { permission: 'default', granted: false };
  return { permission: Notification.permission, granted: Notification.permission === 'granted' };
}

export function isTWAorStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as any).standalone === true ||
    document.referrer.includes('android-app://')
  );
}
