/**
 * graphAudit.mjs — transportGraph.json 網羅性チェック
 *
 * 実行: node scripts/graphAudit.mjs
 *
 * チェック項目:
 *   [A] 新幹線主要ルート（東京〜博多）の到達可能性
 *   [B] 地方路線（金沢〜高山、岡山〜出雲など）の到達可能性
 *   [C] 離島ルート（フェリー・飛行機）の到達可能性
 *   [D] destinations.json 全 destination の BFS 到達可能性チェック
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const GRAPH = JSON.parse(readFileSync(join(__dirname, '../src/data/transportGraph.json'), 'utf8'));
const DESTS = JSON.parse(readFileSync(join(__dirname, '../src/data/destinations.json'), 'utf8'));

/* ── 隣接マップ構築 ── */
const ADJ = {};
for (const edge of GRAPH.edges) {
  if (!ADJ[edge.from]) ADJ[edge.from] = [];
  ADJ[edge.from].push(edge);
}

/* ── BFS ── */
function findPath(fromId, toId) {
  const queue   = [[fromId]];
  const visited = new Set();
  while (queue.length) {
    const path = queue.shift();
    const node = path[path.length - 1];
    if (node === toId) return path;
    if (!visited.has(node)) {
      visited.add(node);
      for (const e of (ADJ[node] ?? [])) {
        if (!visited.has(e.to)) queue.push([...path, e.to]);
      }
    }
  }
  return null;
}

function canReach(fromId, toId) {
  return findPath(fromId, toId) !== null;
}

function pathStr(path) {
  if (!path) return '× 到達不可';
  return path.join(' → ');
}

/* ── テストフレームワーク ── */
let pass = 0, fail = 0;
const failList = [];

function check(label, fromId, toId) {
  const path = findPath(fromId, toId);
  if (path) {
    pass++;
    process.stdout.write('.');
    return path;
  } else {
    fail++;
    failList.push({ label, fromId, toId });
    process.stdout.write('F');
    return null;
  }
}

function section(title) {
  console.log(`\n\n── ${title} ──`);
}

/* ── [A] 新幹線主要ルート（東京〜博多スパイン） ── */
section('[A] 新幹線主要ルート');

const shinkansenSpine = [
  ['東京〜名古屋',   'hub:東京',   'hub:名古屋'],
  ['東京〜京都',     'hub:東京',   'hub:京都'],
  ['東京〜大阪',     'hub:東京',   'hub:大阪'],
  ['東京〜岡山',     'hub:東京',   'hub:岡山'],
  ['東京〜広島',     'hub:東京',   'hub:広島'],
  ['東京〜博多',     'hub:東京',   'hub:博多'],
  ['東京〜福岡',     'hub:東京',   'hub:福岡'],
  ['東京〜熊本',     'hub:東京',   'hub:熊本'],
  ['東京〜鹿児島',   'hub:東京',   'hub:鹿児島'],
  ['東京〜仙台',     'hub:東京',   'hub:仙台'],
  ['東京〜盛岡',     'hub:東京',   'hub:盛岡'],
  ['東京〜秋田',     'hub:東京',   'hub:秋田'],
  ['東京〜山形',     'hub:東京',   'hub:山形'],
  ['東京〜青森',     'hub:東京',   'hub:青森'],
  ['東京〜函館',     'hub:東京',   'hub:函館'],
  ['東京〜札幌',     'hub:東京',   'hub:札幌'],
  ['東京〜新潟',     'hub:東京',   'hub:新潟'],
  ['東京〜金沢',     'hub:東京',   'hub:金沢'],
  ['東京〜富山',     'hub:東京',   'hub:富山'],
  ['東京〜長野',     'hub:東京',   'hub:長野'],
  ['大阪〜博多',     'hub:大阪',   'hub:博多'],
  ['福岡〜長崎',     'hub:福岡',   'hub:長崎'],
  ['福岡〜嬉野温泉', 'hub:福岡',   'hub:嬉野温泉'],
  ['福岡〜武雄温泉', 'hub:福岡',   'hub:武雄温泉'],
];

for (const [label, from, to] of shinkansenSpine) {
  const path = check(label, from, to);
  if (!path) console.log(`\n  ✗ ${label}: ${from} → ${to}`);
}

/* ── [A] 重要 destination への到達可能性 ── */
section('[A] 新幹線圏 destination 到達確認');

