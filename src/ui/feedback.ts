/** Zvuky (Web Audio, syntetizované – žádné soubory) a haptika. */

let ctx: AudioContext | null = null;

function ac(): AudioContext | null {
  try {
    if (!ctx) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    }
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

/** iOS povolí zvuk až po gestu – zavoláme při prvním dotyku. */
export function unlockAudio(): void {
  const c = ac();
  if (!c) return;
  const b = c.createBuffer(1, 1, 22050);
  const s = c.createBufferSource();
  s.buffer = b;
  s.connect(c.destination);
  s.start(0);
}

function blip(freq: number, start: number, dur: number, vol: number, type: OscillatorType = 'sine', endFreq?: number) {
  const c = ac();
  if (!c) return;
  const t = c.currentTime + start;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (endFreq) o.frequency.exponentialRampToValueAtTime(endFreq, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(c.destination);
  o.start(t);
  o.stop(t + dur + 0.02);
}

export const sfx = {
  enabled: true,
  select() {
    if (this.enabled) blip(660, 0, 0.06, 0.05, 'triangle');
  },
  pour(layers: number) {
    if (!this.enabled) return;
    for (let i = 0; i < Math.min(layers, 4); i++) {
      const f = 320 + Math.random() * 180;
      blip(f, i * 0.07, 0.11, 0.07, 'sine', f * 1.9);
    }
  },
  complete() {
    if (!this.enabled) return;
    blip(784, 0, 0.18, 0.06, 'triangle');
    blip(1175, 0.07, 0.25, 0.05, 'triangle');
  },
  invalid() {
    if (this.enabled) blip(180, 0, 0.12, 0.06, 'square', 120);
  },
  win() {
    if (!this.enabled) return;
    [523, 659, 784, 1047, 1319].forEach((f, i) => blip(f, i * 0.09, 0.35, 0.05, 'triangle'));
  },
};

/**
 * Haptika: Safari na iOS nepodporuje navigator.vibrate, ale od iOS 18
 * cvakne při přepnutí <input type="checkbox" switch>. Na ostatních
 * zařízeních zkusíme vibrate().
 */
let hapticLabel: HTMLLabelElement | null = null;
export const haptics = {
  enabled: true,
  tick() {
    if (!this.enabled) return;
    if (typeof navigator.vibrate === 'function') {
      navigator.vibrate(8);
      return;
    }
    if (!hapticLabel) {
      hapticLabel = document.createElement('label');
      hapticLabel.setAttribute('aria-hidden', 'true');
      hapticLabel.style.cssText = 'position:fixed;left:-100px;top:0;width:1px;height:1px;overflow:hidden;opacity:0;pointer-events:none';
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.setAttribute('switch', '');
      input.tabIndex = -1;
      hapticLabel.appendChild(input);
      document.body.appendChild(hapticLabel);
    }
    hapticLabel.click();
  },
};
