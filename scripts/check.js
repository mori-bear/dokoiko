/**
 * check.js — ROUTES / HOTELS 整合性チェック
 *
 * 確認項目:
 *   [1] ROUTES の全エントリが HOTELS に存在する
 *   [2] HOTELS の全 section に rakuten / jalan が存在する
 *   [3] URL が null / undefined でない
 *   [4] ROUTES の各ステップに必須フィールドがある
 *
 * 実行: node scripts/check.js
 */

'use strict';

const fs   = require('fs');
const path = require('path');

function extractExport(src, name) {
  const cleaned = src
    .replace(/^export\s+const\s+/gm, 'const ')
    .replace(/\/\*[\s\S]*?\*\//gm, '')
    .replace(/^\/\/.*/gm, '');
  const fn = new Function(cleaned + `\nreturn ${name};`);
  return fn();
}

const routesRaw = fs.readFileSync(path.join(__dirname, '../data/routes.js'), 'utf8');
const hotelsRaw = fs.readFileSync(path.join(__dirname, '../data/hotels.js'), 'utf8');

const ROUTES = extractExport(routesRaw, 'ROUTES');
const HOTELS = extractExport(hotelsRaw, 'HOTELS');

let pass = 0;
let fail = 0;
const errors = [];

function ok(msg) { pass++; }
function ng(msg) { fail++; errors.push(msg); process.stdout.write(`  ✗ ${msg}\n`); }

/* ── [1] ROUTES の全 ID が HOTELS に存在するか ── */
console.log('\n[1] ROUTES → HOTELS 網羅確認');
const missingInHotels = [];
for (const id of Object.keys(ROUTES)) {
  if (!HOTELS[id]) {
    missingInHotels.push(id);
    ng(`${id} → HOTELS未登録`);
  } else {
    pass++;
  }
}
if (missingInHotels.length === 0) {
  console.log(`  ✓ 全 ${Object.keys(ROUTES).length} 件が HOTELS に登録済み`);
}

/* ── [2] HOTELS → ROUTES 逆チェック（孤立エントリ）── */
console.log('\n[2] HOTELS の孤立エントリ確認');
let orphans = 0;
for (const id of Object.keys(HOTELS)) {
  if (!ROUTES[id]) {
    orphans++;
    // 孤立はエラーではなく警告のみ
    process.stdout.write(`  ⚠ ${id} → ROUTES未登録（HOTELS のみ）\n`);
  }
}
if (orphans === 0) {
  console.log('  ✓ 孤立エントリなし');
}

/* ── [3] HOTELS 属性チェック（solo/couple/friends） ── */
console.log('\n[3] HOTELS 属性チェック（solo/couple/friends）');
const ATTRS = ['solo', 'couple', 'friends'];
for (const [id, data] of Object.entries(HOTELS)) {
  const existing = ATTRS.filter(a => data[a]);
  if (existing.length === 0) {
    ng(`${id}: solo/couple/friends がすべて未設定`);
  } else {
    for (const attr of existing) {
      const entry = data[attr];
      if (!entry.name)   ng(`${id}.${attr}: name が未設定`);
      else if (!entry.reason) ng(`${id}.${attr}: reason が未設定`);
      else pass++;
    }
  }
}

/* ── [3b] HOTELS URL 固定URL チェック（? 禁止 / %XX 禁止） ── */
console.log('\n[3b] HOTELS URL 固定URL チェック');
const PERCENT_ENCODED = /%[0-9A-Fa-f]{2}/;
let urlFail = 0;
for (const [id, data] of Object.entries(HOTELS)) {
  for (const attr of ATTRS) {
    const entry = data[attr];
    if (!entry) continue;
    const urls = [entry.rakutenUrl, entry.jalanUrl].filter(Boolean);
    for (const url of urls) {
      if (url.includes('?')) {
        ng(`${id}.${attr}: URL に ? が含まれている → ${url.slice(0, 80)}`);
        urlFail++;
      } else if (PERCENT_ENCODED.test(url)) {
        ng(`${id}.${attr}: URL にパーセントエンコードが含まれている → ${url.slice(0, 80)}`);
        urlFail++;
      } else {
        pass++;
      }
    }
  }
}
if (urlFail === 0) console.log(`  ✓ 全 URL 固定URL形式（? なし / エンコードなし）`);

/* ── [4] ROUTES ステップ構造チェック ── */
console.log('\n[4] ROUTES ステップ構造チェック');
const VALID_TYPES = new Set(['shinkansen', 'rail', 'flight', 'car', 'ferry', 'bus']);
for (const [id, steps] of Object.entries(ROUTES)) {
  for (const step of steps) {
    if (!VALID_TYPES.has(step.type)) {
      ng(`${id} step${step.step}: 不正 type "${step.type}"`);
      continue;
    }
    if (step.type === 'shinkansen' || step.type === 'rail') {
      if (!step.to)       ng(`${id} step${step.step}: to 未設定`);
      else if (!step.operator) ng(`${id} step${step.step}: operator 未設定`);
      else pass++;
    } else if (step.type === 'flight') {
      if (!step.to) ng(`${id} step${step.step}: to 未設定`);
      else pass++;
    } else if (step.type === 'ferry') {
      if (!step.ferryUrl) ng(`${id} step${step.step}: ferryUrl 未設定`);
      else pass++;
    } else {
      // car / bus
      pass++;
    }
  }
}

/* ── [5] 飛行機非対応ルート検出（flight to が AIRPORT_IATA 未登録）── */
console.log('\n[5] 飛行機ルート → AIRPORT_IATA 網羅確認');
const linkBuilderRaw = fs.readFileSync(path.join(__dirname, '../src/transport/linkBuilder.js'), 'utf8');
const AIRPORT_IATA = {};
linkBuilderRaw.replace(/'([^']+)':\s*'([A-Z]{3})'/g, (_, name, code) => { AIRPORT_IATA[name] = code; });
let flightFail = 0;
for (const [id, steps] of Object.entries(ROUTES)) {
  for (const step of steps) {
    if (step.type === 'flight' && step.to) {
      if (!AIRPORT_IATA[step.to]) {
        ng(`${id}: flight.to "${step.to}" が AIRPORT_IATA に未登録`);
        flightFail++;
      } else {
        pass++;
      }
    }
  }
}
if (flightFail === 0) console.log('  ✓ 全 flight.to が AIRPORT_IATA に登録済み');

