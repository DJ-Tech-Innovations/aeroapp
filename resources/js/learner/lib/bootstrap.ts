import { db } from './db';
import { getActivePackVersion, installPack, type InstallStage } from './installer';
import { BundledPackSource } from './packSources';

let started: Promise<void> | null = null;
type Listener = (stage: InstallStage, frac: number) => void;
const listeners = new Set<Listener>();
export const onBootstrapStage = (l: Listener) => { listeners.add(l); return () => { listeners.delete(l); }; };

/** First launch: install the bundled pack with the SAME installer the update flow uses. */
export function bootstrapContent() {
    return (started ??= (async () => {
        try {
            await db().open();
            if (await getActivePackVersion()) return;
            const source = new BundledPackSource();
            await installPack(source, await source.getLatestManifest(), { onStage: (s, f) => listeners.forEach((l) => l(s, f)) });
        } catch (e) {
            console.error('Content bootstrap failed', e);
            started = null;
            throw e;
        }
    })());
}
