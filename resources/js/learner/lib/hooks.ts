import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useState } from 'react';
import type { Quiz } from '@/shared';
import { getActivePack, getTool, getToolCounts, listQuizzes, listTools, recentTools, type ToolFilter } from './content';
import { db } from './db';
import { pendingCounts } from './sync';
import { quizStatus } from './quizRun';

/** Live (reactive) reads from IndexedDB: screens update automatically when a pack installs or an attempt is saved. */
export const useActivePack = () => useLiveQuery(() => getActivePack(), []);
export const useTools = (f: ToolFilter) => useLiveQuery(() => listTools(f), [f.q, f.category, f.subcategory, f.brand, f.unitSystem]);
export const useTool = (id?: string | null) => useLiveQuery(async () => (id ? (await getTool(id)) ?? null : undefined), [id]);
export const useToolCounts = () => useLiveQuery(() => getToolCounts(), []);
export const useQuizzes = () => useLiveQuery(() => listQuizzes(), []);
export const useQuiz = (id?: string | null) => useLiveQuery(async () => (id ? ((await db().quizzes.get(id)) as Quiz | undefined) ?? null : undefined), [id]);
export const useRecentTools = (userId?: string) => useLiveQuery(() => (userId ? recentTools(userId, 8) : []), [userId]);
export const usePending = (userId?: string) => useLiveQuery(() => (userId ? pendingCounts(userId) : undefined), [userId]);
export const useAttempts = (userId?: string, quizId?: string) =>
  useLiveQuery(async () => {
    if (!userId) return [];
    const rows = await db().attempts.where('userId').equals(userId).toArray();
    return rows.filter((a) => !quizId || a.quizId === quizId).sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  }, [userId, quizId]);
export const useQuizStatus = (quiz: Quiz | null | undefined, userId?: string) =>
  useLiveQuery(() => (quiz && userId ? quizStatus(quiz, userId) : undefined), [quiz?.id, userId]);

/** One-shot async value with loading/error state (for Supabase reads). */
export function useAsync<T>(fn: () => Promise<T>, deps: unknown[]) {
  const [state, set] = useState<{ data?: T; error?: string; loading: boolean }>({ loading: true });
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let live = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- start of an async fetch (loading flag)
    set((s) => ({ ...s, loading: true }));
    fn().then((data) => live && set({ data, loading: false })).catch((e) => live && set({ error: (e as Error).message, loading: false }));
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);
  return { ...state, reload: () => setTick((n) => n + 1) };
}
