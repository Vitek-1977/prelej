/**
 * Herní pravidla.
 *
 * Zkumavka je řetězec barev odspodu nahoru, barva = jeden znak ('a'..'n').
 * Přelít lze horní souvislý blok jedné barvy (jen viditelnou část) do zkumavky,
 * která je prázdná, nebo má navrchu stejnou barvu a volné místo.
 */

export interface State {
  /** obsah zkumavek, odspodu nahoru */
  tubes: string[];
  /** kapacita každé zkumavky */
  caps: number[];
  /** kolik spodních vrstev je v každé zkumavce skrytých */
  hidden: number[];
  /** kolik vrstev má každá barva (= kapacita hlavních zkumavek) */
  per: number;
}

export interface Move {
  from: number;
  to: number;
  count: number;
}

export interface LevelDef {
  /** vrstev na barvu / kapacita zkumavek */
  p: number;
  /** zkumavky oddělené čárkou, prázdný řetězec = prázdná zkumavka */
  t: string;
  /** 1 = skryté vrstvy */
  h?: 1;
}

export function levelToState(def: LevelDef): State {
  const tubes = def.t.split(',');
  return {
    tubes,
    caps: tubes.map(() => def.p),
    hidden: tubes.map((t) => (def.h ? Math.max(0, t.length - 1) : 0)),
    per: def.p,
  };
}

export function cloneState(s: State): State {
  return { tubes: [...s.tubes], caps: [...s.caps], hidden: [...s.hidden], per: s.per };
}

export function topRun(t: string): number {
  const n = t.length;
  if (!n) return 0;
  const c = t.charCodeAt(n - 1);
  let r = 1;
  while (r < n && t.charCodeAt(n - 1 - r) === c) r++;
  return r;
}

export function isComplete(t: string, per: number): boolean {
  return t.length === per && topRun(t) === per;
}

/** Kolik vrstev se přelije z `from` do `to` (0 = tah není možný). */
export function pourCount(s: State, from: number, to: number): number {
  if (from === to) return 0;
  const a = s.tubes[from];
  const b = s.tubes[to];
  if (!a.length) return 0;
  const space = s.caps[to] - b.length;
  if (space <= 0) return 0;
  if (b.length && b[b.length - 1] !== a[a.length - 1]) return 0;
  const visible = a.length - s.hidden[from];
  const run = Math.min(topRun(a), visible);
  return Math.min(run, space);
}

/** Provede tah (mutuje stav). Vrací počet přelitých vrstev. */
export function applyMove(s: State, from: number, to: number): number {
  const n = pourCount(s, from, to);
  if (!n) return 0;
  const a = s.tubes[from];
  const chunk = a.slice(a.length - n);
  s.tubes[from] = a.slice(0, a.length - n);
  s.tubes[to] = s.tubes[to] + chunk;
  // odkrytí: horní vrstva zdrojové zkumavky je vždy vidět
  s.hidden[from] = Math.min(s.hidden[from], Math.max(0, s.tubes[from].length - 1));
  return n;
}

export function isSolved(s: State): boolean {
  return s.tubes.every((t) => t.length === 0 || isComplete(t, s.per));
}

/** Existuje vůbec nějaký smysluplný tah? */
export function hasMoves(s: State): boolean {
  for (let i = 0; i < s.tubes.length; i++) {
    const a = s.tubes[i];
    if (!a.length || isComplete(a, s.per)) continue;
    for (let j = 0; j < s.tubes.length; j++) {
      if (pourCount(s, i, j) > 0) {
        // přelití celé jednobarevné zkumavky do prázdné stejné velikosti nic nezmění
        const b = s.tubes[j];
        if (!b.length && topRun(a) === a.length && s.caps[j] >= s.caps[i]) continue;
        return true;
      }
    }
  }
  return false;
}

export function colorCount(s: State): number {
  const set = new Set<string>();
  for (const t of s.tubes) for (const ch of t) set.add(ch);
  return set.size;
}
