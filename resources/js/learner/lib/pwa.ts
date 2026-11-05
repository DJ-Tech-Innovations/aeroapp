/** Registers the service worker (production only — in dev it would cache stale pages). */
export function registerServiceWorker() {
  if (!('serviceWorker' in navigator) || import.meta.env.DEV) return; // in dev the SW would serve stale Vite chunks
  const hadController = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.register('/sw.js', { scope: '/app', updateViaCache: 'none' }).catch(() => {});
  let reloaded = false;
  // a new version took over → reload once so the page and the cached chunks match
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (hadController && !reloaded) { reloaded = true; location.reload(); }
  });
}

export interface InstallPromptEvent extends Event { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> }

// Chrome/Edge/Samsung Internet fire `beforeinstallprompt` once, often before the page that shows the button mounts,
// so it is captured at startup and shared through this tiny store.
type InstallState = { prompt: InstallPromptEvent | null; installed: boolean };
let state: InstallState = { prompt: null, installed: false };
const listeners = new Set<() => void>();
const emit = (next: Partial<InstallState>) => { state = { ...state, ...next }; listeners.forEach((l) => l()); };

export function captureInstallPrompt() {
  if (typeof window === 'undefined') return;
  emit({ installed: matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true });
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); emit({ prompt: e as InstallPromptEvent }); });
  window.addEventListener('appinstalled', () => emit({ installed: true, prompt: null }));
}
export const installStore = {
  subscribe: (l: () => void) => { listeners.add(l); return () => listeners.delete(l); },
  get: () => state,
  getServer: (): InstallState => ({ prompt: null, installed: true }), // never show install UI during SSR
  async install() {
    if (!state.prompt) return false;
    await state.prompt.prompt();
    const { outcome } = await state.prompt.userChoice;
    emit({ prompt: null, installed: outcome === 'accepted' });
    return outcome === 'accepted';
  },
};

/** iPhone/iPad: no install prompt exists; users add the app from Safari's Share menu. */
export const isIOS = () => typeof navigator !== 'undefined' && (/iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));
