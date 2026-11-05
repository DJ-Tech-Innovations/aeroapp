import { Head, Link, router, usePage } from '@inertiajs/react';
import { FilterSelect, Pagination, SearchInput, Table, Td, Toolbar, useFilters } from '@/components/admin/kit';
import { Badge, buttonClass, Chip, DropdownContent, DropdownItem, DropdownMenu, DropdownSeparator, DropdownTrigger, EmptyState, Icon, IconButton, timeAgo, useConfirm } from '@/components/ui';
import { PageHeader } from '@/layouts/admin-layout';
import { CATEGORY_ICON, ToolThumb } from '@/components/tool-thumb';
import { CATEGORY_LABEL, SUB_LABEL, type Category } from '@/shared';
import { can, type Paginated, type SharedProps } from '@/types';

interface Row { id: string; name: string; slug: string; category: Category; subcategory: string | null; brand: string; model: string; is_published: boolean; hasGlb: boolean; hasVideo: boolean; parts: number; updated_at: string }
interface Props { tools: Paginated<Row>; filters: { q: string; category: string; status: string }; counts: Record<string, number>; total: number }

export default function Tools({ tools, filters, counts, total }: Props) {
    const { props } = usePage<SharedProps>();
    const user = props.auth.user;
    const manage = can(user, 'tools.manage');
    const f = useFilters(filters);
    const confirm = useConfirm();
    const remove = async (t: Row) => {
        if (await confirm({ title: `Delete “${t.name}”?`, message: 'It disappears from learners after the next content pack. Its AI models and photos are deleted too.', confirmLabel: 'Delete tool' })) router.delete(`/admin/tools/${t.id}`, { preserveScroll: true });
    };

    return (
        <>
            <Head title="Tools" />
            <PageHeader title="Tools" icon="tools" description={`${total} tools in the catalogue. Changes reach learners only after you publish a content pack.`}
                actions={<>
                    {can(user, 'tools.import') ? <Link href="/admin/tools/import" className={buttonClass('secondary')}><Icon name="file-excel" />Import / Export</Link> : null}
                    {manage ? <Link href="/admin/tools/create" className={buttonClass('primary')}><Icon name="add" />New tool</Link> : null}
                </>} />

            <div className="-mx-1 mb-4 flex gap-2 overflow-x-auto px-1 pb-1 no-scrollbar">
                <Chip label="All" count={total} selected={!f.values.category} onClick={() => f.set('category', '')} />
                {(Object.keys(CATEGORY_LABEL) as Category[]).map((c) => (
                    <Chip key={c} icon={CATEGORY_ICON[c]} label={CATEGORY_LABEL[c].replace(' Tools', '')} count={counts[c] ?? 0} selected={f.values.category === c} onClick={() => f.set('category', f.values.category === c ? '' : c)} />
                ))}
            </div>
            <Toolbar>
                <SearchInput value={f.values.q} onChange={(v) => f.set('q', v)} placeholder="Search by name or slug" />
                <FilterSelect value={f.values.status} onChange={(v) => f.set('status', v)} placeholder="Any status" options={[{ value: 'published', label: 'Published' }, { value: 'draft', label: 'Draft' }]} />
            </Toolbar>

            <Table head={['Tool', { label: 'Category', className: 'hidden md:table-cell' }, { label: 'Media', className: 'hidden lg:table-cell' }, 'Status', { label: 'Updated', className: 'hidden sm:table-cell' }, '']}
                empty={!tools.data.length ? <EmptyState icon="tools" title="No tools match" description="Try another search, or create a new tool." action={manage ? <Link href="/admin/tools/create" className={buttonClass('primary')}><Icon name="add" />New tool</Link> : null} /> : null}>
                {tools.data.map((t) => (
                    <tr key={t.id} className="hover:bg-surface-2/50">
                        <Td>
                            <Link href={`/admin/tools/${t.id}`} className="flex items-center gap-3">
                                <ToolThumb category={t.category} brand={t.brand} />
                                <span className="min-w-0"><span className="block truncate font-semibold text-text hover:text-primary">{t.name}</span><span className="block truncate text-xs text-muted">{t.brand} · {t.model}</span></span>
                            </Link>
                        </Td>
                        <Td className="hidden md:table-cell">{CATEGORY_LABEL[t.category]}{t.subcategory ? <span className="text-muted"> › {SUB_LABEL[t.subcategory as keyof typeof SUB_LABEL]}</span> : null}</Td>
                        <Td className="hidden lg:table-cell">
                            <div className="flex flex-wrap gap-1">
                                <Badge tone={t.hasGlb ? 'primary' : 'neutral'} icon="cube">{t.hasGlb ? 'AI model' : 'Placeholder'}</Badge>
                                {t.hasVideo ? <Badge tone="neutral" icon="video-camera">Video</Badge> : null}
                                <Badge tone="neutral" icon="target">{t.parts} parts</Badge>
                            </div>
                        </Td>
                        <Td>{t.is_published ? <Badge tone="success" dot>Published</Badge> : <Badge tone="warning" dot>Draft</Badge>}</Td>
                        <Td className="hidden whitespace-nowrap text-xs sm:table-cell">{timeAgo(t.updated_at)}</Td>
                        <Td className="text-right">
                            <DropdownMenu>
                                <DropdownTrigger asChild><IconButton icon="menu-dots-vertical" label={`Actions for ${t.name}`} size="sm" /></DropdownTrigger>
                                <DropdownContent>
                                    <DropdownItem icon={manage ? 'pencil' : 'eye'} onSelect={() => router.visit(`/admin/tools/${t.id}`)}>{manage ? 'Edit' : 'View'}</DropdownItem>
                                    {manage ? <DropdownItem icon={t.is_published ? 'eye-crossed' : 'eye'} onSelect={() => router.post(`/admin/tools/${t.id}/toggle`, {}, { preserveScroll: true })}>{t.is_published ? 'Make draft' : 'Publish in next pack'}</DropdownItem> : null}
                                    {manage ? <><DropdownSeparator /><DropdownItem icon="trash" danger onSelect={() => remove(t)}>Delete</DropdownItem></> : null}
                                </DropdownContent>
                            </DropdownMenu>
                        </Td>
                    </tr>
                ))}
            </Table>
            <Pagination page={tools} noun="tools" />
        </>
    );
}
