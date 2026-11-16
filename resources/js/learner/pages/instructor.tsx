import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router';
import { Avatar, Badge, Card, cn, EmptyState, Icon, Input, KV, ProgressBar, Skeleton, StatCard } from '@/components/ui';
import { fmtDate, yearLabel } from '@/shared';
import { QuizCard } from '../components/cards';
import { OfflineBanner, Page, PageTitle, SectionTitle } from '../components/page';
import { cached } from '../lib/db';
import { useAsync, useQuiz, useQuizzes } from '../lib/hooks';
import { listAttempts, listRoster, pct, summarizeQuiz } from '../lib/instructor';

const Stale = ({ on }: { on?: boolean }) => (on ? <p className="flex items-center gap-2 text-xs text-warning"><Icon name="time-past" />Showing saved data from your last connection.</p> : null);
const tone = (n: number) => (n >= 75 ? 'success' : n >= 60 ? 'warning' : 'danger') as 'success' | 'warning' | 'danger';

export function Students() {
    const [q, setQ] = useState('');
    const r = useAsync(async () => cached('students', async () => {
        const [roster, attempts] = await Promise.all([listRoster(), listAttempts()]);
        return roster.map((s) => {
            const mine = attempts.filter((a) => a.userId === s.id);
            return { ...s, quizzes: mine.length, avg: mine.length ? Math.round(mine.reduce((x, a) => x + pct(a), 0) / mine.length) : null };
        });
    }), []);
    const list = useMemo(() => (r.data?.data ?? []).filter((s) => !q || `${s.fullName} ${s.idNumber} ${s.email}`.toLowerCase().includes(q.toLowerCase())), [r.data, q]);
    return (
        <Page wide>
            <PageTitle title="Students" subtitle="Everyone in the classes you teach." />
            <OfflineBanner />
            <Stale on={r.data?.stale} />
            <Input icon="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search students" className="h-11" />
            {r.loading ? <div className="grid gap-3 sm:grid-cols-2"><Skeleton className="h-20" /><Skeleton className="h-20" /></div>
                : r.error ? <Card className="text-sm text-danger">{r.error}</Card>
                    : !list.length ? <Card padded={false}><EmptyState icon="users" title="No students" description="Ask an admin to add students to your class." /></Card>
                        : (
                            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                                {list.map((s) => (
                                    <Link key={`${s.classId}:${s.id}`} to={`/students/${s.id}`}>
                                        <Card interactive className="flex items-center gap-3 p-4">
                                            <Avatar src={s.avatarUrl} name={s.fullName} size={46} />
                                            <div className="min-w-0 flex-1">
                                                <p className="truncate font-semibold text-text">{s.fullName}</p>
                                                <p className="truncate text-xs text-muted">{s.idNumber || s.email} · {s.className}{s.yearLevel ? ` · ${yearLabel(s.yearLevel)}` : ''}</p>
                                                <p className="text-xs text-muted">{s.quizzes} attempt{s.quizzes === 1 ? '' : 's'}</p>
                                            </div>
                                            {s.avg != null ? <Badge tone={tone(s.avg)}>{s.avg}%</Badge> : <Badge>New</Badge>}
                                        </Card>
                                    </Link>
                                ))}
                            </div>
                        )}
        </Page>
    );
}

export function StudentDetail() {
    const { id } = useParams();
    const r = useAsync(async () => (await cached(`student:${id}`, async () => {
        const [roster, attempts] = await Promise.all([listRoster(), listAttempts({ userId: id })]);
        return { student: roster.find((s) => s.id === id) ?? null, attempts };
    })).data, [id]);
    if (r.loading) return <Page><Skeleton className="h-40" /></Page>;
    const s = r.data?.student;
    if (!s) return <Page><PageTitle back="/students" title="Student" /><Card padded={false}><EmptyState icon="user" title="Student not found" description="They may have been moved to another class." /></Card></Page>;
    const att = r.data!.attempts;
    const avg = att.length ? Math.round(att.reduce((x, a) => x + pct(a), 0) / att.length) : null;
    const passed = att.filter((a) => a.passed).length;
    return (
        <Page>
            <PageTitle back="/students" title={s.fullName} subtitle={`${s.idNumber || s.email} · ${s.className}`} />
            <Card className="flex items-center gap-4"><Avatar src={s.avatarUrl} name={s.fullName} size={64} /><div><p className="font-semibold text-text">{s.email}</p><p className="text-sm text-muted">{[yearLabel(s.yearLevel), s.section ? `Section ${s.section}` : ''].filter(Boolean).join(' · ') || 'Section —'}</p></div></Card>
            <div className="grid grid-cols-3 gap-3">
                <StatCard label="Attempts" value={att.length} icon="list-check" tone="info" />
                <StatCard label="Average" value={avg != null ? `${avg}%` : '—'} icon="chart-histogram" tone="success" />
                <StatCard label="Passed" value={passed} icon="trophy" tone="signal" />
            </div>
            <SectionTitle title="Attempts" />
            {att.length ? att.map((a) => (
                <Card key={a.id} className="space-y-2">
                    <div className="flex items-center justify-between gap-2"><p className="min-w-0 flex-1 truncate font-semibold text-text">{a.quizTitle}</p><Badge tone={a.passed ? 'success' : 'danger'}>{Math.round(pct(a))}%</Badge></div>
                    <ProgressBar value={pct(a) / 100} tone={a.passed ? 'success' : 'danger'} />
                    <p className="text-xs text-muted">{fmtDate(a.submittedAt)} · pack v{a.packVersion}</p>
                </Card>
            )) : <Card padded={false}><EmptyState icon="list-check" title="No attempts yet" /></Card>}
        </Page>
    );
}

