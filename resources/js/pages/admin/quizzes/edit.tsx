import { Head, router, usePage } from '@inertiajs/react';
import { useState } from 'react';
import { Alert, Badge, Button, Card, CardHeader, cn, Field, Icon, IconButton, Input, Segmented, Select, Switch, Textarea, useConfirm } from '@/components/ui';
import { PageHeader } from '@/layouts/admin-layout';
import type { Question, QuestionType, Quiz } from '@/shared';
import { can, type SharedProps } from '@/types';

interface ToolOpt { id: string; name: string; hotspots: { id: string; label: string }[] }
const rid = () => Math.random().toString(36).slice(2, 8);
const blank = (): Question => ({ id: `q-${rid()}`, type: 'mcq', prompt: '', choices: [0, 1, 2, 3].map(() => ({ id: `c-${rid()}`, text: '' })), correctChoiceId: '', explanation: '', points: 1 });
const TYPES: Record<QuestionType, { label: string; icon: string }> = {
    mcq: { label: 'Multiple choice', icon: 'list' }, true_false: { label: 'True / False', icon: 'check-circle' },
    identify_tool: { label: 'Identify the tool (3D)', icon: 'cube' }, identify_part: { label: 'Identify the part', icon: 'target' },
};

export default function QuizEditor({ quiz, published, tools }: { quiz: Quiz | null; published: boolean; tools: ToolOpt[] }) {
    const { props } = usePage<SharedProps>();
    const manage = can(props.auth.user, 'quizzes.manage');
    const errors = props.errors ?? {};
    const confirm = useConfirm();
    const [saving, setSaving] = useState(false);
    const [f, setF] = useState({
        title: quiz?.title ?? '', description: quiz?.description ?? '', mode: (quiz?.mode ?? 'quiz') as 'quiz' | 'exam',
        minutes: quiz?.timeLimitSec ? String(quiz.timeLimitSec / 60) : '', maxAttempts: quiz?.maxAttempts ? String(quiz.maxAttempts) : '',
        pass: String(quiz?.passingPercent ?? 70), draw: quiz?.drawCount ? String(quiz.drawCount) : '', isPublished: published,
    });
    const [qs, setQs] = useState<Question[]>(quiz?.questions ?? [blank()]);
    const [open, setOpen] = useState<number | null>(quiz ? null : 0);
    const setQ = (i: number, p: Partial<Question>) => setQs((a) => a.map((q, n) => (n === i ? { ...q, ...p } : q)));

    const changeType = (i: number, type: QuestionType) => {
        if (type === 'true_false') { const t = { id: `c-${rid()}`, text: 'True' }, fl = { id: `c-${rid()}`, text: 'False' }; setQ(i, { type, choices: [t, fl], correctChoiceId: t.id, toolId: undefined, hotspotId: undefined }); }
        else setQ(i, { type, choices: qs[i].type === 'true_false' ? [0, 1, 2, 3].map(() => ({ id: `c-${rid()}`, text: '' })) : qs[i].choices, toolId: type.startsWith('identify') ? qs[i].toolId : undefined, hotspotId: type === 'identify_part' ? qs[i].hotspotId : undefined });
    };
    const move = (i: number, d: -1 | 1) => setQs((a) => { const b = [...a]; const j = i + d; if (j < 0 || j >= b.length) return a; [b[i], b[j]] = [b[j], b[i]]; return b; });
    const save = () => {
        const data = {
            title: f.title, description: f.description, mode: f.mode, timeLimitSec: f.minutes ? Math.round(Number(f.minutes) * 60) : null,
            maxAttempts: f.maxAttempts ? Number(f.maxAttempts) : null, passingPercent: Number(f.pass), drawCount: f.draw ? Number(f.draw) : null,
            isPublished: f.isPublished, questions: qs.map((q) => ({ ...q, toolId: q.toolId ?? null, hotspotId: q.hotspotId ?? null })),
        };
        const opts = { preserveScroll: true, onStart: () => setSaving(true), onFinish: () => setSaving(false) };
        if (quiz) router.put(`/admin/quizzes/${quiz.id}`, data, opts); else router.post('/admin/quizzes', data, opts);
    };
    const remove = async () => { if (quiz && (await confirm({ title: `Delete “${quiz.title}”?`, message: 'Learners keep their attempt history. It leaves the app in the next pack.', confirmLabel: 'Delete' }))) router.delete(`/admin/quizzes/${quiz.id}`); };
    const errorList = Object.values(errors);
    const points = qs.reduce((s, q) => s + (Number(q.points) || 0), 0);

    return (
        <>
            <Head title={quiz ? quiz.title : 'New quiz'} />
            <PageHeader back="/admin/quizzes" title={quiz ? quiz.title : 'New quiz or exam'} description={`${qs.length} question${qs.length === 1 ? '' : 's'} · ${points} point${points === 1 ? '' : 's'}`}
                actions={manage ? <>{quiz ? <Button variant="ghost" icon="trash" className="text-danger" onClick={remove}>Delete</Button> : null}<Button icon="disk" loading={saving} onClick={save}>{quiz ? 'Save changes' : 'Create'}</Button></> : null} />
            {errorList.length ? <Alert tone="danger" className="mb-6" title={`Please fix ${errorList.length} problem${errorList.length > 1 ? 's' : ''}`}><ul className="list-disc pl-4">{[...new Set(errorList)].slice(0, 8).map((e, i) => <li key={i}>{e}</li>)}</ul></Alert> : null}

            <fieldset disabled={!manage} className="grid gap-6 xl:grid-cols-[360px_1fr]">
                <div className="space-y-6">
                    <Card padded={false} className="xl:sticky xl:top-24">
                        <CardHeader icon="settings-sliders" title="Settings" />
                        <div className="space-y-4 p-5">
                            <Segmented value={f.mode} onChange={(mode) => setF({ ...f, mode })} className="w-full" options={[{ value: 'quiz', label: 'Quiz', icon: 'interrogation' }, { value: 'exam', label: 'Exam', icon: 'stopwatch' }]} />
                            <p className="text-xs text-muted">{f.mode === 'exam' ? 'Timed, auto-submits at zero, feedback only after submitting, attempts can be limited.' : 'Instant feedback after every question, unlimited retries.'}</p>
                            <Field label="Title" required error={errors.title}><Input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></Field>
                            <Field label="Description"><Textarea rows={3} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></Field>
                            <div className="grid grid-cols-2 gap-3">
                                <Field label="Time limit (min)" required={f.mode === 'exam'} error={errors.timeLimitSec}><Input type="number" min="1" value={f.minutes} onChange={(e) => setF({ ...f, minutes: e.target.value })} placeholder="None" /></Field>
                                <Field label="Pass mark (%)" error={errors.passingPercent}><Input type="number" min="1" max="100" value={f.pass} onChange={(e) => setF({ ...f, pass: e.target.value })} /></Field>
                                <Field label="Max attempts" error={errors.maxAttempts}><Input type="number" min="1" value={f.maxAttempts} onChange={(e) => setF({ ...f, maxAttempts: e.target.value })} placeholder="Unlimited" /></Field>
                                <Field label="Draw questions" hint={`From ${qs.length}`} error={errors.drawCount}><Input type="number" min="1" value={f.draw} onChange={(e) => setF({ ...f, draw: e.target.value })} placeholder="All" /></Field>
                            </div>
                            <div className="rounded-xl bg-surface-2 px-4"><Switch checked={f.isPublished} onChange={(v) => setF({ ...f, isPublished: v })} label="Include in next pack" /></div>
                        </div>
                    </Card>
                </div>

                <div className="min-w-0 space-y-3">
                    {qs.map((q, i) => {
                        const tool = tools.find((t) => t.id === q.toolId);
                        const isOpen = open === i;
                        const qErr = errors[`questions.${i}`] ?? Object.entries(errors).find(([k]) => k.startsWith(`questions.${i}.`))?.[1];
                        return (
                            <Card key={q.id} padded={false} className={cn(qErr && 'ring-2 ring-danger/40')}>
                                <div className="flex items-center gap-3 px-4 py-3">
                                    <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-surface-2 text-sm font-bold text-text">{i + 1}</span>
                                    <button type="button" onClick={() => setOpen(isOpen ? null : i)} className="min-w-0 flex-1 text-left">
                                        <p className={cn('truncate font-medium', q.prompt ? 'text-text' : 'text-muted italic')}>{q.prompt || 'Untitled question'}</p>
                                        <p className="flex items-center gap-1.5 text-xs text-muted"><Icon name={TYPES[q.type].icon} />{TYPES[q.type].label} · {q.points} pt{q.points > 1 ? 's' : ''}{q.correctChoiceId ? '' : ' · no answer marked'}</p>
                                    </button>
                                    {qErr ? <Badge tone="danger">Fix</Badge> : null}
                                    <IconButton icon="angle-small-up" label="Move up" size="sm" disabled={i === 0} onClick={() => move(i, -1)} />
                                    <IconButton icon="angle-small-down" label="Move down" size="sm" disabled={i === qs.length - 1} onClick={() => move(i, 1)} />
                                    <IconButton icon={isOpen ? 'compress' : 'expand'} label={isOpen ? 'Collapse' : 'Edit'} size="sm" onClick={() => setOpen(isOpen ? null : i)} />
                                </div>
                                {isOpen ? (
                                    <div className="space-y-4 border-t border-border p-4">
                                        {qErr ? <Alert tone="danger">{qErr}</Alert> : null}
                                        <div className="grid gap-3 sm:grid-cols-[1fr_100px]">
                                            <Field label="Type"><Select value={q.type} onChange={(e) => changeType(i, e.target.value as QuestionType)}>{Object.entries(TYPES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</Select></Field>
                                            <Field label="Points"><Input type="number" min="1" max="20" value={q.points} onChange={(e) => setQ(i, { points: Number(e.target.value) })} /></Field>
                                        </div>
                                        <Field label="Question"><Textarea rows={2} value={q.prompt} onChange={(e) => setQ(i, { prompt: e.target.value })} /></Field>
                                        {q.type === 'identify_tool' || q.type === 'identify_part' ? (
                                            <div className="grid gap-3 sm:grid-cols-2">
                                                <Field label="Tool shown (name hidden from learners)"><Select value={q.toolId ?? ''} onChange={(e) => setQ(i, { toolId: e.target.value || undefined, hotspotId: undefined })}><option value="">Choose…</option>{tools.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</Select></Field>
                                                {q.type === 'identify_part' ? <Field label="Highlighted part"><Select value={q.hotspotId ?? ''} onChange={(e) => setQ(i, { hotspotId: e.target.value || undefined })}><option value="">Choose…</option>{tool?.hotspots.map((h) => <option key={h.id} value={h.id}>{h.label}</option>)}</Select></Field> : null}
                                            </div>
                                        ) : null}
                                        <div className="space-y-2">
                                            <p className="text-sm font-medium text-text-2">Choices <span className="font-normal text-muted">— select the correct one</span></p>
                                            {q.choices.map((c, ci) => (
                                                <div key={c.id} className={cn('flex items-center gap-2 rounded-xl border p-1.5 pl-3', q.correctChoiceId === c.id ? 'border-success/50 bg-success-soft' : 'border-border')}>
                                                    <input type="radio" name={`correct-${q.id}`} checked={q.correctChoiceId === c.id} onChange={() => setQ(i, { correctChoiceId: c.id })} className="size-4 accent-[var(--success)]" aria-label={`Mark choice ${ci + 1} correct`} />
                                                    <Input value={c.text} disabled={q.type === 'true_false'} onChange={(e) => setQ(i, { choices: q.choices.map((x) => (x.id === c.id ? { ...x, text: e.target.value } : x)) })} placeholder={`Choice ${ci + 1}`} className="border-0 shadow-none focus:ring-0" />
                                                    {q.type !== 'true_false' && q.choices.length > 2 ? <IconButton icon="cross-small" label="Remove choice" size="sm" onClick={() => setQ(i, { choices: q.choices.filter((x) => x.id !== c.id), correctChoiceId: q.correctChoiceId === c.id ? '' : q.correctChoiceId })} /> : null}
                                                </div>
                                            ))}
                                            {q.type !== 'true_false' && q.choices.length < 6 ? <Button size="xs" variant="ghost" icon="add" onClick={() => setQ(i, { choices: [...q.choices, { id: `c-${rid()}`, text: '' }] })}>Add choice</Button> : null}
                                        </div>
                                        <Field label="Explanation" hint="Shown (and read aloud) after answering."><Textarea rows={2} value={q.explanation} onChange={(e) => setQ(i, { explanation: e.target.value })} /></Field>
                                        <div className="flex justify-between border-t border-border pt-3">
                                            <Button size="sm" variant="ghost" icon="copy" onClick={() => { setQs((a) => [...a.slice(0, i + 1), { ...q, id: `q-${rid()}`, choices: q.choices.map((c) => ({ ...c, id: `c-${rid()}` })), correctChoiceId: '' }, ...a.slice(i + 1)]); setOpen(i + 1); }}>Duplicate</Button>
                                            {qs.length > 1 ? <Button size="sm" variant="ghost" icon="trash" className="text-danger" onClick={() => { setQs((a) => a.filter((_, n) => n !== i)); setOpen(null); }}>Delete question</Button> : null}
                                        </div>
                                    </div>
                                ) : null}
                            </Card>
                        );
                    })}
                    <button type="button" onClick={() => { setQs((a) => [...a, blank()]); setOpen(qs.length); }} className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-border-strong py-5 text-sm font-semibold text-muted transition hover:border-primary hover:text-primary">
                        <Icon name="add" />Add question
                    </button>
                </div>
            </fieldset>
        </>
    );
}
