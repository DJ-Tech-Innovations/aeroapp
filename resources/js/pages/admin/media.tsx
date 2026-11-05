import { Head, router, usePage } from '@inertiajs/react';
import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { MiniStats, Pagination, SearchInput, Toolbar, useFilters } from '@/components/admin/kit';
import { Badge, Button, Card, cn, EmptyState, Icon, IconButton, Segmented, fmtDay, useConfirm } from '@/components/ui';
import { PageHeader } from '@/layouts/admin-layout';
import { fmtBytes } from '@/shared/lib/format';
import { can, type Paginated, type SharedProps } from '@/types';

interface Item { id: string; name: string; path: string; url: string; kind: string; mime: string; size: number; created_at: string }
interface Props { media: Paginated<Item>; filters: { kind: string; q: string }; usage: { count: number; bytes: number }; maxMb: number }

const KIND_ICON: Record<string, string> = { video: 'video-camera', image: 'picture', audio: 'music-alt', model: 'cube', other: 'document' };

export default function Media({ media, filters, usage, maxMb }: Props) {
    const { props } = usePage<SharedProps>();
    const manage = can(props.auth.user, 'media.manage');
    const f = useFilters(filters);
    const confirm = useConfirm();
    const input = useRef<HTMLInputElement>(null);
    const [drag, setDrag] = useState(false);
    const [progress, setProgress] = useState<number | null>(null);

    const upload = (files: FileList | File[] | null) => {
        const list = [...(files ?? [])];
        if (!list.length) return;
        if (list.some((x) => x.size > maxMb * 1048576)) return toast.error(`Each file must be under ${maxMb} MB.`);
        router.post('/admin/media', { files: list }, {
            forceFormData: true, preserveScroll: true,
            onProgress: (e) => setProgress(e?.percentage ?? null),
            onFinish: () => { setProgress(null); if (input.current) input.current.value = ''; },
        });
    };
    const copy = (path: string) => { void navigator.clipboard?.writeText(path); toast.success('Path copied', { description: path }); };
    const remove = async (m: Item) => {
        if (await confirm({ title: `Delete ${m.name}?`, message: 'Tools that point to this file would lose their media. Files in use are protected.', confirmLabel: 'Delete file' })) router.delete(`/admin/media/${m.id}`, { preserveScroll: true });
    };

    return (
        <>
            <Head title="Media library" />
            <PageHeader title="Media library" icon="picture" description="Videos, images, audio and 3D files used by tools. Learners download the files a pack references so they play offline." />
            <MiniStats items={[
                { label: 'Files', value: usage.count, icon: 'folder' },
                { label: 'Storage used', value: fmtBytes(usage.bytes), icon: 'database', tone: 'bg-info-soft text-info' },
                { label: 'Max file size', value: `${maxMb} MB`, icon: 'upload', tone: 'bg-surface-2 text-muted' },
                { label: 'On this page', value: media.data.length, icon: 'apps', tone: 'bg-surface-2 text-muted' },
            ]} />

            {manage ? (
                <div onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)} onDrop={(e) => { e.preventDefault(); setDrag(false); upload(e.dataTransfer.files); }}
                    className={cn('mb-6 flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed px-6 py-10 text-center transition', drag ? 'border-primary bg-primary-soft' : 'border-border-strong bg-surface')}>
                    <span className="flex size-14 items-center justify-center rounded-2xl bg-primary-soft text-2xl text-primary-soft-fg"><Icon name="cloud-upload" /></span>
                    <div>
                        <p className="font-semibold text-text">Drop files here, or browse</p>
                        <p className="text-sm text-muted">MP4/WebM video, JPG/PNG/WebP, MP3 and GLB — up to {maxMb} MB each, 10 at a time.</p>
                    </div>
                    <input ref={input} type="file" multiple hidden accept="video/mp4,video/webm,image/*,audio/mpeg,.glb" onChange={(e) => upload(e.target.files)} />
                    {progress != null ? (
                        <div className="w-full max-w-xs"><div className="h-2 overflow-hidden rounded-full bg-surface-3"><div className="h-full bg-primary transition-all" style={{ width: `${progress}%` }} /></div><p className="mt-1 text-xs text-muted">Uploading… {progress}%</p></div>
                    ) : <Button icon="upload" onClick={() => input.current?.click()}>Choose files</Button>}
                </div>
            ) : null}

            <Toolbar>
                <SearchInput value={f.values.q} onChange={(v) => f.set('q', v)} placeholder="Search files" />
                <Segmented size="sm" value={(f.values.kind || 'all') as string} onChange={(v) => f.set('kind', v === 'all' ? '' : v)} options={[
                    { value: 'all', label: 'All' }, { value: 'video', label: 'Videos', icon: 'video-camera' }, { value: 'image', label: 'Images', icon: 'picture' }, { value: 'audio', label: 'Audio', icon: 'music-alt' }, { value: 'model', label: '3D', icon: 'cube' },
                ]} />
            </Toolbar>

            {media.data.length ? (
                <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
                    {media.data.map((m) => (
                        <Card key={m.id} padded={false} interactive className="group overflow-hidden">
                            <div className="relative flex aspect-video items-center justify-center bg-surface-2">
                                {m.kind === 'image' ? <img src={m.url} alt="" loading="lazy" className="h-full w-full object-cover" />
                                    : m.kind === 'video' ? <video src={m.url} preload="metadata" muted className="h-full w-full bg-black object-cover" />
                                        : <Icon name={KIND_ICON[m.kind] ?? 'document'} className="text-4xl text-muted" />}
                                <Badge tone="neutral" icon={KIND_ICON[m.kind]} className="absolute left-2 top-2 bg-surface/90 capitalize">{m.kind}</Badge>
                            </div>
                            <div className="p-3">
                                <p className="truncate text-sm font-semibold text-text" title={m.name}>{m.name}</p>
                                <button type="button" onClick={() => copy(m.path)} className="mt-0.5 flex max-w-full items-center gap-1 truncate font-mono text-[11px] text-muted hover:text-primary" title="Copy path"><Icon name="copy" className="text-[10px]" />{m.path}</button>
                                <div className="mt-2 flex items-center justify-between text-xs text-muted">
                                    <span>{fmtBytes(m.size)} · {fmtDay(m.created_at)}</span>
                                    <span className="flex">
                                        <a href={m.url} target="_blank" rel="noreferrer" className="inline-flex size-7 items-center justify-center rounded-md hover:bg-surface-2 hover:text-text" aria-label="Open"><Icon name="arrow-up-right-from-square" /></a>
                                        {manage ? <IconButton icon="trash" label={`Delete ${m.name}`} size="sm" className="size-7 hover:text-danger" onClick={() => remove(m)} /> : null}
                                    </span>
                                </div>
                            </div>
                        </Card>
                    ))}
                </div>
            ) : <Card><EmptyState icon="picture" title="No files yet" description="Upload tutorial videos, photos and 3D models." /></Card>}
            <Pagination page={media} noun="files" />
        </>
    );
}
