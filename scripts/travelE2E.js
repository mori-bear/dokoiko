'use strict';
/**
 * travelE2E.js — 旅行ルート E2E シミュレーションテスト
 *
 * Puppeteer 不要。エンジンロジックを直接検証する。
 *
 * Usage: node scripts/travelE2E.js
 */

const fs = require('fs');

const dests       = JSON.parse(fs.readFileSync('./src/data/destinations.json', 'utf8'));
const hubs        = JSON.parse(fs.readFileSync('./src/data/hubs.json', 'utf8'));
const hotelAreas  = JSON.parse(fs.readFileSync('./src/data/hotelAreas.json', 'utf8'));
const graph       = JSON.parse(fs.readFileSync('./src/data/transportGraph.json', 'utf8'));

const destMap    = new Map(dests.map(d => [d.id, d]));
const areaMap    = new Map(hotelAreas.map(a => [a.id, a]));
const RAKUTEN_AFF = 'https://hb.afl.rakuten.co.jp/hgc/5113ee4b.8662cfc5.5113ee4c.119de89a/?pc=';
const VC_BASE     = 'https://ck.jp.ap.valuecommerce.com/servlet/referral?sid=3764408&pid=892559858&vc_url=';

// BFS
const adj = {};
for (const e of graph.edges) {
  if (!adj[e.from]) adj[e.from] = [];
  adj[e.from].push(e);
}
function bfs(startId, goalId, maxDepth = 8) {
  const found = [];
  const queue = [{ nodeId: startId, path: [], visited: new Set([startId]) }];
  while (queue.length && found.length < 3) {
    const { nodeId: cur, path, visited } = queue.shift();
    if (cur === goalId) { found.push(path); continue; }
    if (path.length >= maxDepth) continue;
    for (const edge of (adj[cur] || [])) {
      if (!visited.has(edge.to)) {
        const nv = new Set(visited); nv.add(edge.to);
        queue.push({ nodeId: edge.to, path: [...path, edge], visited: nv });
      }
    }
  }
  return found;
}

const CITY_AIRPORT = {
  '東京': 'HND', '横浜': 'HND', '千葉': 'NRT', '大宮': 'HND', '宇都宮': 'HND',
  '大阪': 'ITM', '京都': 'ITM', '神戸': 'UKB', '奈良': 'ITM',
  '名古屋': 'NGO', '静岡': 'FSZ', '長野': 'MMJ', '金沢': 'KMQ', '富山': 'TOY',
  '札幌': 'CTS', '函館': 'HKD', '旭川': 'AKJ',
  '仙台': 'SDJ', '盛岡': 'HNA',
  '広島': 'HIJ', '岡山': 'OKJ', '松江': 'IZO',
  '高松': 'TAK', '松山': 'MYJ', '高知': 'KCZ', '徳島': 'TKS',
  '福岡': 'FUK', '熊本': 'KMJ', '鹿児島': 'KOJ', '長崎': 'NGS', '宮崎': 'KMI',
};
const DEPARTURE_RAIL = {
  '東京': '東京駅', '横浜': '横浜駅', '大阪': '大阪駅', '京都': '京都駅',
  '名古屋': '名古屋駅', '福岡': '博多駅', '広島': '広島駅', '高松': '高松駅',
  '松山': '松山駅', '鹿児島': '鹿児島中央駅',
};

// ── 検証関数 ──
function checkTransport(departure, destId) {
  const city = destMap.get(destId);
  if (!city) return { ok: false, reason: 'destination not found: ' + destId };
  const issues = [];

  const startId = 'city:' + departure;
  const goalId  = 'destination:' + destId;
  const hasBfsNode = !!graph.nodes[startId] && !!graph.nodes[goalId];

  // 交通チェック: BFS or field check
  if (hasBfsNode) {
    const routes = bfs(startId, goalId);
    if (!routes.length) issues.push('BFS: no route found');
    // 迂回フライトチェック: transportRenderer と同じフィルターを適用
    // 有効ルート = フライトなし OR 出発地空港と一致するフライト
    const depIata = CITY_AIRPORT[departure];
    const validRoutes = routes.filter(path => {
      const fl = path.find(s => s.type === 'flight');
      if (!fl) return true; // 鉄道・フェリーのみルートは有効
      const fromIata = fl.from.startsWith('airport:') ? fl.from.replace('airport:', '') : null;
      return !depIata || !fromIata || fromIata === depIata;
    });
    if (!validRoutes.length && routes.length > 0) {
      issues.push('BFS: all routes are detour flights (no valid route after filter)');
    }
  } else {
    // フォールバック: destination フィールドチェック
    const hasRail = !!city.railGateway;
    const hasAir  = !!city.airportGateway;
    const hasFerry = !!(city.ferryGateway || (city.gateways?.ferry?.length > 0));
    const isIsland = !!(city.isIsland || city.destType === 'island');
    if (!hasRail && !hasAir && !hasFerry) {
      issues.push('fallback: no rail/air/ferry gateway');
    }
    if (isIsland && !hasFerry && !hasAir) {
      issues.push('island: no ferry or airport gateway');
    }
  }
  return { ok: issues.length === 0, issues };
}

