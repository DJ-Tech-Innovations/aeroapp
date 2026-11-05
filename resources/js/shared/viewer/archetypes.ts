import raw from '../archetypes.json';

export type ColorKey = 'body' | 'metal' | 'dark' | 'accent' | 'rubber' | 'glass';
export interface ArchPart { name: string; shape: 'box' | 'cyl' | 'sphere' | 'torus'; size: number[]; pos: number[]; rot?: number[]; color: ColorKey; pivot?: number[]; /** torus only: sweep angle in radians (default full ring) */ arc?: number }
export interface ArchStep { part: string; kind: 'rotate' | 'translate'; axis: 'x' | 'y' | 'z'; amount: number; loop: 'pingpong' | 'spin'; speed: number }
export interface Archetype { parts: ArchPart[]; anchors: number[][]; animations: { name: string; steps: ArchStep[] }[] }

export const ARCHETYPES = raw as unknown as Record<string, Archetype>;
export const ARCHETYPE_NAMES = Object.keys(ARCHETYPES).sort();
/** `procedural://micrometer` → "micrometer"; real GLB paths return null. */
export const archetypeOf = (file: string): string | null => (file.startsWith('procedural://') ? file.slice('procedural://'.length) : null);
/** True when the model is a real mesh file rather than a procedural placeholder. */
export const isGlbModel = (file: string): boolean => /\.glb(\?|$)/i.test(file);
export const brandColor = (brand: string) =>
  ({ Milwaukee: '#DB1A2D', Stanley: '#F5C400', INGCO: '#1F5FFF', 'Aviation Specialty': '#6F7F96' } as Record<string, string>)[brand] ?? '#6F7F96';
