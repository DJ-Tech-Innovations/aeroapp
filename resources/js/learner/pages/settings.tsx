import { useEffect, useState, useSyncExternalStore, type ReactNode } from 'react';
import { Link } from 'react-router';
import { toast } from 'sonner';
import { Alert, Badge, Button, Card, Chip, cn, Icon, KV, ProgressBar, Segmented, Switch } from '@/components/ui';
import { appSatisfies, compareSemver, fmtBytes, fmtDate, type PackChangelog, type PackManifest } from '@/shared';
import { Page, PageTitle } from '../components/page';
import { haptic } from '../lib/haptics';
import { useActivePack } from '../lib/hooks';
import { APP_VERSION, AppTooOldError, getActivePackVersion, installPack, type InstallStage } from '../lib/installer';
import { useNetwork } from '../lib/network';
import { ServerPackSource } from '../lib/packSources';
import { installStore, isIOS } from '../lib/pwa';
import { useSession } from '../lib/session';
import { useSettings } from '../lib/settings';
import { getVoices, say, speechSupported } from '../lib/speech';

function Row({ icon, title, sub, to, right }: { icon: string; title: string; sub?: string; to: string; right?: ReactNode }) {
    return (
        <Link to={to} className="flex items-center gap-3 px-4 py-3.5 hover:bg-surface-2/60">
            <span className="flex size-9 items-center justify-center rounded-xl bg-primary-soft text-primary-soft-fg"><Icon name={icon} /></span>
            <div className="min-w-0 flex-1"><p className="font-medium text-text">{title}</p>{sub ? <p className="truncate text-xs text-muted">{sub}</p> : null}</div>
            {right}<Icon name="angle-right" className="text-muted" />
        </Link>
    );
}

/** A new app build is waiting (service worker installed). */
function useAppUpdate() {
    const [waiting, setWaiting] = useState(false);
    useEffect(() => {
        if (!('serviceWorker' in navigator)) return;
        navigator.serviceWorker.getRegistration('/app').then((reg) => {
            if (!reg) return;
            if (reg.waiting) setWaiting(true);
            reg.addEventListener('updatefound', () => reg.installing?.addEventListener('statechange', () => { if (reg.waiting) setWaiting(true); }));
        });
    }, []);
    const check = async () => {
        const reg = await navigator.serviceWorker?.getRegistration('/app');
        await reg?.update();
        if (reg?.waiting || reg?.installing) setWaiting(true); else toast.success(`You have the latest app (v${APP_VERSION})`);
    };
    const apply = async () => { const reg = await navigator.serviceWorker?.getRegistration('/app'); reg?.waiting?.postMessage('SKIP_WAITING'); setTimeout(() => location.reload(), 400); };
    return { waiting, check, apply };
}

