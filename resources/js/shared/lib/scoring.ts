import type { Question } from '../types';

export interface ScoreResult {
  score: number;
  maxScore: number;
  percent: number;
  passed: boolean;
  correctIds: string[];
  wrongIds: string[];
  unansweredIds: string[];
}

/** Score the questions that were actually presented in an attempt. */
export function scoreAttempt(
  questions: readonly Question[],
  answers: Record<string, string | null>,
  passingPercent: number,
): ScoreResult {
  let score = 0;
  let maxScore = 0;
  const correctIds: string[] = [];
  const wrongIds: string[] = [];
  const unansweredIds: string[] = [];
  for (const q of questions) {
    maxScore += q.points;
    const a = answers[q.id];
    if (a == null) unansweredIds.push(q.id);
    else if (a === q.correctChoiceId) {
      score += q.points;
      correctIds.push(q.id);
    } else wrongIds.push(q.id);
  }
  const percent = maxScore === 0 ? 0 : Math.round((score / maxScore) * 1000) / 10;
  return { score, maxScore, percent, passed: percent >= passingPercent, correctIds, wrongIds, unansweredIds };
}

export const attemptsLeft = (maxAttempts: number | null, used: number) =>
  maxAttempts == null ? null : Math.max(0, maxAttempts - used);
