/**
 * checkMd.mjs — destinations.json 完全監査スクリプト
 *
 * 実行: node scripts/checkMd.mjs
 *
 * チェック項目:
 *   [D1] name が存在する
 *   [D2] hotelArea が存在する
 *   [D3] hotelArea に % や空白が含まれない（URLエンコード汚染禁止）
 *   [D4] accessStation が存在する（島・フェリーは port で代替 → 警告のみ）
 *   [D5] prefecture が存在する
 *   [D6] id が存在しユニーク
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join }  from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dests = JSON.parse(readFileSync(join(__dirname, '../src/data/destinations.json'), 'utf8'));

const errors   = [];
const warnings = [];
const seenIds  = new Set();

for (const dest of dests) {
  const tag = dest.id ?? JSON.stringify(dest).slice(0, 40);

  // D1: name
  if (!dest.name) errors.push(`[D1] name missing: ${tag}`);

  // D2: hotelArea
  if (!dest.hotelArea) {
    errors.push(`[D2] hotelArea missing: ${dest.name ?? tag}`);
  } else {
    // D3: hotelArea 汚染チェック
    if (dest.hotelArea.includes('%'))  errors.push(`[D3] hotelArea encoded: ${dest.name} → ${dest.hotelArea}`);
    if (dest.hotelArea.includes(' '))  errors.push(`[D3] hotelArea space:   ${dest.name} → ${dest.hotelArea}`);
    if (dest.hotelArea.includes('/'))  errors.push(`[D3] hotelArea slash:   ${dest.name} → ${dest.hotelArea}`);
  }

  // D4: accessStation（島は port で代替可）
  if (!dest.accessStation) {
    if (dest.port) {
      warnings.push(`[D4] accessStation なし（port あり）: ${dest.name} → port: ${dest.port}`);
    } else {
      errors.push(`[D4] accessStation missing（port もなし）: ${dest.name}`);
    }
  }

  // D5: prefecture
  if (!dest.prefecture) errors.push(`[D5] prefecture missing: ${dest.name ?? tag}`);

  // D6: id ユニーク
  if (!dest.id) {
    errors.push(`[D6] id missing: ${dest.name ?? tag}`);
  } else if (seenIds.has(dest.id)) {
    errors.push(`[D6] id duplicate: ${dest.id}`);
  } else {
    seenIds.add(dest.id);
  }
}

/* ── 結果出力 ── */
console.log('\n==== MD CHECK ====');
console.log(`対象: ${dests.length} destinations\n`);

if (warnings.length > 0) {
  console.log('WARN（正常な島）:');
  warnings.forEach(w => console.log('  ', w));
  console.log('');
}

if (errors.length === 0) {
  console.log('✅ ALL OK — エラー 0 件');
} else {
  console.log(`❌ エラー ${errors.length} 件:`);
  errors.forEach(e => console.log('  NG:', e));
  process.exit(1);
}
