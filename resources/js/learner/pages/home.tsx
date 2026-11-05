import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { CATEGORY_ICON, ToolThumb } from '@/components/tool-thumb';
import { Card, cn, EmptyState, Icon, Skeleton, StatCard } from '@/components/ui';
import { CATEGORY_LABEL, isNewer, type Category, type Quiz } from '@/shared';
import { InstallCard, QuizCard, SpotlightCard } from '../components/cards';
import { OfflineBanner, Page, SectionTitle } from '../components/page';
import { useActivePack, useAsync, usePending, useQuizStatus, useQuizzes, useRecentTools, useToolCounts } from '../lib/hooks';
import { cached } from '../lib/db';
import { classOverview } from '../lib/instructor';
import { useNetwork } from '../lib/network';
import { ServerPackSource } from '../lib/packSources';
import { useSession } from '../lib/session';
import { useLiveQuery } from 'dexie-react-hooks';
import { studentStats } from '../lib/stats';

const greet = () => { const h = new Date().getHours(); return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'; };
const CAT_STYLE: Record<Category, string> = {
    power: 'from-amber-500/15 to-amber-500/5 text-amber-600 dark:text-amber-400',
    common: 'from-blue-500/15 to-blue-500/5 text-blue-600 dark:text-blue-400',
    measuring: 'from-emerald-500/15 to-emerald-500/5 text-emerald-600 dark:text-emerald-400',
    special: 'from-violet-500/15 to-violet-500/5 text-violet-600 dark:text-violet-400',
};

/** Non-blocking "a newer content pack exists" probe — reads the manifest only, never downloads. */
export function UpdateBanner() {
    const online = useNetwork((s) => s.online);
    const pack = useActivePack();
    const [latest, setLatest] = useState<string | null>(null);
    useEffect(() => {
        if (!online || !pack) return;
        new ServerPackSource().getLatestManifest().then((m) => setLatest(m && isNewer(m.packVersion, pack.version) ? m.packVersion : null)).catch(() => setLatest(null));
    }, [online, pack?.version]); // eslint-disable-line react-hooks/exhaustive-deps
    if (!online || !latest) return null;
    return (
        <Link to="/settings/updates" className="flex items-center gap-4 rounded-2xl border border-primary/25 bg-primary-soft p-4 transition hover:border-primary/50">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary text-lg text-white shadow-md shadow-primary/30"><Icon name="cloud-download" /></span>
            <div className="min-w-0 flex-1">
                <p className="font-semibold text-text">Content update v{latest} is available</p>
                <p className="text-sm text-muted">See what changed and install it — nothing downloads until you choose.</p>
            </div>
            <Icon name="angle-right" className="text-primary" />
        </Link>
    );
}

function Continue({ quiz, userId }: { quiz: Quiz; userId: string }) {
    const st = useQuizStatus(quiz, userId);
    if (!st?.open) return null;
    const answered = Object.values(st.open.answers).filter((a) => a != null).length;
    return (
        <Link to={`/quizzes/${quiz.id}`} className="flex items-center gap-4 rounded-2xl bg-surface p-4 shadow-card transition hover:shadow-card-hover">
            <span className="flex size-11 items-center justify-center rounded-xl bg-warning-soft text-lg text-warning"><Icon name="play" /></span>
            <div className="min-w-0 flex-1"><p className="label-caps">Continue where you left off</p><p className="truncate font-semibold text-text">{quiz.title}</p><p className="text-xs text-muted">{answered} of {st.open.questionOrder.length} answered</p></div>
            <Icon name="angle-right" className="text-muted" />
        </Link>
    );
}

function StudentHome() {
    const profile = useSession((s) => s.profile)!;
    const counts = useToolCounts();
    const quizzes = useQuizzes();
    const recent = useRecentTools(profile.id);
    const stats = useLiveQuery(() => studentStats(profile.id), [profile.id]);
    return (
        <Page wide>
            <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-blue-950 via-blue-900 to-blue-700 p-6 text-white shadow-card sm:p-8">
                <div className="bg-grid absolute inset-0 opacity-40" />
                <div className="absolute -right-10 -top-10 size-48 rounded-full bg-blue-400/20 blur-2xl" />
                <div className="relative">
                    <p className="text-sm text-blue-200/80">{greet()},</p>
                    <h1 className="mt-0.5 text-3xl font-bold tracking-tight">{profile.fullName.split(' ')[0] || 'there'}</h1>
                    <p className="mt-2 max-w-md text-sm text-blue-100/80">Pick a tool to explore in 3D, or test yourself with a quiz.</p>
                    <div className="mt-6 grid grid-cols-3 gap-3 sm:max-w-md">
                        {[['Tools viewed', stats?.toolsViewed ?? 0, 'eye'], ['Quizzes taken', stats?.quizzesTaken ?? 0, 'list-check'], ['Day streak', stats?.streak ?? 0, 'flame']].map(([l, v, i]) => (
                            <div key={l as string} className="rounded-2xl bg-white/10 p-3 ring-1 ring-white/15 backdrop-blur">
                                <Icon name={i as string} className="text-amber-300" />
                                <p className="mt-1 text-2xl font-bold tabular-nums">{v}</p>
                                <p className="text-[11px] text-blue-100/70">{l}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
            <OfflineBanner />
            <UpdateBanner />
            <InstallCard />
            <SpotlightCard />
            {quizzes?.map((q) => <Continue key={q.id} quiz={q} userId={profile.id} />)}

            <SectionTitle title="Browse by category" action={<Link to="/tools" className="text-sm font-semibold text-primary">All tools</Link>} />
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                {(Object.keys(CATEGORY_LABEL) as Category[]).map((c) => (
                    <Link key={c} to={`/tools?category=${c}`} className={cn('group flex flex-col gap-3 rounded-2xl bg-gradient-to-br p-4 ring-1 ring-inset ring-border transition hover:ring-primary/40', CAT_STYLE[c])}>
                        <span className="flex size-11 items-center justify-center rounded-xl bg-surface text-xl shadow-sm"><Icon name={CATEGORY_ICON[c]} /></span>
                        <div><p className="font-semibold text-text">{CATEGORY_LABEL[c]}</p><p className="text-xs text-muted">{counts ? `${counts.byCategory[c]} tools` : '…'}</p></div>
                    </Link>
                ))}
            </div>

            <SectionTitle title="Recently viewed" />
            {recent === undefined ? <Skeleton className="h-36" /> : recent.length ? (
                <div className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-1 no-scrollbar sm:mx-0 sm:grid sm:grid-cols-3 sm:px-0 lg:grid-cols-4">
                    {recent.map((t) => (
                        <Link key={t.id} to={`/tools/${t.id}`} className="w-40 shrink-0 snap-start sm:w-auto">
                            <Card interactive className="flex h-full flex-col gap-3 p-4">
                                <ToolThumb category={t.category} brand={t.brand} size={48} />
                                <div className="min-w-0"><p className="line-clamp-2 text-sm font-semibold text-text">{t.name}</p><p className="truncate text-xs text-muted">{t.brand}</p></div>
                            </Card>
                        </Link>
                    ))}
                </div>
            ) : <Card padded={false}><EmptyState icon="eye" title="Nothing viewed yet" description="Tools you open will show up here." /></Card>}

            {quizzes?.length ? (
                <>
                    <SectionTitle title="Quizzes & exams" action={<Link to="/quizzes" className="text-sm font-semibold text-primary">See all</Link>} />
                    <div className="grid gap-3 sm:grid-cols-2">{quizzes.slice(0, 4).map((q) => <QuizCard key={q.id} quiz={q} />)}</div>
                </>
            ) : null}
        </Page>
    );
}

function InstructorHome() {
    const profile = useSession((s) => s.profile)!;
    const quizzes = useQuizzes();
    const ov = useAsync(async () => cached('classOverview', classOverview), []);
    const d = ov.data?.data;
    return (
        <Page wide>
            <div className="flex flex-wrap items-end justify-between gap-3">
                <div><p className="text-sm text-muted">{greet()},</p><h1 className="text-3xl font-bold tracking-tight text-text">{profile.fullName}</h1><p className="text-sm text-muted">{profile.school || 'Instructor'}</p></div>
            </div>
            <OfflineBanner />
            {ov.data?.stale ? <p className="flex items-center gap-2 text-xs text-warning"><Icon name="time-past" />Showing saved class data from your last connection.</p> : null}
            <UpdateBanner />
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <StatCard label="Students" value={d?.students ?? '—'} icon="users" />
                <StatCard label="Class average" value={d ? `${d.averageScore}%` : '—'} icon="chart-histogram" tone="success" />
                <StatCard label="Active students" value={d ? `${d.activeStudents}/${d.students}` : '—'} icon="badge-check" tone="info" />
                <StatCard label="Attempts" value={d?.attempts ?? '—'} icon="list-check" tone="signal" />
            </div>
            <InstallCard />
            <SectionTitle title="Class spotlight" />
            <SpotlightCard manage />
            <SectionTitle title="Quiz results" action={<Link to="/results" className="text-sm font-semibold text-primary">All results</Link>} />
            <div className="grid gap-3 sm:grid-cols-2">{quizzes?.map((q) => <QuizCard key={q.id} quiz={q} />)}</div>
        </Page>
    );
}

export default function Home() {
    const role = useSession((s) => s.profile?.role);
    return role === 'instructor' ? <InstructorHome /> : <StudentHome />;
}
