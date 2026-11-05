import { db } from './db';

const dayKey = (iso: string) => new Date(iso).toLocaleDateString('en-CA');
export function computeStreak(isoDates: string[], today = new Date()): number {
  const days = new Set(isoDates.map(dayKey));
  let streak = 0;
  const d = new Date(today);
  if (!days.has(dayKey(d.toISOString()))) d.setDate(d.getDate() - 1); // today may not have activity yet
  while (days.has(dayKey(d.toISOString()))) { streak++; d.setDate(d.getDate() - 1); }
  return streak;
}

export async function studentStats(userId: string) {
  const [attempts, views] = await Promise.all([db().attempts.where('userId').equals(userId).toArray(), db().views.where('userId').equals(userId).toArray()]);
  const done = attempts.filter((a) => a.submittedAt).sort((a, b) => (b.submittedAt ?? '').localeCompare(a.submittedAt ?? ''));
  const pct = (a: (typeof done)[number]) => (a.maxScore ? (a.score / a.maxScore) * 100 : 0);
  return {
    toolsViewed: views.length,
    quizzesTaken: done.length,
    averageScore: done.length ? Math.round(done.reduce((s, x) => s + pct(x), 0) / done.length) : null,
    exams: done.filter((a) => a.quizMode === 'exam'),
    streak: computeStreak([...views.map((v) => v.viewedAt), ...attempts.map((a) => a.startedAt)]),
    history: done,
  };
}
