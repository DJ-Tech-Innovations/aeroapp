import { useEffect, useRef, useState } from 'react';
import { Alert, Badge, Button, cn, Icon, Input, Textarea, useConfirm } from '@/components/ui';
import { http } from '@/lib/http';
import { ModelPreview, type Vec3 } from '@/viewer';

export interface ModelJob {
    id: string; status: 'queued' | 'processing' | 'ready' | 'failed'; progress: number; createdAt: string; error: string | null; sizeBytes: number | null;
    glbUrl: string | null; thumbnailUrl: string | null; photoUrls: string[]; photoPaths: string[];
}
export interface ToolPhoto { path: string; url: string; name: string }
interface Part { label: string; description: string }
type Msg = { tone: 'danger' | 'info' | 'success'; text: string } | null;

interface Props {
    toolId: string | null; initialJobs: ModelJob[]; initialPhotos: ToolPhoto[]; ai: { meshy: boolean; anthropic: boolean }; canUseAi: boolean;
    glb: string | null; onUse: (url: string | null) => void;
    parts: Part[]; positions: (Vec3 | null)[]; onParts: (parts: Part[], positions: (Vec3 | null)[]) => void;
}

const MAX_PHOTOS = 4;
const MAX_PARTS = 20;
const pending = (j: ModelJob) => j.status === 'queued' || j.status === 'processing';
const STATUS: Record<ModelJob['status'], { label: string; tone: 'neutral' | 'info' | 'success' | 'danger' }> = {
    queued: { label: 'Queued', tone: 'neutral' }, processing: { label: 'Generating', tone: 'info' }, ready: { label: 'Ready', tone: 'success' }, failed: { label: 'Failed', tone: 'danger' },
};

