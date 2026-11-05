import { Head } from '@inertiajs/react';
import { FilterSelect, Pagination, SearchInput, Table, Td, Toolbar, useFilters } from '@/components/admin/kit';
import { Badge, EmptyState, Icon, fmtDateTime, timeAgo } from '@/components/ui';
import { PageHeader } from '@/layouts/admin-layout';
import type { Paginated } from '@/types';

interface Entry { id: number; action: string; subject: string; meta: Record<string, unknown> | null; at: string; user: string }
const ICON: Record<string, string> = { tool: 'tools', quiz: 'list-check', pack: 'box', user: 'user', role: 'shield-check', class: 'school', media: 'picture', settings: 'settings', auth: 'sign-in-alt', model: 'cube' };
const TONE: Record<string, 'success' | 'danger' | 'info' | 'neutral' | 'warning'> = { created: 'success', published: 'success', uploaded: 'success', deleted: 'danger', withdrawn: 'warning', deactivated: 'warning', updated: 'info' };

export default function Audit({ entries, filters, types }: { entries: Paginated<Entry>; filters: { q: string; type: string }; types: string[] }) {
    const f = useFilters(filters);
    return (
        <>
            <Head title="Audit trail" />
            <PageHeader title="Audit trail" icon="time-past" description="Who changed what, and when. Entries are kept permanently." />
            <Toolbar>
                <SearchInput value={f.values.q} onChange={(v) => f.set('q', v)} placeholder="Search person or subject" />
                <FilterSelect value={f.values.type} onChange={(v) => f.set('type', v)} placeholder="All areas" options={types.map((t) => ({ value: t, label: t[0].toUpperCase() + t.slice(1) }))} />
            </Toolbar>
            <Table head={['When', 'Who', 'Action', 'Subject']} empty={!entries.data.length ? <EmptyState icon="time-past" title="Nothing recorded yet" /> : null}>
                {entries.data.map((e) => {
                    const [area, verb = ''] = e.action.split('.');
                    return (
                        <tr key={e.id} className="hover:bg-surface-2/50">
                            <Td className="whitespace-nowrap"><p className="text-text">{timeAgo(e.at)}</p><p className="text-xs text-muted">{fmtDateTime(e.at)}</p></Td>
                            <Td className="font-medium text-text">{e.user}</Td>
                            <Td><div className="flex items-center gap-2"><span className="flex size-8 items-center justify-center rounded-lg bg-surface-2 text-muted"><Icon name={ICON[area] ?? 'bolt'} /></span><Badge tone={TONE[verb.split('_')[0]] ?? 'neutral'} className="capitalize">{area} {verb.replace(/_/g, ' ')}</Badge></div></Td>
                            <Td>
                                <p className="text-text">{e.subject || '—'}</p>
                                {e.meta ? <p className="font-mono text-[11px] text-muted">{Object.entries(e.meta).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : String(v)}`).join(' · ')}</p> : null}
                            </Td>
                        </tr>
                    );
                })}
            </Table>
            <Pagination page={entries} noun="entries" />
        </>
    );
}
