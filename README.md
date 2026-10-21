# Přelej

Barevná přelévací hra (ve stylu „water sort“) jako PWA pro iPhone. **Bez reklam, bez registrace, bez soutěží a bez sledování.** Po prvním otevření běží celá offline, postup se ukládá jen v zařízení.

## Hra

- Ťukni na zkumavku a pak na cíl. Přelít jde horní blok jedné barvy, a to jen na stejnou barvu nebo do prázdné zkumavky.
- Úroveň je hotová, když má každá barva svou plnou zkumavku.
- **1000 úrovní** s plynule rostoucí obtížností: více barev, skryté vrstvy (`?`), zkumavky na 5 vrstev, úrovně s jedinou volnou zkumavkou. Každá desátá je „těžká“, po ní přijde oddychovka.
- Neomezené **Zpět**, **Znovu**, **Nápověda** (solver spočítá další tah) a jednou za úroveň **malá zkumavka navíc**.
- V nastavení jsou symboly na barvách, zvuky a haptika (na iPhonu přes iOS 18+).

## Instalace na iPhone

1. Otevři adresu hry v Safari.
2. Sdílet → **Přidat na plochu**.
3. Spouštěj ikonou z plochy. Hra běží na celou obrazovku a funguje offline. Jako appka na ploše si iOS data nemaže.

## Vývoj

```bash
npm ci
npm run dev        # vývojový server
npm test           # ověří, že všech 1000 úrovní jde vyřešit
npm run build      # produkční build do dist/
npm run levels     # znovu vygeneruje src/levels.json (~1 min)
npm run icons      # znovu vygeneruje PNG ikony z public/icon.svg
```

### Jak vznikají úrovně

`scripts/generate-levels.ts` pro každou úroveň:

1. Podle křivky obtížnosti určí parametry (barvy, prázdné zkumavky, kapacitu a skryté vrstvy).
2. Ze seedu (číslo úrovně) deterministicky vygeneruje několik náhodných rozložení.
3. Solver (DFS s heuristikou a pamětí stavů) ověří řešitelnost a změří obtížnost: kolik stavů projde prohledávání s náhodným pořadím tahů.
4. Podle cílového kvantilu vybere kandidáta, takže těžké úrovně dostanou nejtěžší a oddychovky nejlehčí.

Výsledek je v `src/levels.json` (~75 kB) a je součástí repa, takže build nic nepočítá.

### Struktura

```
src/game/core.ts      pravidla (tahy, skryté vrstvy, výhra)
src/game/solver.ts    solver pro generátor i nápovědu
src/main.ts           UI, animace, ovládání
src/ui/               uložení postupu, zvuky/haptika, barvy a symboly
scripts/              generátor úrovní a ikon
tests/                testy pravidel a řešitelnosti všech úrovní
```

## Release

Každý push do `main` spustí GitHub Actions: testy → build → nasazení na GitHub Pages. Service worker se v appce aktualizuje sám při dalším spuštění.

V nastavení repa je potřeba jednou zapnout **Settings → Pages → Source: GitHub Actions**.
