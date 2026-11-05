import { Head, Link, usePage } from '@inertiajs/react';
import { PageHeader } from '@/layouts/admin-layout';
import { Alert, Badge, buttonClass, Card, CardHeader, cn, EmptyState, Icon, StatCard, timeAgo } from '@/components/ui';
import { can, type SharedProps } from '@/types';

interface Props {
    stats: { tools: number; toolsDraft: number; quizzes: number; packs: number; users: number; activeUsers: number; classes: number; attempts: number; passRate: number };
    roles: { name: string; label: string; count: number }[];
    latestPack: { version: string; releasedAt: string; tools: number; quizzes: number } | null;
    draft: Record<string, string[] | string>;
    changes: number;
    problems: string[];
    activityChart: { day: string; attempts: number; passed: number }[];
    recent: { id: number; action: string; subject: string; at: string; user: string }[];
    topMissed: { quiz: string; attempts: number; average: number }[];
}

const ACTION_ICON: Record<string, string> = { tool: 'tools', quiz: 'list-check', pack: 'box', user: 'user', role: 'shield-check', class: 'school', media: 'picture', settings: 'settings', auth: 'sign-in-alt', model: 'cube' };
const greet = () => { const h = new Date().getHours(); return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'; };

/** 14-day bar chart of submitted attempts (passed stacked over the rest). */
function AttemptsChart({ data }: { data: Props['activityChart'] }) {
    const max = Math.max(1, ...data.map((d) => d.attempts));
    const total = data.reduce((s, d) => s + d.attempts, 0);
    return (
        <div>
            <div className="flex h-44 items-end gap-1.5 sm:gap-2">
                {data.map((d) => {
                    const h = (d.attempts / max) * 100;
                    const p = d.attempts ? (d.passed / d.attempts) * 100 : 0;
                    return (
                        <div key={d.day} className="group relative flex h-full flex-1 flex-col justify-end">
                            <div className="flex w-full flex-col justify-end overflow-hidden rounded-t-md bg-primary/20 transition-all group-hover:bg-primary/30" style={{ height: `${Math.max(h, d.attempts ? 6 : 2)}%` }}>
                                <div className="w-full bg-primary" style={{ height: `${p}%` }} />
                            </div>
                            <span className="pointer-events-none absolute -top-9 left-1/2 z-10 hidden -translate-x-1/2 whitespace-nowrap rounded-md bg-slate-900 px-2 py-1 text-[11px] text-white group-hover:block">
                                {new Date(d.day).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}: {d.attempts} · {d.passed} passed
                            </span>
                        </div>
                    );
                })}
            </div>
            <div className="mt-2 flex justify-between text-[11px] text-muted">
                <span>{new Date(data[0]?.day).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
                <span>Today</span>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-muted">
                <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-primary" />Passed</span>
                <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-primary/20" />Not passed</span>
                <span className="ml-auto font-medium text-text">{total} attempts in 14 days</span>
            </div>
        </div>
    );
}

export default function Dashboard(p: Props) {
    const { props } = usePage<SharedProps>();
    const user = props.auth.user;
    const d = p.draft as Record<string, string[]>;
    const s = p.stats;
    return (
        <>
            <Head title="Dashboard" />
            <PageHeader
                title={`${greet()}, ${user?.fullName.split(' ')[0] || 'there'}`}
                description="Here's what's happening across your training content and learners."
                actions={<>
                    {can(user, 'tools.manage') ? <Link href="/admin/tools/create" className={buttonClass('secondary')}><Icon name="add" />New tool</Link> : null}
                    {can(user, 'packs.view') ? <Link href="/admin/packs" className={buttonClass('primary')}><Icon name="box" />{p.changes ? 'Review & publish' : 'Content packs'}</Link> : null}
                </>}
            />

            <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
                <StatCard label="Tools" value={s.tools} icon="tools" hint={s.toolsDraft ? `${s.toolsDraft} draft` : 'All published'} />
                <StatCard label="Quizzes & exams" value={s.quizzes} icon="list-check" tone="info" hint={`${s.attempts} attempts submitted`} />
                <StatCard label="Users" value={s.users} icon="users" tone="success" hint={`${s.activeUsers} active in 30 days`} />
                <StatCard label="Pass rate" value={`${s.passRate}%`} icon="trophy" tone="signal" hint={`${s.classes} class${s.classes === 1 ? '' : 'es'}`} />
            </div>

            <div className="mt-6 grid gap-6 xl:grid-cols-3">
                <Card padded={false} className="xl:col-span-2">
                    <CardHeader title="Quiz activity" description="Submitted attempts per day (last 14 days)" icon="chart-histogram" actions={can(user, 'reports.view') ? <Link href="/admin/results" className="text-sm font-semibold text-primary hover:underline">View results</Link> : null} />
                    <div className="p-5"><AttemptsChart data={p.activityChart} /></div>
                </Card>

                <Card padded={false}>
                    <CardHeader title="Content pack" description={p.latestPack ? `Live: v${p.latestPack.version}` : 'Nothing published yet'} icon="box" />
                    <div className="space-y-4 p-5">
                        {p.latestPack ? (
                            <div className="flex items-center gap-3 rounded-xl bg-surface-2 p-3">
                                <span className="flex size-11 items-center justify-center rounded-xl bg-gradient-to-br from-blue-900 to-blue-600 font-mono text-xs font-bold text-white">v{p.latestPack.version.split('.').slice(0, 2).join('.')}</span>
                                <div className="min-w-0 text-sm">
                                    <p className="font-semibold text-text">{p.latestPack.tools} tools · {p.latestPack.quizzes} quizzes</p>
                                    <p className="text-xs text-muted">Released {timeAgo(p.latestPack.releasedAt)}</p>
                                </div>
                            </div>
                        ) : null}
                        <div>
                            <p className="mb-2 text-sm font-medium text-text">Unpublished changes</p>
                            <div className="flex flex-wrap gap-1.5">
                                <Badge tone="success">+{d.toolsAdded.length} tools</Badge>
                                <Badge tone="info">~{d.toolsUpdated.length} updated</Badge>
                                <Badge tone="danger">−{d.toolsRemoved.length} removed</Badge>
                                <Badge tone="success">+{d.quizzesAdded.length} quizzes</Badge>
                                <Badge tone="info">~{d.quizzesUpdated.length} quizzes</Badge>
                            </div>
                            <p className="mt-2 text-xs text-muted">{p.changes ? "Learners won't see these until you publish a new pack." : 'Everything authored is already in the live pack.'}</p>
                        </div>
                        {p.problems.length ? <Alert tone="warning" title={`${p.problems.length} issue(s) block publishing`}><ul className="list-disc pl-4 text-xs">{p.problems.slice(0, 3).map((x) => <li key={x}>{x}</li>)}</ul></Alert> : null}
                        {can(user, 'packs.view') ? <Link href="/admin/packs" className={buttonClass(p.changes ? 'primary' : 'secondary', 'md', 'w-full')}>{p.changes ? 'Review & publish' : 'Open content packs'}</Link> : null}
                    </div>
                </Card>
            </div>

            <div className="mt-6 grid gap-6 xl:grid-cols-3">
                <Card padded={false} className="xl:col-span-2">
                    <CardHeader title="Recent activity" description="Latest changes made in the portal" icon="time-past" actions={can(user, 'audit.view') ? <Link href="/admin/audit" className="text-sm font-semibold text-primary hover:underline">Audit trail</Link> : null} />
                    {p.recent.length ? (
                        <ul className="divide-y divide-border">
                            {p.recent.map((a) => (
                                <li key={a.id} className="flex items-center gap-3 px-5 py-3">
                                    <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-surface-2 text-muted"><Icon name={ACTION_ICON[a.action.split('.')[0]] ?? 'bolt'} /></span>
                                    <div className="min-w-0 flex-1 text-sm">
                                        <p className="truncate text-text"><span className="font-semibold">{a.user}</span> <span className="text-muted">{a.action.split('.')[1]?.replace(/_/g, ' ')}</span> {a.subject}</p>
                                        <p className="text-xs text-muted">{timeAgo(a.at)}</p>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    ) : <EmptyState icon="time-past" title="No activity yet" description="Changes to tools, packs and users will appear here." />}
                </Card>

                <div className="space-y-6">
                    <Card padded={false}>
                        <CardHeader title="Needs attention" description="Lowest average scores" icon="triangle-warning" />
                        {p.topMissed.length ? (
                            <ul className="space-y-3 p-5">
                                {p.topMissed.map((q) => (
                                    <li key={q.quiz}>
                                        <div className="mb-1.5 flex items-center justify-between gap-2 text-sm"><span className="truncate font-medium text-text">{q.quiz}</span><span className={cn('font-semibold tabular-nums', q.average < 60 ? 'text-danger' : q.average < 75 ? 'text-warning' : 'text-success')}>{q.average}%</span></div>
                                        <div className="h-1.5 overflow-hidden rounded-full bg-surface-3"><div className={cn('h-full rounded-full', q.average < 60 ? 'bg-danger' : q.average < 75 ? 'bg-warning' : 'bg-success')} style={{ width: `${q.average}%` }} /></div>
                                        <p className="mt-1 text-xs text-muted">{q.attempts} attempts</p>
                                    </li>
                                ))}
                            </ul>
                        ) : <EmptyState icon="chart-histogram" title="No attempts yet" />}
                    </Card>
                    <Card padded={false}>
                        <CardHeader title="People by role" icon="users" actions={can(user, 'roles.manage') ? <Link href="/admin/roles" className="text-sm font-semibold text-primary hover:underline">Manage</Link> : null} />
                        <ul className="divide-y divide-border">
                            {p.roles.map((r) => (
                                <li key={r.name} className="flex items-center justify-between px-5 py-2.5 text-sm">
                                    <span className="text-text-2">{r.label}</span>
                                    <span className="font-semibold tabular-nums text-text">{r.count}</span>
                                </li>
                            ))}
                        </ul>
                    </Card>
                </div>
            </div>
        </>
    );
}
