import { Head, router, useForm, usePage } from '@inertiajs/react';
import { useState } from 'react';
import { Pagination, Table, Td } from '@/components/admin/kit';
import { Alert, Badge, Button, Card, CardHeader, EmptyState, Field, Icon, IconButton, Input, Modal, Textarea, fmtDateTime, useConfirm, type Tone } from '@/components/ui';
import { PageHeader } from '@/layouts/admin-layout';
import { fmtBytes } from '@/shared/lib/format';
import { can, type Paginated, type SharedProps } from '@/types';

type Changelog = Record<string, string[] | string | undefined>;
interface Pack { version: string; releasedAt: string; tools: number; quizzes: number; size: number; sha256: string; isPublished: boolean; minAppVersion: string; changelog: Changelog; publisher: string | null }
interface Props {
    packs: Paginated<Pack>; latest: { version: string; tools: number; quizzes: number } | null; draft: Changelog; changes: number;
    next: { tools: number; quizzes: number }; problems: string[]; suggested: string; appVersion: string;
}

const LISTS: [string, string, Tone][] = [
    ['toolsAdded', 'Tools added', 'success'], ['toolsUpdated', 'Tools updated', 'info'], ['toolsRemoved', 'Tools removed', 'danger'],
    ['quizzesAdded', 'Quizzes added', 'success'], ['quizzesUpdated', 'Quizzes updated', 'info'], ['quizzesRemoved', 'Quizzes removed', 'danger'],
];

export function ChangeLists({ c, limit = 10 }: { c: Changelog; limit?: number }) {
    const any = LISTS.some(([k]) => (c[k] as string[] | undefined)?.length);
    if (!any) return <p className="text-sm text-muted">No tool or quiz changes.</p>;
    return (
        <div className="grid gap-4 sm:grid-cols-2">
            {LISTS.map(([k, label, tone]) => {
                const items = (c[k] as string[] | undefined) ?? [];
                if (!items.length) return null;
                return (
                    <div key={k}>
                        <Badge tone={tone}>{label} · {items.length}</Badge>
                        <ul className="mt-2 space-y-1 text-sm text-text-2">
                            {items.slice(0, limit).map((n) => <li key={n} className="flex gap-2"><span className="text-muted">•</span>{n}</li>)}
                            {items.length > limit ? <li className="text-xs text-muted">+ {items.length - limit} more</li> : null}
                        </ul>
                    </div>
                );
            })}
        </div>
    );
}

