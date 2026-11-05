import type { Question, Quiz } from '../types';
import { draw, shuffle, type Rng } from './shuffle';

export interface PreparedAttempt {
  questionOrder: string[];
  choiceOrder: Record<string, string[]>;
  questions: Question[]; // in presented order, choices in presented order
}

/**
 * Builds one attempt: draws `drawCount` questions from the pool, shuffles the
 * question order, and shuffles the choices of every question. Fresh on every call.
 */
export function prepareAttempt(quiz: Quiz, rng: Rng = Math.random): PreparedAttempt {
  const drawn = draw(quiz.questions, quiz.drawCount, rng);
  const questions = drawn.map((q) => ({ ...q, choices: shuffle(q.choices, rng) }));
  return {
    questionOrder: questions.map((q) => q.id),
    choiceOrder: Object.fromEntries(questions.map((q) => [q.id, q.choices.map((c) => c.id)])),
    questions,
  };
}

/** Rebuild the presented questions of a saved attempt from the quiz definition. */
export function restoreAttempt(
  quiz: Quiz,
  questionOrder: string[],
  choiceOrder: Record<string, string[]>,
): Question[] {
  const byId = new Map(quiz.questions.map((q) => [q.id, q]));
  const out: Question[] = [];
  for (const id of questionOrder) {
    const q = byId.get(id);
    if (!q) continue;
    const order = choiceOrder[id] ?? q.choices.map((c) => c.id);
    const cById = new Map(q.choices.map((c) => [c.id, c]));
    out.push({ ...q, choices: order.map((cid) => cById.get(cid)).filter((c): c is NonNullable<typeof c> => !!c) });
  }
  return out;
}