export function Settings() {
    const s = useSettings();
    const pack = useActivePack();
    const online = useNetwork((n) => n.online);
    const { prompt, installed } = useSyncExternalStore(installStore.subscribe, installStore.get, installStore.getServer);
    const app = useAppUpdate();
    return (
        <Page>
            <PageTitle back="/" title="Settings" />
            <Card padded={false} className="divide-y divide-border">
                <Row icon="cloud-download" title="Content updates" sub="Install new tools and quizzes" to="/settings/updates" right={pack ? <Badge tone="primary">v{pack.version}</Badge> : null} />
                <Row icon="volume" title="Voice-over" sub="Speed, pitch and voice" to="/settings/voice" />
                <Row icon="info" title="About" to="/settings/about" />
            </Card>

            <Card className="space-y-3">
                <div className="flex items-center gap-3">
                    <span className="flex size-9 items-center justify-center rounded-xl bg-primary-soft text-primary-soft-fg"><Icon name="smartphone" /></span>
                    <div className="flex-1"><p className="font-medium text-text">App version {APP_VERSION}</p><p className="text-xs text-muted">{installed ? 'Installed on this device' : 'Running in the browser'}</p></div>
                    {app.waiting ? <Button size="sm" icon="refresh" onClick={app.apply}>Update now</Button> : <Button size="sm" variant="secondary" disabled={!online} onClick={app.check}>Check</Button>}
                </div>
                {app.waiting ? <Alert tone="info">A new version of the app is ready. Updating takes a second and keeps all your data.</Alert> : null}
                {!installed ? (prompt ? <Button block variant="soft" icon="download" onClick={() => installStore.install()}>Install AeroApp on this device</Button>
                    : <p className="text-xs text-muted">{isIOS() ? 'On iPhone/iPad: tap Share in Safari, then “Add to Home Screen”.' : 'Use your browser menu → “Install app” or “Add to Home screen”.'}</p>) : null}
            </Card>

            <Card className="space-y-4">
                <div><p className="label-caps mb-2">Appearance</p><Segmented value={s.theme} onChange={(theme) => s.set({ theme })} className="w-full" options={[{ value: 'light', label: 'Light', icon: 'sun' }, { value: 'dark', label: 'Dark', icon: 'moon' }, { value: 'system', label: 'System', icon: 'computer' }]} /></div>
                <div><p className="label-caps mb-2">Units</p><Segmented value={s.units} onChange={(units) => s.set({ units })} className="w-full" options={[{ value: 'english', label: 'Inches / pounds' }, { value: 'metric', label: 'mm / kg' }]} /></div>
            </Card>
            <Card padded={false} className="divide-y divide-border px-4">
                <Switch checked={s.autoRotate} onChange={(autoRotate) => s.set({ autoRotate })} label="Auto-rotate 3D previews" />
                <Switch checked={s.reduce3D} onChange={(reduce3D) => s.set({ reduce3D })} label="Reduce 3D quality" description="Smoother on older phones" />
                <Switch checked={s.haptics} onChange={(haptics) => s.set({ haptics })} label="Vibration feedback" description="Android only" />
            </Card>
            <Card padded={false} className="divide-y divide-border px-4">
                <p className="label-caps pt-4">Demo tools</p>
                <Switch checked={s.forceInstallFailure} onChange={(forceInstallFailure) => s.set({ forceInstallFailure })} label="Fail the next content install" description="Proves rollback: the update fails mid-way and the current pack stays intact." />
                <button type="button" className="flex w-full items-center gap-3 py-3 text-left" onClick={() => void useSession.getState().expireNow()}>
                    <span className="min-w-0 flex-1"><span className="block text-sm font-medium text-text">Expire my offline sign-in</span><span className="block text-xs text-muted">Shows the session-expired screen (when offline)</span></span><Icon name="hourglass-end" className="text-muted" />
                </button>
            </Card>
        </Page>
    );
}

type Phase =
    | { k: 'idle' } | { k: 'checking' } | { k: 'upToDate'; current: string } | { k: 'offline' } | { k: 'tooOld'; required: string }
    | { k: 'available'; current: string; manifest: PackManifest } | { k: 'installing'; stage: InstallStage; frac: number }
    | { k: 'done'; version: string } | { k: 'failed'; message: string; kept: string };

const STEPS: { stage: InstallStage; label: string }[] = [
    { stage: 'downloading', label: 'Downloading pack' }, { stage: 'verifying', label: 'Verifying SHA-256 checksum' }, { stage: 'staging', label: 'Staging' },
    { stage: 'applying', label: 'Applying in one database transaction' }, { stage: 'media', label: 'Saving videos and 3D models for offline use' }, { stage: 'swapping', label: 'Switching to the new pack' },
];

function Changes({ c }: { c: PackChangelog }) {
    const groups: [string, string[], 'success' | 'info' | 'danger'][] = [
        ['Tools added', c.toolsAdded, 'success'], ['Tools updated', c.toolsUpdated, 'info'], ['Tools removed', c.toolsRemoved, 'danger'],
        ['Quizzes added', c.quizzesAdded, 'success'], ['Quizzes updated', c.quizzesUpdated, 'info'], ['Quizzes removed', c.quizzesRemoved, 'danger'],
    ];
    return (
        <div className="grid gap-3 sm:grid-cols-2">
            {groups.filter(([, items]) => items.length).map(([t, items, tone]) => (
                <div key={t}><Badge tone={tone}>{t} · {items.length}</Badge><ul className="mt-1.5 space-y-0.5 text-sm text-text-2">{items.slice(0, 6).map((n) => <li key={n}>• {n}</li>)}{items.length > 6 ? <li className="text-xs text-muted">+ {items.length - 6} more</li> : null}</ul></div>
            ))}
            {c.notes ? <p className="text-sm text-muted sm:col-span-2">{c.notes}</p> : null}
        </div>
    );
}

