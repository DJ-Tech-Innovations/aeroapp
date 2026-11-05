import { Head, router, usePage } from '@inertiajs/react';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { ModelStudio, type ModelJob, type ToolPhoto } from '@/components/admin/model-studio';
import { Alert, Badge, Button, Card, CardHeader, Checkbox, cn, Field, Icon, IconButton, Input, Select, Switch, Textarea, useConfirm } from '@/components/ui';
import { PageHeader } from '@/layouts/admin-layout';
import { archetypeOf, isGlbModel, type Tool } from '@/shared';
import { can, type SharedProps } from '@/types';
import { ToolViewer, type Vec3 } from '@/viewer';

interface Props {
    tool: Tool | null; published: boolean; archetypes: { name: string; animations: string[] }[]; videos: string[];
    jobs: ModelJob[]; photos: ToolPhoto[]; ai: { meshy: boolean; anthropic: boolean };
    catalog: { categories: Record<string, string>; subcategories: Record<string, string>; subs: Record<string, string[]>; brands: string[]; unitSystems: Record<string, string> };
}

const lines = (s: string) => s.split('\n').map((x) => x.trim()).filter(Boolean);
const SECTIONS = [
    { id: 'identity', label: 'Identity', icon: 'id-badge' }, { id: 'specs', label: 'Specifications', icon: 'ruler-combined' },
    { id: 'content', label: 'Learning content', icon: 'book-alt' }, { id: 'model', label: '3D model & parts', icon: 'cube' },
    { id: 'voice', label: 'Voice-over', icon: 'volume' }, { id: 'video', label: 'Video', icon: 'video-camera' }, { id: 'refs', label: 'References', icon: 'books' },
];

function Section({ id, title, description, icon, children, className }: { id: string; title: string; description?: ReactNode; icon: string; children: ReactNode; className?: string }) {
    return (
        <Card padded={false} id={id} className="scroll-mt-24">
            <CardHeader title={title} description={description} icon={icon} />
            <div className={cn('p-5', className)}>{children}</div>
        </Card>
    );
}