export function ModelStudio({ toolId, initialJobs, initialPhotos, ai, canUseAi, glb, onUse, parts, positions, onParts }: Props) {
    const confirm = useConfirm();
    const [jobs, setJobs] = useState(initialJobs);
    const [photos, setPhotos] = useState(initialPhotos);
    const [selected, setSelected] = useState<string[]>([]);
    const [busy, setBusy] = useState<'upload' | 'generate' | 'suggest' | null>(null);
    const [msg, setMsg] = useState<Msg>(null);
    const [partsMsg, setPartsMsg] = useState<Msg>(null);
    const [preview, setPreview] = useState<string | null>(glb ?? initialJobs.find((j) => j.glbUrl)?.glbUrl ?? null);
    const [placing, setPlacing] = useState<number | null>(null);
    const [prompt, setPrompt] = useState('');
    const [glbUrl, setGlbUrl] = useState('');
    const input = useRef<HTMLInputElement>(null);

    // Poll running generations; the server copies finished models into our own storage.
    const hasPending = jobs.some(pending);
    useEffect(() => {
        if (!hasPending) return;
        const t = setInterval(async () => {
            const results = await Promise.all(jobs.filter(pending).map((j) => http<{ job: ModelJob }>(`/admin/studio/jobs/${j.id}`).then((r) => r.job).catch(() => null)));
            setJobs((cur) => cur.map((j) => results.find((r) => r?.id === j.id) ?? j));
            const done = results.find((r) => r?.status === 'ready');
            if (done) { setPreview(done.glbUrl); setMsg({ tone: 'success', text: 'Model ready. Preview it, then “Use this model” and place its parts.' }); }
        }, 5000);
        return () => clearInterval(t);
    }, [hasPending, jobs]);

    if (!toolId) return <Alert tone="info" title="Save the tool first">Then you can generate a 3D model from photos, or attach your own GLB file.</Alert>;

    const upload = async (list: FileList | null) => {
        const files = [...(list ?? [])].filter((f) => /^image\/(jpeg|png|webp)$/.test(f.type));
        if (!files.length) return setMsg({ tone: 'danger', text: 'Choose JPG, PNG or WebP photos.' });
        setBusy('upload');
        setMsg({ tone: 'info', text: `Uploading ${files.length} photo${files.length > 1 ? 's' : ''}…` });
        try {
            const fd = new FormData();
            files.forEach((f) => fd.append('photos[]', f));
            const r = await http<{ photos: ToolPhoto[] }>(`/admin/studio/tools/${toolId}/photos`, { method: 'POST', body: fd });
            setPhotos((p) => [...r.photos, ...p]);
            setSelected((s) => [...s, ...r.photos.map((p) => p.path)].slice(0, MAX_PHOTOS));
            setMsg({ tone: 'success', text: 'Photos added. Select up to 4 of the same tool, then generate.' });
        } catch (e) { setMsg({ tone: 'danger', text: (e as Error).message }); } finally { setBusy(null); if (input.current) input.current.value = ''; }
    };
    const removePhoto = async (path: string) => {
        if (!(await confirm({ title: 'Delete this photo?', confirmLabel: 'Delete' }))) return;
        await http(`/admin/studio/tools/${toolId}/photos`, { method: 'DELETE', json: { path } }).catch((e) => setMsg({ tone: 'danger', text: e.message }));
        setPhotos((p) => p.filter((x) => x.path !== path));
        setSelected((s) => s.filter((p) => p !== path));
    };
    const toggle = (path: string) => setSelected((s) => (s.includes(path) ? s.filter((p) => p !== path) : s.length >= MAX_PHOTOS ? s : [...s, path]));

    const generate = async (paths: string[]) => {
        setBusy('generate');
        setMsg({ tone: 'info', text: 'Sending to Meshy…' });
        try {
            const r = await http<{ job: ModelJob }>(`/admin/studio/tools/${toolId}/jobs`, { method: 'POST', json: { paths } });
            setJobs((j) => [r.job, ...j]);
            setSelected([]);
            setMsg({ tone: 'info', text: 'Generating. This usually takes 1–3 minutes — you can keep editing.' });
        } catch (e) { setMsg({ tone: 'danger', text: (e as Error).message }); } finally { setBusy(null); }
    };
    const removeJob = async (j: ModelJob) => {
        if (!(await confirm({ title: 'Delete this generation?', message: 'Learners on an older pack that uses it fall back to the placeholder model.', confirmLabel: 'Delete' }))) return;
        await http(`/admin/studio/jobs/${j.id}`, { method: 'DELETE' });
        setJobs((l) => l.filter((x) => x.id !== j.id));
        if (preview === j.glbUrl) setPreview(glb);
    };

    const use = (url: string | null) => {
        onUse(url);
        setPlacing(null);
        if (!url) return;
        onParts(parts, parts.map(() => null)); // positions belong to a specific model
        setPreview(url);
        setPlacing(0);
        setMsg({ tone: 'info', text: 'Now name the parts and place each one on the model (click “Place”, then click the model). Save the tool when done.' });
    };
    const place = (i: number, p: Vec3) => {
        onParts(parts, parts.map((_, n) => (n === i ? p : positions[n] ?? null)));
        const next = parts.findIndex((_, n) => n > i && !positions[n]);
        setPlacing(next >= 0 ? next : null);
    };
    const editPart = (i: number, patch: Partial<Part>) => onParts(parts.map((x, n) => (n === i ? { ...x, ...patch } : x)), positions);
    const addPart = () => { onParts([...parts, { label: '', description: '' }], [...positions, null]); setPlacing(parts.length); };
    const removePart = (i: number) => { onParts(parts.filter((_, n) => n !== i), positions.filter((_, n) => n !== i)); setPlacing(null); };

    const partPhotos = () => jobs.find((j) => j.glbUrl && j.glbUrl === glb)?.photoPaths ?? (selected.length ? selected : photos.slice(0, MAX_PHOTOS).map((p) => p.path));
    const suggest = async () => {
        if (parts.some((p) => p.label.trim()) && !(await confirm({ title: `Replace the current ${parts.length} parts?`, message: 'Claude will suggest a new list from the photos.', confirmLabel: 'Replace', tone: 'primary' }))) return;
        setBusy('suggest');
        setPartsMsg({ tone: 'info', text: 'Claude is studying the photos…' });
        try {
            const r = await http<{ parts: { name: string; purpose: string }[] }>(`/admin/studio/tools/${toolId}/parts`, { method: 'POST', json: { paths: partPhotos(), prompt } });
            onParts(r.parts.map((p) => ({ label: p.name, description: p.purpose })), r.parts.map(() => null));
            setPlacing(0);
            setPartsMsg({ tone: 'success', text: `${r.parts.length} parts suggested. Check the wording, then place each one on the model.` });
        } catch (e) { setPartsMsg({ tone: 'danger', text: (e as Error).message }); } finally { setBusy(null); }
    };

    const editing = !!preview && preview === glb;
    const placedCount = positions.filter(Boolean).length;

    return (
        <div className="grid gap-5 xl:grid-cols-[1.25fr_1fr]">
            <div className="flex min-w-0 flex-col gap-3">
                <div className="relative h-80 overflow-hidden rounded-xl border border-border bg-gradient-to-b from-surface-2 to-surface-3 sm:h-96">
                    {preview ? <ModelPreview url={preview} hotspots={editing ? parts.map((h, i) => ({ label: h.label, position: positions[i] ?? null })) : []} placing={editing ? placing : null} onPlace={place} />
                        : <div className="grid h-full place-items-center p-6 text-center text-sm text-muted"><div><Icon name="cube" className="mb-2 text-4xl" /><p>No AI model yet — learners see the placeholder shape.</p></div></div>}
                    {preview ? <span className="absolute left-3 top-3"><Badge tone={editing ? 'primary' : 'neutral'}>{editing ? 'Used by this tool' : 'Preview only'}</Badge></span> : null}
                    {editing && placing != null ? <span className="absolute inset-x-3 bottom-3 rounded-lg bg-slate-900/85 px-3 py-2 text-center text-xs font-medium text-white">Click the model to place part {placing + 1}{parts[placing]?.label ? ` — ${parts[placing].label}` : ''}</span> : null}
                </div>

                {editing ? (
                    <div className="flex flex-col gap-3 rounded-xl border border-border p-4">
                        <div className="flex items-center justify-between gap-2">
                            <h4 className="font-semibold text-text">Parts</h4>
                            <Badge tone={placedCount === parts.length ? 'success' : 'warning'}>{placedCount}/{parts.length} placed</Badge>
                        </div>
                        {canUseAi && ai.anthropic ? (
                            <div className="space-y-2 rounded-lg bg-surface-2 p-3">
                                <label htmlFor="parts-prompt" className="flex items-center gap-2 text-sm font-semibold text-text"><Icon name="sparkles" className="text-primary" />Suggest parts with Claude <span className="font-normal text-muted">(optional instructions)</span></label>
                                <Textarea id="parts-prompt" rows={2} value={prompt} onChange={(e) => setPrompt(e.target.value)} maxLength={2000} placeholder="e.g. Focus on the controls and safety features. Use beginner-friendly words." />
                                <Button size="sm" icon="sparkles" onClick={suggest} loading={busy === 'suggest'} disabled={!photos.length}>{busy === 'suggest' ? 'Analysing photos…' : 'Suggest parts'}</Button>
                                {!photos.length ? <p className="text-xs text-muted">Upload a photo of the tool first.</p> : null}
                                {partsMsg ? <Alert tone={partsMsg.tone}>{partsMsg.text}</Alert> : null}
                            </div>
                        ) : null}
                        {parts.map((h, i) => (
                            <div key={i} className={cn('flex gap-3 rounded-xl border p-3', placing === i ? 'border-primary bg-primary-soft/40' : 'border-border')}>
                                <span className={cn('grid size-7 shrink-0 place-items-center rounded-full text-sm font-bold', positions[i] ? 'bg-amber-500 text-white' : 'bg-surface-2 text-muted')}>{i + 1}</span>
                                <div className="flex min-w-0 flex-1 flex-col gap-2">
                                    <Input value={h.label} onChange={(e) => editPart(i, { label: e.target.value })} placeholder="Part name, e.g. Anvil" aria-label={`Part ${i + 1} name`} />
                                    <Textarea rows={2} value={h.description} onChange={(e) => editPart(i, { description: e.target.value })} placeholder="What it does (also spoken aloud)" aria-label={`Part ${i + 1} purpose`} />
                                    <div className="flex flex-wrap items-center gap-2">
                                        <Button size="xs" variant={placing === i ? 'primary' : 'secondary'} icon="target" onClick={() => setPlacing(placing === i ? null : i)}>{placing === i ? 'Click the model…' : positions[i] ? 'Re-place' : 'Place on model'}</Button>
                                        {positions[i] ? <Badge tone="success" icon="check">Placed</Badge> : <Badge tone="warning">Not placed</Badge>}
                                        {parts.length > 1 ? <Button size="xs" variant="ghost" className="text-danger" onClick={() => removePart(i)}>Remove</Button> : null}
                                    </div>
                                </div>
                            </div>
                        ))}
                        {parts.length < MAX_PARTS ? <div><Button size="sm" variant="secondary" icon="add" onClick={addPart}>Add part</Button></div> : null}
                    </div>
                ) : preview && glb !== preview ? (
                    <div className="rounded-xl border border-dashed border-border-strong p-4 text-sm text-muted">
                        This is a preview. Click <b className="text-text">Use this model</b> to make learners see it, then name and place its parts.
                        <div className="mt-3"><Button size="sm" icon="check" onClick={() => use(preview)}>Use this model</Button></div>
                    </div>
                ) : null}
                {glb ? <div><Button size="sm" variant="ghost" icon="undo" onClick={() => use(null)}>Stop using the 3D model (back to placeholder)</Button></div> : null}
            </div>

            <div className="flex min-w-0 flex-col gap-4">
                <div className="space-y-2 rounded-xl border border-border p-4">
                    <h4 className="flex items-center gap-2 font-semibold text-text"><Icon name="link-alt" className="text-muted" />Use an existing GLB</h4>
                    <p className="text-xs text-muted">Upload a .glb in the Media library, then paste its path (e.g. /storage/models/library/drill.glb).</p>
                    <div className="flex gap-2"><Input value={glbUrl} onChange={(e) => setGlbUrl(e.target.value)} placeholder="/storage/…/model.glb" /><Button variant="secondary" disabled={!/\.glb(\?|$)/i.test(glbUrl)} onClick={() => { setPreview(glbUrl); use(glbUrl); }}>Use</Button></div>
                </div>

                {canUseAi ? (
                    <div className="space-y-3 rounded-xl border border-border p-4">
                        <div className="flex items-center justify-between gap-2">
                            <h4 className="flex items-center gap-2 font-semibold text-text"><Icon name="magic-wand" className="text-primary" />Generate from photos</h4>
                            {!ai.meshy ? <Badge tone="warning">Meshy key needed</Badge> : null}
                        </div>
                        <p className="text-xs text-muted">Plain background, even light: front, side and back. JPG, PNG or WebP up to 20 MB.</p>
                        <input ref={input} type="file" multiple hidden accept="image/jpeg,image/png,image/webp" onChange={(e) => upload(e.target.files)} />
                        <Button size="sm" variant="secondary" icon="upload" loading={busy === 'upload'} onClick={() => input.current?.click()}>Upload photos</Button>
                        {photos.length ? (
                            <>
                                <p className="text-xs text-muted">Select 1–{MAX_PHOTOS} photos of the same tool ({selected.length} selected).</p>
                                <div className="grid grid-cols-4 gap-2">
                                    {photos.map((ph) => {
                                        const n = selected.indexOf(ph.path);
                                        return (
                                            <div key={ph.path} className="group relative">
                                                <button type="button" onClick={() => toggle(ph.path)} aria-pressed={n >= 0} title={ph.name} className={cn('block aspect-square w-full overflow-hidden rounded-lg border-2 transition', n >= 0 ? 'border-primary' : 'border-transparent opacity-75 hover:opacity-100')}>
                                                    <img src={ph.url} alt={ph.name} className="h-full w-full object-cover" loading="lazy" />
                                                </button>
                                                {n >= 0 ? <span className="pointer-events-none absolute left-1 top-1 grid size-5 place-items-center rounded-full bg-primary text-[11px] font-bold text-white">{n + 1}</span> : null}
                                                <button type="button" onClick={() => removePhoto(ph.path)} aria-label={`Delete ${ph.name}`} className="absolute right-1 top-1 hidden size-5 place-items-center rounded-full bg-surface/90 text-[10px] text-danger group-hover:grid"><Icon name="cross-small" /></button>
                                            </div>
                                        );
                                    })}
                                </div>
                            </>
                        ) : null}
                        <Button block icon="magic-wand" onClick={() => generate(selected)} loading={busy === 'generate'} disabled={!ai.meshy || !selected.length || !!busy}>
                            Generate 3D model{selected.length ? ` from ${selected.length} photo${selected.length > 1 ? 's' : ''}` : ''}
                        </Button>
                        {msg ? <Alert tone={msg.tone}>{msg.text}</Alert> : null}
                    </div>
                ) : null}

                {jobs.length ? (
                    <div className="space-y-2">
                        <h4 className="text-sm font-semibold text-text">Generations</h4>
                        {jobs.map((j) => (
                            <div key={j.id} className={cn('flex gap-3 rounded-xl border p-2.5', j.glbUrl && j.glbUrl === preview ? 'border-primary' : 'border-border')}>
                                <div className="size-14 shrink-0 overflow-hidden rounded-lg bg-surface-2">{j.thumbnailUrl ?? j.photoUrls[0] ? <img src={(j.thumbnailUrl ?? j.photoUrls[0])!} alt="" className="h-full w-full object-cover" /> : null}</div>
                                <div className="flex min-w-0 flex-1 flex-col gap-1">
                                    <div className="flex flex-wrap items-center gap-1.5 text-xs">
                                        <Badge tone={STATUS[j.status].tone}>{STATUS[j.status].label}{pending(j) ? ` ${j.progress}%` : ''}</Badge>
                                        {j.glbUrl && j.glbUrl === glb ? <Badge tone="primary">In use</Badge> : null}
                                        <span className="text-muted">{new Date(j.createdAt).toLocaleString()}</span>
                                    </div>
                                    {pending(j) ? <div className="h-1.5 overflow-hidden rounded-full bg-surface-3"><div className="h-full bg-primary transition-all" style={{ width: `${Math.max(4, j.progress)}%` }} /></div> : null}
                                    {j.error ? <p className="truncate text-xs text-danger" title={j.error}>{j.error}</p> : null}
                                    <div className="flex flex-wrap gap-1">
                                        {j.glbUrl ? <>
                                            <Button size="xs" variant="secondary" onClick={() => setPreview(j.glbUrl)}>Preview</Button>
                                            {j.glbUrl !== glb ? <Button size="xs" onClick={() => use(j.glbUrl)}>Use</Button> : null}
                                        </> : null}
                                        {j.status === 'failed' ? <Button size="xs" variant="secondary" disabled={!!busy} onClick={() => generate(j.photoPaths)}>Retry</Button> : null}
                                        {!pending(j) && j.glbUrl !== glb ? <Button size="xs" variant="ghost" className="text-danger" onClick={() => removeJob(j)}>Delete</Button> : null}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : null}
            </div>
        </div>
    );
}
