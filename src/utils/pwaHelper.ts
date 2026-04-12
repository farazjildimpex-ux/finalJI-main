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
  return 'serviceWorker' in navigator && 'caches' in window;
}

export async function unregisterServiceWorker(): Promise<void> {
  if (!('serviceWorker' in navigator)) return;

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
  window.addEventListener('online', () => callback(true));
  window.addEventListener('offline', () => callback(false));

  return () => {
    window.removeEventListener('online', () => callback(true));
    window.removeEventListener('offline', () => callback(false));
  };
}
