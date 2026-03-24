/**
 * renderTest.mjs — 10件レンダリング検証（ES Module）
 *
 * ROUTES/HOTELS を直接ロードして全10件の交通・宿リンクを確認。
 * 実行: node scripts/renderTest.mjs
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

/* ── DB 読み込み ── */
const { ROUTES } = await import(`file://${root}/src/features/dokoiko/routes.js`);
const { HOTELS } = await import(`file://${root}/data/hotels.js`);
const { DEPARTURE_CITY_INFO } = await import(`file://${root}/src/config/constants.js`);
const { resolveTransportLinks } = await import(`file://${root}/src/features/dokoiko/transportRenderer.js`);
const { buildHotelLinks } = await import(`file://${root}/src/hotel/hotelLinkBuilder.js`);

const TARGETS = [
  'tenryu-gorge', 'shikoku-karst', 'zamami-island', 'iki-island', 'suzu',
  'tsuyama', 'ushimado', 'izushi', 'nyuto-onsen', 'nozawa-onsen',
];

const NAMES = {
  'tenryu-gorge':  '天竜峡',
  'shikoku-karst': '四国カルスト',
  'zamami-island': '座間味島',
  'iki-island':    '壱岐',
  'suzu':          '珠洲',
  'tsuyama':       '津山',
  'ushimado':      '牛窓',
  'izushi':        '出石',
  'nyuto-onsen':   '乳頭温泉',
  'nozawa-onsen':  '野沢温泉',
};

const DEPARTURES = ['東京', '大阪', '名古屋', '福岡', '札幌'];

const RAKUTEN_AFF = 'https://hb.afl.rakuten.co.jp/hgc/5113ee4b.8662cfc5.5113ee4c.119de89a/?pc=';
const VC_BASE     = 'https://ck.jp.ap.valuecommerce.com/servlet/referral?sid=3764408&pid=892559858&vc_url=';

/* ── 最小限の city オブジェクト（テスト用） ── */
function makeDest(id) {
  return { id, name: NAMES[id], displayName: NAMES[id] };
}

let pass = 0;
let fail = 0;
const errors = [];

function ok(msg)  { pass++; }
function ng(msg)  { fail++; errors.push(msg); console.log(`  ✗ ${msg}`); }

console.log('\n========== 10件レンダリングテスト ==========\n');

for (const id of TARGETS) {
  const name = NAMES[id];
  console.log(`▶ ${name} (${id})`);
  const city = makeDest(id);

  let anyLinkFound = false;

  for (const dep of DEPARTURES) {
    /* 交通リンク */
    const tlinks = resolveTransportLinks(city, dep);
    if (!tlinks || tlinks.length === 0) {
      ng(`${name} ← ${dep}: 交通リンク0件`);
      continue;
    }

    const isPrep = tlinks.length === 1 && tlinks[0].label === '現在準備中です';
    if (isPrep) {
      ng(`${name} ← ${dep}: 現在準備中（ROUTESにデータなし）`);
      continue;
    }

    const hasNote = tlinks.some(l => l.type === 'note' && l.label !== '現在準備中です');
    const hasURL  = tlinks.some(l => l.url);
    if (!hasNote) ng(`${name} ← ${dep}: ステップノートなし`);
    else ok();
    if (!hasURL)  ng(`${name} ← ${dep}: URLリンクなし`);
    else ok();
    anyLinkFound = true;

    /* URL形式チェック */
    for (const l of tlinks.filter(l => l.url)) {
      try { new URL(l.url); ok(); }
      catch { ng(`${name} ← ${dep}: 不正URL ${l.url.slice(0,60)}`); }
    }
  }

  /* 宿リンク（{ heading, links } 形式） */
  const hotel = buildHotelLinks(city);
  if (!hotel?.links?.length) {
    ng(`${name}: 宿リンクなし（links空）`);
  } else {
    for (const l of hotel.links) {
      try { new URL(l.url); ok(); }
      catch { ng(`${name} 宿: 不正URL ${l.url?.slice(0,60)}`); }
      if (!l.url.startsWith(RAKUTEN_AFF) && !l.url.startsWith(VC_BASE)) {
        ng(`${name} 宿: アフィリエイトラッパー未適用`);
      } else ok();
    }
  }

  /* 結果表示 */
  const tlinks0 = resolveTransportLinks(city, '大阪');
  const note = tlinks0.find(l => l.type === 'note')?.label ?? '（ノートなし）';
  const urls = tlinks0.filter(l => l.url).map(l => `  [${l.type}] ${l.url.slice(0,70)}`);
  const hLine = hotel?.links?.length
    ? `  Hotel [${hotel.heading}] | ${hotel.links.map(l=>l.type).join(', ')}`
    : '';

  console.log(`  Note: ${note}`);
  urls.forEach(u => console.log(u));
  if (hLine) console.log(hLine);
  console.log();
}

/* ── サマリ ── */
console.log('══════════════════════════════════');
console.log(`  総計: PASS ${pass} / FAIL ${fail}`);
if (errors.length) {
  console.log('\n  エラー:');
  errors.forEach(e => console.log(`    - ${e}`));
}
console.log(fail === 0 ? '  ✓ 全チェック通過' : '  ✗ エラーあり');
console.log('══════════════════════════════════\n');
process.exit(fail > 0 ? 1 : 0);
