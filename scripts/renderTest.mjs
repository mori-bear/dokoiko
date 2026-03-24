/**
 * renderTest.mjs — 全destination レンダリング検証（ES Module）
 *
 * ROUTESあり or gateway設定済みの全destinationを5出発地でテスト。
 * 成功条件:
 *   - transportLinks ≥ 1件
 *   - hotelLinks ちょうど2件（楽天 + じゃらん）
 *   - 全URLが有効な形式
 *
 * 実行: node scripts/renderTest.mjs
 */

import { fileURLToPath } from 'url';
import { dirname, join }  from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root      = join(__dirname, '..');

const { ROUTES }               = await import(`file://${root}/src/features/dokoiko/routes.js`);
const { resolveTransportLinks } = await import(`file://${root}/src/features/dokoiko/transportRenderer.js`);
const { buildHotelLinks }       = await import(`file://${root}/src/hotel/hotelLinkBuilder.js`);

import { readFileSync } from 'fs';
const allDests = JSON.parse(readFileSync(join(root, 'data/destinations.json'), 'utf8'));

// Task1 と同じフィルタ: ROUTESあり or gateway設定済み
const DESTS = allDests.filter(d => ROUTES[d.id] || d.gateway);

const DEPARTURES = ['東京', '大阪', '名古屋', '福岡', '札幌'];
const RAKUTEN_AFF = 'https://hb.afl.rakuten.co.jp/hgc/5113ee4b.8662cfc5.5113ee4c.119de89a/?pc=';
const VC_BASE     = 'https://ck.jp.ap.valuecommerce.com/servlet/referral?sid=3764408&pid=892559858&vc_url=';

let pass = 0;
let fail = 0;
const errors = [];

function ok()       { pass++; }
function ng(msg)    { fail++; errors.push(msg); }

console.log(`\n========== 全destination レンダリングテスト ==========`);
console.log(`対象: ${DESTS.length}件 × ${DEPARTURES.length}出発地\n`);

for (const city of DESTS) {
  for (const dep of DEPARTURES) {
    /* 交通リンク */
    const tlinks = resolveTransportLinks(city, dep);

    if (!tlinks || tlinks.length === 0) {
      ng(`${city.name}(${city.id}) ← ${dep}: transportLinks 0件`);
      continue;
    }

    // 「現在準備中」のみは失敗
    if (tlinks.every(l => l.type === 'note' && l.label === '現在準備中です')) {
      ng(`${city.name}(${city.id}) ← ${dep}: 現在準備中`);
      continue;
    }

    const hasURL = tlinks.some(l => l.url);
    if (!hasURL) {
      ng(`${city.name}(${city.id}) ← ${dep}: URLリンクなし（noteのみ）`);
      continue;
    }

    ok();

    // URL形式チェック
    for (const l of tlinks.filter(l => l.url)) {
      try { new URL(l.url); ok(); }
      catch { ng(`${city.name}(${city.id}) ← ${dep}: 不正URL ${l.url?.slice(0,60)}`); }
    }
  }

  /* 宿リンク */
  const hotel = buildHotelLinks(city);

  if (!hotel?.links?.length) {
    ng(`${city.name}(${city.id}): 宿リンク0件`);
    continue;
  }
  if (hotel.links.length !== 2) {
    ng(`${city.name}(${city.id}): 宿リンクが2件でない（${hotel.links.length}件）`);
    continue;
  }

  for (const l of hotel.links) {
    try { new URL(l.url); ok(); }
    catch { ng(`${city.name}(${city.id}) 宿: 不正URL ${l.url?.slice(0,60)}`); }

    const isAffiliate = l.url.startsWith(RAKUTEN_AFF) || l.url.startsWith(VC_BASE);
    if (!isAffiliate) ng(`${city.name}(${city.id}) 宿: アフィリエイトラッパー未適用`);
    else ok();
  }
}

/* ── サマリ ── */
console.log('══════════════════════════════════');
console.log(`  対象destination: ${DESTS.length}件`);
console.log(`  総計: PASS ${pass} / FAIL ${fail}`);
if (errors.length) {
  const preview = errors.slice(0, 20);
  console.log(`\n  エラー（先頭${preview.length}件）:`);
  preview.forEach(e => console.log(`    - ${e}`));
  if (errors.length > 20) console.log(`    ... 他${errors.length - 20}件`);
}
console.log(fail === 0 ? '  ✓ 全チェック通過' : '  ✗ エラーあり');
console.log('══════════════════════════════════\n');
process.exit(fail > 0 ? 1 : 0);
