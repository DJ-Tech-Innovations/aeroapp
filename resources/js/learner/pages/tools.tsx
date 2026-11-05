import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { CATEGORY_ICON, ToolThumb } from '@/components/tool-thumb';
import { Badge, Button, Card, Chip, cn, EmptyState, Icon, IconButton, Input, Skeleton } from '@/components/ui';
import { BRANDS, CATEGORY_LABEL, fmtWeight, SUB_LABEL, UNIT_LABEL, type Brand, type Category, type Subcategory, type UnitSystem } from '@/shared';
import { OfflineBanner, Page, PageTitle } from '../components/page';
import { useToolCounts, useTools } from '../lib/hooks';
import { useSettings } from '../lib/settings';

const UNITS: UnitSystem[] = ['english', 'metric', 'dual', 'na'];
const SUBS: Partial<Record<Category, Exclude<Subcategory, null>[]>> = { power: ['pneumatic', 'electric'], measuring: ['english', 'metric'] };
const CATS = Object.keys(CATEGORY_LABEL) as Category[];

export default function Tools() {
    const [params, setParams] = useSearchParams();
    const units = useSettings((s) => s.units);
    const [q, setQ] = useState('');
    const initial = params.get('category');
    const [category, setCat] = useState<Category | null>(initial && CATS.includes(initial as Category) ? (initial as Category) : null);
    const [sub, setSub] = useState<Exclude<Subcategory, null> | null>(null);
    const [brand, setBrand] = useState<Brand | null>(null);
    const [unit, setUnit] = useState<UnitSystem | null>(null);
    const [grid, setGrid] = useState(() => { try { return localStorage.getItem('aeroapp.toolsView') !== 'list'; } catch { return true; } });
    const [showFilters, setShowFilters] = useState(false);
    const setCategory = (c: Category | null) => { setCat(c); setSub(null); setParams(c ? { category: c } : {}, { replace: true }); };
    const toggleView = () => setGrid((g) => { try { localStorage.setItem('aeroapp.toolsView', g ? 'list' : 'grid'); } catch { /* ignore */ } return !g; });

    const filter = useMemo(() => ({ q, category, subcategory: sub, brand, unitSystem: unit }), [q, category, sub, brand, unit]);
    const tools = useTools(filter);
    const counts = useToolCounts();
    const extra = [sub, brand, unit].filter(Boolean).length;
    const clear = () => { setCategory(null); setBrand(null); setUnit(null); setQ(''); };

    return (
        <Page wide>
            <PageTitle title="Tools" subtitle={`${tools?.length ?? '…'} of ${counts?.total ?? '…'} tools · everything works offline`} />
            <OfflineBanner />
            <div className="sticky top-14 z-20 -mx-4 space-y-3 bg-bg/90 px-4 pb-2 pt-1 backdrop-blur md:top-0 md:mx-0 md:px-0">
                <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                        <Input icon="search" className="h-11 rounded-xl pr-9 text-base sm:text-sm" placeholder="Search tools, tags or aircraft uses" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search tools" />
                        {q ? <button type="button" onClick={() => setQ('')} className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1.5 text-muted" aria-label="Clear search"><Icon name="cross-small" /></button> : null}
                    </div>
                    <IconButton icon="settings-sliders" label="Filters" active={showFilters || extra > 0} onClick={() => setShowFilters((v) => !v)} className="size-11 border border-border bg-surface" />
                    <IconButton icon={grid ? 'list' : 'apps'} label={grid ? 'List view' : 'Grid view'} onClick={toggleView} className="hidden size-11 border border-border bg-surface sm:inline-flex" />
                </div>
                <div className="-mx-4 flex gap-2 overflow-x-auto px-4 no-scrollbar md:mx-0 md:px-0">
                    <Chip label="All" count={counts?.total} selected={!category} onClick={() => setCategory(null)} />
                    {CATS.map((c) => <Chip key={c} icon={CATEGORY_ICON[c]} label={CATEGORY_LABEL[c].replace(' Tools', '')} count={counts?.byCategory[c]} selected={category === c} onClick={() => setCategory(category === c ? null : c)} />)}
                </div>
                {category && SUBS[category] ? (
                    <div className="flex gap-2 overflow-x-auto no-scrollbar">
                        {SUBS[category]!.map((s) => <Chip key={s} label={SUB_LABEL[s]} count={counts?.bySubcategory[`${category}:${s}`] ?? 0} selected={sub === s} onClick={() => setSub(sub === s ? null : s)} />)}
                    </div>
                ) : null}
            </div>
            {showFilters ? (
                <Card className="grid gap-4 sm:grid-cols-2">
                    <div><p className="label-caps mb-2">Brand</p><div className="flex flex-wrap gap-2">{BRANDS.map((b) => <Chip key={b} label={b} selected={brand === b} onClick={() => setBrand(brand === b ? null : b)} />)}</div></div>
                    <div><p className="label-caps mb-2">Unit system</p><div className="flex flex-wrap gap-2">{UNITS.map((u) => <Chip key={u} label={UNIT_LABEL[u].split(' ')[0]} selected={unit === u} onClick={() => setUnit(unit === u ? null : u)} />)}</div></div>
                </Card>
            ) : null}

            {!tools ? (
                <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">{[0, 1, 2, 3, 4, 5, 6, 7].map((i) => <Skeleton key={i} className="h-44" />)}</div>
            ) : !tools.length ? (
                <Card padded={false}><EmptyState icon="search" title="No tools match" description="Try another word or remove a filter." action={<Button variant="secondary" onClick={clear}>Clear filters</Button>} /></Card>
            ) : (
                <ul className={cn('grid gap-3', grid ? 'grid-cols-2 md:grid-cols-3 lg:grid-cols-4' : 'grid-cols-1 lg:grid-cols-2')}>
                    {tools.map((t) => (
                        <li key={t.id}>
                            <Link to={`/tools/${t.id}`} aria-label={`${t.name}, ${t.brand}`} className="group block h-full">
                                <Card interactive className={cn('h-full', grid ? 'flex flex-col gap-3 p-4' : 'flex items-center gap-4 p-3')}>
                                    <ToolThumb category={t.category} brand={t.brand} size={grid ? 52 : 48} />
                                    {grid ? (
                                        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                                            <p className="line-clamp-2 font-semibold leading-snug text-text group-hover:text-primary">{t.name}</p>
                                            <p className="truncate text-xs text-muted">{t.brand} · {t.model}</p>
                                            <div className="mt-auto flex flex-wrap gap-1 pt-1">
                                                <Badge tone="primary">{CATEGORY_LABEL[t.category].replace(' Tools', '')}{t.subcategory ? ` · ${SUB_LABEL[t.subcategory].split(' ')[0]}` : ''}</Badge>
                                                {t.isSampleData ? <Badge tone="signal">Sample</Badge> : null}
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="min-w-0 flex-1">
                                            <p className="truncate font-semibold text-text group-hover:text-primary">{t.name}</p>
                                            <p className="truncate text-xs text-muted">{t.brand} · {t.model} · {fmtWeight(t.weight, units)}</p>
                                        </div>
                                    )}
                                    {!grid ? <Icon name="angle-right" className="text-muted" /> : null}
                                </Card>
                            </Link>
                        </li>
                    ))}
                </ul>
            )}
        </Page>
    );
}