const shinkansenDests = [
  ['東京→奈良',       'hub:東京',   'destination:nara'],
  ['東京→京都嵐山',   'hub:東京',   'destination:arashiyama'],
  ['東京→鎌倉',       'hub:東京',   'destination:kamakura'],
  ['東京→日光',       'hub:東京',   'destination:nikko'],
  ['大阪→奈良',       'hub:大阪',   'destination:nara'],
  ['大阪→京都嵐山',   'hub:大阪',   'destination:arashiyama'],
  ['東京→博多',       'hub:東京',   'destination:mojiko'],
  ['東京→熊本',       'hub:東京',   'destination:kumano'],
  ['東京→熱海',       'hub:東京',   'destination:atami'],
  ['東京→軽井沢',     'hub:東京',   'destination:karuizawa'],
];

for (const [label, from, to] of shinkansenDests) {
  const path = check(label, from, to);
  if (!path) console.log(`\n  ✗ ${label}: ${from} → ${to}`);
}

/* ── [B] 地方路線 ── */
section('[B] 地方路線');

const regionalRoutes = [
  ['金沢〜高山',       'hub:金沢',    'destination:takayama-o'],
  ['名古屋〜高山',     'hub:名古屋',  'destination:takayama-o'],
  ['大阪〜高山',       'hub:大阪',    'destination:takayama-o'],
  ['岡山〜出雲',       'hub:岡山',    'destination:izumo'],
  ['大阪〜出雲',       'hub:大阪',    'destination:izumo'],
  ['東京〜出雲',       'hub:東京',    'destination:izumo'],
  ['岡山〜倉敷',       'hub:岡山',    'destination:kurashiki-o'],
  ['東京〜松山',       'hub:東京',    'destination:dogo-onsen'],
  ['大阪〜高知',       'hub:大阪',    'destination:oboke'],
  ['東京〜白川郷',     'hub:東京',    'destination:shirakawago-t'],
  ['名古屋〜白川郷',   'hub:名古屋',  'destination:shirakawago-t'],
  ['東京〜立山黒部',   'hub:東京',    'destination:tateyama-kurobe'],
  ['東京〜奥飛騨',     'hub:東京',    'destination:okuhida-onsen'],
  ['大阪〜城崎温泉',   'hub:大阪',    'destination:kinosaki-onsen'],
  ['東京〜津和野',     'hub:東京',    'destination:tsuwano'],
  ['東京〜萩',         'hub:東京',    'destination:hagi'],
  ['東京〜天橋立',     'hub:東京',    'destination:amanohashidate'],
  ['東京〜平泉',       'hub:東京',    'destination:hiraizumi'],
  ['東京〜弘前',       'hub:東京',    'destination:hirosaki'],
  ['東京〜角館',       'hub:東京',    'destination:kakunodate'],
  ['東京〜遠野',       'hub:東京',    'destination:tono'],
  ['東京〜会津若松',   'hub:東京',    'destination:aizu'],
  ['東京〜草津温泉',   'hub:東京',    'destination:kusatsu-onsen'],
  ['東京〜上高地',     'hub:東京',    'destination:kamikochi'],
  ['東京〜奥入瀬',     'hub:東京',    'destination:oirase'],
  ['福岡〜阿蘇',       'hub:福岡',    'destination:aso'],
  ['福岡〜由布院',     'hub:福岡',    'destination:yufuin'],
  ['東京〜下呂温泉',   'hub:東京',    'destination:gero-onsen'],
  ['東京〜那智勝浦',   'hub:東京',    'destination:nachikatsuura'],
  ['東京〜飛騨古川',   'hub:東京',    'destination:hida-furukawa'],
];

for (const [label, from, to] of regionalRoutes) {
  const path = check(label, from, to);
  if (!path) console.log(`\n  ✗ ${label}: ${from} → ${to}`);
}

/* ── [C] 離島ルート ── */
section('[C] 離島ルート（フェリー・飛行機）');

