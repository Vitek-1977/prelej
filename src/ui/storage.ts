/** Uložení postupu do localStorage (vše zůstává jen v zařízení). */
import type { State } from '../game/core';

export interface Settings {
  symbols: boolean;
  sound: boolean;
  haptics: boolean;
}

export interface InProgress {
  level: number;
  history: State[];
  extraUsed: boolean;
  moves: number;
  hints: number;
}

export interface Save {
  v: 1;
  /** nejvyšší odemčená úroveň */
  unlocked: number;
  current: number;
  /** nejlepší počet tahů pro dokončené úrovně */
  best: Record<string, number>;
  settings: Settings;
  progress?: InProgress;
  /** zobrazené tipy */
  tips?: string[];
}

const KEY = 'prelej:v1';

export function defaultSave(): Save {
  return {
    v: 1,
    unlocked: 1,
    current: 1,
    best: {},
    settings: { symbols: false, sound: true, haptics: true },
  };
}

export function loadSave(): Save {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaultSave();
    const s = JSON.parse(raw) as Save;
    if (s.v !== 1) return defaultSave();
    return { ...defaultSave(), ...s, settings: { ...defaultSave().settings, ...s.settings } };
  } catch {
    return defaultSave();
  }
}

let timer: number | undefined;

export function storeSave(s: Save, immediate = false): void {
  const write = () => {
    try {
      // historii tahů ukládáme jen posledních 400 kroků
      const copy: Save = s.progress
        ? { ...s, progress: { ...s.progress, history: s.progress.history.slice(-400) } }
        : s;
      localStorage.setItem(KEY, JSON.stringify(copy));
    } catch {
      /* plné úložiště / soukromý režim – hra běží dál bez ukládání */
    }
  };
  clearTimeout(timer);
  if (immediate) write();
  else timer = window.setTimeout(write, 250);
}

export async function requestPersistence(): Promise<void> {
  try {
    if (navigator.storage?.persist && !(await navigator.storage.persisted())) {
      await navigator.storage.persist();
    }
  } catch {
    /* nepodporováno */
  }
}
