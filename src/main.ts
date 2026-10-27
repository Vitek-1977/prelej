import './style.css';
import LEVELS from './levels.json';
import {
  type LevelDef,
  type State,
  levelToState,
  cloneState,
  pourCount,
  applyMove,
  isSolved,
  isComplete,
  isDeadlocked,
  topRun,
} from './game/core';
import { solve } from './game/solver';
import { COLORS, symbolSvg } from './ui/palette';
import { sfx, haptics, unlockAudio } from './ui/feedback';
import { loadSave, storeSave, requestPersistence, defaultSave, type Save } from './ui/storage';
import { registerSW } from 'virtual:pwa-register';
import { setupViewport } from './ui/viewport';

declare const __APP_VERSION__: string;

const levels = LEVELS as LevelDef[];
const TOTAL = levels.length;

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const board = $('board');

// ---------------------------------------------------------------- stav hry
let save: Save = loadSave();
let level = Math.min(Math.max(1, save.current), save.unlocked, TOTAL);
let state: State;
let history: State[] = [];
let extraUsed = false;
let hints = 0;
let selected: number | null = null;
let busy = false;
let finished = false;
/** úplný deadlock – žádný smysluplný tah, plocha je zamčená */
let stuck = false;
let stuckTimer: number | undefined;
let menuRange = Math.floor((level - 1) / 100);

sfx.enabled = save.settings.sound;
haptics.enabled = save.settings.haptics;

function startLevel(n: number, resume = false) {
  level = n;
  save.current = n;
  selected = null;
  finished = false;
  busy = false;
  const p = save.progress;
  if (resume && p && p.level === n && p.history.length) {
    history = p.history.slice(0, -1);
    state = p.history[p.history.length - 1];
    extraUsed = p.extraUsed;
    hints = p.hints ?? 0;
  } else {
    state = levelToState(levels[n - 1]);
    history = [];
    extraUsed = false;
    hints = 0;
  }
  persist(true);
  clearStuck();
  renderAll();
  if (isSolved(state)) onWin();
  else if (isDeadlocked(state)) enterStuck(0);
  else showTips();
}

function persist(immediate = false) {
  save.progress = { level, history: [...history, state], extraUsed, moves: history.length, hints };
  storeSave(save, immediate);
}

// ---------------------------------------------------------------- rozložení
interface Layout {
  w: number;
  l: number;
  rows: number[][];
}

function computeLayout(): Layout {
  const n = state.tubes.length;
  const per = state.per;
  const rect = board.getBoundingClientRect();
  const availW = rect.width;
  const availH = rect.height;
  const gapX = 0.38;
  const tubeH = per * 0.86 + 0.42; // výška zkumavky v násobcích šířky
  const rowGap = 0.75;
  let best: Layout = { w: 0, l: 0, rows: [] };
  for (let r = 1; r <= 4; r++) {
    const perRow = Math.ceil(n / r);
    if (r > 1 && Math.ceil(n / (r - 1)) === perRow) continue;
    const wByW = availW / (perRow + (perRow - 1) * gapX);
    const wByH = availH / (r * tubeH + (r - 1) * rowGap + 0.6);
    const w = Math.min(wByW, wByH, 66);
    if (w > best.w + 0.5) {
      const rows: number[][] = [];
      let i = 0;
      for (let k = 0; k < r; k++) {
        const cnt = Math.ceil((n - i) / (r - k));
        rows.push([...Array(cnt).keys()].map((x) => x + i));
        i += cnt;
      }
      best = { w: Math.floor(w), l: 0, rows };
    }
  }
  best.l = Math.round(best.w * 0.86);
  return best;
}

// ---------------------------------------------------------------- vykreslení
let layout: Layout;
const tubeEls: HTMLButtonElement[] = [];

interface RenderOpts {
  pending?: { tube: number; count: number };
  reveal?: { tube: number; index: number };
}

