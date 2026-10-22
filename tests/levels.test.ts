import { describe, it, expect } from 'vitest';
import LEVELS from '../src/levels.json';
import { levelToState, applyMove, isSolved, pourCount, cloneState, isDeadlocked, type LevelDef } from '../src/game/core';
import { solve } from '../src/game/solver';

const levels = LEVELS as LevelDef[];

describe('úrovně', () => {
  it('je jich 1000', () => {
    expect(levels.length).toBe(1000);
  });

  it('každá barva má správný počet vrstev a nic není vyřešené předem', () => {
    levels.forEach((l, i) => {
      const s = levelToState(l);
      const counts = new Map<string, number>();
      for (const t of s.tubes) {
        expect(t.length, `úroveň ${i + 1}`).toBeLessThanOrEqual(l.p);
        for (const ch of t) counts.set(ch, (counts.get(ch) ?? 0) + 1);
      }
      for (const [, c] of counts) expect(c, `úroveň ${i + 1}`).toBe(l.p);
      expect(isSolved(s), `úroveň ${i + 1}`).toBe(false);
    });
  });

  it('všechny jdou vyřešit i podle herních pravidel (se skrytými vrstvami)', () => {
    levels.forEach((l, i) => {
      const s = levelToState(l);
      const res = solve(s.tubes, s.caps, s.per, { limit: 400_000 });
      expect(res.status, `úroveň ${i + 1}`).toBe('solved');
      // přehrání řešení přes herní logiku (ta při skrytých vrstvách lije jen viditelnou část)
      const g = cloneState(s);
      for (const m of res.moves) {
        let left = m.count;
        while (left > 0) {
          const n = pourCount(g, m.from, m.to);
          expect(n, `úroveň ${i + 1}`).toBeGreaterThan(0);
          applyMove(g, m.from, m.to);
          left -= n;
        }
      }
      expect(isSolved(g), `úroveň ${i + 1}`).toBe(true);
    });
  }, 120_000);
});

describe('pravidla', () => {
  it('nelze lít na jinou barvu ani do plné', () => {
    const s = levelToState({ p: 4, t: 'aabb,bbaa,' });
    expect(pourCount(s, 0, 1)).toBe(0);
    expect(pourCount(s, 1, 2)).toBe(2);
    applyMove(s, 1, 2);
    expect(s.tubes).toEqual(['aabb', 'bb', 'aa']);
  });

  it('pozná úplný deadlock: plné zkumavky, nahoře různé barvy', () => {
    expect(isDeadlocked(levelToState({ p: 4, t: 'abab,baba' }))).toBe(true);
    expect(isDeadlocked(levelToState({ p: 4, t: 'aabb,bbaa,ccdd,ddcc' }))).toBe(true);
  });

  it('volné místo nebo stejná barva navrchu = není deadlock', () => {
    expect(isDeadlocked(levelToState({ p: 4, t: 'abab,baba,' }))).toBe(false);
    expect(isDeadlocked(levelToState({ p: 4, t: 'abab,bab' }))).toBe(false);
    expect(isDeadlocked(levelToState({ p: 4, t: 'aab,bbab,a' }))).toBe(false);
  });

  it('vyřešená pozice není deadlock', () => {
    expect(isDeadlocked(levelToState({ p: 4, t: 'aaaa,bbbb' }))).toBe(false);
  });

  it('malá zkumavka navíc deadlock uvolní', () => {
    const s = levelToState({ p: 4, t: 'abab,baba' });
    s.tubes.push('');
    s.caps.push(2);
    s.hidden.push(0);
    expect(isDeadlocked(s)).toBe(false);
  });

  it('úvodní pozice žádné úrovně není deadlock', () => {
    levels.forEach((l, i) => expect(isDeadlocked(levelToState(l)), `úroveň ${i + 1}`).toBe(false));
  });

  it('skrytá vrstva se odkryje, když se dostane navrch', () => {
    const s = levelToState({ p: 4, t: 'abcc,,', h: 1 });
    expect(s.hidden[0]).toBe(3);
    expect(pourCount(s, 0, 1)).toBe(1); // vidět je jen horní c
    applyMove(s, 0, 1);
    expect(s.hidden[0]).toBe(2);
  });
});
