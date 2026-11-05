import { useEffect, useState } from 'react';

export type ThemeMode = 'light' | 'dark' | 'system';
const KEY = 'aeroapp.theme';

export function applyTheme(mode: ThemeMode) {
    const dark = mode === 'dark' || (mode === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.classList.toggle('dark', dark);
}

/** Admin + sign-in pages. (The learner app keeps its theme in its own settings store.) */
export function useTheme() {
    const [mode, setMode] = useState<ThemeMode>(() => {
        try { return (localStorage.getItem(KEY) as ThemeMode) || 'system'; } catch { return 'system'; }
    });
    useEffect(() => {
        applyTheme(mode);
        try { localStorage.setItem(KEY, mode); } catch { /* private mode */ }
        if (mode !== 'system') return;
        const mq = matchMedia('(prefers-color-scheme: dark)');
        const on = () => applyTheme('system');
        mq.addEventListener('change', on);
        return () => mq.removeEventListener('change', on);
    }, [mode]);
    return { mode, setMode, toggle: () => setMode(document.documentElement.classList.contains('dark') ? 'light' : 'dark') };
}
