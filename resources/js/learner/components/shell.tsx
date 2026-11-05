import { useEffect, useState, type ReactNode } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router';
import { IconCredit, LogoMark } from '@/components/brand';
import { Avatar, Button, cn, Icon, ProgressBar } from '@/components/ui';
import { bootstrapContent, onBootstrapStage } from '../lib/bootstrap';
import { useActivePack, usePending } from '../lib/hooks';
import type { InstallStage } from '../lib/installer';
import { useNetwork } from '../lib/network';
import { useSession } from '../lib/session';
import { useSettings } from '../lib/settings';

interface NavItem { to: string; label: string; icon: string; end?: boolean }
const STUDENT: NavItem[] = [
    { to: '/', label: 'Home', icon: 'home', end: true },
    { to: '/tools', label: 'Tools', icon: 'tools' },
    { to: '/quizzes', label: 'Quizzes', icon: 'list-check' },
    { to: '/profile', label: 'Profile', icon: 'user' },
];
const INSTRUCTOR: NavItem[] = [
    { to: '/', label: 'Home', icon: 'home', end: true },
    { to: '/tools', label: 'Tools', icon: 'tools' },
    { to: '/students', label: 'Students', icon: 'users' },
    { to: '/results', label: 'Results', icon: 'chart-histogram' },
    { to: '/profile', label: 'Profile', icon: 'user' },
];
/** Immersive screens: no navigation chrome. */
const FULLSCREEN = [/^\/tools\/[^/]+\/3d$/, /^\/quizzes\/[^/]+\/play$/];

function Splash({ children }: { children?: ReactNode }) {
    return (
        <div className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-bg px-6 text-center">
            <div className="relative">
                <div className="absolute inset-0 animate-ping rounded-[28%] bg-primary/20" />
                <LogoMark size={72} className="relative" />
            </div>
            {children}
        </div>
    );
}

const STAGE_LABEL: Record<InstallStage, string> = {
    downloading: 'Loading the tool catalogue', verifying: 'Verifying content', staging: 'Preparing', applying: 'Saving tools and quizzes on this device',
    media: 'Saving videos and 3D models for offline use', swapping: 'Finishing up', done: 'Ready',
};

/** First launch on a device: install the bundled content pack before showing the app. */
function ContentGate({ children }: { children: ReactNode }) {
    const pack = useActivePack();
    const [stage, setStage] = useState<{ s: InstallStage; f: number } | null>(null);
    const [failed, setFailed] = useState<string | null>(null);
    useEffect(() => onBootstrapStage((s, f) => setStage({ s, f })), []);
    useEffect(() => { if (pack === null || pack === undefined) bootstrapContent().catch((e) => setFailed((e as Error).message)); }, [pack]);
    if (pack) return <>{children}</>;
    return (
        <Splash>
            <div className="w-full max-w-xs">
                <h1 className="text-xl font-bold text-text">{failed ? 'Setup could not finish' : 'Setting up AeroApp'}</h1>
                <p className="mt-1 text-sm text-muted">{failed ?? (stage ? STAGE_LABEL[stage.s] : 'Getting the tool catalogue ready…')}</p>
                {failed ? <Button className="mt-5" icon="refresh" onClick={() => { setFailed(null); void bootstrapContent().catch((e) => setFailed((e as Error).message)); }}>Try again</Button>
                    : <ProgressBar className="mt-5" value={stage ? (Object.keys(STAGE_LABEL).indexOf(stage.s) + stage.f) / 6 : 0.05} label="Setup progress" />}
            </div>
        </Splash>
    );
}

