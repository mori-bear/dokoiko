#!/usr/bin/env node
// scripts/verifyImages.mjs — 機械監査で差し替えた画像が本番(tabidokoiko.com)へ反映されたかを実測する。
// ローカル成果物のファイルサイズと、実配信のファイルサイズが一致するかで反映を判定。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BASE = 'https://tabidokoiko.com';
const FILES = process.argv.slice(2).length ? process.argv.slice(2) : [
  'images/gen_北海_小樽運河/spot-1.jpg',
  'images/hatoma-island/main.jpg',
  'images/kitami/main.jpg',
  'images/koyasan/main.jpg',
  'images/noboribetsu/spot-1.jpg',
  'images/tomari-okinawa/main.jpg',
  'images/tonaki/main.jpg',
  'images/uozu/main.jpg',
];

async function liveSize(rel) {
  const url = BASE + '/' + rel.split('/').map(encodeURIComponent).join('/') + '?z=' + Date.now();
  const res = await fetch(url, { redirect: 'follow', headers: { 'User-Agent': 'dokoiko-verifyImages/1.0' } });
  const buf = Buffer.from(await res.arrayBuffer());
  return { status: res.status, size: buf.length };
}

let match = 0;
for (const rel of FILES) {
  const local = fs.existsSync(path.join(ROOT, rel)) ? fs.statSync(path.join(ROOT, rel)).size : -1;
  const { status, size } = await liveSize(rel);
  const ok = local > 0 && local === size;
  if (ok) match++;
  console.log(`  ${ok ? '✓' : '✗'} ${rel.padEnd(34)} local=${local}b live=${size}b(HTTP${status}) ${ok ? '反映済' : '不一致'}`);
}
console.log(`\n本番反映: ${match}/${FILES.length} 画像が一致`);
process.exit(match === FILES.length ? 0 : 1);
