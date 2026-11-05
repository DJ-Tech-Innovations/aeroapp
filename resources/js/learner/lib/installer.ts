import { appSatisfies, diffPacks, isGlbModel, sha256Hex, type PackChangelog, type PackManifest, type PackPayload } from '@/shared';
import { db, getMeta, setMeta } from './db';
import { resolveMedia } from './media';
import type { PackSource } from './packSources';

declare global { interface Window { AEROAPP?: { version: string; name: string; bundledPack: string } } }

/** Version of this app shell (config/aeroapp.php). Packs with a higher minAppVersion ask for a reload first. */
export const APP_VERSION = window.AEROAPP?.version ?? '1.1.0';
export const MEDIA_CACHE = 'aeroapp-media';

export type InstallStage = 'downloading' | 'verifying' | 'staging' | 'applying' | 'media' | 'swapping' | 'done';
export interface InstallOptions {
  onStage?: (stage: InstallStage, fraction: number) => void;
  /** Demo switch: throw inside the transaction (after the writes) to prove the rollback. */
  forceFailure?: boolean;
}

export class ChecksumError extends Error {
  constructor() { super('Checksum mismatch — the downloaded pack is corrupt. Your current content was kept.'); this.name = 'ChecksumError'; }
}
export class AppTooOldError extends Error {
  constructor(readonly required: string) { super(`This content pack needs app version ${required} or newer. Please reload to get the latest app.`); this.name = 'AppTooOldError'; }
}

export async function getActivePackVersion(): Promise<string | null> {
  return (await getMeta<string>('activePackVersion')) ?? null;
}

/** Media files (videos, 3D models, recorded narration) referenced by a payload, as URLs. */
export function mediaUrls(p: PackPayload): string[] {
  const set = new Set<string>();
  for (const t of p.tools) {
    if (isGlbModel(t.model3d.file)) set.add(resolveMedia(t.model3d.file));
    if (t.video?.file) set.add(resolveMedia(t.video.file));
    for (const a of Object.values(t.voiceOver.audioFiles ?? {})) if (a) set.add(resolveMedia(a));
  }
  return [...set];
}

/**
 * download → verify SHA-256 → stage → apply in ONE IndexedDB transaction → cache media → swap pointer → clean up.
 * Used by both the first-launch install (bundled pack) and manual updates (server pack).
 */
export async function installPack(source: PackSource, manifest: PackManifest, opts: InstallOptions = {}): Promise<{ version: string; changelog: PackChangelog }> {
  const stage = opts.onStage ?? (() => {});
  if (!appSatisfies(APP_VERSION, manifest.minAppVersion)) throw new AppTooOldError(manifest.minAppVersion);
  const previous = await getActivePackVersion();

  try {
    stage('downloading', 0);
    const text = await source.downloadPack(manifest, (p) => stage('downloading', p.received / Math.max(1, p.total)));

    stage('verifying', 0);
    if ((await sha256Hex(text)) !== manifest.sha256) throw new ChecksumError();
    stage('verifying', 1);

    stage('staging', 0);
    const payload = JSON.parse(text) as PackPayload;
    await db().staged.put({ version: manifest.packVersion, text, manifest });
    stage('staging', 1);

    stage('applying', 0);
    const [oldTools, oldQuizzes] = await Promise.all([db().tools.toArray(), db().quizzes.toArray()]);
    const changelog: PackChangelog = { ...diffPacks({ tools: oldTools, quizzes: oldQuizzes }, payload), notes: manifest.changelog.notes };
    const d = db();
    // If anything throws inside, Dexie aborts the transaction and every write below is rolled back.
    await d.transaction('rw', [d.tools, d.quizzes, d.packs, d.meta], async () => {
      await d.tools.clear(); // the new pack replaces the catalog entirely (count can go up or down)
      await d.quizzes.clear();
      await d.tools.bulkPut(payload.tools.map((t, i) => ({ ...t, sortOrder: i })));
      await d.quizzes.bulkPut(payload.quizzes.map((q, i) => ({ ...q, sortOrder: i })));
      for (const p of await d.packs.toArray()) await d.packs.update(p.version, { active: false });
      await d.packs.put({
        version: manifest.packVersion, installedAt: new Date().toISOString(), releasedAt: manifest.releasedAt,
        toolCount: payload.tools.length, quizCount: payload.quizzes.length, sizeBytes: manifest.sizeBytes,
        sha256: manifest.sha256, changelog, active: true,
      });
      await setMeta('activePackVersion', manifest.packVersion);
      if (opts.forceFailure) throw new Error('Simulated failure during install (demo) — rolling back.');
    });
    stage('applying', 1);

    // Make the pack's videos and 3D models available offline (best effort, never fails the install).
    stage('media', 0);
    try {
      const urls = mediaUrls(payload);
      let doneCount = 0;
      if (typeof caches !== 'undefined') {
        const cache = await caches.open(MEDIA_CACHE);
        // CORS first: the 3D loader cannot read an opaque (no-cors) response; videos play either way
        for (const u of urls) {
          if (!(await cache.match(u))) {
            if (u.startsWith('/')) await cache.add(new Request(u, { mode: 'same-origin' })).catch(() => {});
            else await cache.add(new Request(u, { mode: 'cors' })).catch(() => cache.add(new Request(u, { mode: 'no-cors' }))).catch(() => {});
          }
          stage('media', ++doneCount / Math.max(1, urls.length));
        }
        // delete media that the new pack no longer references
        const keep = new Set(urls.map((u) => new URL(u, location.href).href));
        for (const req of await cache.keys()) if (!keep.has(req.url)) await cache.delete(req);
      }
    } catch { /* offline media is a nice-to-have */ }
    stage('media', 1);

    stage('swapping', 0);
    await d.staged.clear();
    if (previous && previous !== manifest.packVersion) await d.packs.delete(previous);
    stage('done', 1);
    return { version: manifest.packVersion, changelog };
  } catch (e) {
    try { await db().staged.delete(manifest.packVersion); } catch { /* ignore */ }
    throw e; // transaction already reverted → previous pack is untouched
  }
}