function SignedOutScreen() {
    const { expired, offlineFirstRun } = useSession();
    const online = useNetwork((s) => s.online);
    useEffect(() => { if (online && !expired && !offlineFirstRun) window.location.href = '/login'; }, [online, expired, offlineFirstRun]);
    return (
        <Splash>
            <div className="max-w-sm">
                <h1 className="text-2xl font-bold text-text">{offlineFirstRun ? 'Connect to sign in' : expired ? 'Please sign in again' : 'Signing you in…'}</h1>
                <p className="mt-2 text-sm text-muted">
                    {offlineFirstRun ? "The first sign-in on a device needs internet. After that, AeroApp works offline." : expired ? 'For your security, the offline sign-in on this device has expired. Your unsynced progress is kept and uploads after you sign in.' : 'Redirecting to the sign-in page.'}
                </p>
                {(expired || offlineFirstRun) ? (
                    <div className="mt-6 flex flex-col gap-2">
                        <Button size="lg" icon="sign-in-alt" disabled={!online} onClick={() => (window.location.href = '/login?expired=1')}>{online ? 'Sign in' : 'Waiting for connection…'}</Button>
                        {!online ? <p className="flex items-center justify-center gap-1.5 text-xs text-warning"><Icon name="wifi-slash" />You're offline</p> : null}
                    </div>
                ) : null}
            </div>
        </Splash>
    );
}

function AdminOnlyScreen() {
    return (
        <Splash>
            <div className="max-w-sm">
                <h1 className="text-2xl font-bold text-text">This is a staff account</h1>
                <p className="mt-2 text-sm text-muted">The learner app is for students and instructors. Your account manages content in the admin portal.</p>
                <div className="mt-6 flex flex-col gap-2">
                    <Button size="lg" icon="apps" onClick={() => (window.location.href = '/admin')}>Open the admin portal</Button>
                    <Button variant="ghost" onClick={() => useSession.getState().signOut()}>Sign out</Button>
                </div>
            </div>
        </Splash>
    );
}

function SyncPill() {
    const id = useSession((s) => s.profile?.id);
    const pending = usePending(id);
    const online = useNetwork((s) => s.online);
    if (!online) return <span className="flex items-center gap-1.5 rounded-full bg-warning-soft px-2.5 py-1 text-xs font-medium text-warning"><Icon name="wifi-slash" />Offline</span>;
    if (pending?.total) return <NavLink to="/profile" className="flex items-center gap-1.5 rounded-full bg-info-soft px-2.5 py-1 text-xs font-medium text-info"><Icon name="cloud-upload" />{pending.total} to sync</NavLink>;
    return <span className="flex items-center gap-1.5 rounded-full bg-success-soft px-2.5 py-1 text-xs font-medium text-success"><Icon name="cloud-check" />Synced</span>;
}

function Chrome({ nav }: { nav: NavItem[] }) {
    const profile = useSession((s) => s.profile)!;
    const pack = useActivePack();
    return (
        <div className="min-h-dvh bg-bg md:flex">
            {/* Desktop / tablet rail */}
            <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-border bg-surface md:flex">
                <div className="flex h-16 items-center gap-3 border-b border-border px-5">
                    <LogoMark size={34} />
                    <div className="leading-tight"><p className="font-bold text-text">AeroApp</p><p className="text-[11px] text-muted">{profile.role === 'instructor' ? 'Instructor' : 'Student'} · pack v{pack?.version ?? '—'}</p></div>
                </div>
                <nav className="flex-1 space-y-1 p-3" aria-label="Primary">
                    {nav.map((n) => (
                        <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => cn('flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition', isActive ? 'bg-primary text-white shadow-md shadow-primary/25' : 'text-text-2 hover:bg-surface-2 hover:text-text')}>
                            {({ isActive }) => <><Icon name={n.icon} solid={isActive} className="text-[17px]" />{n.label}</>}
                        </NavLink>
                    ))}
                    <NavLink to="/settings" className={({ isActive }) => cn('flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition', isActive ? 'bg-primary text-white' : 'text-text-2 hover:bg-surface-2 hover:text-text')}>
                        {({ isActive }) => <><Icon name="settings" solid={isActive} className="text-[17px]" />Settings</>}
                    </NavLink>
                </nav>
                <div className="space-y-3 border-t border-border p-4">
                    <div className="flex justify-center"><SyncPill /></div>
                    <NavLink to="/profile" className="flex items-center gap-3 rounded-xl p-2 hover:bg-surface-2">
                        <Avatar src={profile.avatarUrl} name={profile.fullName} size={36} />
                        <div className="min-w-0"><p className="truncate text-sm font-semibold text-text">{profile.fullName}</p><p className="truncate text-xs text-muted">{profile.email}</p></div>
                    </NavLink>
                    <IconCredit className="block text-center text-muted" />
                </div>
            </aside>

            <div className="min-w-0 flex-1 pb-[calc(76px+env(safe-area-inset-bottom))] md:pb-0">
                {/* Phone top bar */}
                <header className="safe-top sticky top-0 z-30 border-b border-border bg-surface/85 backdrop-blur-md md:hidden">
                    <div className="flex h-14 items-center gap-3 px-4">
                        <LogoMark size={30} />
                        <span className="flex-1 font-bold text-text">AeroApp</span>
                        <SyncPill />
                        <NavLink to="/settings" aria-label="Settings" className="flex size-9 items-center justify-center rounded-lg text-muted hover:bg-surface-2"><Icon name="settings" /></NavLink>
                    </div>
                </header>
                <Outlet />
            </div>

            {/* Phone bottom tab bar */}
            <nav className="safe-bottom fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface/95 backdrop-blur-md md:hidden" aria-label="Primary">
                <div className="flex">
                    {nav.map((n) => (
                        <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => cn('flex h-[68px] flex-1 flex-col items-center justify-center gap-1 text-[11px] font-semibold transition', isActive ? 'text-primary' : 'text-muted')}>
                            {({ isActive }) => (
                                <>
                                    <span className={cn('flex h-8 w-14 items-center justify-center rounded-full text-lg transition', isActive && 'bg-primary-soft')}><Icon name={n.icon} solid={isActive} /></span>
                                    {n.label}
                                </>
                            )}
                        </NavLink>
                    ))}
                </div>
            </nav>
        </div>
    );
}

/** Auth gate + responsive shell. */
export function AppShell() {
    const status = useSession((s) => s.status);
    const profile = useSession((s) => s.profile);
    const onboarded = useSettings((s) => s.onboarded);
    const { pathname } = useLocation();
    const nav = useNavigate();
    useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
    useEffect(() => { if (status === 'signedIn' && !onboarded && pathname !== '/welcome') nav('/welcome', { replace: true }); }, [status, onboarded, pathname, nav]);

    if (status === 'loading') return <Splash />;
    if (status === 'signedOut' || !profile) return <SignedOutScreen />;
    if (profile.role === 'admin') return <AdminOnlyScreen />;
    if (pathname === '/welcome') return <Outlet />;
    const fullscreen = FULLSCREEN.some((r) => r.test(pathname));
    return <ContentGate>{fullscreen ? <Outlet /> : <Chrome nav={profile.role === 'instructor' ? INSTRUCTOR : STUDENT} />}</ContentGate>;
}