function renderBoard(opts: RenderOpts = {}) {
  layout = computeLayout();
  const { w, l } = layout;
  board.style.setProperty('--w', `${w}px`);
  board.style.setProperty('--l', `${l}px`);
  board.replaceChildren();
  tubeEls.length = 0;
  const gap = Math.round(w * 0.38);
  layout.rows.forEach((row, ri) => {
    const rowEl = document.createElement('div');
    rowEl.className = 'row';
    rowEl.style.gap = `${gap}px`;
    if (ri > 0) rowEl.style.marginTop = `${Math.round(w * 0.75)}px`;
    for (const i of row) {
      const el = renderTube(i, opts);
      tubeEls[i] = el;
      rowEl.appendChild(el);
    }
    board.appendChild(rowEl);
  });
}

function renderTube(i: number, opts: RenderOpts): HTMLButtonElement {
  const { w, l } = layout;
  const t = state.tubes[i];
  const cap = state.caps[i];
  const el = document.createElement('button');
  el.className = 'tube';
  el.dataset.i = String(i);
  el.style.setProperty('--h', `${Math.round(cap * l + w * 0.42)}px`);
  el.setAttribute('aria-label', `Zkumavka ${i + 1}`);
  if (cap < state.per) el.classList.add('small');
  if (i === selected) el.classList.add('sel');
  if (isComplete(t, state.per)) {
    el.classList.add('done');
    el.style.setProperty('--dc', COLORS[t.charCodeAt(0) - 97]);
  }
  const glass = document.createElement('div');
  glass.className = 'glass';
  const hiddenN = state.hidden[i];
  const pendingFrom = opts.pending?.tube === i ? t.length - opts.pending.count : Infinity;

  // skryté vrstvy jednotlivě
  for (let k = 0; k < hiddenN; k++) {
    const d = document.createElement('div');
    d.className = 'layer hidden';
    d.style.setProperty('--k', String(k));
    d.style.setProperty('--n', '1');
    d.innerHTML = '<span>?</span>';
    glass.appendChild(d);
  }
  // viditelné vrstvy sloučené do souvislých bloků
  let k = hiddenN;
  while (k < t.length) {
    let e = k + 1;
    while (e < t.length && t[e] === t[k] && !(e === pendingFrom)) e++;
    const ci = t.charCodeAt(k) - 97;
    const d = document.createElement('div');
    d.className = 'layer';
    if (k >= pendingFrom) d.classList.add('pending');
    if (opts.reveal?.tube === i && k === opts.reveal.index) d.classList.add('reveal');
    d.style.setProperty('--k', String(k));
    d.style.setProperty('--n', String(e - k));
    d.style.setProperty('--c', COLORS[ci]);
    if (save.settings.symbols) {
      for (let s = k; s < e; s++) {
        const sym = document.createElement('div');
        sym.className = 'sym';
        sym.innerHTML = symbolSvg(ci);
        d.appendChild(sym);
      }
    }
    glass.appendChild(d);
    k = e;
  }
  el.appendChild(glass);
  return el;
}

/** 1 tah, 2–4 tahy, 5+ tahů */
function tahy(n: number): string {
  return `${n} ${n === 1 ? 'tah' : n >= 2 && n <= 4 ? 'tahy' : 'tahů'}`;
}

const HEAD_TAGS: Record<string, string> = {};
function renderHud() {
  $('lvl').textContent = String(level);
  $('moves').textContent = String(history.length);
  $('moves-label').textContent = tahy(history.length).split(' ')[1];
  ($('btn-undo') as HTMLButtonElement).disabled = history.length === 0 || finished;
  ($('btn-restart') as HTMLButtonElement).disabled = (history.length === 0 && !extraUsed && !stuck) || finished;
  ($('btn-extra') as HTMLButtonElement).disabled = extraUsed || finished;
  ($('btn-hint') as HTMLButtonElement).disabled = finished || stuck;

  const def = levels[level - 1];
  const tags: [string, string?][] = [];
  if (level % 10 === 0) tags.push(['Těžká', 'boss']);
  if (def.h) tags.push(['Skryté vrstvy']);
  if (def.p !== 4) tags.push([`${def.p} vrstvy`]);
  const empties = def.t.split(',').filter((x) => !x).length;
  if (empties === 1 && level > 1) tags.push(['1 volná zkumavka']);
  const html = tags.map(([t, c]) => `<span class="tag ${c ?? ''}">${t}</span>`).join('');
  if (HEAD_TAGS.last !== html) {
    $('tags').innerHTML = html;
    HEAD_TAGS.last = html;
  }
}