const islandRoutes = [
  ['東京→石垣島',       'hub:東京',   'destination:ishigaki'],
  ['東京→宮古島',       'hub:東京',   'destination:miyakojima'],
  ['東京→久米島',       'hub:東京',   'destination:kumejima'],
  ['東京→与那国',       'hub:東京',   'destination:yonaguni-island'],
  ['東京→波照間',       'hub:東京',   'destination:taketomi-island'],  // 竹富・波照間代表
  ['東京→座間味',       'hub:東京',   'destination:zamami-island'],
  ['東京→伊良部島',     'hub:東京',   'destination:irabu-island'],
  ['東京→粟国島',       'hub:東京',   'destination:aguni-island'],
  ['東京→伊計・読谷',   'hub:東京',   'destination:yomitanson'],
  ['東京→屋久島',       'hub:東京',   'destination:yakushima'],
  ['東京→奄美大島',     'hub:東京',   'destination:amami'],
  ['東京→壱岐',         'hub:東京',   'destination:iki-island'],
  ['東京→対馬',         'hub:東京',   'destination:tsushima'],
  ['東京→種子島',       'hub:東京',   'destination:tanegashima'],
  ['東京→天草',         'hub:東京',   'destination:amakusa'],
  ['東京→五島列島',     'hub:東京',   'destination:goto'],
  ['東京→佐渡島',       'hub:東京',   'destination:sado-island'],
  ['東京→小豆島',       'hub:東京',   'destination:shodoshima'],
  ['東京→直島',         'hub:東京',   'destination:naoshima'],
  ['東京→礼文島',       'hub:東京',   'destination:rebun-island'],
  ['東京→利尻島',       'hub:東京',   'destination:rishiri-island'],
  ['東京→奥尻島',       'hub:東京',   'destination:oki-island'],  // 隠岐
  ['東京→沖永良部',     'hub:東京',   'destination:iriomote'],  // 西表島
  ['大阪→壱岐',         'hub:大阪',   'destination:iki-island'],
  ['大阪→対馬',         'hub:大阪',   'destination:tsushima'],
  ['福岡→石垣島',       'hub:福岡',   'destination:ishigaki'],
  ['福岡→壱岐',         'hub:福岡',   'destination:iki-island'],
  ['那覇→石垣島',       'hub:那覇',   'destination:ishigaki'],
];

for (const [label, from, to] of islandRoutes) {
  const path = check(label, from, to);
  if (!path) console.log(`\n  ✗ ${label}: ${from} → ${to}`);
}

/* ── [D] destinations.json 全件 BFS 到達可能性（主要3拠点から） ── */
section('[D] destinations.json 全件到達確認（東京・大阪・福岡）');

const hubs = ['hub:東京', 'hub:大阪', 'hub:福岡'];
const unreachable = [];

for (const dest of DESTS) {
  const toId = `destination:${dest.id}`;
  if (!GRAPH.nodes[toId]) {
    // destination node 自体がない
    unreachable.push({ dest: dest.id, reason: 'グラフにノードなし' });
    continue;
  }
  const reachableFrom = hubs.filter(h => GRAPH.nodes[h] && canReach(h, toId));
  if (reachableFrom.length === 0) {
    unreachable.push({ dest: dest.id, name: dest.name, reason: '全拠点から到達不可' });
    process.stdout.write('F');
    failList.push({ label: `${dest.name}(${dest.id})`, fromId: '東京/大阪/福岡', toId });
  } else {
    pass++;
    process.stdout.write('.');
  }
}

/* ── 結果サマリー ── */
console.log('\n\n');
console.log('════════════════════════════════════════════════');
console.log('  graphAudit — 結果');
console.log('════════════════════════════════════════════════');
console.log(`  PASS: ${pass}`);
console.log(`  FAIL: ${fail + unreachable.length}`);

if (unreachable.length > 0) {
  console.log('\n  ── [D] 全拠点から到達不可（または グラフノード欠損） ──');
  for (const u of unreachable) {
    console.log(`    × ${u.name ?? u.dest}  (${u.dest}) — ${u.reason}`);
  }
}

if (failList.length > 0) {
  console.log('\n  ── FAIL 一覧（A/B/C チェック） ──');
  for (const f of failList) {
    if (!f.fromId.includes('東京/大阪/福岡')) {
      console.log(`    × ${f.label}  ${f.fromId} → ${f.toId}`);
    }
  }
}

/* ── 新幹線ルート詳細表示 ── */
console.log('\n  ── 新幹線主要ルート詳細 ──');
const checkRoutes = [
  ['東京→博多', 'hub:東京', 'hub:博多'],
  ['東京→金沢', 'hub:東京', 'hub:金沢'],
  ['大阪→出雲市', 'hub:大阪', 'hub:出雲市'],
  ['岡山→出雲市', 'hub:岡山', 'hub:出雲市'],
  ['金沢→高山', 'hub:金沢', 'hub:高山'],
];
for (const [label, from, to] of checkRoutes) {
  const path = findPath(from, to);
  console.log(`  ${label}: ${path ? path.join(' → ') : '× 到達不可'}`);
}

if (fail + unreachable.length === 0) {
  console.log('\n  ✅ 全チェック PASS');
} else {
  console.log(`\n  ❌ ${fail + unreachable.length} 件の問題あり`);
  process.exit(1);
}
