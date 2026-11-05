import * as Dialog from '@radix-ui/react-dialog';
import { Link, router, usePage } from '@inertiajs/react';
import { Fragment, useEffect, useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import { IconCredit, LogoMark } from '@/components/brand';
import { Avatar, cn, DropdownContent, DropdownItem, DropdownLabel, DropdownMenu, DropdownSeparator, DropdownTrigger, Icon, IconButton, Tooltip } from '@/components/ui';
import { useTheme } from '@/lib/theme';
import { can, type SharedProps } from '@/types';

interface NavItem { title: string; href: string; icon: string; permission?: string; match?: string }
const SECTIONS: { label: string; items: NavItem[] }[] = [
    { label: 'Overview', items: [{ title: 'Dashboard', href: '/admin', icon: 'apps', permission: 'dashboard.view', match: '/admin$' }] },
    {
        label: 'Content',
        items: [
            { title: 'Tools', href: '/admin/tools', icon: 'tools', permission: 'tools.view' },
            { title: 'Quizzes & exams', href: '/admin/quizzes', icon: 'list-check', permission: 'quizzes.view' },
            { title: 'Content packs', href: '/admin/packs', icon: 'box', permission: 'packs.view' },
            { title: 'Media library', href: '/admin/media', icon: 'picture', permission: 'media.view' },
        ],
    },
    {
        label: 'Learning',
        items: [
            { title: 'Classes', href: '/admin/classes', icon: 'school', permission: 'classes.view' },
            { title: 'Results', href: '/admin/results', icon: 'chart-histogram', permission: 'reports.view' },
        ],
    },
    {
        label: 'Administration',
        items: [
            { title: 'Users', href: '/admin/users', icon: 'users', permission: 'users.view' },
            { title: 'Roles & permissions', href: '/admin/roles', icon: 'shield-check', permission: 'roles.manage' },
            { title: 'Audit trail', href: '/admin/audit', icon: 'time-past', permission: 'audit.view' },
            { title: 'Settings', href: '/admin/settings', icon: 'settings', permission: 'settings.manage' },
        ],
    },
];

const LABELS: Record<string, string> = {
    admin: 'Dashboard', tools: 'Tools', quizzes: 'Quizzes & exams', packs: 'Content packs', media: 'Media library', classes: 'Classes',
    results: 'Results', users: 'Users', roles: 'Roles & permissions', audit: 'Audit trail', settings: 'Settings', account: 'My account',
    create: 'New', import: 'Import / Export',
};

function useCollapsed() {
    const [collapsed, set] = useState(() => { try { return localStorage.getItem('aeroapp.sidebar') === '1'; } catch { return false; } });
    const toggle = () => set((c) => { try { localStorage.setItem('aeroapp.sidebar', c ? '0' : '1'); } catch { /* ignore */ } return !c; });
    return { collapsed, toggle };
}

const isActive = (url: string, item: NavItem) => {
    const path = url.split('?')[0];
    return item.match ? new RegExp(`^${item.match}`).test(path) : path === item.href || path.startsWith(`${item.href}/`);
};

function Sidebar({ collapsed = false, onNavigate, onClose }: { collapsed?: boolean; onNavigate?: () => void; onClose?: () => void }) {
    const { url, props } = usePage<SharedProps>();
    const user = props.auth.user;
    const org = props.app.org;
    const sections = SECTIONS.map((s) => ({ ...s, items: s.items.filter((i) => can(user, i.permission)) })).filter((s) => s.items.length);

    return (
        <div className="flex h-full flex-col bg-gradient-to-b from-blue-950 via-blue-950 to-slate-950 text-blue-100">
            <div className={cn('flex h-16 shrink-0 items-center border-b border-white/10', collapsed ? 'justify-center px-2' : 'justify-between gap-3 px-5')}>
                <Link href="/admin" onClick={onNavigate} className="flex min-w-0 items-center gap-3" aria-label={org.name}>
                    <LogoMark size={36} className="rounded-[10px] shadow-lg shadow-blue-900/50 ring-1 ring-white/20" />
                    {!collapsed ? (
                        <span className="min-w-0 leading-tight">
                            <span className="block max-w-[10.5rem] truncate text-[15px] font-semibold tracking-tight text-white">{org.name}</span>
                            <span className="block max-w-[10.5rem] truncate text-[11px] text-blue-300/70">{org.tagline || 'Admin portal'}</span>
                        </span>
                    ) : null}
                </Link>
                {onClose ? <button type="button" onClick={onClose} className="rounded-md p-1.5 text-blue-200 hover:bg-white/10 hover:text-white" aria-label="Close navigation"><Icon name="cross" /></button> : null}
            </div>

            <nav aria-label="Main navigation" className={cn('flex-1 overflow-y-auto py-4', collapsed ? 'space-y-1 px-3 no-scrollbar' : 'sidebar-scroll space-y-6 px-3')}>
                {sections.map((section, si) => (
                    <div key={section.label} className={cn(collapsed && si > 0 && 'border-t border-white/10 pt-1')}>
                        {!collapsed ? <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-wider text-blue-300/55">{section.label}</p> : null}
                        <ul className="space-y-1">
                            {section.items.map((item) => {
                                const active = isActive(url, item);
                                const link = (
                                    <Link href={item.href} onClick={onNavigate} aria-current={active ? 'page' : undefined} aria-label={collapsed ? item.title : undefined}
                                        className={cn('group flex items-center rounded-lg text-sm font-medium transition-colors', collapsed ? 'mx-auto h-11 w-12 justify-center' : 'gap-3 px-3 py-2.5',
                                            active ? 'bg-blue-600 text-white shadow-md shadow-blue-950/40' : 'text-blue-100/75 hover:bg-white/10 hover:text-white')}>
                                        <Icon name={item.icon} solid={active} className={cn(collapsed ? 'text-[19px]' : 'text-[16px]', active ? 'text-white' : 'text-blue-300/70 group-hover:text-white')} />
                                        {!collapsed ? <span className="flex-1 truncate">{item.title}</span> : null}
                                    </Link>
                                );
                                return <li key={item.href}>{collapsed ? <Tooltip content={item.title} side="right">{link}</Tooltip> : link}</li>;
                            })}
                        </ul>
                    </div>
                ))}
            </nav>

            {!collapsed ? (
                <div className="shrink-0 space-y-3 border-t border-white/10 p-4">
                    <a href="/app" className="flex items-center gap-3 rounded-lg bg-white/5 px-3 py-2.5 ring-1 ring-white/10 transition hover:bg-white/10">
                        <span className="flex size-8 items-center justify-center rounded-md bg-amber-500/90 text-white"><Icon name="graduation-cap" /></span>
                        <span className="min-w-0 leading-tight">
                            <span className="block text-xs font-semibold text-white">Open learner app</span>
                            <span className="block text-[11px] text-blue-300/70">Works offline · v{props.app.version}</span>
                        </span>
                    </a>
                    <IconCredit className="block text-center text-blue-300/50" />
                </div>
            ) : null}
        </div>
    );
}

function Breadcrumbs() {
    const { url } = usePage();
    const parts = url.split('?')[0].split('/').filter(Boolean);
    const crumbs = parts.map((p, i) => ({ label: LABELS[p] ?? (p.length > 20 ? 'Details' : decodeURIComponent(p)), href: '/' + parts.slice(0, i + 1).join('/') }));
    return (
        <nav aria-label="Breadcrumb" className="min-w-0 flex-1">
            <ol className="flex items-center gap-1.5 text-sm">
                {crumbs.map((c, i) => (
                    <li key={c.href} className={cn('flex min-w-0 items-center gap-1.5', i < crumbs.length - 2 && 'hidden sm:flex')}>
                        {i > 0 ? <Icon name="angle-small-right" className="text-muted/60" /> : null}
                        {i === crumbs.length - 1 ? <span className="truncate font-medium text-text">{c.label}</span> : <Link href={c.href} className="truncate text-muted hover:text-text">{c.label}</Link>}
                    </li>
                ))}
            </ol>
        </nav>
    );
}

function AccountMenu() {
    const { props } = usePage<SharedProps>();
    const user = props.auth.user!;
    const { mode, setMode } = useTheme();
    return (
        <DropdownMenu>
            <DropdownTrigger asChild>
                <button type="button" className="flex items-center gap-2 rounded-full p-0.5 pr-2 transition hover:bg-surface-2" aria-label="Account menu">
                    <Avatar src={user.avatarUrl} name={user.fullName} initials={user.initials} size={34} />
                    <span className="hidden max-w-32 truncate text-sm font-medium text-text lg:block">{user.fullName || user.email}</span>
                    <Icon name="angle-small-down" className="hidden text-muted lg:block" />
                </button>
            </DropdownTrigger>
            <DropdownContent className="w-64">
                <div className="flex items-center gap-3 px-2.5 py-2">
                    <Avatar src={user.avatarUrl} name={user.fullName} initials={user.initials} size={38} />
                    <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-text">{user.fullName || 'Account'}</p>
                        <p className="truncate text-xs text-muted">{user.email}</p>
                    </div>
                </div>
                <DropdownSeparator />
                <DropdownItem icon="user" onSelect={() => router.visit('/admin/account')}>My account</DropdownItem>
                <DropdownItem icon="graduation-cap" onSelect={() => (window.location.href = '/app')}>Open learner app</DropdownItem>
                <DropdownSeparator />
                <DropdownLabel>Theme</DropdownLabel>
                {(['light', 'dark', 'system'] as const).map((m) => (
                    <DropdownItem key={m} icon={{ light: 'sun', dark: 'moon', system: 'computer' }[m]} onSelect={() => setMode(m)}>
                        <span className="flex-1 capitalize">{m}</span>{mode === m ? <Icon name="check" className="text-primary" /> : null}
                    </DropdownItem>
                ))}
                <DropdownSeparator />
                <DropdownItem icon="sign-out-alt" danger onSelect={() => router.post('/logout')}>Sign out</DropdownItem>
            </DropdownContent>
        </DropdownMenu>
    );
}

/** Shows server flash messages as toasts. */
function Flash() {
    const { props } = usePage<SharedProps>();
    const { success, error, status } = props.flash;
    useEffect(() => { if (success) toast.success(success); }, [success]);
    useEffect(() => { if (error) toast.error(error); }, [error]);
    useEffect(() => { if (status) toast.info(status); }, [status]);
    return null;
}

export default function AdminLayout({ children }: { children: ReactNode }) {
    const [open, setOpen] = useState(false);
    const { collapsed, toggle } = useCollapsed();
    const { mode, toggle: toggleTheme } = useTheme();
    useEffect(() => router.on('navigate', () => setOpen(false)), []);
    const dark = mode === 'dark' || (mode === 'system' && typeof window !== 'undefined' && matchMedia('(prefers-color-scheme: dark)').matches);

    return (
        <div className="min-h-dvh bg-bg">
            <Flash />
            <Dialog.Root open={open} onOpenChange={setOpen}>
                <Dialog.Portal>
                    <Dialog.Overlay className="fixed inset-0 z-40 bg-slate-950/60 backdrop-blur-sm data-[state=open]:animate-fade-in lg:hidden" />
                    <Dialog.Content className="fixed inset-y-0 left-0 z-50 w-72 max-w-[85vw] shadow-2xl focus:outline-none data-[state=open]:animate-fade-in lg:hidden">
                        <Dialog.Title className="sr-only">Navigation</Dialog.Title>
                        <Dialog.Description className="sr-only">Admin portal sections</Dialog.Description>
                        <Sidebar onNavigate={() => setOpen(false)} onClose={() => setOpen(false)} />
                    </Dialog.Content>
                </Dialog.Portal>
            </Dialog.Root>

            <aside className={cn('hidden transition-[width] duration-200 ease-out lg:fixed lg:inset-y-0 lg:z-40 lg:flex lg:flex-col print:hidden', collapsed ? 'lg:w-[4.5rem]' : 'lg:w-64')}>
                <Sidebar collapsed={collapsed} />
            </aside>

            <div className={cn('flex min-h-dvh flex-col transition-[padding] duration-200 ease-out', collapsed ? 'lg:pl-[4.5rem]' : 'lg:pl-64')}>
                <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center gap-2 border-b border-border bg-surface/80 px-3 backdrop-blur-md sm:gap-3 sm:px-6 lg:px-8 print:hidden">
                    <IconButton icon="menu-burger" label="Open navigation" className="lg:hidden" onClick={() => setOpen(true)} />
                    <IconButton icon={collapsed ? 'sidebar' : 'sidebar-flip'} label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} className="hidden lg:inline-flex" onClick={toggle} />
                    <div className="hidden h-6 w-px bg-border sm:block" />
                    <Breadcrumbs />
                    <span className="hidden text-xs text-muted xl:inline">{new Date().toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}</span>
                    <IconButton icon={dark ? 'sun' : 'moon'} label="Toggle theme" onClick={toggleTheme} />
                    <AccountMenu />
                </header>
                <main className="flex-1">
                    <div key={usePage().component} className="mx-auto w-full max-w-[1400px] animate-fade-in px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</div>
                </main>
            </div>
        </div>
    );
}

/** Admin page header: title, description and actions, stacked on phones. */
export function PageHeader({ title, description, actions, back, icon }: { title: ReactNode; description?: ReactNode; actions?: ReactNode; back?: string; icon?: string }) {
    return (
        <div className="mb-6 flex flex-col gap-4 border-b border-border pb-6 sm:mb-8 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex min-w-0 items-start gap-3">
                {back ? <Link href={back} className="mt-1 inline-flex size-9 shrink-0 items-center justify-center rounded-lg border border-border bg-surface text-muted shadow-xs hover:text-text" aria-label="Back"><Icon name="arrow-left" /></Link> : null}
                {icon && !back ? <span className="mt-0.5 hidden size-11 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-xl text-primary-soft-fg sm:flex"><Icon name={icon} /></span> : null}
                <div className="min-w-0">
                    <h1 className="text-2xl font-bold tracking-tight text-text sm:text-[28px]">{title}</h1>
                    {description ? <p className="mt-1 max-w-3xl text-sm text-muted">{description}</p> : null}
                </div>
            </div>
            {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
        </div>
    );
}

export { Fragment };