function renderAll(opts: RenderOpts = {}) {
  renderBoard(opts);
  renderHud();
}

// ---------------------------------------------------------------- toast
let toastTimer: number | undefined;
function toast(msg: string, ms = 2600) {
  const t = $('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => t.classList.remove('show'), ms);
}

function showTips() {
  const def = levels[level - 1];
  const seen = new Set(save.tips ?? []);
  const tip = (id: string, msg: string) => {
    if (seen.has(id)) return false;
    seen.add(id);
    save.tips = [...seen];
    storeSave(save);
    setTimeout(() => toast(msg, 5200), 350);
    return true;
  };
  if (level === 1) tip('basic', 'Ťukni na zkumavku a pak na cíl. Přelít jde jen na stejnou barvu nebo do prázdné.');
  else if (def.h) tip('hidden', 'Šedé vrstvy jsou skryté – barvu uvidíš, až se dostanou navrch.');
  else if (def.p === 5) tip('per5', 'Tady má každá barva 5 vrstev a zkumavky jsou vyšší.');
  else if (level > 1 && def.t.split(',').filter((x) => !x).length === 1) tip('one', 'Jen jedna prázdná zkumavka – plánuj dopředu.');
}

// ---------------------------------------------------------------- ovládání
function onTubeTap(i: number) {
  if (busy || finished) return;
  if (stuck) {
    showStuck();
    return;
  }
  clearHint();
  if (selected === null) {
    if (!state.tubes[i].length || isComplete(state.tubes[i], state.per)) {
      shake(i);
      return;
    }
    selected = i;
    tubeEls[i].classList.add('sel');
    sfx.select();
    return;
  }
  if (selected === i) {
    tubeEls[i].classList.remove('sel');
    selected = null;
    return;
  }
  const from = selected;
  const n = pourCount(state, from, i);
  if (!n) {
    // jiná zkumavka s obsahem → přepnout výběr, jinak zatřást
    tubeEls[from].classList.remove('sel');
    selected = null;
    if (state.tubes[i].length && !isComplete(state.tubes[i], state.per) && state.tubes[from].length) {
      const fromTop = state.tubes[from].at(-1);
      const toTop = state.tubes[i].at(-1);
      if (fromTop !== toTop) {
        selected = i;
        tubeEls[i].classList.add('sel');
        sfx.select();
        return;
      }
    }
    shake(i);
    sfx.invalid();
    return;
  }
  doMove(from, i);
}

function shake(i: number) {
  const el = tubeEls[i];
  el.classList.remove('shake');
  void el.offsetWidth;
  el.classList.add('shake');
}

function doMove(from: number, to: number) {
  busy = true;
  const srcEl = tubeEls[from];
  const layersBefore = srcEl.querySelectorAll<HTMLElement>('.layer:not(.hidden)');
  const topBlock = layersBefore[layersBefore.length - 1];
  const srcRect = topBlock.getBoundingClientRect();

  history.push(cloneState(state));
  const hiddenBefore = state.hidden[from];
  const n = applyMove(state, from, to);
  const color = COLORS[state.tubes[to].charCodeAt(state.tubes[to].length - 1) - 97];
  const revealed = state.hidden[from] < hiddenBefore ? { tube: from, index: state.hidden[from] } : undefined;
  selected = null;

  renderAll({ pending: { tube: to, count: n }, reveal: revealed });
  sfx.pour(n);
  haptics.tick();

  const pendingEl = tubeEls[to].querySelector<HTMLElement>('.layer.pending');
  const toRect = pendingEl!.getBoundingClientRect();
  const toTubeRect = tubeEls[to].getBoundingClientRect();

  const fly = document.createElement('div');
  fly.className = 'fly';
  const blockLayers = Number(topBlock.style.getPropertyValue('--n')) || 1;
  const h = (srcRect.height / blockLayers) * n;
  fly.style.cssText += `left:${srcRect.left}px;top:${srcRect.top}px;width:${srcRect.width}px;height:${h}px;background:${color}`;
  document.body.appendChild(fly);

  const dx = toRect.left - srcRect.left;
  const liftY = Math.min(srcRect.top, toTubeRect.top) - layout.w * 0.9 - srcRect.top;
  const endY = toRect.top - srcRect.top;
  const anim = fly.animate(
    [
      { transform: 'translate(0,0)' },
      { transform: `translate(${dx * 0.5}px, ${liftY}px)`, offset: 0.45 },
      { transform: `translate(${dx}px, ${liftY + 4}px)`, offset: 0.62 },
      { transform: `translate(${dx}px, ${endY}px)` },
    ],
    { duration: 380, easing: 'cubic-bezier(.35,.1,.3,1)' },
  );
  const finish = () => {
    fly.remove();
    tubeEls[to].querySelectorAll('.pending').forEach((e) => e.classList.remove('pending'));
    busy = false;
    afterMove(to);
  };
  anim.onfinish = finish;
  anim.oncancel = finish;
}

function afterMove(to: number) {
  persist();
  if (isComplete(state.tubes[to], state.per)) {
    renderBoard();
    sfx.complete();
  }
  if (isSolved(state)) {
    onWin();
    return;
  }
  if (isDeadlocked(state)) enterStuck(550);
}

// ---------------------------------------------------------------- deadlock
function enterStuck(delay: number) {
  stuck = true;
  board.classList.add('locked');
  if (selected !== null) {
    tubeEls[selected]?.classList.remove('sel');
    selected = null;
  }
  clearHint();
  renderHud();
  clearTimeout(stuckTimer);
  stuckTimer = window.setTimeout(() => {
    sfx.invalid();
    haptics.tick();
    showStuck();
  }, delay);
}

function showStuck() {
  if (!stuck) return;
  const cap = Math.ceil(state.per / 2);
  ($('btn-stuck-extra') as HTMLButtonElement).hidden = extraUsed;
  $('btn-stuck-extra').textContent = `+ Malá zkumavka (na ${cap} vrstvy)`;
  ($('btn-stuck-undo') as HTMLButtonElement).hidden = history.length === 0;
  $('stuck-text').textContent = extraUsed
    ? 'Z téhle pozice už nejde nic přelít. Začni znovu, nebo vrať poslední tah.'
    : 'Z téhle pozice už nejde nic přelít. Začni znovu, přidej malou zkumavku, nebo vrať poslední tah.';
  $('stuck').hidden = false;
}

function hideStuck() {
  clearTimeout(stuckTimer);
  $('stuck').hidden = true;
}

function clearStuck() {
  stuck = false;
  board.classList.remove('locked');
  hideStuck();
}

/** Po změně stavu (zpět, zkumavka) znovu ověří deadlock. */
function recheckStuck() {
  clearStuck();
  if (!isSolved(state) && isDeadlocked(state)) enterStuck(0);
}

function undo() {
  if (busy || !history.length || finished) return;
  clearHint();
  state = history.pop()!;
  selected = null;
  persist();
  clearStuck();
  renderAll();
  recheckStuck();
  haptics.tick();
}

function restart() {
  if (busy || finished) return;
  if (!stuck && history.length > 5 && !confirm('Začít úroveň znovu?')) return;
  clearStuck();
  clearHint();
  state = levelToState(levels[level - 1]);
  history = [];
  extraUsed = false;
  selected = null;
  persist();
  renderAll();
}

function addExtra() {
  if (busy || extraUsed || finished) return;
  const cap = Math.ceil(state.per / 2);
  const add = (s: State) => {
    s.tubes.push('');
    s.caps.push(cap);
    s.hidden.push(0);
  };
  add(state);
  history.forEach(add);
  extraUsed = true;
  selected = null;
  persist();
  clearStuck();
  renderAll();
  recheckStuck();
  toast(`Přidána malá zkumavka (na ${cap} vrstvy). Jedna na úroveň.`);
}

// ---------------------------------------------------------------- nápověda
let hintTimer: number | undefined;
function clearHint() {
  clearTimeout(hintTimer);
  tubeEls.forEach((e) => e?.classList.remove('hint', 'hint-from', 'hint-to'));
}

function hint() {
  if (busy || finished || stuck) return;
  clearHint();
  if (selected !== null) {
    tubeEls[selected].classList.remove('sel');
    selected = null;
  }
  toast('Přemýšlím…', 800);
  setTimeout(() => {
    const res = solve(state.tubes, state.caps, state.per, { limit: 250_000 });
    if (res.status === 'solved' && res.moves.length) {
      const m = res.moves[0];
      if (!pourCount(state, m.from, m.to)) {
        toast('Nápověda teď nic nenašla – zkus pár tahů zpět.');
        return;
      }
      hints++;
      persist();
      tubeEls[m.from].classList.add('hint', 'hint-from');
      tubeEls[m.to].classList.add('hint', 'hint-to');
      toast(`Do konce zbývá zhruba ${tahy(res.moves.length)}.`, 2200);
      hintTimer = window.setTimeout(clearHint, 2600);
    } else if (res.status === 'unsolvable') {
      toast('Z této pozice to už vyřešit nejde. Vrať se o pár tahů zpět.', 3600);
    } else {
      toast('Tohle je na nápovědu moc zamotané – zkus pár tahů zpět.', 3600);
    }
  }, 30);
}

// ---------------------------------------------------------------- výhra
function onWin() {
  finished = true;
  renderHud();
  sfx.win();
  haptics.tick();
  const moves = history.length;
  const prev = save.best[level];
  const record = prev === undefined || moves < prev;
  if (record) save.best[level] = moves;
  save.unlocked = Math.max(save.unlocked, Math.min(TOTAL, level + 1));
  save.progress = undefined;
  storeSave(save, true);

  const last = level >= TOTAL;
  $('win-title').textContent = last ? 'Všech 1000 hotovo!' : `Úroveň ${level} hotová`;
  let text = `<b>${moves}</b> ${tahy(moves).split(' ')[1]}`;
  if (prev !== undefined) text += record && moves < prev ? ' · nový rekord!' : ` · rekord ${Math.min(prev, moves)}`;
  if (hints) text += ` · nápovědy ${hints}`;
  $('win-text').innerHTML = text;
  $('btn-next').textContent = last ? 'Zpět na úrovně' : 'Další úroveň';
  setTimeout(() => {
    $('win').hidden = false;
  }, 650);
}

function nextLevel() {
  $('win').hidden = true;
  if (level >= TOTAL) {
    openMenu();
    return;
  }
  startLevel(level + 1);
}

// ---------------------------------------------------------------- menu
function openMenu() {
  menuRange = Math.floor((level - 1) / 100);
  renderMenu();
  $('menu').hidden = false;
  const cur = $('grid').querySelector('.cur');
  cur?.scrollIntoView({ block: 'center' });
}

function closeMenu() {
  $('menu').hidden = true;
}

function renderMenu() {
  const done = Object.keys(save.best).length;
  $('progress-text').textContent = `Dokončeno ${done} z ${TOTAL} · odemčeno do ${save.unlocked}`;
  const ranges = $('ranges');
  ranges.replaceChildren();
  for (let r = 0; r < TOTAL / 100; r++) {
    const b = document.createElement('button');
    b.textContent = `${r * 100 + 1}–${(r + 1) * 100}`;
    if (r === menuRange) b.classList.add('on');
    b.disabled = r * 100 + 1 > save.unlocked;
    b.onclick = () => {
      menuRange = r;
      renderMenu();
    };
    ranges.appendChild(b);
  }
  const grid = $('grid');
  grid.replaceChildren();
  for (let n = menuRange * 100 + 1; n <= Math.min(TOTAL, (menuRange + 1) * 100); n++) {
    const b = document.createElement('button');
    b.textContent = String(n);
    if (save.best[n] !== undefined) b.classList.add('done');
    if (n % 10 === 0) b.classList.add('boss');
    if (n === level) b.classList.add('cur');
    b.disabled = n > save.unlocked;
    b.onclick = () => {
      closeMenu();
      if (n !== level || finished) startLevel(n, n === level);
    };
    grid.appendChild(b);
  }
  ($('set-symbols') as HTMLInputElement).checked = save.settings.symbols;
  ($('set-sound') as HTMLInputElement).checked = save.settings.sound;
  ($('set-haptics') as HTMLInputElement).checked = save.settings.haptics;
  $('version').textContent = __APP_VERSION__;
}

// ---------------------------------------------------------------- události
board.addEventListener('pointerdown', (e) => {
  const t = (e.target as HTMLElement).closest<HTMLElement>('.tube');
  if (t) {
    e.preventDefault();
    onTubeTap(Number(t.dataset.i));
  } else if (selected !== null && !busy) {
    tubeEls[selected]?.classList.remove('sel');
    selected = null;
  }
});

$('btn-undo').onclick = undo;
$('btn-restart').onclick = restart;
$('btn-extra').onclick = addExtra;
$('btn-hint').onclick = hint;
$('btn-menu').onclick = openMenu;
$('btn-close').onclick = closeMenu;
$('menu').addEventListener('click', (e) => {
  if (e.target === $('menu')) closeMenu();
});
$('btn-next').onclick = nextLevel;
$('btn-stuck-restart').onclick = restart;
$('btn-stuck-undo').onclick = undo;
$('btn-stuck-extra').onclick = addExtra;
$('stuck').addEventListener('click', (e) => {
  // klepnutí mimo kartu ji zavře, plocha ale zůstane zamčená
  if (e.target === $('stuck')) hideStuck();
});
$('btn-replay').onclick = () => {
  $('win').hidden = true;
  startLevel(level);
};

($('set-symbols') as HTMLInputElement).onchange = (e) => {
  save.settings.symbols = (e.target as HTMLInputElement).checked;
  storeSave(save);
  renderBoard();
};
($('set-sound') as HTMLInputElement).onchange = (e) => {
  save.settings.sound = sfx.enabled = (e.target as HTMLInputElement).checked;
  storeSave(save);
};
($('set-haptics') as HTMLInputElement).onchange = (e) => {
  save.settings.haptics = haptics.enabled = (e.target as HTMLInputElement).checked;
  storeSave(save);
};
$('btn-reset').onclick = () => {
  if (!confirm('Opravdu smazat veškerý postup? Nedá se to vrátit.')) return;
  const settings = save.settings;
  save = { ...defaultSave(), settings };
  storeSave(save, true);
  closeMenu();
  startLevel(1);
};

document.addEventListener('pointerdown', unlockAudio, { once: true, capture: true });
document.addEventListener('gesturestart', (e) => e.preventDefault());
document.addEventListener('dblclick', (e) => e.preventDefault());
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') storeSave(save, true);
});

setupViewport(board, () => renderBoard());

// ---------------------------------------------------------------- start
startLevel(level, true);
void requestPersistence();
registerSW({ immediate: true });

// pro ladění v konzoli
Object.assign(window, { __prelej: { get state() { return state; }, topRun } });
