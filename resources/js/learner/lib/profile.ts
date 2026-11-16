import type { UserProfile } from '@/shared';
import { api } from './api';
import { db } from './db';
import { isOnline } from './network';

/** Applied locally at once; queued as "pending sync" when offline (or when the upload fails). */
export async function updateProfile(userId: string, patch: Partial<Omit<UserProfile, 'id' | 'role' | 'email'>>): Promise<UserProfile> {
    const cur = await db().profiles.get(userId);
    if (!cur) throw new Error('Profile not found on this device.');
    const next: UserProfile = { ...cur.data, ...patch };
    delete next.pendingSync;
    await db().profiles.put({ userId, data: next, pendingSync: true, updatedAt: new Date().toISOString() });
    if (isOnline()) {
        try { await uploadProfile(userId); return { ...next, pendingSync: false }; } catch { /* stays pending */ }
    }
    return { ...next, pendingSync: true };
}

export async function uploadProfile(userId: string) {
    const row = await db().profiles.get(userId);
    if (!row) return;
    const p = row.data;
    await api.patch('/me', { fullName: p.fullName, idNumber: p.idNumber, school: p.school, section: p.section, yearLevel: p.yearLevel ?? null });
    await db().profiles.update(userId, { pendingSync: false });
}

/** Upload a profile photo (online only). Returns the updated profile. */
export async function uploadAvatar(userId: string, file: Blob): Promise<UserProfile> {
    const fd = new FormData();
    fd.append('avatar', file, 'avatar.jpg');
    const { profile } = await api.upload<{ profile: UserProfile }>('/me/avatar', fd);
    const row = await db().profiles.get(userId);
    if (row) await db().profiles.put({ ...row, data: { ...row.data, avatarUrl: profile.avatarUrl } });
    return profile;
}

/** Shrink a picked photo to a 512px JPEG so uploads stay small. */
export async function resizeImage(file: File, max = 512): Promise<Blob> {
    const bmp = await createImageBitmap(file);
    const s = Math.min(1, max / Math.max(bmp.width, bmp.height));
    const c = document.createElement('canvas');
    c.width = Math.round(bmp.width * s); c.height = Math.round(bmp.height * s);
    c.getContext('2d')!.drawImage(bmp, 0, 0, c.width, c.height);
    return new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('Could not process image'))), 'image/jpeg', 0.85));
}
