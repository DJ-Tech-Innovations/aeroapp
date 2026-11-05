import { useSettings } from './settings';

/** Vibration API where supported (Android Chrome); silently ignored elsewhere (iOS Safari). */
const buzz = (p: number | number[]) => { try { if (useSettings.getState().haptics) navigator.vibrate?.(p); } catch { /* ignore */ } };
export const haptic = { tap: () => buzz(8), light: () => buzz(12), success: () => buzz([12, 40, 12]), error: () => buzz([40, 30, 40]) };
