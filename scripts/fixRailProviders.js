/**
 * fixRailProviders.js — railProvider=null の46件に正しいプロバイダを設定（一回限り）
 *
 * A) ekinet  : 北海道・東北・関東・中部の鉄道アクセス目的地 29件
 * B) e5489   : 近畿・中国・四国の鉄道アクセス目的地 12件
 * C) jrkyushu: 九州の鉄道アクセス目的地 5件
 *
 * 離島・私鉄専用駅・既存EXCLUDE_FROM_JR_CTAは触らない。
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FILE = path.resolve(__dirname, '../src/data/destinations.json');

const A_EKINET = [
  'otaru', 'furano', 'toyako', 'noboribetsu', 'shiretoko',
  'jozankei', 'biei', 'shakotan', 'sounkyo', 'akan',
  'abashiri', 'shikotsu', 'wakkanai', 'obihiro', 'rausu',
  'esashi-hokkaido', 'niseko', 'daisetsuzan', 'shiraoi',
  'tomamu', 'kamaishi', 'ofunato', 'kuji', 'osorezan',
  'tsukuba', 'miura', 'jigokudani', 'minamichita', 'suzu',
];

const B_E5489 = [
  'asuka', 'dorogawa-onsen', 'matsusaka',
  'dogo-onsen', 'marugame', 'misaki-sadamisaki',
  'shigaraki', 'anan', 'niyodogawa', 'yusuhara',
  'shikoku-karst', 'sakai',
];

const C_JRKYUSHU = [
  'aoshima', 'yamaga', 'yoshinogari',
  'kunisaki', 'chiran',
];

const PROVIDER_MAP = {};
for (const id of A_EKINET)   PROVIDER_MAP[id] = 'ekinet';
for (const id of B_E5489)    PROVIDER_MAP[id] = 'e5489';
for (const id of C_JRKYUSHU) PROVIDER_MAP[id] = 'jrkyushu';

const TOTAL_EXPECTED = A_EKINET.length + B_E5489.length + C_JRKYUSHU.length;

const data = JSON.parse(fs.readFileSync(FILE, 'utf-8'));
const arr = Array.isArray(data) ? data : (data.destinations || Object.values(data));

let updated = 0;
const skipped = [];
const log = [];
const idsSeen = new Set();
for (const d of arr) {
  const target = PROVIDER_MAP[d.id];
  if (!target) continue;
  idsSeen.add(d.id);
  const before = d.railProvider ?? null;
  if (before !== null && before !== undefined) {
    skipped.push({ id: d.id, name: d.name, before });
    continue;
  }
  d.railProvider = target;
  updated++;
  log.push({ id: d.id, name: d.name, provider: target });
}

const missing = Object.keys(PROVIDER_MAP).filter(id => !idsSeen.has(id));
if (missing.length > 0) {
  console.error(`データ未発見ID: ${missing.join(', ')}`);
  process.exit(1);
}

if (updated + skipped.length !== TOTAL_EXPECTED) {
  console.error(`想定件数(${TOTAL_EXPECTED})と処理件数(${updated + skipped.length})が不一致`);
  process.exit(1);
}

fs.writeFileSync(FILE, JSON.stringify(arr, null, 2) + '\n');

console.log(`✓ ${updated}件更新 / ${skipped.length}件スキップ（既存値あり）/ 想定 ${TOTAL_EXPECTED}件`);
console.log('--- 更新詳細 ---');
for (const r of log) console.log(`  ${r.id} (${r.name}) → ${r.provider}`);
if (skipped.length > 0) {
  console.log('--- スキップ（既に値が設定されていたため） ---');
  for (const r of skipped) console.log(`  ${r.id} (${r.name}) 既存=${r.before}`);
}
