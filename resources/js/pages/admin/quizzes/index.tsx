import { Head, Link, usePage } from '@inertiajs/react';
import { Pagination, SearchInput, Toolbar, useFilters } from '@/components/admin/kit';
import { Badge, buttonClass, Card, cn, EmptyState, Icon, Segmented, timeAgo } from '@/components/ui';
import { PageHeader } from '@/layouts/admin-layout';
import { can, type Paginated, type SharedProps } from '@/types';

interface Row { id: string; title: string; mode: 'quiz' | 'exam'; is_published: boolean; questions: number; drawCount: number | null; timeLimitSec: number | null; passingPercent: number; maxAttempts: number | null; attempts: number; passRate: number | null; updated_at: string }

export default function Quizzes({ quizzes, filters }: { quizzes: Paginated<Row>; filters: { q: string; mode: string } }) {
    const { props } = usePage<SharedProps>();
    const manage = can(props.auth.user, 'quizzes.manage');
    const f = useFilters(filters);
    return (
        <>
            <Head title="Quizzes & exams" />
            <PageHeader title="Quizzes & exams" icon="list-check" description="Quizzes give instant feedback. Exams are timed, auto-submit and limit attempts. Questions and choices reshuffle on every attempt."
                actions={manage ? <Link href="/admin/quizzes/create" className={buttonClass('primary')}><Icon name="add" />New quiz</Link> : null} />
            <Toolbar>
                <SearchInput value={f.values.q} onChange={(v) => f.set('q', v)} placeholder="Search quizzes" />
                <Segmented size="sm" value={f.values.mode || 'all'} onChange={(v) => f.set('mode', v === 'all' ? '' : v)} options={[{ value: 'all', label: 'All' }, { value: 'quiz', label: 'Quizzes', icon: 'interrogation' }, { value: 'exam', label: 'Exams', icon: 'stopwatch' }]} />
            </Toolbar>
            {quizzes.data.length ? (
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {quizzes.data.map((q) => (
                        <Link key={q.id} href={`/admin/quizzes/${q.id}`} className="group">
                            <Card interactive className="flex h-full flex-col">
                                <div className="flex items-start justify-between gap-3">
                                    <span className={cn('flex size-11 items-center justify-center rounded-xl text-lg', q.mode === 'exam' ? 'bg-danger-soft text-danger' : 'bg-info-soft text-info')}><Icon name={q.mode === 'exam' ? 'stopwatch' : 'interrogation'} /></span>
                                    <div className="flex gap-1">
                                        <Badge tone={q.mode === 'exam' ? 'danger' : 'info'}>{q.mode === 'exam' ? 'Exam' : 'Quiz'}</Badge>
                                        {q.is_published ? null : <Badge tone="warning">Draft</Badge>}
                                    </div>
                                </div>
                                <h3 className="mt-4 font-semibold text-text group-hover:text-primary">{q.title}</h3>
                                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
                                    <span className="flex items-center gap-1"><Icon name="list" />{q.drawCount ? `${q.drawCount} of ${q.questions}` : q.questions} questions</span>
                                    {q.timeLimitSec ? <span className="flex items-center gap-1"><Icon name="clock-three" />{Math.round(q.timeLimitSec / 60)} min</span> : null}
                                    <span className="flex items-center gap-1"><Icon name="flag" />Pass {q.passingPercent}%</span>
                                    {q.maxAttempts ? <span className="flex items-center gap-1"><Icon name="refresh" />{q.maxAttempts} attempts</span> : null}
                                </div>
                                <div className="mt-auto flex items-center justify-between border-t border-border pt-4 text-sm" style={{ marginTop: 'auto' }}>
                                    <span className="text-muted">{q.attempts} attempts{q.passRate != null ? <> · <b className="text-text">{q.passRate}%</b> pass</> : null}</span>
                                    <span className="text-xs text-muted">{timeAgo(q.updated_at)}</span>
                                </div>
                            </Card>
                        </Link>
                    ))}
                </div>
            ) : <Card><EmptyState icon="list-check" title="No quizzes yet" action={manage ? <Link href="/admin/quizzes/create" className={buttonClass('primary')}><Icon name="add" />New quiz</Link> : null} /></Card>}
            <Pagination page={quizzes} noun="quizzes" />
        </>
    );
}
