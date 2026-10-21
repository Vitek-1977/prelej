// Vygeneruje PNG ikony z public/icon.svg (spouští se ručně: npm run icons, výsledek je v repu).
import sharp from 'sharp';
import { readFileSync } from 'node:fs';

const svg = readFileSync('public/icon.svg');
const out = [
  ['public/apple-touch-icon.png', 180, 0],
  ['public/icon-192.png', 192, 0],
  ['public/icon-512.png', 512, 0],
  ['public/icon-maskable-512.png', 512, 0.12],
];
for (const [file, size, pad] of out) {
  const inner = Math.round(size * (1 - pad * 2));
  const img = await sharp(svg, { density: 384 }).resize(inner, inner).png().toBuffer();
  await sharp({ create: { width: size, height: size, channels: 4, background: '#0b0f1a' } })
    .composite([{ input: img, gravity: 'center' }])
    .png()
    .toFile(file);
  console.log(file);
}
