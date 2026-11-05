import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router';
import { Badge, Button, Card, cn, Icon, Skeleton } from '@/components/ui';
import { restoreAttempt } from '@/shared';
import { Page } from '../components/page';
import { db } from '../lib/db';
import { useQuiz, useQuizStatus } from '../lib/hooks';
import { useRun } from '../lib/quizRun';
import { useSession } from '../lib/session';
import { say } from '../lib/speech';

function ScoreRing({ pct, passed }: { pct: number; passed: boolean }) {
    const r = 54, c = 2 * Math.PI * r;
    return (
        <div className="relative size-40">
            <svg viewBox="0 0 120 120" className="size-full -rotate-90">
                <circle cx="60" cy="60" r={r} fill="none" stroke="var(--surface-3)" strokeWidth="10" />
                <circle cx="60" cy="60" r={r} fill="none" stroke={passed ? 'var(--success)' : 'var(--danger)'} strokeWidth="10" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - pct / 100)} className="transition-[stroke-dashoffset] duration-1000" />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center"><span className="text-4xl font-bold tabular-nums text-text">{pct}%</span><span className="text-xs text-muted">score</span></div>
        </div>
    );
}

export default function Result() {
    const nav = useNavigate();
    const { id, attemptId } = useParams();
    const [sp] = useSearchParams();
    const auto = sp.get('auto') === '1';
    const userId = useSession((s) => s.profile?.id);
    const quiz = useQuiz(id);
    const st = useQuizStatus(quiz, userId);
    const attempt = useLiveQuery(() => (attemptId ? db().attempts.get(attemptId) : undefined), [attemptId]);
    const [busy, setBusy] = useState(false);
    const [filter, setFilter] = useState<'all' | 'wrong'>('all');
    const questions = useMemo(() => (quiz && attempt ? restoreAttempt(quiz, attempt.questionOrder, attempt.choiceOrder) : []), [quiz, attempt]);
    if (!attempt) return <Page><Skeleton className="h-72" /></Page>;

    const pct = attempt.maxScore ? Math.round((attempt.score / attempt.maxScore) * 100) : 0;
    const canRetry = !!quiz && !!st && (st.left == null || st.left > 0);
    const retry = async () => { if (!quiz || !userId) return; setBusy(true); await useRun.getState().start(quiz, userId); nav(`/quizzes/${quiz.id}/play`, { replace: true }); };
    const wrong = questions.filter((q) => attempt.answers[q.id] !== q.correctChoiceId);
    const shown = filter === 'wrong' ? wrong : questions;

    return (
        <Page>
            {auto ? <div className="flex items-center gap-3 rounded-xl border border-warning/30 bg-warning-soft px-4 py-3 text-sm font-medium text-text"><Icon name="hourglass-end" className="text-warning" />Time ran out — your exam was submitted automatically.</div> : null}
            <Card className="flex flex-col items-center gap-3 py-8 text-center">
                <ScoreRing pct={pct} passed={attempt.passed} />
                <h1 className="text-2xl font-bold text-text">{attempt.passed ? 'You passed!' : 'Not passed yet'}</h1>
                <p className="text-sm text-muted">{attempt.score} of {attempt.maxScore} points · pass mark {quiz?.passingPercent ?? '—'}%</p>
                <p className="text-xs text-muted">{attempt.quizTitle} · pack v{attempt.packVersion}</p>
                {attempt.syncStatus === 'synced' ? <Badge tone="success" icon="cloud-check">Synced with your instructor</Badge> : <Badge tone="warning" icon="cloud-upload">Saved on this device — uploads when online</Badge>}
            </Card>
            <div className="flex gap-3">
                {canRetry ? <Button size="lg" className="flex-1" icon="refresh" onClick={retry} loading={busy}>Try again</Button> : null}
                <Button size="lg" className="flex-1" variant="secondary" icon="check" onClick={() => nav('/quizzes', { replace: true })}>Done</Button>
            </div>
            {quiz && st && st.left === 0 ? <p className="text-center text-xs text-muted">No attempts left for this {quiz.mode}.</p> : null}

            <div className="mt-2 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-text">Question review</h2>
                <div className="flex gap-1 rounded-lg bg-surface-2 p-1 text-xs">
                    {(['all', 'wrong'] as const).map((f) => <button key={f} type="button" onClick={() => setFilter(f)} className={cn('rounded-md px-2.5 py-1 font-medium', filter === f ? 'bg-surface text-text shadow-sm' : 'text-muted')}>{f === 'all' ? `All (${questions.length})` : `Missed (${wrong.length})`}</button>)}
                </div>
            </div>
            {shown.map((q) => {
                const i = questions.indexOf(q);
                const a = attempt.answers[q.id];
                const ok = a === q.correctChoiceId;
                return (
                    <Card key={q.id} className="space-y-3">
                        <div className="flex items-start gap-3">
                            <Icon name={ok ? 'check-circle' : 'cross-circle'} solid className={cn('mt-0.5 text-xl', ok ? 'text-success' : 'text-danger')} />
                            <div className="min-w-0 flex-1"><p className="label-caps">Question {i + 1}</p><p className="mt-0.5 font-semibold text-text">{q.prompt}</p></div>
                        </div>
                        <div className="space-y-1.5 pl-8 text-sm">
                            <p className="text-muted">Your answer: <span className={cn('font-medium', ok ? 'text-success' : 'text-danger')}>{q.choices.find((c) => c.id === a)?.text ?? 'No answer'}</span></p>
                            {!ok ? <p className="text-muted">Correct answer: <span className="font-medium text-success">{q.choices.find((c) => c.id === q.correctChoiceId)?.text}</span></p> : null}
                            <p className="rounded-xl bg-surface-2 p-3 text-text-2">{q.explanation}</p>
                            <Button size="xs" variant="ghost" icon="volume" className="-ml-2" onClick={() => say(`exp:${q.id}`, q.explanation)}>Hear explanation</Button>
                        </div>
                    </Card>
                );
            })}
        </Page>
    );
}
