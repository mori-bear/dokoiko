#!/usr/bin/env node
// scripts/verifyDeploy.mjs — 本番(tabidokoiko.com)の反映を実測確認する。
//
// 「デプロイ完了」を報告する前に必ず実行する運用チェック。
// このリポジトリ(mori-bear/dokoiko = 本番の成果物)のローカルHTMLと、実際に配信されている
// tabidokoiko.com を突き合わせ、主要ページが「最新のビルドで反映されているか」を判定する。
//
// 判定の要:
//   Astro のアセット(_astro/*.css,*.js)は内容ハッシュ付きファイル名なので、ローカルの
//   ビルド成果物と本番ページが参照する _astro ハッシュ集合が一致 ⟺ 本番=このビルドで最新。
//   加えて HTTP 200 / canonical=tabidokoiko.com / 誤配信(/dokoiko-site/)混入なし を確認する。
//
// 使い方:  node scripts/verifyDeploy.mjs
//         （このリポジトリのルートで実行。CI/報告前ゲートとして exit code を見る）

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BASE = 'https://tabidokoiko.com';

// 主要3-5ページ（本番の代表: トップ / 目的地2 / ハブ / 一覧）
const PAGES = [
  { url: '/', file: 'index.html' },
  { url: '/destinations/abashiri/', file: 'destinations/abashiri/index.html' },
  { url: '/destinations/adachi-museum/', file: 'destinations/adachi-museum/index.html' },
  { url: '/hub/akita/', file: 'hub/akita/index.html' },
  { url: '/list/', file: 'list/index.html' },
];

const astroRefs = (html) =>
  new Set((html.match(/\/_astro\/[A-Za-z0-9@._%-]+\.(?:css|js)/g) || []));

async function fetchText(url, timeoutMs = 20000) {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), timeoutMs);
  try {
    const res = await fetch(url, { redirect: 'follow', signal: ac.signal,
      headers: { 'User-Agent': 'dokoiko-verifyDeploy/1.0' } });
    const body = await res.text();
    return { status: res.status, body };
  } finally {
    clearTimeout(t);
  }
}

function setEq(a, b) {
  if (a.size !== b.size) return false;
  for (const x of a) if (!b.has(x)) return false;
  return true;
}

async function main() {
  console.log(`本番反映チェック → ${BASE}\n`);
  let fail = 0;
  for (const p of PAGES) {
    const localPath = path.join(ROOT, p.file);
    const label = p.url;
    if (!fs.existsSync(localPath)) {
      console.log(`  ⚠ ${label}  ローカル成果物なし(${p.file}) → スキップ`);
      continue;
    }
    const local = fs.readFileSync(localPath, 'utf8');
    let live;
    try {
      live = await fetchText(BASE + p.url);
    } catch (e) {
      console.log(`  ✗ ${label}  取得失敗: ${e.message}`);
      fail++;
      continue;
    }
    const problems = [];
    if (live.status !== 200) problems.push(`HTTP ${live.status}`);
    if (!/canonical"[^>]*tabidokoiko\.com/i.test(live.body))
      problems.push('canonicalがtabidokoiko.comでない');
    if (/\/dokoiko-site\//.test(live.body))
      problems.push('誤配信パス(/dokoiko-site/)混入');
    // 最新判定: _astro ハッシュ資産の集合一致
    const lref = astroRefs(local), rref = astroRefs(live.body);
    const current = setEq(lref, rref);
    if (!current) {
      const missing = [...lref].filter((x) => !rref.has(x)).slice(0, 3);
      problems.push(`ビルド不一致(未反映の可能性): local資産${lref.size}件 vs live${rref.size}件` +
        (missing.length ? ` 例:${missing.join(',')}` : ''));
    }
    if (problems.length) {
      console.log(`  ✗ ${label}  ${problems.join(' / ')}`);
      fail++;
    } else {
      console.log(`  ✓ ${label}  200・canonical正・_astro資産${lref.size}件一致(最新反映済)`);
    }
  }
  console.log('');
  if (fail) {
    console.log(`❌ ${fail}ページで不一致/失敗 → 本番が最新ビルドで反映されていません（再デプロイ/伝播待ちを確認）`);
    process.exit(1);
  }
  console.log('✅ すべて最新ビルドで反映済み（本番=tabidokoiko.com）');
}

main().catch((e) => { console.error(e); process.exit(1); });
