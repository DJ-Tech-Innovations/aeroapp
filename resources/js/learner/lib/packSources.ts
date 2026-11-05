import { compareSemver, type PackManifest } from '@/shared';
import { api } from './api';

export interface DownloadProgress { received: number; total: number }

/** Where packs come from. The installer is identical for every source. */
export interface PackSource {
    getLatestManifest(): Promise<PackManifest | null>;
    getManifest(version: string): Promise<PackManifest>;
    /** The exact text the manifest checksum covers — never re-serialised. */
    downloadPack(m: PackManifest, onProgress?: (p: DownloadProgress) => void): Promise<string>;
}

async function readWithProgress(res: Response, total: number, onProgress?: (p: DownloadProgress) => void): Promise<string> {
    if (!res.body) return res.text();
    const reader = res.body.getReader();
    const chunks: Uint8Array[] = [];
    let received = 0;
    for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        received += value.length;
        onProgress?.({ received, total: total || received });
    }
    return new TextDecoder().decode(await new Blob(chunks as BlobPart[]).arrayBuffer());
}

/** The pack shipped inside the app (public/packs) so a first launch has content without a big download. */
export class BundledPackSource implements PackSource {
    constructor(private version = window.AEROAPP?.bundledPack ?? '1.1.0') {}
    async getLatestManifest() { return this.getManifest(this.version); }
    async getManifest(version: string): Promise<PackManifest> {
        const r = await fetch(`/packs/pack-${version}.manifest.json`);
        if (!r.ok) throw new Error(`Bundled pack ${version} not found`);
        return r.json();
    }
    async downloadPack(m: PackManifest, onProgress?: (p: DownloadProgress) => void) {
        const r = await fetch(`/packs/pack-${m.packVersion}.json`);
        if (!r.ok) throw new Error(`Bundled pack ${m.packVersion} not found`);
        return readWithProgress(r, m.sizeBytes, onProgress);
    }
}

/** Published packs from the AeroApp server. */
export class ServerPackSource implements PackSource {
    async getLatestManifest() {
        const { packs } = await api.get<{ packs: PackManifest[] }>('/packs');
        return [...packs].sort((a, b) => compareSemver(b.packVersion, a.packVersion))[0] ?? null;
    }
    async getManifest(version: string) {
        const { packs } = await api.get<{ packs: PackManifest[] }>('/packs');
        const m = packs.find((p) => p.packVersion === version);
        if (!m) throw new Error(`Pack ${version} is not available.`);
        return m;
    }
    async downloadPack(m: PackManifest, onProgress?: (p: DownloadProgress) => void) {
        const res = await fetch(`/api/packs/${m.packVersion}/download`, { credentials: 'same-origin', headers: { Accept: 'application/json' }, cache: 'no-store' });
        if (res.status === 401) throw new Error('Your session expired. Sign in again to download updates.');
        if (!res.ok) throw new Error(`Download failed (${res.status})`);
        return readWithProgress(res, m.sizeBytes, onProgress);
    }
}