export default function Packs(p: Props) {
    const { props } = usePage<SharedProps>();
    const publish = can(props.auth.user, 'packs.publish');
    const confirm = useConfirm();
    const form = useForm({ version: p.suggested, minAppVersion: '1.0.0', notes: '' });
    const [details, setDetails] = useState<Pack | null>(null);
    const blocked = p.problems.length > 0;

    const submit = async () => {
        if (!(await confirm({ title: `Publish v${form.data.version}?`, message: <>Learners will be offered this pack in <b>Settings → Content updates</b>. Published versions are immutable.</>, confirmLabel: 'Build & publish', tone: 'primary', icon: 'box' }))) return;
        form.post('/admin/packs', { preserveScroll: true, onSuccess: () => form.setData('notes', '') });
    };
    const toggle = async (pk: Pack) => {
        if (pk.isPublished && !(await confirm({ title: `Withdraw v${pk.version}?`, message: "Learners who haven't installed it won't be offered it any more. Devices that already installed it keep it.", confirmLabel: 'Withdraw' }))) return;
        router.post(`/admin/packs/${pk.version}/toggle`, {}, { preserveScroll: true });
    };

    return (
        <>
            <Head title="Content packs" />
            <PageHeader title="Content packs" icon="box" description="A pack is an immutable, versioned snapshot of every published tool and quiz. Learners install it manually — it then works fully offline." />

            {publish ? (
                <Card padded={false} className="mb-6">
                    <CardHeader icon="rocket-lunch" title="Publish a new pack" description={<>Will contain <b className="text-text">{p.next.tools} tools</b> and <b className="text-text">{p.next.quizzes} quizzes</b>{p.latest ? <> · live: v{p.latest.version} ({p.latest.tools} tools)</> : null}</>} />
                    <div className="grid gap-6 p-5 lg:grid-cols-[1.2fr_1fr]">
                        <div className="space-y-4">
                            <h4 className="text-sm font-semibold text-text">Changes since {p.latest ? `v${p.latest.version}` : 'the beginning'}</h4>
                            {p.changes ? <ChangeLists c={p.draft} /> : <Alert tone="info">Nothing has changed — publishing now would create an identical pack.</Alert>}
                            {blocked ? <Alert tone="danger" title="Publishing is blocked until these are fixed"><ul className="list-disc space-y-0.5 pl-4">{p.problems.slice(0, 8).map((x) => <li key={x}>{x}</li>)}</ul></Alert> : null}
                        </div>
                        <form onSubmit={(e) => { e.preventDefault(); void submit(); }} className="space-y-4 rounded-2xl bg-surface-2/70 p-4">
                            <div className="grid gap-4 sm:grid-cols-2">
                                <Field label="New version" required error={form.errors.version} hint="Higher than the latest."><Input value={form.data.version} onChange={(e) => form.setData('version', e.target.value)} className="font-mono" /></Field>
                                <Field label="Min. app version" required error={form.errors.minAppVersion} hint={`This app is v${p.appVersion}.`}><Input value={form.data.minAppVersion} onChange={(e) => form.setData('minAppVersion', e.target.value)} className="font-mono" /></Field>
                            </div>
                            <Field label="Release notes" hint="Shown to learners in the changelog."><Textarea rows={3} value={form.data.notes} onChange={(e) => form.setData('notes', e.target.value)} placeholder="What's new in this pack?" /></Field>
                            <Button type="submit" block icon="box" disabled={blocked} loading={form.processing}>Build & publish v{form.data.version}</Button>
                        </form>
                    </div>
                </Card>
            ) : null}

            <h2 className="mb-3 text-lg font-semibold text-text">Published packs</h2>
            <Table head={['Version', 'Released', 'Contents', { label: 'Size', className: 'hidden md:table-cell' }, { label: 'SHA-256', className: 'hidden lg:table-cell' }, 'Status', '']}
                empty={!p.packs.data.length ? <EmptyState icon="box" title="No packs yet" description="Publish your first pack to deliver content to learners." /> : null}>
                {p.packs.data.map((pk, i) => (
                    <tr key={pk.version} className="hover:bg-surface-2/50">
                        <Td><button type="button" onClick={() => setDetails(pk)} className="flex items-center gap-2 font-mono font-semibold text-text hover:text-primary">v{pk.version}{i === 0 && p.packs.current_page === 1 && pk.isPublished ? <Badge tone="primary">Latest</Badge> : null}</button></Td>
                        <Td className="whitespace-nowrap text-xs">{fmtDateTime(pk.releasedAt)}</Td>
                        <Td className="whitespace-nowrap">{pk.tools} tools · {pk.quizzes} quizzes</Td>
                        <Td className="hidden md:table-cell">{fmtBytes(pk.size)}</Td>
                        <Td className="hidden font-mono text-xs lg:table-cell">{pk.sha256.slice(0, 12)}…</Td>
                        <Td>{pk.isPublished ? <Badge tone="success" dot>Live</Badge> : <Badge tone="warning" dot>Withdrawn</Badge>}</Td>
                        <Td className="whitespace-nowrap text-right">
                            <IconButton icon="eye" label="View changelog" size="sm" onClick={() => setDetails(pk)} />
                            <a href={`/admin/packs/${pk.version}/download`} className="inline-flex size-8 items-center justify-center rounded-lg text-muted hover:bg-surface-2 hover:text-text" aria-label="Download JSON" title="Download JSON"><Icon name="download" /></a>
                            {publish ? <Button variant="ghost" size="xs" onClick={() => toggle(pk)} className={pk.isPublished ? 'text-danger' : 'text-success'}>{pk.isPublished ? 'Withdraw' : 'Restore'}</Button> : null}
                        </Td>
                    </tr>
                ))}
            </Table>
            <Pagination page={p.packs} noun="packs" />

            <Modal open={!!details} onOpenChange={(o) => !o && setDetails(null)} size="lg" icon="box" title={`Pack v${details?.version}`} description={details ? `${details.tools} tools · ${details.quizzes} quizzes · ${fmtBytes(details.size)} · needs app ${details.minAppVersion}+` : undefined}>
                {details ? (
                    <div className="space-y-5">
                        {details.changelog.notes ? <Alert tone="info" title="Release notes">{details.changelog.notes as string}</Alert> : null}
                        <ChangeLists c={details.changelog} limit={30} />
                        <div className="rounded-xl bg-surface-2 p-3"><p className="label-caps mb-1">SHA-256</p><p className="break-all font-mono text-xs text-text-2">{details.sha256}</p></div>
                        <p className="text-xs text-muted">Published {fmtDateTime(details.releasedAt)}{details.publisher ? ` by ${details.publisher}` : ''}</p>
                    </div>
                ) : null}
            </Modal>
        </>
    );
}
