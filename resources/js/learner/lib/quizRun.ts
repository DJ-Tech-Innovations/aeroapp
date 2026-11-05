import { create } from 'zustand';
import { prepareAttempt, restoreAttempt, scoreAttempt, uid, type AttemptRow, type Question, type Quiz } from '@/shared';
import { db } from './db';
import { getActivePack } from './content';

interface Run {
  attempt: AttemptRow;
  quiz: Quiz;
  questions: Question[]; // in presented order; choices already shuffled
  index: number;
  deadline: number | null; // epoch ms
  revealed: Record<string, boolean>; // quiz mode: feedback showing
}
interface RunState {
  run: Run | null;
  start: (quiz: Quiz, userId: string) => Promise<string>;
  resume: (attempt: AttemptRow, quiz: Quiz) => void;
  answer: (qid: string, choiceId: string) => void;
  reveal: (qid: string) => void;
  goto: (i: number) => void;
  submit: () => Promise<string>;
  clear: () => void;
}
const nowIso = () => new Date().toISOString();

export const useRun = create<RunState>((set, get) => ({
  run: null,

  async start(quiz, userId) {
    const prep = prepareAttempt(quiz); // fresh draw + shuffle of questions AND choices on every attempt
    const packVersion = (await getActivePack())?.version ?? 'unknown';
    const attempt: AttemptRow = {
      id: uid(), quizId: quiz.id, quizTitle: quiz.title, quizMode: quiz.mode, userId, packVersion,
      questionOrder: prep.questionOrder, choiceOrder: prep.choiceOrder,
      answers: Object.fromEntries(prep.questionOrder.map((id) => [id, null])),
      score: 0, maxScore: prep.questions.reduce((a, q) => a + q.points, 0), passed: false,
      startedAt: nowIso(), submittedAt: null, syncStatus: 'pending',
    };
    await db().attempts.put(attempt);
    set({ run: { attempt, quiz, questions: prep.questions, index: 0, deadline: quiz.timeLimitSec ? Date.now() + quiz.timeLimitSec * 1000 : null, revealed: {} } });
    return attempt.id;
  },

  resume(attempt, quiz) {
    const questions = restoreAttempt(quiz, attempt.questionOrder, attempt.choiceOrder);
    const firstOpen = Math.max(0, questions.findIndex((q) => attempt.answers[q.id] == null));
    set({ run: {
      attempt, quiz, questions, index: firstOpen,
      deadline: quiz.timeLimitSec ? new Date(attempt.startedAt).getTime() + quiz.timeLimitSec * 1000 : null,
      revealed: Object.fromEntries(questions.filter((q) => attempt.answers[q.id] != null && quiz.mode === 'quiz').map((q) => [q.id, true])),
    } });
  },

  answer(qid, choiceId) {
    const { run } = get();
    if (!run || (run.quiz.mode === 'quiz' && run.revealed[qid])) return;
    const attempt = { ...run.attempt, answers: { ...run.attempt.answers, [qid]: choiceId } };
    set({ run: { ...run, attempt } });
    void db().attempts.put(attempt); // saved on every answer → survives reloads / closed tabs
  },
  reveal: (qid) => set((s) => (s.run ? { run: { ...s.run, revealed: { ...s.run.revealed, [qid]: true } } } : s)),
  goto: (i) => set((s) => (s.run ? { run: { ...s.run, index: Math.max(0, Math.min(s.run.questions.length - 1, i)) } } : s)),

  async submit() {
    const { run } = get();
    if (!run) throw new Error('No active attempt');
    const r = scoreAttempt(run.questions, run.attempt.answers, run.quiz.passingPercent);
    const attempt: AttemptRow = { ...run.attempt, score: r.score, maxScore: r.maxScore, passed: r.passed, submittedAt: nowIso(), syncStatus: 'pending' };
    await db().attempts.put(attempt);
    set({ run: null });
    return attempt.id;
  },
  clear: () => set({ run: null }),
}));

/** Grade an attempt that was never submitted (e.g. the exam timer ran out while the tab was closed). */
export async function finalizeExpired(attempt: AttemptRow, quiz: Quiz): Promise<AttemptRow> {
  const questions = restoreAttempt(quiz, attempt.questionOrder, attempt.choiceOrder);
  const r = scoreAttempt(questions, attempt.answers, quiz.passingPercent);
  const deadline = new Date(attempt.startedAt).getTime() + (quiz.timeLimitSec ?? 0) * 1000;
  const done: AttemptRow = { ...attempt, score: r.score, maxScore: r.maxScore, passed: r.passed, submittedAt: new Date(deadline).toISOString(), syncStatus: 'pending' };
  await db().attempts.put(done);
  return done;
}

/** Attempts used / left / best / resumable attempt. Expired exams are auto-graded here. */
export async function quizStatus(quiz: Quiz, userId: string) {
  let rows = await db().attempts.where('userId').equals(userId).filter((a) => a.quizId === quiz.id).toArray();
  const expired = rows.filter((a) => !a.submittedAt && quiz.timeLimitSec && new Date(a.startedAt).getTime() + quiz.timeLimitSec * 1000 <= Date.now());
  for (const a of expired) await finalizeExpired(a, quiz);
  if (expired.length) rows = await db().attempts.where('userId').equals(userId).filter((a) => a.quizId === quiz.id).toArray();
  const submitted = rows.filter((a) => a.submittedAt);
  const open = rows.find((a) => !a.submittedAt) ?? null;
  const used = quiz.mode === 'exam' ? rows.length : submitted.length; // an abandoned exam attempt still counts
  const left = quiz.maxAttempts == null ? null : Math.max(0, quiz.maxAttempts - used);
  const best = submitted.length ? Math.max(...submitted.map((a) => (a.maxScore ? (a.score / a.maxScore) * 100 : 0))) : null;
  return { used, left, best, open };
}