/* ── [6] 島目的地 + 不正駅名チェック（フェリー/飛行機でしか行けない島に駅名）── */
console.log('\n[6] 島目的地 + 不正駅名チェック');
const destsRaw = fs.readFileSync(path.join(__dirname, '../src/data/destinations.json'), 'utf8');
const DESTS = JSON.parse(destsRaw);
// 橋でアクセスできる島（駅あり）は除外
const BRIDGE_ISLAND_IDS = new Set(['shijishima', 'suo-oshima', 'kashiwajima']);
let islandStationFail = 0;
for (const dest of DESTS) {
  if ((dest.type === 'island' || dest.destType === 'island') && !BRIDGE_ISLAND_IDS.has(dest.id)) {
    if (dest.accessStation && dest.accessStation.endsWith('駅')) {
      ng(`${dest.id}: 島目的地に不正な駅名 "${dest.accessStation}" が設定されている`);
      islandStationFail++;
    } else {
      pass++;
    }
  }
}
if (islandStationFail === 0) console.log('  ✓ 島目的地の accessStation に不正駅名なし');

/* ── [7] 曖昧駅名チェック（同名駅ミス防止）── */
console.log('\n[7] 曖昧駅名チェック');
// 実在するが複数都市に存在する混同しやすい駅名
const AMBIGUOUS_STATIONS = new Set(['五条', '五条駅', '大和八木', '吉野口', '王子', '天満橋']);
let ambiguousFail = 0;
for (const [id, steps] of Object.entries(ROUTES)) {
  for (const step of steps) {
    for (const field of ['to', 'from']) {
      if (step[field] && AMBIGUOUS_STATIONS.has(step[field])) {
        ng(`${id} step${step.step}: 曖昧な駅名 "${step[field]}" — 都道府県を確認`);
        ambiguousFail++;
      }
    }
  }
}
if (ambiguousFail === 0) console.log('  ✓ 曖昧駅名の混入なし');

/* ── サマリ ── */
console.log('\n══════════════════════════════════');
console.log(`  ROUTES: ${Object.keys(ROUTES).length} 件`);
console.log(`  HOTELS: ${Object.keys(HOTELS).length} 件`);
console.log(`  PASS ${pass} / FAIL ${fail}`);
if (errors.length) {
  console.log('\n  エラー一覧:');
  errors.forEach(e => console.log(`    - ${e}`));
}
console.log(fail === 0 ? '  ✓ 全チェック通過' : '  ✗ エラーあり');
console.log('══════════════════════════════════\n');
process.exit(fail > 0 ? 1 : 0);