export function Updates() {
    const pack = useActivePack();
    const forceFail = useSettings((s) => s.forceInstallFailure);
    const [phase, setPhase] = useState<Phase>({ k: 'idle' });
    const [lastChecked, setLastChecked] = useState(() => { try { return localStorage.getItem('aeroapp.lastChecked'); } catch { return null; } });
    const source = new ServerPackSource();

    const check = async () => {
        if (!navigator.onLine) return setPhase({ k: 'offline' });
        setPhase({ k: 'checking' });
        try {
            const [latest, current] = await Promise.all([source.getLatestManifest(), getActivePackVersion()]);
            const now = new Date().toISOString();
            try { localStorage.setItem('aeroapp.lastChecked', now); } catch { /* ignore */ }
            setLastChecked(now);
            if (!latest || !current || compareSemver(latest.packVersion, current) <= 0) return setPhase({ k: 'upToDate', current: current ?? '—' });
            if (!appSatisfies(APP_VERSION, latest.minAppVersion)) return setPhase({ k: 'tooOld', required: latest.minAppVersion });
            setPhase({ k: 'available', current, manifest: latest });
        } catch (e) { setPhase({ k: 'failed', message: (e as Error).message, kept: pack?.version ?? '—' }); }
    };
    const install = async (manifest: PackManifest, kept: string) => {
        setPhase({ k: 'installing', stage: 'downloading', frac: 0 });
        try {
            const res = await installPack(source, manifest, { forceFailure: forceFail, onStage: (stage, frac) => setPhase({ k: 'installing', stage, frac }) });
            haptic.success();
            setPhase({ k: 'done', version: res.version });
        } catch (e) {
            haptic.error();
            useSettings.getState().set({ forceInstallFailure: false }); // demo switch is one-shot
            setPhase({ k: 'failed', message: e instanceof AppTooOldError ? e.message : (e as Error).message, kept });
        }
    };
    const busy = phase.k === 'checking' || phase.k === 'installing';
    const cur = phase.k === 'installing' ? STEPS.findIndex((x) => x.stage === phase.stage) : -1;

    return (
        <Page>
            <PageTitle back="/settings" title="Content updates" subtitle="Updates are manual. A new pack replaces the tool catalogue; your quiz history is always kept." />
            <Card className="flex items-center gap-4">
                <span className="flex size-14 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-900 to-blue-600 font-mono text-sm font-bold text-white shadow-md">v{pack?.version.split('.').slice(0, 2).join('.') ?? '—'}</span>
                <div className="min-w-0 flex-1 text-sm">
                    <p className="font-semibold text-text">Installed pack v{pack?.version ?? '—'}</p>
                    <p className="text-muted">{pack ? `${pack.toolCount} tools · ${pack.quizCount} quizzes · installed ${fmtDate(pack.installedAt)}` : '—'}</p>
                    <p className="text-xs text-muted">Last checked {lastChecked ? fmtDate(lastChecked) : 'never'}</p>
                </div>
            </Card>
            <Button size="lg" icon="refresh" onClick={check} loading={phase.k === 'checking'} disabled={busy}>{phase.k === 'checking' ? 'Checking…' : 'Check for updates'}</Button>

            {phase.k === 'upToDate' ? <Alert tone="success" title="You're up to date">Pack v{phase.current} is the latest.</Alert> : null}
            {phase.k === 'offline' ? <Alert tone="warning" icon="wifi-slash" title="You're offline">Connect to the internet to check for updates.</Alert> : null}
            {phase.k === 'tooOld' ? <Alert tone="warning" title="App update needed first">The newest pack needs app version {phase.required} or newer. Go to Settings → App version → Check.</Alert> : null}

            {phase.k === 'available' ? (
                <Card className="space-y-4 ring-2 ring-primary/30">
                    <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-xl font-bold text-text">v{phase.manifest.packVersion} is available</h2><Badge tone="primary" icon="download">{fmtBytes(phase.manifest.sizeBytes)}</Badge></div>
                    <p className="text-sm text-muted">From v{phase.current} · {phase.manifest.toolCount} tools · {phase.manifest.quizCount} quizzes · released {fmtDate(phase.manifest.releasedAt)}</p>
                    <Changes c={phase.manifest.changelog} />
                    {forceFail ? <Alert tone="danger" title="Demo">This install will fail on purpose and roll back.</Alert> : null}
                    <Button block size="lg" icon="cloud-download" onClick={() => install(phase.manifest, phase.current)}>Download & install</Button>
                </Card>
            ) : null}

            {phase.k === 'installing' ? (
                <Card className="space-y-3">
                    <h2 className="font-semibold text-text">Installing…</h2>
                    {STEPS.map((s, i) => (
                        <div key={s.stage} className="space-y-1.5">
                            <div className="flex items-center gap-3 text-sm">
                                {i < cur ? <Icon name="check-circle" solid className="text-success" /> : i === cur ? <span className="size-4 animate-spin rounded-full border-2 border-primary border-r-transparent" /> : <span className="size-4 rounded-full border-2 border-border-strong" />}
                                <span className={cn(i === cur ? 'font-semibold text-text' : i < cur ? 'text-text-2' : 'text-muted')}>{s.label}</span>
                            </div>
                            {i === cur && (s.stage === 'downloading' || s.stage === 'media') ? <ProgressBar value={phase.frac} className="ml-7" /> : null}
                        </div>
                    ))}
                </Card>
            ) : null}

            {phase.k === 'done' ? <Alert tone="success" title={`Updated to v${phase.version}`} action={<Link to="/tools" className="text-sm font-semibold text-primary">Browse</Link>}>The catalogue now has {pack?.toolCount ?? '…'} tools and {pack?.quizCount ?? '…'} quizzes, all available offline.</Alert> : null}
            {phase.k === 'failed' ? <Alert tone="danger" title="Update failed — nothing was changed">{phase.message} <span className="mt-1 block font-medium text-success">Rolled back: still on v{phase.kept}.</span></Alert> : null}
        </Page>
    );
}

