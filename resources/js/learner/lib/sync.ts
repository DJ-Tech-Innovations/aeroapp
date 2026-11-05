import type { AttemptRow } from '@/shared';
import { api } from './api';
import { db } from './db';
import { isOnline } from './network';
import { uploadProfile } from './profile';

export interface PendingCounts { attempts: number; profile: number; total: number }
interface SyncResult { id: string; status: 'stored' | 'duplicate' | 'rejected'; reason?: string; score?: number; maxScore?: number; passed?: boolean }

export async function pendingCounts(userId: string): Promise<PendingCounts> {
    const attempts = await db().attempts.where('userId').equals(userId).filter((a) => !!a.submittedAt && a.syncStatus !== 'synced').count();
    const profile = (await db().profiles.get(userId))?.pendingSync ? 1 : 0;
    return { attempts, profile, total: attempts + profile };
}

let running: Promise<{ attempts: number; profile: number; rejected: string[] }> | null = null;

/**
 * Uploads queued quiz/exam attempts and profile edits. Idempotent: attempt ids are generated on the device and the server
 * answers stored | duplicate | rejected per item. Server scores replace local ones (the server re-scores every attempt).
 */
export function syncNow(userId: string) {
    return (running ??= (async () => {
        try {
            if (!isOnline()) throw new Error('You are offline — changes will sync when you reconnect.');
            const rows = await db().attempts.where('userId').equals(userId).filter((a) => !!a.submittedAt && a.syncStatus !== 'synced').toArray();
            let attempts = 0;
            const rejected: string[] = [];
            for (let i = 0; i < rows.length; i += 50) {
                const batch = rows.slice(i, i + 50);
                let results: SyncResult[];
                try {
                    ({ results } = await api.post<{ results: SyncResult[] }>('/attempts', { attempts: batch }));
                } catch (e) {
                    await db().attempts.bulkPut(batch.map((r) => ({ ...r, syncStatus: 'failed' as const })));
                    throw e;
                }
                const byId = new Map(results.map((r) => [r.id, r]));
                const updated: AttemptRow[] = batch.map((r) => {
                    const res = byId.get(r.id);
                    if (!res || res.status === 'rejected') { rejected.push(`${r.quizTitle}: ${res?.reason ?? 'not accepted'}`); return { ...r, syncStatus: 'failed' }; }
                    attempts++;
                    return { ...r, syncStatus: 'synced', score: res.score ?? r.score, maxScore: res.maxScore ?? r.maxScore, passed: res.passed ?? r.passed };
                });
                await db().attempts.bulkPut(updated);
            }
            let profile = 0;
            if ((await db().profiles.get(userId))?.pendingSync) { await uploadProfile(userId); profile = 1; }
            return { attempts, profile, rejected };
        } finally {
            running = null;
        }
    })());
}
