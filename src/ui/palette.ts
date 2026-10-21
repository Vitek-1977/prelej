/** 14 barev + symboly pro lepší rozlišení (přepínač v nastavení). */
export const COLORS: string[] = [
  '#e5484d', // a červená
  '#f78a1d', // b oranžová
  '#f5d90a', // c žlutá
  '#9fdc3a', // d limetková
  '#239b56', // e zelená
  '#14b8a6', // f tyrkysová
  '#5ec8f2', // g nebeská
  '#2f5fe0', // h modrá
  '#7c5cf0', // i fialová
  '#c043d8', // j purpurová
  '#f58bc0', // k růžová
  '#8a5a2e', // l hnědá
  '#d8c39a', // m písková
  '#f2efe8', // n bílá
];

export const COLOR_NAMES = [
  'červená', 'oranžová', 'žlutá', 'limetková', 'zelená', 'tyrkysová', 'nebeská',
  'modrá', 'fialová', 'purpurová', 'růžová', 'hnědá', 'písková', 'bílá',
];

/** SVG tvary ve viewBoxu 0 0 20 20. */
const SHAPES: string[] = [
  '<circle cx="10" cy="10" r="6"/>',
  '<path d="M10 3.5 17 16H3z"/>',
  '<rect x="4.5" y="4.5" width="11" height="11" rx="1"/>',
  '<path d="M10 2.5 17.5 10 10 17.5 2.5 10z"/>',
  '<path d="m10 2.8 2.1 4.6 5 .5-3.8 3.4 1.1 4.9L10 13.7l-4.4 2.5 1.1-4.9L2.9 7.9l5-.5z"/>',
  '<path d="M8 3.5h4v4.5h4.5v4H12v4.5H8V12H3.5V8H8z"/>',
  '<path d="m5 3.2 5 5 5-5 1.8 1.8-5 5 5 5-1.8 1.8-5-5-5 5L3.2 15l5-5-5-5z"/>',
  '<circle cx="10" cy="10" r="6.5" fill="none" stroke-width="3"/>',
  '<path d="m10 2.8 6.3 3.6v7.2L10 17.2l-6.3-3.6V6.4z"/>',
  '<path d="M10 16.5S3 12.3 3 7.6C3 5.3 4.8 3.8 6.7 3.8c1.5 0 2.6.8 3.3 2 .7-1.2 1.8-2 3.3-2 1.9 0 3.7 1.5 3.7 3.8 0 4.7-7 8.9-7 8.9z"/>',
  '<path d="M12.8 3a7 7 0 1 0 4.3 11.4A6 6 0 0 1 12.8 3z"/>',
  '<rect x="3" y="8" width="14" height="4" rx="1"/>',
  '<circle cx="6" cy="10" r="3"/><circle cx="14" cy="10" r="3"/>',
  '<path d="m3.5 6.5 6.5 6 6.5-6 1.8 2L10 16.2 1.7 8.5z"/>',
];

export function symbolSvg(colorIndex: number): string {
  const shape = SHAPES[colorIndex] ?? SHAPES[0];
  return `<svg viewBox="0 0 20 20" aria-hidden="true">${shape}</svg>`;
}
