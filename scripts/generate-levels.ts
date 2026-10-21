/**
 * Generátor 1000 úrovní.
 *
 * Pro každou úroveň se podle křivky obtížnosti určí parametry (počet barev,
 * prázdných zkumavek, kapacita, skryté vrstvy), vygeneruje se několik
 * náhodných kandidátů (deterministicky ze seedu), solver ověří řešitelnost
 * a změří obtížnost, a vybere se kandidát podle cílového kvantilu.
 *
 * Spuštění: npm run levels  → src/levels.json
 */
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { solve } from '../src/game/solver';
import { mulberry32, hashSeed, shuffle } from '../src/game/rng';
import type { LevelDef } from '../src/game/core';

export const LEVEL_COUNT = 1000;
const SALT = 20261021;

export interface Params {
  colors: number;
  empties: number;
  per: number;
  hidden: boolean;
  /** cílový kvantil obtížnosti mezi kandidáty (0 = nejlehčí, 1 = nejtěžší) */
  q: number;
}

export function params(n: number): Params {
  const rnd = mulberry32(hashSeed(SALT, n, 7));
  const boss = n % 10 === 0;
  const breather = n % 10 === 1 && n > 1;

  let colors = 3 + Math.floor(11 * (1 - Math.exp(-n / 170)));
  if (boss) colors += 1;
  if (breather) colors -= 1;
  if (n === 1) colors = 2;
  if (n >= 2 && n <= 5) colors = 3;

  let per = 4;
  if (n >= 450 && !boss && rnd() < 0.25) {
    per = 5;
    colors -= 2;
  }

  let empties = 2;
  if (n === 1) empties = 1;
  // jedna prázdná zkumavka = výrazně těžší; občas od 250. úrovně
  // (s jednou prázdnou je náhodná pozice řešitelná jen při menším počtu barev)
  if (n >= 250 && !breather && rnd() < Math.min(0.3, 0.08 + (n - 250) / 1500)) {
    empties = 1;
    colors = Math.min(colors, per === 5 ? 7 : 9);
  }

  let hidden = false;
  if (n >= 40 && n < 200) hidden = n % 5 === 0 || n % 10 === 7;
  else if (n >= 200 && n < 500) hidden = rnd() < 0.45;
  else if (n >= 500) hidden = rnd() < 0.65;
  if (breather) hidden = false;

  colors = Math.max(n === 1 ? 2 : 3, Math.min(14, colors));

  let q = 0.5;
  if (n <= 10) q = 0.1;
  else if (boss) q = 0.92;
  else if (breather) q = 0.15;
  else q = 0.35 + 0.3 * rnd();

  return { colors, empties, per, hidden, q };
}

function makeCandidate(colors: number, per: number, empties: number, rnd: () => number): string[] {
  const items: string[] = [];
  for (let c = 0; c < colors; c++) for (let k = 0; k < per; k++) items.push(String.fromCharCode(97 + c));
  // přejmenování barev, aby první úrovně nebyly pořád červená/oranžová
  const perm = shuffle([...Array(14).keys()], rnd);
  const mapped = items.map((ch) => String.fromCharCode(97 + perm[ch.charCodeAt(0) - 97]));
  shuffle(mapped, rnd);
  const tubes: string[] = [];
  for (let c = 0; c < colors; c++) tubes.push(mapped.slice(c * per, (c + 1) * per).join(''));
  for (let e = 0; e < empties; e++) tubes.push('');
  return tubes;
}

function topRun(t: string): number {
  let r = t.length ? 1 : 0;
  while (r < t.length && t[t.length - 1 - r] === t[t.length - 1]) r++;
  return r;
}

/** Zamítne „nudné“ startovní pozice. */
function acceptable(tubes: string[], per: number): boolean {
  for (const t of tubes) {
    if (!t.length) continue;
    if (topRun(t) === t.length) return false; // jednobarevná zkumavka hned na startu
    if (topRun(t) >= per - 1) return false;
  }
  return true;
}

interface Scored { tubes: string[]; diff: number; len: number }

function difficulty(tubes: string[], per: number, seed: number): Scored | null {
  const caps = tubes.map(() => per);
  const smart = solve(tubes, caps, per, { limit: 300_000 });
  if (smart.status !== 'solved') return null;
  // „lidská“ obtížnost: kolik stavů projde DFS s náhodným pořadím tahů
  let total = 0;
  const RUNS = 3;
  for (let r = 0; r < RUNS; r++) {
    const res = solve(tubes, caps, per, { limit: 60_000, rnd: mulberry32(hashSeed(seed, r)) });
    total += res.status === 'solved' ? res.nodes : 60_000 * 1.5;
  }
  const diff = Math.log2(total / RUNS + 1) + smart.moves.length * 0.05;
  return { tubes, diff, len: smart.moves.length };
}

export function generateLevel(n: number): LevelDef {
  const p = params(n);

  if (n === 1) {
    // výuková úroveň
    return { p: 4, t: 'aabb,bbaa,' };
  }

  const tryGen = (empties: number, candidates: number): Scored[] => {
    const rnd = mulberry32(hashSeed(SALT, n, empties));
    const out: Scored[] = [];
    let attempts = 0;
    const maxAttempts = candidates * (empties === 1 ? 40 : 6);
    while (out.length < candidates && attempts < maxAttempts) {
      attempts++;
      const tubes = makeCandidate(p.colors, p.per, empties, rnd);
      if (!acceptable(tubes, p.per)) continue;
      const s = difficulty(tubes, p.per, hashSeed(SALT, n, attempts));
      if (s) out.push(s);
    }
    return out;
  };

  const K = p.colors >= 11 ? 6 : 10;
  let found = tryGen(p.empties, K);
  if (found.length < 2 && p.empties === 1) found = tryGen(2, K);
  if (!found.length) throw new Error(`Úroveň ${n}: nepodařilo se najít řešitelnou pozici`);

  found.sort((a, b) => a.diff - b.diff);
  const pick = found[Math.min(found.length - 1, Math.round(p.q * (found.length - 1)))];
  const def: LevelDef = { p: p.per, t: pick.tubes.join(',') };
  if (p.hidden) def.h = 1;
  return def;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const from = Number(process.env.FROM ?? 1);
  const to = Number(process.env.TO ?? LEVEL_COUNT);
  const out: LevelDef[] = [];
  const t0 = Date.now();
  for (let n = from; n <= to; n++) {
    out.push(generateLevel(n));
    if (n % 50 === 0) console.log(`${n} úrovní (${((Date.now() - t0) / 1000).toFixed(1)} s)`);
  }
  const file = process.env.OUT ?? 'src/levels.json';
  writeFileSync(file, '[\n' + out.map((l) => JSON.stringify(l)).join(',\n') + '\n]\n');
  console.log(`Hotovo: ${out.length} úrovní → ${file} za ${((Date.now() - t0) / 1000).toFixed(1)} s`);
}
