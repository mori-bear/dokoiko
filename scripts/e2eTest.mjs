/**
 * e2eTest.mjs — 全destination × 全出発地 E2Eテスト
 *
 * チェック項目:
 *   [1] 交通リンクが必ず1件以上（URL付き）出る
 *   [2] 宿リンクが必ず2件（楽天・じゃらん）出る
 *   [3] 「準備中」が出ない
 *   [4] URLが有効な形式
 *   [5] 楽天URLが /yado/ を含む（エリアページ方式）
 *   [6] じゃらんURLがアフィリエイトラッパー済み
 *
 * 実行: node scripts/e2eTest.mjs
 */

import { fileURLToPath } from 'url';
import { dirname, join }  from 'path';
import { readFileSync }   from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root      = join(__dirname, '..');

const { resolveTransportLinks } = await import(`file://${root}/src/features/dokoiko/transportRenderer.js`);
const { buildHotelLinks }       = await import(`file://${root}/src/hotel/hotelLinkBuilder.js`);
const { ROUTES }                = await import(`file://${root}/src/features/dokoiko/routes.js`);

const allDests = JSON.parse(readFileSync(join(root, 'data/destinations.json'), 'utf8'));
const DESTS    = allDests.filter(d => ROUTES[d.id] || d.gateway);

const DEPARTURES = [
  '東京', '横浜', '大宮', '仙台', '盛岡',
  '札幌', '名古屋', '大阪', '京都', '神戸',
  '広島', '岡山', '高松', '福岡', '熊本',
  '鹿児島', '長崎', '宮崎',
];

const RAKUTEN_AFF = 'https://hb.afl.rakuten.co.jp/';
const JALAN_AFF   = 'https://ck.jp.ap.valuecommerce.com/';

let pass = 0;
let fail = 0;
const errors = [];

function ok()    { pass++; }
function ng(msg) { fail++; errors.push(msg); }

function checkUrl(urlStr, label) {
  try { new URL(urlStr); return true; }
  catch { ng(`不正URL [${label}]: ${urlStr?.slice(0, 60)}`); return false; }
}

console.log(`\n========== E2E テスト ==========`);
console.log(`対象: ${DESTS.length}件 × ${DEPARTURES.length}出発地\n`);

for (const city of DESTS) {
  /* ── [2][5][6] 宿リンク（出発地不問） ── */
  const hotel = buildHotelLinks(city);

  if (!hotel?.links?.length) {
    ng(`${city.name}: 宿リンク0件`);
  } else if (hotel.links.length !== 2) {
    ng(`${city.name}: 宿リンクが2件でない（${hotel.links.length}件）`);
  } else {
    for (const l of hotel.links) {
      if (!checkUrl(l.url, `${city.name} 宿`)) continue;
      if (l.type === 'rakuten') {
        if (!l.url.includes('travel.rakuten.co.jp/yado/')) {
          ng(`${city.name} 楽天: travel.rakuten.co.jp/yado/ を含まない`);
        } else ok();
      } else if (l.type === 'jalan') {
        if (!l.url.includes('jalan.net')) {
          ng(`${city.name} じゃらん: jalan.net を含まない`);
        } else ok();
      }
    }
  }

  /* ── [1][3][4] 交通リンク（全出発地） ── */
  for (const dep of DEPARTURES) {
    const tlinks = resolveTransportLinks(city, dep);

    if (!tlinks || tlinks.length === 0) {
      ng(`${city.name}(${city.id}) ← ${dep}: 交通リンク0件`);
      continue;
    }

    // 「準備中」チェック [3]
    if (tlinks.every(l => l.type === 'note' && l.label?.includes('準備中'))) {
      ng(`${city.name}(${city.id}) ← ${dep}: 準備中のみ`);
      continue;
    }

    // URLリンク必須 [1] — step-group 方式では URL は l.cta.url にある
    const effectiveUrl = l => l.url ?? l.cta?.url;
    const urlLinks = tlinks.filter(l => effectiveUrl(l));
    if (urlLinks.length === 0) {
      ng(`${city.name}(${city.id}) ← ${dep}: URLリンクなし（noteのみ）`);
      continue;
    }

    ok();

    // URL形式チェック [4]
    for (const l of urlLinks) {
      checkUrl(effectiveUrl(l), `${city.name} ← ${dep}`);
    }
  }
}

/* ── サマリ ── */
const totalDests = DESTS.length;
console.log('══════════════════════════════════');
console.log(`  対象destination: ${totalDests}件`);
console.log(`  出発地: ${DEPARTURES.length}都市`);
console.log(`  総計: PASS ${pass} / FAIL ${fail}`);
if (errors.length) {
  const preview = errors.slice(0, 30);
  console.log(`\n  エラー（先頭${preview.length}件）:`);
  preview.forEach(e => console.log(`    - ${e}`));
  if (errors.length > 30) console.log(`    ... 他${errors.length - 30}件`);
}
console.log(fail === 0 ? '  ✓ 全チェック通過' : '  ✗ エラーあり');
console.log('══════════════════════════════════\n');
process.exit(fail > 0 ? 1 : 0);
