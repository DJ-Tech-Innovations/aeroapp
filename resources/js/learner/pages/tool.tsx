import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router';
import { toast } from 'sonner';
import { ToolThumb } from '@/components/tool-thumb';
import { Badge, Button, buttonClass, Card, Chip, cn, EmptyState, Icon, IconButton, KV, Segmented, Skeleton } from '@/components/ui';
import { CATEGORY_LABEL, fmtDimensions, fmtWeight, SUB_LABEL, UNIT_LABEL, type Tool } from '@/shared';
import { ToolViewer } from '@/viewer';
import { Page, PageTitle } from '../components/page';
import { PlayAllButton, ToolVideo, VoiceSection } from '../components/tool-media';
import { recordToolView } from '../lib/content';
import { useTool } from '../lib/hooks';
import { useNetwork } from '../lib/network';
import { useSession } from '../lib/session';
import { useSettings } from '../lib/settings';
import { say, useVoice, type SpeechItem } from '../lib/speech';
import { setSpotlight } from '../lib/spotlight';

type TabKey = 'overview' | 'learn' | '3d' | 'video' | 'care' | 'refs';
const TABS: { value: TabKey; label: string; icon: string }[] = [
    { value: 'overview', label: 'Overview', icon: 'info' }, { value: 'learn', label: 'Learn', icon: 'book-alt' }, { value: '3d', label: 'Parts', icon: 'target' },
    { value: 'video', label: 'Video', icon: 'video-camera' }, { value: 'care', label: 'Safety', icon: 'shield-check' }, { value: 'refs', label: 'Sources', icon: 'books' },
];

function voiceItems(t: Tool) {
    const mk = (k: 'purpose' | 'howItWorks' | 'howToUse' | 'maintenance'): SpeechItem => ({ id: `${t.id}:${k}`, text: t.voiceOver[k], audioUrl: t.voiceOver.audioFiles?.[k] });
    return { purpose: mk('purpose'), howItWorks: mk('howItWorks'), howToUse: mk('howToUse'), maintenance: mk('maintenance') };
}

export default function ToolPage() {
    const { id } = useParams();
    const tool = useTool(id);
    if (tool === undefined) return <Page wide><Skeleton className="h-80" /><Skeleton className="h-10" /><Skeleton className="h-40" /></Page>;
    if (tool === null) return <Page><Card padded={false}><EmptyState icon="search" title="Tool not found" description="It isn't in the installed content pack — a content update may have removed it." action={<Link to="/tools" className={buttonClass('primary')}>Back to tools</Link>} /></Card></Page>;
    return <ToolView key={tool.id} tool={tool} />;
}

function SpotlightButton({ toolId }: { toolId: string }) {
    const online = useNetwork((s) => s.online);
    const [busy, setBusy] = useState(false);
    const go = async () => {
        setBusy(true);
        try { const r = await setSpotlight(toolId, 'Review this before the next quiz'); toast.success(`Spotlighted for ${r.classes} class${r.classes > 1 ? 'es' : ''}`); } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
    };
    return <Button variant="soft" icon="megaphone" loading={busy} disabled={!online} onClick={go} title={online ? undefined : 'Needs internet'}>Spotlight for my class</Button>;
}