export function Results() {
    const quizzes = useQuizzes();
    return (
        <Page wide>
            <PageTitle title="Results" subtitle="Pick a quiz to see best scores per student and the most-missed questions." />
            <OfflineBanner />
            {!quizzes ? <Skeleton className="h-40" /> : !quizzes.length ? <Card padded={false}><EmptyState icon="list-check" title="No quizzes in this pack" /></Card>
                : <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{quizzes.map((q) => <QuizCard key={q.id} quiz={q} />)}</div>}
        </Page>
    );
}

export function QuizResults() {
    const { quizId } = useParams();
    const quiz = useQuiz(quizId);
    const r = useAsync(async () => cached(`results:${quizId}`, async () => ({ attempts: await listAttempts({ quizId }), roster: await listRoster() })), [quizId]);
    const sum = useMemo(() => (quiz && r.data ? summarizeQuiz(quiz, r.data.data.attempts, r.data.data.roster) : null), [quiz, r.data]);
    if (quiz === undefined || r.loading) return <Page><Skeleton className="h-40" /></Page>;
    if (!quiz) return <Page><Card padded={false}><EmptyState icon="list-check" title="Quiz not in the installed pack" /></Card></Page>;
    return (
        <Page>
            <PageTitle back="/results" eyebrow={quiz.mode === 'exam' ? 'Exam' : 'Quiz'} title={quiz.title} />
            <Stale on={r.data?.stale} />
            {r.error ? <Card className="text-sm text-danger">{r.error}</Card> : null}
            {sum && sum.rows.length ? (
                <>
                    <div className="grid grid-cols-2 gap-3">
                        <StatCard label="Class average (best)" value={`${sum.averagePercent}%`} icon="chart-histogram" tone="success" />
                        <StatCard label={`Pass rate (≥${quiz.passingPercent}%)`} value={`${sum.passRate}%`} icon="trophy" tone="info" />
                    </div>
                    <SectionTitle title="Most-missed questions" />
                    {sum.itemAnalysis.slice(0, 6).map((it, i) => (
                        <Card key={it.questionId} className="space-y-2">
                            <div className="flex gap-3"><span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-surface-2 text-sm font-bold text-text">{i + 1}</span><p className="flex-1 text-sm text-text">{it.prompt}</p></div>
                            <ProgressBar value={it.missRate} tone={it.missRate > 0.45 ? 'danger' : 'warning'} />
                            <p className="text-xs text-muted">{Math.round(it.missRate * 100)}% missed · {it.answered} answer{it.answered === 1 ? '' : 's'}</p>
                        </Card>
                    ))}
                    <SectionTitle title="Students" />
                    <Card padded={false} className="divide-y divide-border">
                        {sum.rows.map((x) => (
                            <div key={x.studentId} className="flex items-center gap-3 px-4 py-3">
                                <Avatar name={x.studentName} size={32} />
                                <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-text">{x.studentName}</p><p className="text-xs text-muted">{x.attempts} attempt{x.attempts > 1 ? 's' : ''}</p></div>
                                <Badge tone={x.passed ? 'success' : 'danger'}>{x.bestPercent}% · {x.passed ? 'Pass' : 'Fail'}</Badge>
                            </div>
                        ))}
                    </Card>
                </>
            ) : <Card padded={false}><EmptyState icon="chart-histogram" title="No attempts yet" description="Results appear once students take this quiz and their devices sync." /></Card>}
            <Card className={cn('text-xs text-muted')}><KV k="Questions in pool" v={quiz.questions.length} /><KV k="Pass mark" v={`${quiz.passingPercent}%`} /></Card>
        </Page>
    );
}