export function Voice() {
    const s = useSettings();
    const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
    useEffect(() => {
        if (!speechSupported()) return;
        const load = () => setVoices(getVoices().slice(0, 14));
        load();
        speechSynthesis.addEventListener('voiceschanged', load);
        return () => speechSynthesis.removeEventListener('voiceschanged', load);
    }, []);
    return (
        <Page>
            <PageTitle back="/settings" title="Voice-over" subtitle="Narration uses your device's built-in voice and works offline." />
            {!speechSupported() ? <Alert tone="warning">This browser doesn't support speech. The text is always shown on screen.</Alert> : null}
            <Card className="space-y-3"><p className="label-caps">Speed</p><div className="flex flex-wrap gap-2">{[0.75, 1, 1.25, 1.5].map((r) => <Chip key={r} label={`${r}×`} selected={s.voiceRate === r} onClick={() => s.set({ voiceRate: r })} />)}</div></Card>
            <Card className="space-y-3"><p className="label-caps">Pitch</p><div className="flex flex-wrap gap-2">{[0.8, 1, 1.2].map((p) => <Chip key={p} label={p === 1 ? 'Normal' : p < 1 ? 'Lower' : 'Higher'} selected={s.voicePitch === p} onClick={() => s.set({ voicePitch: p })} />)}</div></Card>
            <Card className="space-y-3">
                <p className="label-caps">Voice</p>
                <div className="flex flex-wrap gap-2"><Chip label="System default" selected={!s.voiceURI} onClick={() => s.set({ voiceURI: null })} />{voices.map((v) => <Chip key={v.voiceURI} label={v.name} selected={s.voiceURI === v.voiceURI} onClick={() => s.set({ voiceURI: v.voiceURI })} />)}</div>
            </Card>
            <Button size="lg" icon="volume" disabled={!speechSupported()} onClick={() => say('voice-test', 'This is how tool narration will sound. A rivet gun drives rivets with rapid hammer blows.')}>Test voice</Button>
        </Page>
    );
}

export function About() {
    const pack = useActivePack();
    return (
        <Page>
            <PageTitle back="/settings" title="About AeroApp" />
            <Card>
                <KV k="App version" v={APP_VERSION} />
                <KV k="Content pack" v={pack ? `v${pack.version}` : '—'} />
                <KV k="Pack installed" v={pack ? fmtDate(pack.installedAt) : '—'} />
                <KV k="Tools / quizzes" v={pack ? `${pack.toolCount} / ${pack.quizCount}` : '—'} />
                <KV k="Works offline" v="Yes — after the first sign-in" />
            </Card>
            <Card className="space-y-2 text-sm text-text-2">
                <h3 className="font-semibold text-text">About the content</h3>
                <p>Weights, dimensions and model numbers marked “Sample data” are example values, not certified specifications. Placeholder 3D models are stylised shapes; tutorial videos may be placeholder clips.</p>
                <p>References cite the FAA Aviation Maintenance Technician Handbooks (FAA-H-8083-30B, -31B), AC 43.13-1B and manufacturer manuals.</p>
                <p className="text-xs text-muted">Icons: <a className="underline" href="https://www.flaticon.com/uicons" target="_blank" rel="noreferrer">UIcons by Flaticon</a>.</p>
            </Card>
        </Page>
    );
}
