import type { Brand, Category, Quiz, Subcategory, Tool, UnitSystem } from '@/shared';
import { db, type InstalledPackRow } from './db';

export interface ToolFilter { q?: string; category?: Category | null; subcategory?: Subcategory; brand?: Brand | null; unitSystem?: UnitSystem | null }

export async function getActivePack(): Promise<InstalledPackRow | undefined> {
  return (await db().packs.toArray()).find((p) => p.active);
}

export async function listTools(f: ToolFilter = {}): Promise<Tool[]> {
  let list = await db().tools.orderBy('sortOrder').toArray();
  if (f.category) list = list.filter((t) => t.category === f.category);
  if (f.subcategory) list = list.filter((t) => t.subcategory === f.subcategory);
  if (f.brand) list = list.filter((t) => t.brand === f.brand);
  if (f.unitSystem) list = list.filter((t) => t.unitSystem === f.unitSystem);
  const q = f.q?.trim().toLowerCase();
  if (q) {
    const byName = list.filter((t) => t.name.toLowerCase().includes(q) || t.model.toLowerCase().includes(q));
    list = byName.length ? byName : list.filter((t) => t.tags.some((x) => x.toLowerCase().includes(q)) || t.aircraftApplications.some((x) => x.toLowerCase().includes(q)) || t.purpose.toLowerCase().includes(q));
  }
  return list;
}

export const getTool = (id: string) => db().tools.get(id) as Promise<Tool | undefined>;
export const listQuizzes = async (): Promise<Quiz[]> => db().quizzes.orderBy('sortOrder').toArray();
export const getQuiz = (id: string) => db().quizzes.get(id) as Promise<Quiz | undefined>;

export async function getToolCounts() {
  const all = await db().tools.toArray();
  const byCategory: Record<Category, number> = { power: 0, common: 0, measuring: 0, special: 0 };
  const bySubcategory: Record<string, number> = {};
  for (const t of all) {
    byCategory[t.category]++;
    if (t.subcategory) bySubcategory[`${t.category}:${t.subcategory}`] = (bySubcategory[`${t.category}:${t.subcategory}`] ?? 0) + 1;
  }
  return { total: all.length, byCategory, bySubcategory };
}

export async function recordToolView(userId: string, toolId: string) {
  await db().views.put({ key: `${userId}:${toolId}`, userId, toolId, viewedAt: new Date().toISOString() });
}
export async function recentTools(userId: string, limit: number): Promise<Tool[]> {
  const views = (await db().views.where('userId').equals(userId).toArray()).sort((a, b) => b.viewedAt.localeCompare(a.viewedAt));
  const out: Tool[] = [];
  for (const v of views) {
    const t = await getTool(v.toolId); // skips tools that a later pack removed
    if (t) out.push(t);
    if (out.length >= limit) break;
  }
  return out;
}
