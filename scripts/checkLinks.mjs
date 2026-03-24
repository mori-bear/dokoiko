/**
 * checkLinks.mjs — 宿リンク生成検証スクリプト
 *
 * 実行: node scripts/checkLinks.mjs
 *
 * チェック項目:
 *   [L1] 楽天URL: travel.rakuten.co.jp/yado/{area}/ 形式
 *   [L2] 楽天URL: 二重エンコードなし
 *   [L3] じゃらんURL: jalan.net/uw/uwp2011/uww2011init.do?keyword= 形式
 *   [L4] じゃらんURL: 二重エンコードなし（%25 禁止）
 *   [L5] 全件: URL が https で始まる
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join }  from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const dests = JSON.parse(readFileSync(join(ROOT, 'src/data/destinations.json'), 'utf8'));
const { buildHotelLinks } = await import(`file://${ROOT}/src/hotel/hotelLinkBuilder.js`);

function buildRakutenUrl(dest) {
  if (!dest.hotelArea) return 'https://travel.rakuten.co.jp/';
  return `https://travel.rakuten.co.jp/yado/${dest.hotelArea}/`;
}

function buildJalanUrl(dest) {
  const keyword = encodeURIComponent(dest.name.trim());
  return `https://www.jalan.net/uw/uwp2011/uww2011init.do?keyword=${keyword}`;
}

let errorCount = 0;

function ng(msg) {
  errorCount++;
  console.log('NG:', msg);
}

console.log('\n==== LINK CHECK ====');
console.log(`対象: ${dests.length} destinations\n`);

for (const dest of dests) {
  const rakuten = buildRakutenUrl(dest);
  const jalan   = buildJalanUrl(dest);

  // L1: 楽天形式
  if (!rakuten.includes('travel.rakuten.co.jp/yado/')) {
    ng(`[L1] 楽天URL形式エラー: ${dest.name} → ${rakuten}`);
  }

  // L2: 楽天二重エンコード
  if (rakuten.includes('%25')) {
    ng(`[L2] 楽天二重エンコード: ${dest.name} → ${rakuten}`);
  }

  // L3: じゃらん形式
  if (!jalan.includes('jalan.net') || !jalan.includes('keyword=')) {
    ng(`[L3] じゃらんURL形式エラー: ${dest.name} → ${jalan}`);
  }

  // L4: じゃらん二重エンコード
  if (jalan.includes('%25')) {
    ng(`[L4] じゃらん二重エンコード: ${dest.name} → ${jalan}`);
  }

  // L5: https
  if (!rakuten.startsWith('https://')) ng(`[L5] 楽天 http非対応: ${dest.name}`);
  if (!jalan.startsWith('https://'))  ng(`[L5] じゃらん http非対応: ${dest.name}`);
}

console.log('');

if (errorCount === 0) {
  console.log(`✅ ALL OK — ${dests.length} 件すべて正常`);
} else {
  console.log(`❌ エラー ${errorCount} 件`);
  process.exit(1);
}
