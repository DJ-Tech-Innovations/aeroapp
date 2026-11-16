import type { Quiz } from '@/shared';
import { api } from './api';

export interface RosterStudent { id: string; fullName: string; email: string; idNumber: string; section: string; yearLevel: number | null; avatarUrl: string | null; classId: string; className: string }
export interface AttemptSummary { id: string; userId: string; quizId: string; quizTitle: string; score: number; maxScore: number; passed: boolean; submittedAt: string; answers: Record<string, string | null>; packVersion: string }

/** The server scopes everything here to the signed-in instructor's own classes. */
export const listRoster = async () => (await api.get<{ roster: RosterStudent[] }>('/instructor/roster')).roster;

export async function listAttempts(filter: { quizId?: string; userId?: string } = {}): Promise<AttemptSummary[]> {
    const q = new URLSearchParams(Object.entries(filter).filter(([, v]) => !!v) as [string, string][]).toString();
    return (await api.get<{ attempts: AttemptSummary[] }>(`/instructor/attempts${q ? `?${q}` : ''}`)).attempts;
}

export const pct = (a: { score: number; maxScore: number }) => (a.maxScore ? (a.score / a.maxScore) * 100 : 0);

export async function classOverview() {
    const [roster, attempts] = await Promise.all([listRoster(), listAttempts()]);
    const byStudent = new Map<string, number[]>();
    for (const a of attempts) byStudent.set(a.userId, [...(byStudent.get(a.userId) ?? []), pct(a)]);
    const avgs = [...byStudent.values()].map((v) => v.reduce((s, x) => s + x, 0) / v.length);
    return {
        students: roster.length,
        averageScore: avgs.length ? Math.round(avgs.reduce((s, x) => s + x, 0) / avgs.length) : 0,
        activeStudents: byStudent.size,
        attempts: attempts.length,
    };
}

export interface QuizSummary {
    rows: { studentId: string; studentName: string; bestPercent: number; attempts: number; passed: boolean }[];
    averagePercent: number;
    passRate: number;
    itemAnalysis: { questionId: string; prompt: string; missRate: number; answered: number }[];
}

/** Best score per student + item analysis (most-missed questions) computed from the real attempts. */
export function summarizeQuiz(quiz: Quiz, attempts: AttemptSummary[], roster: RosterStudent[]): QuizSummary {
    const names = new Map(roster.map((s) => [s.id, s.fullName]));
    const by = new Map<string, AttemptSummary[]>();
    for (const a of attempts) by.set(a.userId, [...(by.get(a.userId) ?? []), a]);
    const rows = [...by.entries()].map(([id, list]) => {
        const best = Math.max(...list.map(pct));
        return { studentId: id, studentName: names.get(id) ?? 'Student', bestPercent: Math.round(best), attempts: list.length, passed: best >= quiz.passingPercent };
    }).sort((a, b) => b.bestPercent - a.bestPercent);

    const stat = new Map<string, { wrong: number; answered: number }>();
    for (const a of attempts) {
        for (const q of quiz.questions) {
            if (!(q.id in a.answers)) continue; // question wasn't drawn for this attempt
            const s = stat.get(q.id) ?? { wrong: 0, answered: 0 };
            s.answered++;
            if (a.answers[q.id] !== q.correctChoiceId) s.wrong++; // unanswered counts as missed
            stat.set(q.id, s);
        }
    }
    const itemAnalysis = quiz.questions.filter((q) => stat.has(q.id)).map((q) => ({ questionId: q.id, prompt: q.prompt, missRate: stat.get(q.id)!.wrong / stat.get(q.id)!.answered, answered: stat.get(q.id)!.answered })).sort((a, b) => b.missRate - a.missRate);
    return {
        rows,
        averagePercent: rows.length ? Math.round(rows.reduce((s, r) => s + r.bestPercent, 0) / rows.length) : 0,
        passRate: rows.length ? Math.round((rows.filter((r) => r.passed).length / rows.length) * 100) : 0,
        itemAnalysis,
    };
}
