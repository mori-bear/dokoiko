/**
 * daytrip/1night プール集計レポート
 * - 修正対象4都市（米子・姫路・倉敷・福山）の改善確認
 * - 新規追加31件の daytrip 内訳
 * - 全出発地統計・地域別集計
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dests = JSON.parse(fs.readFileSync(path.join(__dirname, '../src/data/destinations.json'), 'utf-8'));

// ── distanceCalculator.js と同等のロジック ──────────────────────────────────
const DEPARTURE_REF_KEY = {
  '東京':'tokyo',   '横浜':'tokyo',  '千葉':'tokyo',  '大宮':'tokyo',
  '宇都宮':'tokyo', '仙台':'tokyo',  '盛岡':'tokyo',
  '青森':'aomori',  '新潟':'niigata',
  '名古屋':'nagoya','静岡':'nagoya', '長野':'nagoya', '富山':'nagoya', '金沢':'nagoya',
  '大阪':'osaka',   '京都':'osaka',  '神戸':'osaka',  '奈良':'osaka',
  '広島':'osaka',   '岡山':'osaka',  '松江':'osaka',
  '倉敷':'osaka',   '姫路':'osaka',  '米子':'osaka',  '福山':'osaka',
  '高松':'takamatsu','松山':'takamatsu','高知':'takamatsu','徳島':'takamatsu',
  '福岡':'fukuoka', '熊本':'fukuoka','鹿児島':'fukuoka','長崎':'fukuoka','宮崎':'fukuoka',
  '那覇':'naha',
  '函館':'hakodate','旭川':'sapporo','札幌':'sapporo',
};

const METRO = {
  '東京': new Set(['横浜','千葉','さいたま','川崎']),
  '大阪': new Set(['京都','神戸','奈良']),
};

function getTravelTime(dest, dep) {
  if (!dest.travelTime) return 180;
  if (dest.hubCity === dep) return 60;
  const key = DEPARTURE_REF_KEY[dep];
  if (!key) return 180;
  return dest.travelTime[key] ?? 180;
}

function calcPool(dep, stayType) {
  const threshold = stayType === 'daytrip' ? 120 : 240;
  return dests.filter(d => {
    if (d.type !== 'destination') return false;
    // departures フィルタ
    if (d.departures && d.departures.length > 0 && !d.departures.includes(dep)) return false;
    // stayAllowed フィルタ
    if (d.stayAllowed && d.stayAllowed.length > 0 && !d.stayAllowed.includes(stayType)) return false;
    return getTravelTime(d, dep) <= threshold;
  });
}

// ── 全出発地リスト ──────────────────────────────────────────────────────────
const ALL_DEPS = [
  '東京','横浜','千葉','大宮','宇都宮',
  '仙台','盛岡','青森','函館','旭川','札幌',
  '新潟','長野','名古屋','静岡','富山','金沢',
  '大阪','京都','神戸','奈良','姫路',
  '広島','岡山','倉敷','福山','松江','米子',
  '高松','松山','高知','徳島',
  '福岡','熊本','鹿児島','長崎','宮崎','那覇',
];

// ── 新規追加31件ID ─────────────────────────────────────────────────────────
const NEW_31 = new Set([
  'bihoro-pass','kamui-misaki','saroma-ko','notsuke-hanto','mashu-ko',
  'kussharo-ko','uryunuma','konsen-daichi',
  'chokai-san','eshima-miyagi',
  'kirigamine','nyukasa','ontake',
  'mitsuke-jima','rokkozaki','sozogi','shiroyone-senmaida','tojinbo','shimanami-kaido','keta-taisha',
  'kaizu-osaki','chikubushima','metasequoia','tango-matsushima',
  'kuju-kogen','gokase','ikoma-kogen','chinen-misaki','bise','kudakajima','sefa-utaki',
]);

// ── 集計 ─────────────────────────────────────────────────────────────────────
console.log('═══════════════════════════════════════════════════════════════');
console.log('  どこいこ daytrip/1night プール集計レポート');
console.log('═══════════════════════════════════════════════════════════════');
console.log(`  対象目的地数: ${dests.filter(d => d.type === 'destination').length}件\n`);

// ── 1. 修正対象4都市 + 函館・旭川 ────────────────────────────────────────
const TARGET_DEPS = ['米子','姫路','倉敷','福山','函館','旭川'];
console.log('【修正1・2 対象都市】');
console.log('┌──────────┬──────────┬──────────┐');
console.log('│ 出発地   │ daytrip  │  1night  │');
console.log('├──────────┼──────────┼──────────┤');
for (const dep of TARGET_DEPS) {
  const dt = calcPool(dep, 'daytrip').length;
  const on = calcPool(dep, '1night').length;
  const d = dep.padEnd(4, '　');
  console.log(`│ ${d}   │   ${String(dt).padStart(4)}   │   ${String(on).padStart(4)}   │`);
}
console.log('└──────────┴──────────┴──────────┘\n');

// ── 2. 全出発地一覧 ────────────────────────────────────────────────────────
console.log('【全出発地 daytrip / 1night プール件数】');
console.log(`${'出発地'.padEnd(6)} ${'daytrip'.padStart(8)} ${'1night'.padStart(8)}`);
console.log('─'.repeat(30));
for (const dep of ALL_DEPS) {
  const dt = calcPool(dep, 'daytrip').length;
  const on = calcPool(dep, '1night').length;
  const flag = dt === 0 ? ' ⚠️' : dt < 5 ? ' △' : '';
  console.log(`${dep.padEnd(6)} ${String(dt).padStart(8)} ${String(on).padStart(8)}${flag}`);
}
console.log();

// ── 3. 新規追加31件の daytrip 内訳 ────────────────────────────────────────
console.log('【新規追加31件の daytrip 対応状況】');
const newDests = dests.filter(d => NEW_31.has(d.id));
const newWithDaytrip = [];
const newWithoutDaytrip = [];

for (const d of newDests) {
  // どの出発地からでも daytrip になりうるか確認
  const daytripDeps = ALL_DEPS.filter(dep => {
    if (d.stayAllowed && d.stayAllowed.length > 0 && !d.stayAllowed.includes('daytrip')) return false;
    if (d.departures && d.departures.length > 0 && !d.departures.includes(dep)) return false;
    return getTravelTime(d, dep) <= 120;
  });
  if (daytripDeps.length > 0) {
    newWithDaytrip.push({ id: d.id, name: d.name, region: d.region, deps: daytripDeps });
  } else {
    newWithoutDaytrip.push({ id: d.id, name: d.name, region: d.region });
  }
}

console.log(`  daytrip 可能: ${newWithDaytrip.length}件`);
for (const d of newWithDaytrip) {
  console.log(`    ✅ ${d.name} (${d.region}) ← ${d.deps.join('・')}`);
}
console.log(`\n  daytrip 対象外 (1night以上): ${newWithoutDaytrip.length}件`);
for (const d of newWithoutDaytrip) {
  console.log(`    📍 ${d.name} (${d.region})`);
}
console.log();

// ── 4. 全体統計（daytrip件数分布） ────────────────────────────────────────
console.log('【全出発地 daytrip 件数分布】');
const dtCounts = ALL_DEPS.map(dep => calcPool(dep, 'daytrip').length);
const buckets = { '0件': 0, '1~4件': 0, '5~20件': 0, '21~50件': 0, '51件以上': 0 };
for (const c of dtCounts) {
  if      (c === 0)  buckets['0件']++;
  else if (c <= 4)   buckets['1~4件']++;
  else if (c <= 20)  buckets['5~20件']++;
  else if (c <= 50)  buckets['21~50件']++;
  else               buckets['51件以上']++;
}
for (const [k, v] of Object.entries(buckets)) {
  const bar = '█'.repeat(v);
  console.log(`  ${k.padEnd(8)} : ${String(v).padStart(2)}都市 ${bar}`);
}
console.log();

// ── 5. 地域別 daytrip 分布（新規31件が何件追加で daytrip に貢献したか） ──
console.log('【地域別 目的地数 / うち daytrip 対応件数】');
const regions = ['北海道','東北','関東','中部','近畿','中国','四国','九州','沖縄'];
for (const reg of regions) {
  const all = dests.filter(d => d.type === 'destination' && d.region === reg);
  const withDt = all.filter(d => {
    if (d.stayAllowed && d.stayAllowed.length > 0 && !d.stayAllowed.includes('daytrip')) return false;
    return true;
  });
  const newCount = all.filter(d => NEW_31.has(d.id)).length;
  const newStr = newCount > 0 ? ` (+${newCount}件追加)` : '';
  console.log(`  ${reg.padEnd(4)}: 全${String(all.length).padStart(4)}件 / daytrip許可${String(withDt.length).padStart(4)}件${newStr}`);
}
console.log();
console.log('═══════════════════════════════════════════════════════════════');
console.log('  レポート完了');
console.log('═══════════════════════════════════════════════════════════════');