export default function ToolEditor({ tool, published, archetypes, videos, jobs, photos, ai, catalog }: Props) {
    const { props } = usePage<SharedProps>();
    const manage = can(props.auth.user, 'tools.manage');
    const canAi = can(props.auth.user, 'tools.ai');
    const confirm = useConfirm();
    const errors = props.errors ?? {};
    const [saving, setSaving] = useState(false);
    const [dirty, setDirty] = useState(false);

    const initial = useMemo(() => ({
        name: tool?.name ?? '', slug: tool?.slug ?? '', category: tool?.category ?? 'common', subcategory: tool?.subcategory ?? '',
        brand: tool?.brand ?? 'Stanley', model: tool?.model ?? '', unitSystem: tool?.unitSystem ?? 'na',
        wValue: String(tool?.weight.value ?? ''), wUnit: tool?.weight.unit ?? 'kg',
        dL: String(tool?.dimensions.length ?? ''), dW: String(tool?.dimensions.width ?? ''), dH: String(tool?.dimensions.height ?? ''), dUnit: tool?.dimensions.unit ?? 'mm',
        apps: (tool?.aircraftApplications ?? []).join('\n'), purpose: tool?.purpose ?? '', howItWorks: tool?.howItWorks ?? '',
        howToUse: (tool?.howToUse ?? []).join('\n'), maintenance: (tool?.maintenance ?? []).join('\n'), safety: (tool?.safety ?? []).join('\n'),
        archetype: (tool && (archetypeOf(tool.model3d.file) ?? tool.model3d.fallback)) || archetypes[0]?.name || '',
        glb: tool && isGlbModel(tool.model3d.file) ? tool.model3d.file : (null as string | null),
        positions: (tool && isGlbModel(tool.model3d.file) ? tool.model3d.hotspots.map((h) => h.position) : [null, null, null]) as (Vec3 | null)[],
        hotspots: tool?.model3d.hotspots.map((h) => ({ label: h.label, description: h.description })) ?? [0, 1, 2].map(() => ({ label: '', description: '' })),
        voPurpose: tool?.voiceOver.purpose ?? '', voHow: tool?.voiceOver.howItWorks ?? '', voUse: tool?.voiceOver.howToUse ?? '', voCare: tool?.voiceOver.maintenance ?? '',
        videoFile: tool?.video?.file ?? 'videos/placeholder.mp4', videoDur: String(tool?.video?.durationSec ?? 8), hasVideo: tool ? !!tool.video : true,
        refs: tool?.references.map((r) => ({ title: r.title, publisher: r.publisher, section: r.section ?? '', url: r.url ?? '' })) ?? [{ title: '', publisher: '', section: '', url: '' }],
        tags: (tool?.tags ?? []).join(', '), isSample: tool?.isSampleData ?? true, isPublished: published,
    }), [tool, published, archetypes]);
    const [f, setF] = useState(initial);
    const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => { setF((s) => ({ ...s, [k]: v })); setDirty(true); };
    const arch = archetypes.find((a) => a.name === f.archetype);
    const subs = catalog.subs[f.category] ?? [];

    // Warn before leaving with unsaved changes.
    useEffect(() => {
        if (!dirty) return;
        const before = (e: BeforeUnloadEvent) => { e.preventDefault(); };
        window.addEventListener('beforeunload', before);
        const off = router.on('before', (e) => (e.detail.visit.method === 'get' ? window.confirm('Leave without saving your changes?') : true));
        return () => { window.removeEventListener('beforeunload', before); off(); };
    }, [dirty]);

    const payload = () => ({
        name: f.name, slug: f.slug, category: f.category, subcategory: f.subcategory || null, brand: f.brand, model: f.model, unitSystem: f.unitSystem,
        weight: { value: f.wValue, unit: f.wUnit }, dimensions: { length: f.dL, width: f.dW, height: f.dH, unit: f.dUnit },
        aircraftApplications: lines(f.apps), purpose: f.purpose, howItWorks: f.howItWorks, howToUse: lines(f.howToUse), maintenance: lines(f.maintenance), safety: lines(f.safety),
        archetype: f.archetype, glb: f.glb, hotspots: f.hotspots, hotspotPositions: f.glb ? f.positions : null,
        voiceOver: { purpose: f.voPurpose, howItWorks: f.voHow, howToUse: f.voUse, maintenance: f.voCare },
        video: f.hasVideo ? { file: f.videoFile, durationSec: f.videoDur } : null,
        references: f.refs, tags: f.tags, isSampleData: f.isSample, isPublished: f.isPublished,
    });
    const save = () => {
        const opts = { preserveScroll: true, onStart: () => setSaving(true), onFinish: () => setSaving(false), onSuccess: () => setDirty(false) };
        setDirty(false);
        if (tool) router.put(`/admin/tools/${tool.id}`, payload(), opts); else router.post('/admin/tools', payload(), opts);
    };
    const remove = async () => {
        if (tool && (await confirm({ title: `Delete “${tool.name}”?`, message: 'It leaves the learners’ catalogue in your next pack.', confirmLabel: 'Delete tool' }))) { setDirty(false); router.delete(`/admin/tools/${tool.id}`); }
    };
    const err = (k: string) => errors[k] ?? null;
    const errorList = Object.values(errors);

    // A preview Tool for the placeholder model (live as the archetype changes).
    const previewTool = useMemo<Tool | null>(() => (f.archetype ? { ...(tool ?? ({} as Tool)), id: 'preview', name: f.name || 'Preview', brand: f.brand as Tool['brand'], model3d: { file: f.glb ?? `procedural://${f.archetype}`, fallback: f.archetype, scale: 1, animations: arch?.animations ?? [], hotspots: [] } } as Tool : null), [f.archetype, f.glb, f.brand, f.name, arch, tool]);

    return (
        <>
            <Head title={tool ? tool.name : 'New tool'} />
            <PageHeader back="/admin/tools" title={tool ? tool.name : 'New tool'} description={tool ? `${tool.brand} · ${tool.model} · /${tool.slug}` : 'Learners need every section: specs, 3D model, parts, procedure, safety, voice-over and references.'}
                actions={<>{tool ? <Badge tone={published ? 'success' : 'warning'} dot>{published ? 'Published' : 'Draft'}</Badge> : null}</>} />

            {errorList.length ? <Alert tone="danger" className="mb-6" title={`Please fix ${errorList.length} problem${errorList.length > 1 ? 's' : ''}`}><ul className="list-disc space-y-0.5 pl-4">{errorList.slice(0, 8).map((e, i) => <li key={i}>{e}</li>)}</ul></Alert> : null}

            <div className="grid gap-6 xl:grid-cols-[1fr_300px]">
                <fieldset disabled={!manage} className="min-w-0 space-y-6">
                    <Section id="identity" title="Identity" icon="id-badge" className="grid gap-4 md:grid-cols-2">
                        <Field label="Name" required error={err('name')}><Input value={f.name} onChange={(e) => set('name', e.target.value)} /></Field>
                        <Field label="Slug" hint="Web name. Blank = made from the name." error={err('slug')}><Input value={f.slug} onChange={(e) => set('slug', e.target.value)} placeholder="auto" className="font-mono" /></Field>
                        <Field label="Category" required><Select value={f.category} onChange={(e) => { set('category', e.target.value as typeof f.category); set('subcategory', ''); }}>{Object.entries(catalog.categories).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select></Field>
                        <Field label="Subcategory" error={err('subcategory')}><Select value={f.subcategory ?? ''} disabled={!subs.length} onChange={(e) => set('subcategory', e.target.value as typeof f.subcategory)}><option value="">—</option>{subs.map((s) => <option key={s} value={s}>{catalog.subcategories[s]}</option>)}</Select></Field>
                        <Field label="Brand" required><Select value={f.brand} onChange={(e) => set('brand', e.target.value as typeof f.brand)}>{catalog.brands.map((b) => <option key={b}>{b}</option>)}</Select></Field>
                        <Field label="Model number" required error={err('model')}><Input value={f.model} onChange={(e) => set('model', e.target.value)} /></Field>
                        <Field label="Unit system" required><Select value={f.unitSystem} onChange={(e) => set('unitSystem', e.target.value as typeof f.unitSystem)}>{Object.entries(catalog.unitSystems).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select></Field>
                        <Field label="Tags" hint="Comma separated — used by search."><Input value={f.tags} onChange={(e) => set('tags', e.target.value)} placeholder="riveting, sheet metal" /></Field>
                    </Section>

                    <Section id="specs" title="Specifications" description="Sample values unless certified." icon="ruler-combined" className="space-y-4">
                        <div className="grid gap-4 sm:grid-cols-[1fr_120px]">
                            <Field label="Weight" required error={err('weight.value')}><Input type="number" step="any" min="0" value={f.wValue} onChange={(e) => set('wValue', e.target.value)} /></Field>
                            <Field label="Unit"><Select value={f.wUnit} onChange={(e) => set('wUnit', e.target.value as typeof f.wUnit)}>{['kg', 'g', 'lb', 'oz'].map((u) => <option key={u}>{u}</option>)}</Select></Field>
                        </div>
                        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                            {(['dL', 'dW', 'dH'] as const).map((k, i) => <Field key={k} label={['Length', 'Width', 'Height'][i]} required error={err(`dimensions.${['length', 'width', 'height'][i]}`)}><Input type="number" step="any" min="0" value={f[k]} onChange={(e) => set(k, e.target.value)} /></Field>)}
                            <Field label="Unit"><Select value={f.dUnit} onChange={(e) => set('dUnit', e.target.value as typeof f.dUnit)}>{['mm', 'cm', 'in'].map((u) => <option key={u}>{u}</option>)}</Select></Field>
                        </div>
                        <Checkbox checked={f.isSample} onChange={(v) => set('isSample', v)} label="Flag as sample data" description="Shows a “Sample data” badge in the app until real specifications are confirmed." />
                    </Section>

                    <Section id="content" title="Learning content" icon="book-alt" className="space-y-4">
                        <Field label="Aircraft applications" required hint="One per line." error={err('aircraftApplications')}><Textarea rows={3} value={f.apps} onChange={(e) => set('apps', e.target.value)} /></Field>
                        <Field label="Purpose" required error={err('purpose')}><Textarea rows={3} value={f.purpose} onChange={(e) => set('purpose', e.target.value)} /></Field>
                        <Field label="How it works" required error={err('howItWorks')}><Textarea rows={4} value={f.howItWorks} onChange={(e) => set('howItWorks', e.target.value)} /></Field>
                        <Field label="How to use it — steps" required hint="One step per line; the app numbers them." error={err('howToUse')}><Textarea rows={6} value={f.howToUse} onChange={(e) => set('howToUse', e.target.value)} /></Field>
                        <div className="grid gap-4 lg:grid-cols-2">
                            <Field label="Maintenance" required hint="One per line." error={err('maintenance')}><Textarea rows={5} value={f.maintenance} onChange={(e) => set('maintenance', e.target.value)} /></Field>
                            <Field label="Safety (PPE & hazards)" required hint="One per line." error={err('safety')}><Textarea rows={5} value={f.safety} onChange={(e) => set('safety', e.target.value)} /></Field>
                        </div>
                    </Section>

                    <Section id="model" title="3D model & parts" description="Learners rotate the model and tap numbered points to hear each part." icon="cube" className="space-y-5">
                        <ModelStudio toolId={tool?.id ?? null} initialJobs={jobs} initialPhotos={photos} ai={ai} canUseAi={canAi && manage} glb={f.glb}
                            onUse={(url) => { setF((s) => ({ ...s, glb: url, hotspots: url ? s.hotspots : [0, 1, 2].map((n) => s.hotspots[n] ?? { label: '', description: '' }), positions: url ? s.positions : [null, null, null] })); setDirty(true); }}
                            parts={f.hotspots} positions={f.positions} onParts={(hotspots, positions) => { setF((s) => ({ ...s, hotspots, positions })); setDirty(true); }} />
                        <div className="grid gap-4 border-t border-border pt-5 lg:grid-cols-[1fr_1.4fr]">
                            <div className="space-y-3">
                                <Field label={f.glb ? 'Fallback placeholder' : 'Placeholder model'} hint={f.glb ? 'Shown while the 3D file downloads, or if it cannot load.' : 'Built-in shape used until you attach a real 3D model.'}>
                                    <Select value={f.archetype} onChange={(e) => set('archetype', e.target.value)}>{archetypes.map((a) => <option key={a.name}>{a.name}</option>)}</Select>
                                </Field>
                                <p className="text-xs text-muted">{f.glb ? 'Real models have no moving parts, so there are no animations.' : `Animations: ${arch?.animations.join(', ') || '—'}.`}</p>
                            </div>
                            {!f.glb && previewTool ? <div className="h-48 overflow-hidden rounded-xl bg-gradient-to-b from-surface-2 to-surface-3"><ToolViewer tool={previewTool} autoRotate /></div> : null}
                        </div>
                        {!f.glb ? (
                            <div className="space-y-3">
                                <p className="text-sm font-medium text-text-2">Hotspots <span className="font-normal text-muted">— the placeholder has exactly 3 points, in this order</span></p>
                                {err('hotspots') ? <p className="text-xs font-medium text-danger">{err('hotspots')}</p> : null}
                                {f.hotspots.map((h, i) => (
                                    <div key={i} className="grid gap-3 rounded-xl border border-border p-3 md:grid-cols-[auto_1fr_2fr]">
                                        <span className="grid size-7 place-items-center rounded-full bg-amber-500 text-sm font-bold text-white">{i + 1}</span>
                                        <Input aria-label={`Hotspot ${i + 1} label`} placeholder="Label" value={h.label} onChange={(e) => set('hotspots', f.hotspots.map((x, n) => (n === i ? { ...x, label: e.target.value } : x)))} />
                                        <Input aria-label={`Hotspot ${i + 1} description`} placeholder="Description (also spoken)" value={h.description} onChange={(e) => set('hotspots', f.hotspots.map((x, n) => (n === i ? { ...x, description: e.target.value } : x)))} />
                                    </div>
                                ))}
                            </div>
                        ) : null}
                    </Section>

                    <Section id="voice" title="Voice-over" description="Leave blank to write it automatically from the text above (recommended)." icon="volume" className="grid gap-4 md:grid-cols-2">
                        <Field label="Purpose narration"><Textarea rows={3} value={f.voPurpose} onChange={(e) => set('voPurpose', e.target.value)} placeholder="Automatic" /></Field>
                        <Field label="How it works narration"><Textarea rows={3} value={f.voHow} onChange={(e) => set('voHow', e.target.value)} placeholder="Automatic" /></Field>
                        <Field label="How to use narration"><Textarea rows={3} value={f.voUse} onChange={(e) => set('voUse', e.target.value)} placeholder="Automatic" /></Field>
                        <Field label="Maintenance narration"><Textarea rows={3} value={f.voCare} onChange={(e) => set('voCare', e.target.value)} placeholder="Automatic" /></Field>
                    </Section>

                    <Section id="video" title="Video tutorial" icon="video-camera" className="space-y-4">
                        <div className="rounded-xl bg-surface-2 px-4"><Switch checked={f.hasVideo} onChange={(v) => set('hasVideo', v)} label="This tool has a video" description="Videos are downloaded with the pack so they play offline." /></div>
                        {f.hasVideo ? (
                            <div className="grid gap-4 sm:grid-cols-[1fr_160px]">
                                <Field label="Video file" hint="Path from the Media library (videos/…) or an https URL." error={err('video.file')}>
                                    <Input list="video-files" value={f.videoFile} onChange={(e) => set('videoFile', e.target.value)} className="font-mono text-xs" />
                                    <datalist id="video-files">{videos.map((v) => <option key={v} value={v} />)}</datalist>
                                </Field>
                                <Field label="Length (seconds)" error={err('video.durationSec')}><Input type="number" min="1" value={f.videoDur} onChange={(e) => set('videoDur', e.target.value)} /></Field>
                            </div>
                        ) : null}
                    </Section>

                    <Section id="refs" title="References" description="At least one: FAA handbooks, AC 43.13-1B, manufacturer manuals." icon="books" className="space-y-3">
                        {err('references') ? <p className="text-xs font-medium text-danger">{err('references')}</p> : null}
                        {f.refs.map((r, i) => (
                            <div key={i} className="relative grid gap-3 rounded-xl border border-border p-4 md:grid-cols-2">
                                <Field label="Title" required error={err(`references.${i}.title`)}><Input value={r.title} onChange={(e) => set('refs', f.refs.map((x, n) => (n === i ? { ...x, title: e.target.value } : x)))} /></Field>
                                <Field label="Publisher" required error={err(`references.${i}.publisher`)}><Input value={r.publisher} onChange={(e) => set('refs', f.refs.map((x, n) => (n === i ? { ...x, publisher: e.target.value } : x)))} /></Field>
                                <Field label="Chapter / section"><Input value={r.section} onChange={(e) => set('refs', f.refs.map((x, n) => (n === i ? { ...x, section: e.target.value } : x)))} /></Field>
                                <Field label="URL" error={err(`references.${i}.url`)}><Input value={r.url} onChange={(e) => set('refs', f.refs.map((x, n) => (n === i ? { ...x, url: e.target.value } : x)))} placeholder="https://" /></Field>
                                {f.refs.length > 1 ? <IconButton icon="trash" label="Remove reference" size="sm" className="absolute right-2 top-2 hover:text-danger" onClick={() => set('refs', f.refs.filter((_, n) => n !== i))} /> : null}
                            </div>
                        ))}
                        <Button size="sm" variant="secondary" icon="add" onClick={() => set('refs', [...f.refs, { title: '', publisher: '', section: '', url: '' }])}>Add reference</Button>
                    </Section>
                </fieldset>

                <aside className="hidden xl:block">
                    <div className="sticky top-24 space-y-4">
                        <Card padded={false}>
                            <div className="p-4"><Switch checked={f.isPublished} disabled={!manage} onChange={(v) => set('isPublished', v)} label="Include in next pack" description="Off = draft, kept out of content packs." /></div>
                            {manage ? (
                                <div className="space-y-2 border-t border-border p-4">
                                    <Button block icon="disk" loading={saving} onClick={save}>{tool ? 'Save changes' : 'Create tool'}</Button>
                                    {tool ? <Button block variant="ghost" icon="trash" className="text-danger" onClick={remove}>Delete tool</Button> : null}
                                </div>
                            ) : null}
                        </Card>
                        <Card padded={false} className="p-2">
                            <p className="label-caps px-2 pb-1 pt-2">On this page</p>
                            {SECTIONS.map((s) => <a key={s.id} href={`#${s.id}`} className="flex items-center gap-2.5 rounded-lg px-2 py-2 text-sm text-text-2 hover:bg-surface-2 hover:text-text"><Icon name={s.icon} className="text-muted" />{s.label}</a>)}
                        </Card>
                    </div>
                </aside>
            </div>

            {manage ? (
                <div className="sticky bottom-0 z-20 -mx-4 mt-6 flex items-center gap-3 border-t border-border bg-surface/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8 xl:hidden">
                    <Switch checked={f.isPublished} onChange={(v) => set('isPublished', v)} label="Published" />
                    <Button icon="disk" loading={saving} onClick={save} className="shrink-0">{tool ? 'Save' : 'Create'}</Button>
                </div>
            ) : null}
            {dirty && manage ? <div className="pointer-events-none fixed bottom-20 right-6 z-30 hidden rounded-full bg-slate-900 px-3 py-1.5 text-xs font-medium text-white shadow-lg xl:block">Unsaved changes</div> : null}
        </>
    );
}
