import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { Badge, Button, cn, Icon, IconButton, ProgressBar, useConfirm } from '@/components/ui';
import { fmtDuration, type Question } from '@/shared';
import { ToolViewer } from '@/viewer';
import { getQuiz } from '../lib/content';
import { haptic } from '../lib/haptics';
import { useTool } from '../lib/hooks';
import { useNetwork } from '../lib/network';
import { quizStatus, useRun } from '../lib/quizRun';
import { useSession } from '../lib/session';
import { useSettings } from '../lib/settings';
import { say, useVoice } from '../lib/speech';
import { syncNow } from '../lib/sync';

const TYPE_LABEL = { true_false: 'True or false', identify_tool: 'Identify the tool', identify_part: 'Identify the part', mcq: 'Multiple choice' } as const;
const LETTERS = 'ABCDEF';

function Media({ q }: { q: Question }) {
    const tool = useTool(q.type === 'identify_tool' || q.type === 'identify_part' ? q.toolId : null);
    const reduce3D = useSettings((s) => s.reduce3D);
    if (!q.toolId || (q.type !== 'identify_tool' && q.type !== 'identify_part')) return null;
    if (!tool) return <div className="skeleton h-64" />;
    // the tool's name is deliberately not shown
    return <div className="h-64 overflow-hidden rounded-2xl bg-gradient-to-b from-surface-2 to-surface-3 shadow-card sm:h-72"><ToolViewer tool={tool} reduce3D={reduce3D} autoRotate={q.type === 'identify_tool'} showHotspots={q.type === 'identify_part'} hotspotFilter={q.hotspotId ? [q.hotspotId] : undefined} /></div>;
}

