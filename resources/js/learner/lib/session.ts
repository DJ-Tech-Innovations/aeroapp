import { create } from 'zustand';
import type { UserProfile } from '@/shared';
import { api, isAuthError } from './api';
import { db, getMeta, setMeta } from './db';
import { isOnline } from './network';

type Status = 'loading' | 'signedOut' | 'signedIn';
const DAY = 86400000;

interface MeResponse { profile: UserProfile; canAccessAdmin: boolean; offlineDays: number }

interface SessionState {
    status: Status;
    profile: UserProfile | null;
    canAccessAdmin: boolean;
    /** Signed out because the offline window lapsed (needs internet to sign in again). */
    expired: boolean;
    /** No cached account on this device and no connection: the very first sign-in needs internet. */
    offlineFirstRun: boolean;
    init: () => Promise<void>;
    signOut: () => Promise<void>;
    setProfile: (p: UserProfile) => void;
    expireNow: () => Promise<void>;
}

async function cachedProfile(): Promise<{ profile: UserProfile; pendingSync: boolean } | null> {
    const id = await getMeta<string>('currentUserId');
    if (!id) return null;
    const row = await db().profiles.get(id);
    return row ? { profile: { ...row.data, pendingSync: row.pendingSync }, pendingSync: row.pendingSync } : null;
}

/**
 * Offline-first session. The server session cookie lasts 14 days; on this device the cached profile keeps the app usable
 * offline for the same window since the last time the server confirmed the session. Signing in itself always happens
 * on the server's /login page (online).
 */
export const useSession = create<SessionState>((set, get) => ({
    status: 'loading', profile: null, canAccessAdmin: false, expired: false, offlineFirstRun: false,

    async init() {
        const local = await cachedProfile().catch(() => null);
        if (local && get().status !== 'signedIn') set({ status: 'signedIn', profile: local.profile });

        if (isOnline()) {
            try {
                const me = await api.get<MeResponse>('/me');
                const prev = await db().profiles.get(me.profile.id);
                const keep = prev?.pendingSync ? prev.data : me.profile; // never clobber unsynced local edits
                await db().profiles.put({ userId: me.profile.id, data: keep, pendingSync: !!prev?.pendingSync, updatedAt: new Date().toISOString() });
                await setMeta('currentUserId', me.profile.id);
                await setMeta('verifiedAt', Date.now());
                await setMeta('offlineDays', me.offlineDays);
                set({ status: 'signedIn', profile: { ...keep, pendingSync: !!prev?.pendingSync }, canAccessAdmin: me.canAccessAdmin, expired: false, offlineFirstRun: false });
                return;
            } catch (e) {
                if (isAuthError(e)) return set({ status: 'signedOut', profile: null, expired: !!local });
                // Server unreachable although the browser says online — treat as offline below.
            }
        }
        if (!local) return set({ status: 'signedOut', offlineFirstRun: true });
        const verified = (await getMeta<number>('verifiedAt')) ?? 0;
        const days = (await getMeta<number>('offlineDays')) ?? 14;
        if (Date.now() - verified > days * DAY) return set({ status: 'signedOut', profile: null, expired: true });
        set({ status: 'signedIn', profile: local.profile });
    },

    async signOut() {
        try { if (isOnline()) await api.post('/logout'); } catch { /* signed out locally anyway */ }
        await setMeta('currentUserId', null);
        set({ status: 'signedOut', profile: null });
        window.location.href = '/login';
    },

    setProfile: (profile) => set({ profile }),

    async expireNow() {
        await setMeta('verifiedAt', 0);
        await get().init();
    },
}));
