import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type ThemeMode = 'dark' | 'light' | 'system';
export type UnitPref = 'english' | 'metric';

interface SettingsState {
    theme: ThemeMode; units: UnitPref; voiceRate: number; voicePitch: number; voiceURI: string | null;
    reduce3D: boolean; autoRotate: boolean; haptics: boolean; onboarded: boolean;
    /** Demo switch: make the next content install fail mid-transaction to prove rollback. */
    forceInstallFailure: boolean;
    set: (p: Partial<Omit<SettingsState, 'set'>>) => void;
}

export const applyTheme = (t: ThemeMode) => {
    const dark = t === 'dark' || (t === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.classList.toggle('dark', dark);
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#0d1117' : '#172554');
};

export const useSettings = create<SettingsState>()(
    persist(
        (set) => ({
            theme: 'system', units: 'english', voiceRate: 1, voicePitch: 1, voiceURI: null,
            reduce3D: false, autoRotate: true, haptics: true, onboarded: false, forceInstallFailure: false,
            set: (p) => { set(p); if (p.theme) applyTheme(p.theme); },
        }),
        { name: 'aeroapp.settings', partialize: (s) => ({ ...s, set: undefined }) as unknown as SettingsState },
    ),
);