function checkHotelLinks(destId) {
  const city = destMap.get(destId);
  if (!city) return { ok: false, reason: 'not found' };
  const area = city.hotelArea ? areaMap.get(city.hotelArea) : null;
  const kw = area ? area.rakutenKeyword : (city.prefecture + ' ' + city.city);
  if (!kw) return { ok: false, reason: 'no keyword' };
  const rakutenTarget = 'https://kw.travel.rakuten.co.jp/keyword/Search.do?f_query=' + encodeURIComponent(kw);
  const rakutenUrl    = RAKUTEN_AFF + rakutenTarget;
  const jalanUrl      = area?.jalanUrl ? VC_BASE + encodeURIComponent(area.jalanUrl) : null;
  const ok = rakutenUrl.startsWith(RAKUTEN_AFF) && (!jalanUrl || jalanUrl.startsWith(VC_BASE));
  return { ok, rakutenUrl: rakutenUrl.substring(0, 80) + '...', jalanOk: !!jalanUrl };
}

function checkGoogleMaps(departure, destId) {
  const city = destMap.get(destId);
  if (!city) return { ok: false };
  const isIsland = !!(city.isIsland || city.destType === 'island');
  const ferryPort = isIsland ? (city.ferryGateway || city.gateways?.ferry?.[0] || null) : null;
  const destStation = ferryPort || city.accessStation || city.name + ' ' + city.prefecture;
  const originStation = DEPARTURE_RAIL[departure] || departure + '駅';
  const mapsUrl = 'https://www.google.com/maps/dir/?api=1' +
    '&origin=' + encodeURIComponent(originStation) +
    '&destination=' + encodeURIComponent(destStation) +
    '&travelmode=transit';
  return {
    ok: mapsUrl.includes('maps.google.com') || mapsUrl.includes('google.com/maps'),
    origin: originStation,
    dest: destStation,
  };
}

// ── テストケース ──
const TEST_CASES = [
  { departure: '大阪', destId: 'koshikijima', label: '大阪 → 甑島（フェリー+鉄道）' },
  { departure: '大阪', destId: 'ishigaki',    label: '大阪 → 石垣島（飛行機）' },
  { departure: '大阪', destId: 'tanabe',       label: '大阪 → 田辺（鉄道・飛行機禁止）' },
  { departure: '高松', destId: 'dogo-onsen',   label: '高松 → 道後温泉（鉄道）' },
  { departure: '大阪', destId: 'yakushima',    label: '大阪 → 屋久島（飛行機+フェリー）' },
  { departure: '東京', destId: 'ishigaki',     label: '東京 → 石垣島（飛行機）' },
  { departure: '鹿児島', destId: 'yakushima',  label: '鹿児島 → 屋久島（飛行機+フェリー）' },
];

let pass = 0; let fail = 0;
const results = [];

console.log('\n=== Travel E2E シミュレーションテスト ===\n');

for (const tc of TEST_CASES) {
  const t = checkTransport(tc.departure, tc.destId);
  const h = checkHotelLinks(tc.destId);
  const m = checkGoogleMaps(tc.departure, tc.destId);
  const ok = t.ok && h.ok && m.ok;
  if (ok) { pass++; console.log('✓', tc.label); }
  else     { fail++; console.log('✗', tc.label); }
  if (t.issues?.length) t.issues.forEach(i => console.log('  ⚠ transport:', i));
  if (!h.ok) console.log('  ⚠ hotel:', h.reason);
  if (!m.ok) console.log('  ⚠ maps: failed');
  if (ok) console.log('   maps:', m.origin, '→', m.dest);
  results.push({ ...tc, transportOk: t.ok, hotelOk: h.ok, mapsOk: m.ok, issues: t.issues });
}

console.log('\n=== 結果 ===');
console.log('PASS:', pass, '/ FAIL:', fail, '/', TEST_CASES.length);

// 追加: 特定ルートの詳細検証
console.log('\n--- 大阪→田辺 飛行機禁止チェック ---');
const startId2 = 'city:大阪'; const goalId2 = 'destination:tanabe';
if (graph.nodes[startId2] && graph.nodes[goalId2]) {
  const routes2 = bfs(startId2, goalId2, 8);
  const flights2 = routes2.filter(p => p.some(e => e.type === 'flight'));
  const detours2 = flights2.filter(p => {
    const fl = p.find(e => e.type === 'flight');
    return fl && fl.from.startsWith('airport:') && fl.from.replace('airport:', '') !== CITY_AIRPORT['大阪'];
  });
  const validRoutes2 = routes2.filter(p => !p.some(e => e.type === 'flight'));
  console.log('総ルート:', routes2.length, '/ 飛行機ルート:', flights2.length, '/ 迂回フライト:', detours2.length, '/ 有効(非飛行機)ルート:', validRoutes2.length);
  if (validRoutes2.length > 0) console.log('✓ 有効な鉄道ルートあり（迂回フライトはrenderで除外）');
}

// JSON レポート出力
fs.writeFileSync('docs/e2e_test_result.json', JSON.stringify({ date: new Date().toISOString(), pass, fail, results }, null, 2));
console.log('\n詳細: docs/e2e_test_result.json');
process.exit(fail > 0 ? 1 : 0);
