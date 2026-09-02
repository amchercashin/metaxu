/** Seeded mulberry32. No I/O. */
export type Rng = () => number;

export function createRng(seed: number): Rng {
  let t = seed >>> 0;
  if (t === 0) t = 0x9e3779b9;
  return () => {
    t += 0x6d2b79f5;
    let x = t;
    x = Math.imul(x ^ (x >>> 15), x | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

export function rngInt(rng: Rng, maxExclusive: number): number {
  return Math.floor(rng() * maxExclusive);
}

export function pickWeighted<T>(items: T[], weights: number[], rng: Rng): T {
  if (items.length === 0) {
    throw new Error("pickWeighted: empty");
  }
  let sum = 0;
  for (const w of weights) sum += Math.max(0, w);
  if (sum <= 0) return items[rngInt(rng, items.length)];
  let r = rng() * sum;
  for (let i = 0; i < items.length; i++) {
    r -= Math.max(0, weights[i]);
    if (r <= 0) return items[i];
  }
  return items[items.length - 1];
}

export function shuffleInPlace<T>(arr: T[], rng: Rng): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = rngInt(rng, i + 1);
    const tmp = arr[i];
    arr[i] = arr[j];
    arr[j] = tmp;
  }
  return arr;
}
