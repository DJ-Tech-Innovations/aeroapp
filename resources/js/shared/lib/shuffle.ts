export type Rng = () => number;

/** Fisher–Yates. Returns a new array; the input is never mutated. */
export function shuffle<T>(input: readonly T[], rng: Rng = Math.random): T[] {
  const a = input.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Draw `count` random items (all of them, shuffled, when count is null or >= length). */
export function draw<T>(input: readonly T[], count: number | null, rng: Rng = Math.random): T[] {
  const s = shuffle(input, rng);
  return count == null || count >= s.length ? s : s.slice(0, Math.max(0, count));
}

/** Small deterministic PRNG (mulberry32) for tests. */
export function seededRng(seed: number): Rng {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}