export default function Play() {
    const nav = useNavigate();
    const { id: quizId } = useParams();
    const confirm = useConfirm();
    const run = useRun((s) => s.run);
    const { answer, reveal, goto } = useRun.getState();
    const userId = useSession((s) => s.profile?.id);
    const online = useNetwork((s) => s.online);
    const [now, setNow] = useState(() => Date.now());
    const [reviewing, setReviewing] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const submitted = useRef(false);

    const finish = useCallback(async (auto: boolean) => {
        if (submitted.current) return;
        submitted.current = true;
        setSubmitting(true);
        useVoice.getState().stop();
        const attemptId = await useRun.getState().submit();
        haptic.success();
        if (online && userId) syncNow(userId).catch(() => {}); // offline → stays "pending sync" until reconnect
        nav(`/quizzes/${quizId}/result/${attemptId}${auto ? '?auto=1' : ''}`, { replace: true });
    }, [online, userId, quizId, nav]);

    useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
    useEffect(() => () => useVoice.getState().stop(), []);
    const remaining = run?.deadline ? Math.max(0, Math.round((run.deadline - now) / 1000)) : null;
    const isExam = run?.quiz.mode === 'exam';
    useEffect(() => { if (run && isExam && remaining === 0) void finish(true); }, [remaining, isExam, run, finish]);

    // No in-memory run (page reloaded / reopened offline): resume the saved attempt from IndexedDB.
    useEffect(() => {
        if (run || submitting || submitted.current || !quizId || !userId) return;
        let live = true;
        (async () => {
            const quiz = await getQuiz(quizId);
            const st = quiz ? await quizStatus(quiz, userId) : null;
            if (!live) return;
            if (quiz && st?.open) useRun.getState().resume(st.open, quiz);
            else nav(`/quizzes/${quizId}`, { replace: true });
        })();
        return () => { live = false; };
    }, [run, submitting, quizId, userId, nav]);

    if (!run) return <div className="flex min-h-dvh items-center justify-center bg-bg text-muted">{submitting ? 'Submitting…' : 'Loading…'}</div>;

    const q = run.questions[run.index];
    const total = run.questions.length;
    const picked = run.attempt.answers[q.id];
    const revealed = !isExam && !!run.revealed[q.id];
    const answeredCount = run.questions.filter((x) => run.attempt.answers[x.id] != null).length;
    const last = run.index === total - 1;
    const low = remaining != null && remaining <= 60;
    const correct = picked === q.correctChoiceId;

    const leave = async () => {
        if (!(await confirm({ title: isExam ? 'Leave the exam?' : 'Leave the quiz?', message: isExam ? 'Your answers are saved, but the timer keeps running.' : 'Your progress is saved — you can resume later.', confirmLabel: 'Leave', tone: 'primary', icon: 'exit' }))) return;
        useVoice.getState().stop(); useRun.getState().clear(); nav('/quizzes', { replace: true });
    };
    const submit = async () => {
        const un = total - answeredCount;
        if (await confirm({ title: 'Submit your answers?', message: un ? `${un} question${un > 1 ? 's are' : ' is'} still unanswered.` : 'You answered every question.', confirmLabel: 'Submit', tone: 'primary', icon: 'paper-plane' })) void finish(false);
    };

    const header = (
        <header className="safe-top sticky top-0 z-20 border-b border-border bg-surface/90 backdrop-blur-md">
            <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
                <IconButton icon="cross" label="Leave" onClick={leave} />
                <div className="min-w-0 flex-1">
                    <div className="mb-1.5 flex items-center justify-between text-xs"><span className="truncate font-semibold text-text">{run.quiz.title}</span><span className="tabular-nums text-muted">{reviewing ? `${answeredCount}/${total} answered` : `${run.index + 1} / ${total}`}</span></div>
                    <ProgressBar value={(reviewing ? answeredCount : run.index + 1) / total} />
                </div>
                {remaining != null ? <div className={cn('flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-bold tabular-nums', low ? 'animate-pulse bg-danger text-white' : 'bg-surface-2 text-text')} aria-label={`Time remaining ${fmtDuration(remaining)}`} aria-live={low ? 'polite' : 'off'}><Icon name="clock-three" />{fmtDuration(remaining)}</div> : null}
            </div>
        </header>
    );

    if (reviewing) {
        return (
            <div className="min-h-dvh bg-bg">{header}
                <div className="mx-auto flex max-w-3xl animate-fade-in flex-col gap-4 px-4 py-6">
                    <h2 className="text-2xl font-bold text-text">Review your answers</h2>
                    <p className="text-sm text-muted">{answeredCount} of {total} answered. Tap a number to go back to that question.</p>
                    <div className="grid grid-cols-5 gap-2 sm:grid-cols-8">
                        {run.questions.map((x, i) => { const done = run.attempt.answers[x.id] != null; return <button key={x.id} type="button" onClick={() => { goto(i); setReviewing(false); }} aria-label={`Question ${i + 1}, ${done ? 'answered' : 'unanswered'}`} className={cn('aspect-square rounded-xl border-2 text-sm font-bold transition', done ? 'border-primary bg-primary text-white' : 'border-dashed border-danger/60 bg-danger-soft text-danger')}>{i + 1}</button>; })}
                    </div>
                    <Button size="lg" icon="paper-plane" onClick={submit} loading={submitting}>Submit exam</Button>
                    <Button variant="secondary" onClick={() => setReviewing(false)}>Back to questions</Button>
                </div>
            </div>
        );
    }

    const style = (cid: string) => {
        if (revealed) return cid === q.correctChoiceId ? 'border-success bg-success-soft' : cid === picked ? 'border-danger bg-danger-soft' : 'border-border bg-surface opacity-60';
        return cid === picked ? 'border-primary bg-primary-soft shadow-sm' : 'border-border bg-surface hover:border-border-strong';
    };
    return (
        <div className="flex min-h-dvh flex-col bg-bg">
            {header}
            <div key={q.id} className="mx-auto flex w-full max-w-3xl flex-1 animate-fade-in flex-col gap-5 px-4 py-6">
                <div className="flex items-center gap-2"><Badge tone="info">{TYPE_LABEL[q.type]}</Badge><Badge tone="neutral">{q.points} pt{q.points > 1 ? 's' : ''}</Badge></div>
                <h2 className="text-xl font-bold leading-snug text-text sm:text-2xl">{q.prompt}</h2>
                <Media q={q} />
                <div className="flex flex-col gap-2.5" role="radiogroup" aria-label="Answer choices">
                    {q.choices.map((c, i) => (
                        <button key={c.id} type="button" role="radio" aria-checked={picked === c.id} disabled={revealed} onClick={() => { haptic.tap(); answer(q.id, c.id); }}
                            className={cn('flex min-h-14 items-center gap-3 rounded-2xl border-2 px-4 py-3 text-left transition active:scale-[0.99]', style(c.id))}>
                            <span className={cn('flex size-8 shrink-0 items-center justify-center rounded-lg text-sm font-bold', picked === c.id ? 'bg-primary text-white' : 'bg-surface-2 text-muted')}>{LETTERS[i]}</span>
                            <span className="flex-1 font-medium text-text">{c.text}</span>
                            {revealed && c.id === q.correctChoiceId ? <Icon name="check-circle" solid className="text-xl text-success" /> : revealed && c.id === picked ? <Icon name="cross-circle" solid className="text-xl text-danger" /> : null}
                        </button>
                    ))}
                </div>
                {revealed ? (
                    <div className={cn('animate-pop-in rounded-2xl border p-4', correct ? 'border-success/40 bg-success-soft' : 'border-danger/30 bg-danger-soft')}>
                        <p className="flex items-center gap-2 font-bold text-text"><Icon name={correct ? 'badge-check' : 'info'} className={correct ? 'text-success' : 'text-danger'} />{correct ? 'Correct!' : 'Not quite'}</p>
                        <p className="mt-1 text-[15px] text-text-2">{q.explanation}</p>
                        <Button size="sm" variant="ghost" icon="volume" className="mt-2 -ml-2" onClick={() => say(`exp:${q.id}`, `${correct ? 'Correct.' : 'Not quite.'} ${q.explanation}`)}>Hear explanation</Button>
                    </div>
                ) : null}
            </div>
            <footer className="safe-bottom sticky bottom-0 border-t border-border bg-surface/95 backdrop-blur">
                <div className="mx-auto flex max-w-3xl gap-3 px-4 py-3">
                    {isExam ? <Button size="lg" className="flex-1" variant="secondary" icon="arrow-left" disabled={run.index === 0} onClick={() => goto(run.index - 1)}>Back</Button> : null}
                    {isExam ? (last ? <Button size="lg" className="flex-1" icon="list-check" onClick={() => setReviewing(true)}>Review</Button> : <Button size="lg" className="flex-1" iconRight="arrow-right" onClick={() => goto(run.index + 1)}>Next</Button>)
                        : !revealed ? <Button size="lg" className="flex-1" icon="check" disabled={picked == null} onClick={() => { reveal(q.id); if (correct) haptic.success(); else haptic.error(); }}>Check answer</Button>
                            : last ? <Button size="lg" className="flex-1" icon="flag" loading={submitting} onClick={() => void finish(false)}>See my score</Button>
                                : <Button size="lg" className="flex-1" iconRight="arrow-right" onClick={() => goto(run.index + 1)}>Next question</Button>}
                </div>
            </footer>
        </div>
    );
}