function ToolView({ tool }: { tool: Tool }) {
    const userId = useSession((s) => s.profile?.id);
    const role = useSession((s) => s.profile?.role);
    const { autoRotate, reduce3D, units } = useSettings();
    const [tab, setTab] = useState<TabKey>('overview');
    const [animation, setAnimation] = useState<string | null>(tool.model3d.animations[0] ?? null);
    const [playing, setPlaying] = useState(false);
    const [selected, setSelected] = useState<string | null>(null);
    const [reset, setReset] = useState(0);
    useEffect(() => { if (userId) void recordToolView(userId, tool.id); return () => useVoice.getState().stop(); }, [tool.id, userId]);
    const items = useMemo(() => voiceItems(tool), [tool]);
    const pick = (hid: string) => { const h = tool.model3d.hotspots.find((x) => x.id === hid); if (!h) return; setSelected(hid); setTab('3d'); say(`hotspot:${hid}`, `${h.label}. ${h.description}`); };
    const hs = tool.model3d.hotspots.find((h) => h.id === selected);
    const showParts = tab === '3d';

    return (
        <Page wide className="gap-6">
            <PageTitle back="/tools" eyebrow={`${CATEGORY_LABEL[tool.category]}${tool.subcategory ? ` · ${SUB_LABEL[tool.subcategory]}` : ''}`} title={tool.name} subtitle={`${tool.brand} · ${tool.model}`}
                actions={<Link to={`/tools/${tool.id}/3d`} className={buttonClass('secondary', 'sm')} aria-label="Open full-screen 3D viewer"><Icon name="expand" /><span className="hidden sm:inline">Full screen</span></Link>} />

            <div className="grid gap-6 lg:grid-cols-[1.15fr_1fr]">
                <div className="space-y-3 lg:sticky lg:top-6 lg:self-start">
                    <div className="relative h-72 overflow-hidden rounded-3xl bg-gradient-to-b from-surface-2 via-surface to-surface-3 shadow-card sm:h-96">
                        <ToolViewer tool={tool} autoRotate={!showParts && autoRotate} reduce3D={reduce3D} animation={animation} playing={playing} showHotspots={showParts} selectedHotspotId={selected} resetKey={reset} onHotspotPress={pick} />
                        <div className="pointer-events-none absolute left-3 top-3 flex gap-1.5">
                            <Badge tone="neutral" icon="cube" className="bg-surface/90">{tool.model3d.file.startsWith('procedural://') ? 'Model' : '3D scan'}</Badge>
                            {tool.isSampleData ? <Badge tone="signal" className="bg-surface/90">Sample data</Badge> : null}
                        </div>
                        <div className="absolute bottom-3 right-3 flex gap-1.5">
                            {tool.model3d.animations.length ? <IconButton icon={playing ? 'pause' : 'play'} label={playing ? 'Pause animation' : 'Play animation'} className="bg-surface/90 shadow-sm" onClick={() => setPlaying((p) => !p)} /> : null}
                            <IconButton icon="refresh" label="Reset view" className="bg-surface/90 shadow-sm" onClick={() => setReset((n) => n + 1)} />
                        </div>
                    </div>
                    <p className="text-center text-xs text-muted">Drag to rotate · pinch or scroll to zoom · double-tap to reset{showParts ? ' · tap the orange dots' : ''}</p>
                    {tool.model3d.animations.length > 1 ? <div className="flex flex-wrap justify-center gap-2">{tool.model3d.animations.map((a) => <Chip key={a} label={a} selected={animation === a && playing} onClick={() => { setAnimation(a); setPlaying(true); }} />)}</div> : null}
                    {role === 'instructor' ? <div className="flex justify-center"><SpotlightButton toolId={tool.id} /></div> : null}
                </div>

                <div className="min-w-0 space-y-4">
                    <div className="sticky top-14 z-10 -mx-4 bg-bg/90 px-4 py-1 backdrop-blur md:top-0 md:mx-0 md:px-0">
                        <Segmented value={tab} onChange={setTab} options={TABS} className="w-full" />
                    </div>

                    {tab === 'overview' ? (
                        <>
                            <VoiceSection title="Purpose" icon="bullseye" item={items.purpose}><p>{tool.purpose}</p></VoiceSection>
                            <Card>
                                <h3 className="mb-3 flex items-center gap-2 font-semibold text-text"><Icon name="plane-alt" className="text-primary" />Aircraft applications</h3>
                                <ul className="grid gap-2 sm:grid-cols-2">{tool.aircraftApplications.map((a) => <li key={a} className="flex items-start gap-2 rounded-xl bg-surface-2 px-3 py-2 text-sm text-text-2"><Icon name="check" className="mt-0.5 text-success" />{a}</li>)}</ul>
                            </Card>
                            <Card>
                                <div className="mb-1 flex items-center justify-between"><h3 className="font-semibold text-text">Specifications</h3>{tool.isSampleData ? <Badge tone="signal">Sample values</Badge> : null}</div>
                                <KV k="Brand" v={<span className="flex items-center gap-2"><ToolThumb category={tool.category} brand={tool.brand} size={20} />{tool.brand}</span>} />
                                <KV k="Model" v={tool.model} />
                                <KV k="Unit system" v={UNIT_LABEL[tool.unitSystem]} />
                                <KV k="Weight" v={fmtWeight(tool.weight, units)} />
                                <KV k="Dimensions (L × W × H)" v={fmtDimensions(tool.dimensions, units)} />
                                <p className="mt-2 text-xs text-muted">Change between inches and millimetres in Settings.</p>
                            </Card>
                        </>
                    ) : null}

                    {tab === 'learn' ? (
                        <>
                            <PlayAllButton items={[items.purpose, items.howItWorks, items.howToUse, items.maintenance]} />
                            <VoiceSection title="How it works" icon="gears" item={items.howItWorks}><p>{tool.howItWorks}</p></VoiceSection>
                            <VoiceSection title="How to use it" icon="list-check" item={items.howToUse}>
                                <ol className="space-y-3">{tool.howToUse.map((s, i) => <li key={i} className="flex gap-3"><span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-white">{i + 1}</span><span className="pt-0.5">{s}</span></li>)}</ol>
                            </VoiceSection>
                        </>
                    ) : null}

                    {tab === '3d' ? (
                        <Card className="space-y-4">
                            <div>
                                <h3 className="font-semibold text-text">Parts of the {tool.name}</h3>
                                <p className="text-sm text-muted">Tap a dot on the model, or choose a part to hear what it does.</p>
                            </div>
                            {hs ? <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4"><p className="font-semibold text-text">{hs.label}</p><p className="mt-1 text-sm text-text-2">{hs.description}</p></div> : null}
                            <div className="grid gap-2 sm:grid-cols-2">
                                {tool.model3d.hotspots.map((h, i) => (
                                    <button key={h.id} type="button" onClick={() => pick(h.id)} className={cn('flex items-center gap-3 rounded-xl border p-3 text-left text-sm transition', selected === h.id ? 'border-amber-500 bg-amber-500/10' : 'border-border hover:border-border-strong')}>
                                        <span className="grid size-7 shrink-0 place-items-center rounded-full bg-amber-500 text-xs font-bold text-white">{i + 1}</span>
                                        <span className="font-medium text-text">{h.label}</span>
                                    </button>
                                ))}
                            </div>
                        </Card>
                    ) : null}

                    {tab === 'video' ? <ToolVideo tool={tool} /> : null}

                    {tab === 'care' ? (
                        <>
                            <VoiceSection title="Maintaining this tool" icon="tools" item={items.maintenance}>
                                <ul className="space-y-2">{tool.maintenance.map((m, i) => <li key={i} className="flex gap-2"><Icon name="check-circle" className="mt-1 text-success" /><span>{m}</span></li>)}</ul>
                            </VoiceSection>
                            <Card className="border border-warning/30 bg-warning-soft">
                                <h3 className="mb-3 flex items-center gap-2 font-semibold text-text"><Icon name="triangle-warning" className="text-warning" />Safety — PPE & hazards</h3>
                                <ul className="space-y-2">{tool.safety.map((m, i) => <li key={i} className="flex gap-2 text-[15px] text-text-2"><span className="mt-2 size-1.5 shrink-0 rounded-full bg-warning" />{m}</li>)}</ul>
                            </Card>
                        </>
                    ) : null}

                    {tab === 'refs' ? (
                        <>
                            {tool.references.map((r, i) => (
                                <Card key={i} className="flex gap-4">
                                    <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-surface-2 text-muted"><Icon name="book-alt" /></span>
                                    <div className="min-w-0">
                                        <p className="font-semibold text-text">{r.title}</p>
                                        <p className="text-sm text-muted">{r.publisher}{r.section ? ` · ${r.section}` : ''}</p>
                                        {r.url ? <a href={r.url} target="_blank" rel="noreferrer" className="mt-1 inline-flex max-w-full items-center gap-1 truncate text-sm font-semibold text-primary">{r.url}<Icon name="arrow-up-right-from-square" className="text-[10px]" /></a> : null}
                                    </div>
                                </Card>
                            ))}
                            <p className="text-xs text-muted">Links open in your browser and need internet; the citations themselves are stored offline.</p>
                        </>
                    ) : null}
                </div>
            </div>
        </Page>
    );
}
