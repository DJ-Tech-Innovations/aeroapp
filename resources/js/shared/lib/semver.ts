export interface SemVer {
  major: number;
  minor: number;
  patch: number;
}

export function parseSemver(v: string): SemVer {
  const m = /^v?(\d+)\.(\d+)\.(\d+)/.exec(v.trim());
  if (!m) throw new Error(`Invalid semantic version: "${v}"`);
  return { major: +m[1], minor: +m[2], patch: +m[3] };
}

/** -1 if a<b, 0 if equal, 1 if a>b. */
export function compareSemver(a: string, b: string): -1 | 0 | 1 {
  const x = parseSemver(a);
  const y = parseSemver(b);
  for (const k of ['major', 'minor', 'patch'] as const) {
    if (x[k] !== y[k]) return x[k] < y[k] ? -1 : 1;
  }
  return 0;
}

export const isNewer = (candidate: string, current: string) => compareSemver(candidate, current) === 1;

/** True when the running app binary satisfies a pack's `minAppVersion`. */
export const appSatisfies = (appVersion: string, minAppVersion: string) =>
  compareSemver(appVersion, minAppVersion) >= 0;
