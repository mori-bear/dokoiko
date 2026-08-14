// 本番(tabidokoiko.com)に最新ビルドが反映されたかを実測確認する。
// DEPLOY.md 手順5。ローカル成果物の _astro アセット集合と本番のHTMLが参照する
// アセットが一致していれば「反映済み」と判定する。
// 使い方: node scripts/verifyDeploy.mjs
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

const PAGES = [
  '/',
  '/destinations/abashiri/',
  '/destinations/hakone/',
  '/hub/tokyo/',
  '/list/',
];
const ORIGIN = 'https://tabidokoiko.com';

const localAssets = new Set(fs.readdirSync(path.join(root, '_astro')));
let failed = 0;

for (const p of PAGES) {
  const url = ORIGIN + p;
  let res, html;
  try {
    res = await fetch(url, { cache: 'no-store' });
    html = await res.text();
  } catch (e) {
    console.log(`NG ${p} — fetch失敗: ${e.message}`);
    failed++;
    continue;
  }
  const problems = [];
  if (res.status !== 200) problems.push(`HTTP ${res.status}`);
  if (!/<link rel="canonical" href="https:\/\/tabidokoiko\.com/.test(html)) problems.push('canonical不正');
  if (html.includes('/dokoiko-site/')) problems.push('/dokoiko-site/ 混入');

  const referenced = [...html.matchAll(/\/_astro\/([^"'()\s]+)/g)].map(m => m[1]);
  const stale = referenced.filter(a => !localAssets.has(a));
  if (stale.length) problems.push(`未反映アセット: ${stale.join(', ')}`);

  if (problems.length) { console.log(`NG ${p} — ${problems.join(' / ')}`); failed++; }
  else console.log(`OK ${p} — 最新ビルド反映済み (assets: ${referenced.length})`);
}

if (failed) { console.log(`\n${failed}件が未反映/異常。GitHub Pagesの伝播待ちの可能性あり。`); process.exit(1); }
console.log('\n全ページ 最新ビルド反映済み。');
