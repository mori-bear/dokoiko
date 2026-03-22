/**
 * Travel time precomputer
 *
 * Runs Dijkstra from 5 reference departure cities through transportGraph.json
 * to compute realistic travel times (minutes) for every hub + destination.
 *
 * Adds to each entry in hubs.json and destinations.json:
 *   travelTime: { tokyo, osaka, nagoya, fukuoka, takamatsu }
 *   stayRecommendation: 'daytrip' | '1night' | '2night' | '3night+'
 *
 * Usage: node _computeTravelTimes.js
 */

'use strict';

const fs = require('fs');

const graph = JSON.parse(fs.readFileSync('./src/lib/transportCore/transportGraph.json', 'utf8'));
const hubs  = JSON.parse(fs.readFileSync('./src/lib/transportCore/hubs.json', 'utf8'));
const dests = JSON.parse(fs.readFileSync('./src/data/destinations.json', 'utf8'));

/* ── 隣接リスト ── */
const adj = {};
for (const edge of graph.edges) {
  if (!adj[edge.from]) adj[edge.from] = [];
  adj[edge.from].push(edge);
}

/* ── Dijkstra ── */
function dijkstra(startId) {
  // 優先度付きキュー（min-heap の代わりに sort で実装）
  const dist  = {};
  const queue = [{ id: startId, cost: 0 }];

  while (queue.length > 0) {
    queue.sort((a, b) => a.cost - b.cost);
    const { id: cur, cost } = queue.shift();
    if (dist[cur] !== undefined) continue;
    dist[cur] = cost;

    for (const edge of (adj[cur] || [])) {
      if (dist[edge.to] === undefined) {
        queue.push({ id: edge.to, cost: cost + (edge.minutes ?? 0) });
      }
    }
  }

  return dist;
}

/* ── 基準都市 ── */
const REF_CITIES = {
  tokyo:      '東京',
  osaka:      '大阪',
  nagoya:     '名古屋',
  fukuoka:    '福岡',
  takamatsu:  '高松',
};

console.log('Dijkstra 計算中...');
const refDists = {};
for (const [key, city] of Object.entries(REF_CITIES)) {
  refDists[key] = dijkstra(`city:${city}`);
  console.log(`  ${city} 完了 (${Object.keys(refDists[key]).length} ノード到達)`);
}

/* ── stayRecommendation 決定 ──
   基準: 東京からの移動時間（全国的参照）
   東京から到達不可の場合は大阪から
*/
function toStayRec(minutes) {
  if (minutes === null || minutes === undefined) return '2night'; // fallback
  if (minutes < 120) return 'daytrip';
  if (minutes < 300) return '1night';
  if (minutes < 480) return '2night';
  return '3night+';
}

/* ── ノードID解決（destination → hub → city の順で探す）── */
function resolveNodeDist(refDistMap, entry) {
  const candidates = [
    `destination:${entry.id}`,
    `hub:${entry.name}`,
    `city:${entry.name}`,
  ];
  for (const nodeId of candidates) {
    const d = refDistMap[nodeId];
    if (d !== undefined) return d;
  }
  return null;
}

/* ── 各エントリに travelTime + stayRecommendation を付与 ── */
function enrichEntry(entry) {
  const travelTime = {};
  for (const key of Object.keys(REF_CITIES)) {
    const raw = resolveNodeDist(refDists[key], entry);
    travelTime[key] = raw !== null ? Math.round(raw) : null;
  }

  // stayRecommendation: 東京 → 大阪 → 名古屋 の順で非 null を使用
  const refMin = travelTime.tokyo ?? travelTime.osaka ?? travelTime.nagoya ?? travelTime.fukuoka ?? null;
  const stayRecommendation = toStayRec(refMin);

  return { ...entry, travelTime, stayRecommendation };
}

const hubsUpdated  = hubs.map(enrichEntry);
const destsUpdated = dests.map(enrichEntry);

/* ── 到達不可チェック ── */
const unreachable = [...hubsUpdated, ...destsUpdated].filter(
  e => Object.values(e.travelTime).every(v => v === null)
);
if (unreachable.length > 0) {
  console.warn(`\n⚠ 全参照都市から到達不可: ${unreachable.map(e => e.id).join(', ')}`);
}

/* ── 書き込み ── */
fs.writeFileSync('./src/lib/transportCore/hubs.json', JSON.stringify(hubsUpdated,  null, 2), 'utf8');
fs.writeFileSync('./src/data/destinations.json', JSON.stringify(destsUpdated, null, 2), 'utf8');

/* ── サマリ ── */
const allUpdated = [...hubsUpdated, ...destsUpdated];
const recs = { daytrip: 0, '1night': 0, '2night': 0, '3night+': 0 };
allUpdated.forEach(e => { if (recs[e.stayRecommendation] !== undefined) recs[e.stayRecommendation]++; });

const nullCount = allUpdated.filter(e => Object.values(e.travelTime).some(v => v === null)).length;

console.log('\n── stayRecommendation 分布 ──');
Object.entries(recs).forEach(([k, v]) => console.log(`  ${k}: ${v}件`));
console.log(`  到達不可あり(一部null): ${nullCount}件`);
console.log(`\n  hubs: ${hubsUpdated.length}, dests: ${destsUpdated.length}`);
console.log('Done → hubs.json, destinations.json 更新完了');
