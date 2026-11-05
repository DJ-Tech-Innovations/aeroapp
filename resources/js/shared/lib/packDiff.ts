import type { PackChangelog, Quiz, Tool } from '../types';

interface Versioned {
  id: string;
  updatedAt: string;
}

function diffList<T extends Versioned>(oldList: readonly T[], newList: readonly T[]) {
  const oldMap = new Map(oldList.map((x) => [x.id, x]));
  const newMap = new Map(newList.map((x) => [x.id, x]));
  const added: string[] = [];
  const updated: string[] = [];
  const removed: string[] = [];
  for (const [id, n] of newMap) {
    const o = oldMap.get(id);
    if (!o) added.push(id);
    else if (o.updatedAt !== n.updatedAt) updated.push(id);
  }
  for (const id of oldMap.keys()) if (!newMap.has(id)) removed.push(id);
  return { added, updated, removed };
}

/** Compare two pack payloads. Items are "updated" when their `updatedAt` stamp differs. */
export function diffPacks(
  oldPack: { tools: readonly Tool[]; quizzes: readonly Quiz[] },
  newPack: { tools: readonly Tool[]; quizzes: readonly Quiz[] },
): PackChangelog {
  const t = diffList(oldPack.tools, newPack.tools);
  const q = diffList(oldPack.quizzes, newPack.quizzes);
  return {
    toolsAdded: t.added,
    toolsUpdated: t.updated,
    toolsRemoved: t.removed,
    quizzesAdded: q.added,
    quizzesUpdated: q.updated,
    quizzesRemoved: q.removed,
  };
}
