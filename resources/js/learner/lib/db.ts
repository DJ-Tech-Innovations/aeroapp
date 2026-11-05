import Dexie, { type Table } from 'dexie';
import type { AttemptRow, PackChangelog, PackManifest, Quiz, Tool, UserProfile } from '@/shared';

export type StoredTool = Tool & { sortOrder: number };
export type StoredQuiz = Quiz & { sortOrder: number };
export interface InstalledPackRow {
  version: string; installedAt: string; releasedAt: string; toolCount: number; quizCount: number;
  sizeBytes: number; sha256: string; changelog: PackChangelog; active: boolean;
}

/** Everything the app needs offline lives here: the active content pack, attempts, profile, caches. */
class AeroDB extends Dexie {
  meta!: Table<{ key: string; value: unknown }, string>;
  tools!: Table<StoredTool, string>;
  quizzes!: Table<StoredQuiz, string>;
  packs!: Table<InstalledPackRow, string>;
  staged!: Table<{ version: string; text: string; manifest: PackManifest }, string>;
  attempts!: Table<AttemptRow, string>;
  views!: Table<{ key: string; userId: string; toolId: string; viewedAt: string }, string>;
  profiles!: Table<{ userId: string; data: UserProfile; pendingSync: boolean; updatedAt: string }, string>;
  cache!: Table<{ key: string; value: unknown; at: string }, string>;

  constructor() {
    super('aeroapp');
    this.version(1).stores({
      meta: 'key',
      tools: 'id, category, brand, subcategory, unitSystem, sortOrder',
      quizzes: 'id, sortOrder',
      packs: 'version',
      staged: 'version',
      attempts: 'id, userId, quizId, syncStatus, startedAt',
      views: 'key, userId, viewedAt',
      profiles: 'userId',
      cache: 'key',
    });
  }
}

let instance: AeroDB | null = null;
export const db = (): AeroDB => (instance ??= new AeroDB());

export async function getMeta<T>(key: string): Promise<T | undefined> {
  return (await db().meta.get(key))?.value as T | undefined;
}
export const setMeta = (key: string, value: unknown) => db().meta.put({ key, value });

/** Network-first read with an IndexedDB fallback — used for instructor data so pages still render offline. */
export async function cached<T>(key: string, fetcher: () => Promise<T>): Promise<{ data: T; stale: boolean }> {
  try {
    const data = await fetcher();
    await db().cache.put({ key, value: data, at: new Date().toISOString() });
    return { data, stale: false };
  } catch (e) {
    const hit = await db().cache.get(key);
    if (hit) return { data: hit.value as T, stale: true };
    throw e;
  }
}
