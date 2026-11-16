import type { Dimensions, Measurement, Subcategory, UnitSystem } from '../types';

const round = (n: number, d = 1) => Math.round(n * 10 ** d) / 10 ** d;
/** 1 → "1st year". Year levels run 1–4; null/unknown → ''. */
export const YEAR_LEVELS = [1, 2, 3, 4] as const;
export const yearLabel = (n: number | null | undefined) => (n ? `${n}${['st', 'nd', 'rd'][n - 1] ?? 'th'} year` : '');
export const fmtBytes = (n: number) => (n < 1024 ? `${n} B` : n < 1048576 ? `${(n / 1024).toFixed(0)} KB` : `${(n / 1048576).toFixed(1)} MB`);
export const fmtDuration = (sec: number) => `${Math.floor(sec / 60)}:${Math.floor(sec % 60).toString().padStart(2, '0')}`;
export const fmtDate = (iso: string) => new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
/** RFC 4122 v4 id. randomUUID only exists on secure origins, so fall back to getRandomValues (works everywhere). */
export const uid = (): string => {
  if (typeof crypto.randomUUID === 'function' && globalThis.isSecureContext !== false) return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
};

export function fmtWeight(m: Measurement, pref: 'english' | 'metric'): string {
  const kg = m.unit === 'kg' ? m.value : m.unit === 'g' ? m.value / 1000 : m.unit === 'lb' ? m.value * 0.45359237 : m.value * 0.0283495;
  return pref === 'metric' ? (kg < 1 ? `${Math.round(kg * 1000)} g` : `${round(kg, 2)} kg`) : `${round(kg * 2.20462, 2)} lb`;
}
export function fmtDimensions(d: Dimensions, pref: 'english' | 'metric'): string {
  const mm = d.unit === 'mm' ? 1 : d.unit === 'cm' ? 10 : 25.4;
  const v = [d.length, d.width, d.height].map((x) => x * mm);
  return pref === 'metric' ? `${v.map((x) => Math.round(x)).join(' × ')} mm` : `${v.map((x) => round(x / 25.4, 1)).join(' × ')} in`;
}

export const CATEGORY_LABEL = { power: 'Power Tools', common: 'Common Tools', measuring: 'Measuring Tools', special: 'Special Tools' } as const;
export const UNIT_LABEL: Record<UnitSystem, string> = { english: 'English', metric: 'Metric', dual: 'Dual (English + Metric)', na: 'Not applicable' };
export const SUB_LABEL: Record<Exclude<Subcategory, null>, string> = { pneumatic: 'Pneumatic', electric: 'Electric', english: 'English (imperial)', metric: 'Metric' };
export const BRANDS = ['Milwaukee', 'INGCO', 'Stanley', 'Aviation Specialty'] as const;
