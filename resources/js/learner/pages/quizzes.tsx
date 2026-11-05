import { Link, useNavigate, useParams } from 'react-router';
import { useState } from 'react';
import { Badge, Button, buttonClass, Card, cn, EmptyState, Icon, KV, Skeleton } from '@/components/ui';
import { fmtDate } from '@/shared';
import { QuizCard } from '../components/cards';
import { OfflineBanner, Page, PageTitle, SectionTitle } from '../components/page';
import { useActivePack, useAttempts, useQuiz, useQuizStatus, useQuizzes } from '../lib/hooks';
import { useRun } from '../lib/quizRun';
import { useSession } from '../lib/session';

export function QuizList() {
    const quizzes = useQuizzes();
    const pack = useActivePack();
    return (
        <Page wide>
            <PageTitle title="Quizzes & exams" subtitle={`From content pack v${pack?.version ?? '…'}. Questions and answer choices reshuffle on every attempt.`} />
            <OfflineBanner />
            {!quizzes ? <div className="grid gap-3 sm:grid-cols-2"><Skeleton className="h-44" /><Skeleton className="h-44" /></div>
                : !quizzes.length ? <Card padded={false}><EmptyState icon="list-check" title="No quizzes in this pack" /></Card>
                    : (
                        <>
                            {(['quiz', 'exam'] as const).map((mode) => {
                                const list = quizzes.filter((q) => q.mode === mode);
                                if (!list.length) return null;
                                return (
                                    <section key={mode} className="space-y-3">
                                        <SectionTitle title={mode === 'exam' ? 'Exams' : 'Practice quizzes'} />
                                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{list.map((q) => <QuizCard key={q.id} quiz={q} />)}</div>
                                    </section>
                                );
                            })}
                        </>
                    )}
        </Page>
    );
}

export function QuizIntro() {
    const { id } = useParams();
    const nav = useNavigate();
    const quiz = useQuiz(id);
    const userId = useSession((s) => s.profile?.id);
    const st = useQuizStatus(quiz, userId);
    const attempts = useAttempts(userId, id);
    const [busy, setBusy] = useState(false);
    if (quiz === undefined) return <Page><Skeleton className="h-64" /></Page>;
    if (!quiz) return <Page><Card padded={false}><EmptyState icon="search" title="Quiz not found" description="It isn't in the installed content pack." action={<Link to="/quizzes" className={buttonClass('primary')}>Back to quizzes</Link>} /></Card></Page>;

    const go = async () => {
        setBusy(true);
        try {
            if (st?.open) useRun.getState().resume(st.open, quiz); else await useRun.getState().start(quiz, userId!);
            nav(`/quizzes/${quiz.id}/play`);
        } finally { setBusy(false); }
    };
    const n = quiz.drawCount ? Math.min(quiz.drawCount, quiz.questions.length) : quiz.questions.length;
    const blocked = !st?.open && st?.left === 0;
    const done = (attempts ?? []).filter((a) => a.submittedAt);
    const exam = quiz.mode === 'exam';

    return (
        <Page>
            <PageTitle back="/quizzes" eyebrow={exam ? 'Exam' : 'Practice quiz'} title={quiz.title} subtitle={quiz.description} />
            <div className="grid grid-cols-3 gap-3">
                {[['Questions', n, 'list'], ['Time', quiz.timeLimitSec ? `${Math.round(quiz.timeLimitSec / 60)} min` : '∞', 'clock-three'], ['Pass mark', `${quiz.passingPercent}%`, 'flag']].map(([l, v, i]) => (
                    <Card key={l as string} className="p-4 text-center"><Icon name={i as string} className="text-lg text-primary" /><p className="mt-1 text-xl font-bold tabular-nums text-text">{v}</p><p className="text-xs text-muted">{l}</p></Card>
                ))}
            </div>
            <Card>
                <KV k="Attempts" v={quiz.maxAttempts == null ? 'Unlimited' : `${st?.left ?? quiz.maxAttempts} of ${quiz.maxAttempts} left`} />
                <KV k="Feedback" v={exam ? 'After you submit' : 'Right after each question'} />
                <KV k="Question pool" v={quiz.drawCount && quiz.drawCount < quiz.questions.length ? `${n} drawn at random from ${quiz.questions.length}` : 'All questions'} />
                <KV k="Best score" v={st?.best != null ? `${Math.round(st.best)}%` : 'Not attempted yet'} />
            </Card>
            {blocked ? <div className="rounded-xl border border-danger/30 bg-danger-soft px-4 py-3 text-sm font-medium text-text">You've used all attempts for this exam.</div> : null}
            {exam && !st?.open && !blocked ? <div className="flex gap-3 rounded-xl border border-warning/30 bg-warning-soft px-4 py-3 text-sm text-text-2"><Icon name="triangle-warning" className="mt-0.5 text-warning" />Once you start, the timer keeps running even if you leave the app, and the attempt counts as used.</div> : null}
            <Button size="lg" icon={st?.open ? 'play' : exam ? 'stopwatch' : 'play'} onClick={go} loading={busy} disabled={blocked}>{st?.open ? 'Resume attempt' : exam ? 'Start exam' : 'Start quiz'}</Button>
            {done.length ? (
                <>
                    <SectionTitle title="Your attempts" />
                    <div className="space-y-2">
                        {done.map((a) => {
                            const p = Math.round((a.score / (a.maxScore || 1)) * 100);
                            return (
                                <Link key={a.id} to={`/quizzes/${quiz.id}/result/${a.id}`} className="flex items-center gap-4 rounded-2xl bg-surface p-4 shadow-card transition hover:shadow-card-hover">
                                    <span className={cn('flex size-12 items-center justify-center rounded-xl text-sm font-bold tabular-nums', a.passed ? 'bg-success-soft text-success' : 'bg-danger-soft text-danger')}>{p}%</span>
                                    <div className="min-w-0 flex-1"><p className="font-semibold text-text">{a.passed ? 'Passed' : 'Not passed'}</p><p className="text-xs text-muted">{fmtDate(a.submittedAt!)} · pack v{a.packVersion}</p></div>
                                    {a.syncStatus === 'synced' ? <Badge tone="success" icon="cloud-check">Synced</Badge> : <Badge tone="warning" icon="cloud-upload">Pending</Badge>}
                                </Link>
                            );
                        })}
                    </div>
                </>
            ) : null}
        </Page>
    );
}
