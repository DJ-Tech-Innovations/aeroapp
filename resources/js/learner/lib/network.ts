import { create } from 'zustand';

export const useNetwork = create<{ online: boolean }>(() => ({ online: true }));

let started = false;
export function startNetworkMonitor() {
  if (started || typeof window === 'undefined') return;
  started = true;
  useNetwork.setState({ online: navigator.onLine });
  window.addEventListener('online', () => useNetwork.setState({ online: true }));
  window.addEventListener('offline', () => useNetwork.setState({ online: false }));
}
export const isOnline = () => (typeof navigator === 'undefined' ? true : navigator.onLine);
