import { Link, router } from '@inertiajs/react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Card, cn, Icon, Input, Select } from '@/components/ui';
import type { Paginated } from '@/types';

/** Responsive table: horizontal scroll on phones, sticky header, zebra-free clean rows. */
export function Table({ head, children, className, empty }: { head: (ReactNode | { label: ReactNode; className?: string })[]; children: ReactNode; className?: string; empty?: ReactNode }) {
    return (
        <div className={cn('overflow-hidden rounded-2xl bg-surface shadow-card', className)}>
            <div className="overflow-x-auto">
                <table className="w-full text-left text-sm sm:min-w-[640px]">
                    <thead className="border-b border-border bg-surface-2/60">
                        <tr>
                            {head.map((h, i) => {
                                const cell = typeof h === 'object' && h !== null && 'label' in (h as object) ? (h as { label: ReactNode; className?: string }) : { label: h as ReactNode };
                                return <th key={i} scope="col" className={cn('whitespace-nowrap px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-muted first:pl-5 last:pr-5', cell.className)}>{cell.label}</th>;
                            })}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border">{children}</tbody>
                </table>
            </div>
            {empty}
        </div>
    );
}

export const Td = ({ children, className, ...rest }: React.TdHTMLAttributes<HTMLTableCellElement>) => (
    <td className={cn('px-4 py-3 align-middle text-text-2 first:pl-5 last:pr-5', className)} {...rest}>{children}</td>
);

export function Pagination<T>({ page, noun = 'items' }: { page: Paginated<T>; noun?: string }) {
    if (page.total === 0) return null;
    const links = page.links.slice(1, -1);
    const prev = page.links[0]?.url;
    const next = page.links[page.links.length - 1]?.url;
    const btn = 'inline-flex h-9 min-w-9 items-center justify-center rounded-lg px-2.5 text-sm font-medium transition';
    return (
        <div className="mt-4 flex flex-col items-center justify-between gap-3 sm:flex-row">
            <p className="text-sm text-muted">Showing <span className="font-medium text-text">{page.from}</span>–<span className="font-medium text-text">{page.to}</span> of <span className="font-medium text-text">{page.total}</span> {noun}</p>
            {page.last_page > 1 ? (
                <nav className="flex items-center gap-1" aria-label="Pagination">
                    {prev ? <Link href={prev} preserveScroll className={cn(btn, 'text-muted hover:bg-surface-2 hover:text-text')} aria-label="Previous page"><Icon name="angle-left" /></Link> : <span className={cn(btn, 'text-muted/40')}><Icon name="angle-left" /></span>}
                    {links.map((l, i) => l.url ? (
                        <Link key={i} href={l.url} preserveScroll className={cn(btn, 'hidden sm:inline-flex', l.active ? 'bg-primary text-white shadow-sm' : 'text-text-2 hover:bg-surface-2')} aria-current={l.active ? 'page' : undefined}>{l.label}</Link>
                    ) : <span key={i} className={cn(btn, 'hidden text-muted sm:inline-flex')}>…</span>)}
                    <span className="px-2 text-sm text-muted sm:hidden">{page.current_page} / {page.last_page}</span>
                    {next ? <Link href={next} preserveScroll className={cn(btn, 'text-muted hover:bg-surface-2 hover:text-text')} aria-label="Next page"><Icon name="angle-right" /></Link> : <span className={cn(btn, 'text-muted/40')}><Icon name="angle-right" /></span>}
                </nav>
            ) : null}
        </div>
    );
}

/** Applies filters to the query string (debounced for typing), keeping scroll and state. */
export function useFilters<T extends Record<string, string>>(initial: T, url?: string) {
    const [values, setValues] = useState<T>(initial);
    const first = useRef(true);
    useEffect(() => {
        if (first.current) { first.current = false; return; }
        const t = setTimeout(() => {
            const q = Object.fromEntries(Object.entries(values).filter(([, v]) => v !== '' && v != null));
            router.get(url ?? window.location.pathname, q, { preserveState: true, preserveScroll: true, replace: true });
        }, 300);
        return () => clearTimeout(t);
    }, [values, url]);
    const set = (k: keyof T, v: string) => setValues((s) => ({ ...s, [k]: v }));
    const clear = () => setValues(Object.fromEntries(Object.keys(values).map((k) => [k, ''])) as T);
    const active = Object.values(values).filter(Boolean).length;
    return { values, set, clear, active };
}

export function Toolbar({ children, className }: { children: ReactNode; className?: string }) {
    return <Card padded={false} className={cn('mb-4 flex flex-col gap-3 p-3 sm:flex-row sm:flex-wrap sm:items-center', className)}>{children}</Card>;
}

export function SearchInput({ value, onChange, placeholder = 'Search…', className }: { value: string; onChange: (v: string) => void; placeholder?: string; className?: string }) {
    return (
        <div className={cn('relative w-full sm:w-72', className)}>
            <Input icon="search" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} aria-label={placeholder} className={value ? 'pr-8' : undefined} />
            {value ? <button type="button" onClick={() => onChange('')} className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted hover:text-text" aria-label="Clear search"><Icon name="cross-small" /></button> : null}
        </div>
    );
}

export function FilterSelect({ value, onChange, options, placeholder, className }: { value: string; onChange: (v: string) => void; options: { value: string; label: string }[]; placeholder: string; className?: string }) {
    return (
        <Select value={value} onChange={(e) => onChange(e.target.value)} aria-label={placeholder} className={cn('sm:w-48', className)}>
            <option value="">{placeholder}</option>
            {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </Select>
    );
}

/** Small rows-of-stats strip used above lists. */
export function MiniStats({ items }: { items: { label: string; value: ReactNode; icon: string; tone?: string }[] }) {
    return (
        <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
            {items.map((s) => (
                <Card key={s.label} className="flex items-center gap-3 p-4">
                    <span className={cn('flex size-10 shrink-0 items-center justify-center rounded-xl text-lg', s.tone ?? 'bg-primary-soft text-primary-soft-fg')}><Icon name={s.icon} /></span>
                    <div className="min-w-0">
                        <p className="text-xl font-bold leading-tight text-text tabular-nums">{s.value}</p>
                        <p className="text-xs leading-tight text-muted">{s.label}</p>
                    </div>
                </Card>
            ))}
        </div>
    );
}
