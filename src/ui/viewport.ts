/**
 * Otáčení telefonu na iOS.
 *
 * Safari (a hlavně PWA na ploše) při otočení na šířku občas zvětší měřítko
 * stránky a po otočení zpět ho nechá zvětšené. Navíc posílá `resize` ještě
 * v půlce otáčení, kdy rozměry nesedí. Proto:
 *  - po otočení (nebo kdykoli je měřítko ≠ 1) přepíšeme meta viewport, což
 *    WebKit donutí vrátit měřítko na 1,
 *  - rozložení přepočítáme až po ustálení rozměrů (ResizeObserver + několik
 *    opožděných průchodů).
 */
export function setupViewport(target: HTMLElement, relayout: () => void): void {
  const meta = document.querySelector<HTMLMetaElement>('meta[name="viewport"]');
  const base = meta?.content ?? '';
  let flip = false;

  const resetZoom = () => {
    if (!meta) return;
    // obsah musí být pokaždé jiný řetězec, jinak ho WebKit nepřečte znovu
    flip = !flip;
    meta.content = flip ? base.replace('initial-scale=1', 'initial-scale=1.0') : base;
    window.scrollTo(0, 0);
  };

  let raf = 0;
  let lastW = 0;
  let lastH = 0;
  const run = () => {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => {
      const r = target.getBoundingClientRect();
      const w = Math.round(r.width);
      const h = Math.round(r.height);
      if (w === lastW && h === lastH) return;
      lastW = w;
      lastH = h;
      relayout();
    });
  };

  let timers: number[] = [];
  const settle = (zoom: boolean) => {
    timers.forEach(clearTimeout);
    if (zoom) resetZoom();
    run();
    timers = [80, 250, 500, 900].map((ms) =>
      window.setTimeout(() => {
        if (zoom || (window.visualViewport && Math.abs(window.visualViewport.scale - 1) > 0.01)) resetZoom();
        run();
      }, ms),
    );
  };

  window.addEventListener('orientationchange', () => settle(true));
  screen.orientation?.addEventListener?.('change', () => settle(true));
  window.addEventListener('resize', () => settle(false));
  window.visualViewport?.addEventListener('resize', () => {
    if (Math.abs(window.visualViewport!.scale - 1) > 0.01) settle(true);
    else run();
  });
  if ('ResizeObserver' in window) new ResizeObserver(run).observe(target);
  window.addEventListener('pageshow', () => settle(false));
}
