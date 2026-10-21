/**
 * Solver: DFS s pamětí navštívených stavů a heuristickým řazením tahů.
 * Pracuje s plnou informací (ignoruje skryté vrstvy) – používá se
 * při generování úrovní a pro nápovědu.
 */
import type { Move } from './core';

export interface SolveResult {
  status: 'solved' | 'unsolvable' | 'limit';
  moves: Move[];
  nodes: number;
}

export interface SolveOptions {
  limit?: number;
  /** náhodné řazení tahů (pro měření obtížnosti); jinak heuristika */
  rnd?: () => number;
}

function topRun(t: string): number {
  const n = t.length;
  if (!n) return 0;
  const c = t.charCodeAt(n - 1);
  let r = 1;
  while (r < n && t.charCodeAt(n - 1 - r) === c) r++;
  return r;
}

export function solve(tubes: string[], caps: number[], per: number, opts: SolveOptions = {}): SolveResult {
  const limit = opts.limit ?? 400_000;
  const rnd = opts.rnd;
  const seen = new Set<string>();
  const path: Move[] = [];
  let nodes = 0;
  const n = tubes.length;
  const ts = [...tubes];

  const complete = (t: string) => t.length === per && topRun(t) === per;

  const key = () => {
    const parts = new Array<string>(n);
    for (let i = 0; i < n; i++) parts[i] = caps[i] + ts[i];
    parts.sort();
    return parts.join('|');
  };

  const solved = () => {
    for (let i = 0; i < n; i++) {
      const t = ts[i];
      if (t.length && !complete(t)) return false;
    }
    return true;
  };

  interface Cand { from: number; to: number; count: number; score: number }

  const gen = (): Cand[] => {
    const out: Cand[] = [];
    for (let i = 0; i < n; i++) {
      const a = ts[i];
      if (!a.length || complete(a)) continue;
      const run = topRun(a);
      const c = a[a.length - 1];
      const uniform = run === a.length;
      const emptyCapsTried = new Set<number>();
      for (let j = 0; j < n; j++) {
        if (j === i) continue;
        const b = ts[j];
        const space = caps[j] - b.length;
        if (space <= 0) continue;
        if (b.length) {
          if (b[b.length - 1] !== c) continue;
        } else {
          // jednobarevnou zkumavku nemá smysl přelévat do prázdné (stejné či větší)
          if (uniform && caps[j] >= caps[i]) continue;
          if (emptyCapsTried.has(caps[j])) continue;
          emptyCapsTried.add(caps[j]);
        }
        const count = Math.min(run, space);
        let score: number;
        if (rnd) {
          score = rnd();
        } else {
          score = 0;
          if (b.length) {
            score += 10;
            if (topRun(b) === b.length && b.length + count === per) score += 30; // dokončí barvu
            if (topRun(b) === b.length) score += 4;
          } else {
            score -= 2;
          }
          if (count === run) score += 6; else score -= 6;
          if (count === a.length) score += 3; // vyprázdní zkumavku
          else if (topRun(a.slice(0, a.length - count)) >= 2) score += 1;
        }
        out.push({ from: i, to: j, count, score });
      }
    }
    out.sort((x, y) => y.score - x.score);
    return out;
  };

  class Limit {}

  const dfs = (): boolean => {
    if (solved()) return true;
    if (++nodes > limit) throw new Limit();
    const k = key();
    if (seen.has(k)) return false;
    seen.add(k);
    for (const m of gen()) {
      const a = ts[m.from];
      const b = ts[m.to];
      ts[m.from] = a.slice(0, a.length - m.count);
      ts[m.to] = b + a.slice(a.length - m.count);
      path.push({ from: m.from, to: m.to, count: m.count });
      if (dfs()) return true;
      path.pop();
      ts[m.from] = a;
      ts[m.to] = b;
    }
    return false;
  };

  try {
    const ok = dfs();
    return { status: ok ? 'solved' : 'unsolvable', moves: ok ? [...path] : [], nodes };
  } catch (e) {
    if (e instanceof Limit) return { status: 'limit', moves: [], nodes };
    throw e;
  }
}
