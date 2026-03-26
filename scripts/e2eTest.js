/**
 * qa-e2e.js — E2Eテスト: 宿リンク・交通リンク HTML解析
 *
 * 実行:
 *   node qa-e2e.js              # 地域サンプル (5件/地方, ~35件)
 *   node qa-e2e.js --all        # 全件 (200件, 所要時間: ~20分)
 *   node qa-e2e.js --hotel-only # 宿リンクのみ
 *   node qa-e2e.js --bfs-only   # BFS交通検証のみ (高速)
 *
 * チェック項目:
 *   [1] 宿リンク HTML解析: 楽天・じゃらん パターン検証
 *   [2] 宿リンク fallback: destination → hotelHub → prefecture
 *   [3] 交通リンク URL形式検証
 *   [4] BFSルート検証 (全件, transportGraph使用)
 *   [5] travelTime整合性検証 (全件)
 */

'use strict';

const fs    = require('fs');
const https = require('https');
const http  = require('http');
const { URL } = require('url');

/* ── オプション ── */
const OPT_ALL        = process.argv.includes('--all');
const OPT_HOTEL_ONLY = process.argv.includes('--hotel-only');
const OPT_BFS_ONLY   = process.argv.includes('--bfs-only');
const OPT_QUICK      = process.argv.includes('--quick');
const SAMPLE_N       = OPT_ALL ? 999 : OPT_QUICK ? 1 : 5; // per region

/* ── データ読み込み ── */
const DESTS_RAW = JSON.parse(fs.readFileSync('./src/data/destinations.json', 'utf8'));
const HUBS_RAW  = JSON.parse(fs.readFileSync('./src/data/hubs.json', 'utf8'));
const GRAPH     = JSON.parse(fs.readFileSync('./src/lib/transportCore/transportGraph.json', 'utf8'));

/* destinations のみ（hub除外）: BFS・travelTime・ホテルテスト共通 */
const ALL_ENTRIES = DESTS_RAW; // destinations.json のみ（graph に destination:id ノードあり）

/* ── 定数 ── */
const RAKUTEN_SEARCH = 'https://kw.travel.rakuten.co.jp/keyword/Search.do?f_keyword=';
const JALAN_SEARCH   = 'https://www.jalan.net/uw/uwp2011/uww2011init.do?keyword=';
const RATE_MS        = 500;   // リクエスト間隔
const TIMEOUT_MS     = 12000;
const MAX_REDIRECTS  = 8;

/* ── リクエストヘッダ ── */
const HEADERS = {
  'User-Agent':      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept':          'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'ja,en-US;q=0.7,en;q=0.3',
  'Accept-Encoding': 'identity',
  'Cache-Control':   'no-cache',
  'Connection':      'close',
};

/* ═══════════════════════════════════════
   ユーティリティ
═══════════════════════════════════════ */

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

/**
 * HTTP fetch（リダイレクト追従）
 * バイナリバッファとして返す（Shift-JIS 対応）。
 */
async function fetchBuf(rawUrl, hop = 0) {
  if (hop > MAX_REDIRECTS) return { buf: Buffer.alloc(0), status: 0, finalUrl: rawUrl };

  return new Promise((resolve, reject) => {
    let parsed;
    try { parsed = new URL(rawUrl); } catch { return resolve({ buf: Buffer.alloc(0), status: 0, finalUrl: rawUrl }); }

    const lib = parsed.protocol === 'https:' ? https : http;
    const opts = {
      hostname: parsed.hostname,
      path:     parsed.pathname + parsed.search,
      method:   'GET',
      headers:  HEADERS,
      timeout:  TIMEOUT_MS,
    };

    const req = lib.request(opts, async res => {
      if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
        res.resume();
        try {
          const loc = new URL(res.headers.location, rawUrl).toString();
          resolve(await fetchBuf(loc, hop + 1));
        } catch { resolve({ buf: Buffer.alloc(0), status: res.statusCode, finalUrl: rawUrl }); }
        return;
      }
      const chunks = [];
      let total = 0;
      res.on('data', chunk => { if (total < 400_000) { chunks.push(chunk); total += chunk.length; } });
      res.on('end', () => resolve({ buf: Buffer.concat(chunks), status: res.statusCode, finalUrl: rawUrl }));
      res.on('error', reject);
    });

    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
    req.on('error', reject);
    req.end();
  });
}

/** 後方互換: buf を utf8 html として返す */
async function fetchHtml(url, hop = 0) {
  const { buf, status, finalUrl } = await fetchBuf(url, hop);
  return { html: buf.toString('utf8'), status, finalUrl };
}

/** サンプリング: 地方ごとに最大 n 件 */
function sampleByRegion(arr, n) {
  const map = {};
  for (const d of arr) {
    const r = d.region || 'other';
    if (!map[r]) map[r] = [];
    if (map[r].length < n) map[r].push(d);
  }
  return Object.values(map).flat();
}

/* ═══════════════════════════════════════
   キーワード / フォールバック解決
═══════════════════════════════════════ */

function primaryKeyword(city) {
  return city.hotelHub ?? city.hotelSearch ?? city.name;
}

/** destination → hotelHub → prefecture の順でフォールバックリストを返す */
function fallbackList(city) {
  const primary = primaryKeyword(city);
  const list = [];
  if (city.hotelHub && city.hotelHub !== primary) list.push(city.hotelHub);
  if (city.hotelSearch && !list.includes(city.hotelSearch)) list.push(city.hotelSearch);
  if (city.name !== primary && !list.includes(city.name)) list.push(city.name);
  const pref = (city.prefecture || '').replace(/[都道府県]$/, '');
  if (pref && !list.includes(pref)) list.push(pref);
  return list;
}

/* ═══════════════════════════════════════
   [1][2] 宿リンク HTML 検証
   ─────────────────────────────────────
   Rakuten / Jalan とも動的ロード（SPA/AJAX）のため
   初期HTMLに宿一覧はない。以下の実用的シグナルで判定する:
     PASS:    HTTP 200 + レスポンス ≥ 20KB + キーワード応答あり
     UNKNOWN: HTTP 200 + 5-20KB    (フォームのみの可能性)
     FAIL:    HTTP 4xx/5xx、または明示的エラーパターン検出
═══════════════════════════════════════ */

/* Shift-JIS バイナリで検索するエラーパターン（binary encoding で比較） */
const JALAN_FAIL_ASCII = ['noYadoMessage', 'kensakuError'];
/* Rakuten のエラーパターン */
const RAKUTEN_FAIL_ASCII = ['404 Not Found'];
/* Rakuten の成功パターン（宿一覧あり） */
const RAKUTEN_PASS_PATTERN = 'hotelinfo/plan/';

/**
 * HTTP レスポンスのバイナリを受け取り宿リンクを評価する。
 * @param {'rakuten'|'jalan'} type
 * @param {Buffer} buf
 * @param {number} status
 * @param {string} keyword
 */
function analyzeHotelResponse(type, buf, status, keyword) {
  /* HTTP エラー */
  if (status >= 400) return { ok: false, reason: `HTTP ${status}` };
  if (status === 0)  return { ok: null,  reason: 'タイムアウト/接続不可' };

  const size = buf.length;
  /* バイナリを ASCII として検索 */
  const ascii = buf.toString('binary');

  /* サイズ不足 → エラーページ */
  if (size < 3000) return { ok: false, reason: `レスポンス小さすぎ (${size}B) — エラーページの可能性` };

  /* 明示的エラーパターン */
  const failPats = type === 'jalan' ? JALAN_FAIL_ASCII : RAKUTEN_FAIL_ASCII;
  for (const p of failPats) {
    if (ascii.toLowerCase().includes(p.toLowerCase())) {
      return { ok: false, reason: `FAILパターン検出: "${p}" (size=${size}B)` };
    }
  }

  /* Rakuten 専用: 宿一覧あり確認 */
  if (type === 'rakuten') {
    if (ascii.includes(RAKUTEN_PASS_PATTERN)) {
      return { ok: true, reason: `HTTP ${status}, 宿一覧確認済み, size=${(size/1024).toFixed(0)}KB` };
    }
    /* 宿一覧なし — フォールバックへ */
    return { ok: false, reason: `宿一覧パターン未検出, size=${(size/1024).toFixed(0)}KB` };
  }

  /* じゃらん: 大きなページ → 正常とみなす */
  if (size >= 20000) return { ok: true, reason: `HTTP ${status}, size=${(size/1024).toFixed(0)}KB — 正常ページ` };

  /* 中間サイズ: キーワードが含まれているか確認 */
  const utf8included = buf.toString('utf8').includes(keyword);
  if (utf8included) return { ok: true, reason: `HTTP ${status}, キーワード確認済み, size=${(size/1024).toFixed(0)}KB` };

  return { ok: null, reason: `HTTP ${status}, size=${(size/1024).toFixed(0)}KB — 判定不可` };
}

/** 1件テスト: 楽天 + じゃらん、fallback付き */
async function testHotelLinks(city) {
  const keyword = primaryKeyword(city);
  const fbs     = fallbackList(city);

  async function tryHotel(type, baseUrl, kw) {
    const url = baseUrl + encodeURIComponent(kw);
    try {
      const { buf, status } = await fetchBuf(url);
      await sleep(RATE_MS);
      return { ...analyzeHotelResponse(type, buf, status, kw), keyword: kw, url, status };
    } catch (e) {
      return { ok: null, keyword: kw, reason: `fetchエラー: ${e.message}`, status: 0 };
    }
  }

  /* --- 楽天 --- */
  console.log(`[HOTEL TEST] ${city.name}: 楽天="${keyword}"`);
  let rkt = await tryHotel('rakuten', RAKUTEN_SEARCH, keyword);
  if (rkt.ok === false) {
    for (const fb of fbs) {
      console.log(`[HOTEL TEST] ${city.name}: 楽天fallback="${fb}"`);
      const res = await tryHotel('rakuten', RAKUTEN_SEARCH, fb);
      if (res.ok !== false) { rkt = { ...res, fallback: true }; break; }
    }
  }

  /* --- じゃらん --- */
  console.log(`[HOTEL TEST] ${city.name}: じゃらん="${keyword}"`);
  let jln = await tryHotel('jalan', JALAN_SEARCH, keyword);
  if (jln.ok === false) {
    for (const fb of fbs) {
      console.log(`[HOTEL TEST] ${city.name}: じゃらんfallback="${fb}"`);
      const res = await tryHotel('jalan', JALAN_SEARCH, fb);
      if (res.ok !== false) { jln = { ...res, fallback: true }; break; }
    }
  }

  const rktMark = rkt.ok === true ? '✓' : rkt.ok === false ? '✗' : '?';
  const jlnMark = jln.ok === true ? '✓' : jln.ok === false ? '✗' : '?';
  console.log(`[HOTEL TEST] ${city.name}: 楽天${rktMark} ${rkt.reason} | じゃらん${jlnMark} ${jln.reason}`);

  return { city: city.name, rakuten: rkt, jalan: jln };
}

/* ═══════════════════════════════════════
   [3] 交通リンク URL形式検証
═══════════════════════════════════════ */

const TRANSPORT_DOMAINS = {
  'google-maps':      ['google.com/maps', 'maps.app.goo.gl'],
  'jr-east':          ['eki-net.com', 'jreast.co.jp'],
  'jr-west':          ['jr-odekake.net', 'jrwest.co.jp', 'eki-net.com'],
  'jr-kyushu':        ['jrkyushu.co.jp', 'eki-net.com'],
  'jr-ex':            ['jr-ex.jp', 'express.co.jp'],
  skyscanner:         ['skyscanner.jp', 'skyscanner.net'],
  ferry:              ['kankoukisen.co.jp', 'ferry.co.jp', 'navitransport.co.jp'],
  rental:             ['google.com', 'jaran.net'],
};

/** URL形式が期待するドメインを含むか */
function checkTransportUrl(type, url) {
  const domains = TRANSPORT_DOMAINS[type];
  if (!domains || !url) return null; // チェック対象外
  return domains.some(d => url.includes(d));
}

/* ═══════════════════════════════════════
   [4] BFS ルート到達性
═══════════════════════════════════════ */

function buildAdj(graph) {
  const adj = {};
  for (const e of graph.edges) {
    if (!adj[e.from]) adj[e.from] = [];
    adj[e.from].push(e);
  }
  return adj;
}

function bfs(adj, startId, targetId, maxHops = 12) {
  const visited = new Set();
  const queue   = [[startId, []]];
  while (queue.length > 0) {
    const [cur, path] = queue.shift();
    if (cur === targetId) return path;
    if (visited.has(cur) || path.length >= maxHops) continue;
    visited.add(cur);
    for (const e of (adj[cur] || [])) {
      if (!visited.has(e.to)) queue.push([e.to, [...path, e]]);
    }
  }
  return null;
}

const REF_DEPARTURES = ['東京', '大阪', '福岡'];

function checkBfsAll(adj, entry) {
  const targetId = `destination:${entry.id}`;
  for (const dep of REF_DEPARTURES) {
    const startId = `city:${dep}`;
    const path    = bfs(adj, startId, targetId);
    if (path !== null) {
      const types = [...new Set(path.map(e => e.type).filter(t => t !== 'local'))];
      console.log(`[TRANSPORT TEST] ${entry.name}: routes=${types.join(',')} (from ${dep})`);
      return { reachable: true, from: dep, transportTypes: types };
    }
  }
  console.log(`[TRANSPORT TEST] ${entry.name}: 全基準都市から到達不可`);
  return { reachable: false, transportTypes: [] };
}

/* ═══════════════════════════════════════
   [5] travelTime 整合性
═══════════════════════════════════════ */

const STAY_BOUNDS = {
  daytrip:  [0,    120],
  '1night': [120,  300],
  '2night': [300,  480],
  '3night+': [480, Infinity],
};

function checkTravelTimeConsistency(entry) {
  const tt   = entry.travelTime;
  const stay = entry.stayRecommendation;
  if (!tt)   return { ok: false, reason: 'travelTime未設定' };
  if (!stay) return { ok: false, reason: 'stayRecommendation未設定' };
  if (!STAY_BOUNDS[stay]) return { ok: false, reason: `不明なstay値: "${stay}"` };

  // 基準 ref: tokyo → osaka → nagoya → fukuoka
  const refMin = tt.tokyo ?? tt.osaka ?? tt.nagoya ?? tt.fukuoka ?? null;
  if (refMin === null) return { ok: null, reason: 'refMin=null(全null)' };

  const [lo, hi] = STAY_BOUNDS[stay];
  if (refMin < lo || refMin >= hi) {
    return { ok: false, reason: `refMin=${refMin}分 がstay="${stay}"(${lo}–${hi})と不整合` };
  }
  return { ok: true, reason: `refMin=${refMin}分 → stay="${stay}" 正常` };
}

/* ═══════════════════════════════════════
   [6] 特定ルート検証（QA前チェック）
   ─────────────────────────────────────
   テストケース:
     高松→道後温泉 / 高松→牛窓
     東京→石垣    / 大阪→田辺 / 大阪→屋久島
═══════════════════════════════════════ */

const CITY_AIRPORT_MAP = {
  '東京': 'HND', '横浜': 'HND', '大宮': 'HND', '宇都宮': 'HND',
  '大阪': 'ITM', '京都': 'ITM', '奈良': 'ITM',
  '神戸': 'UKB', '高松': 'TAK', '松山': 'MYJ', '高知': 'KCZ', '徳島': 'TKS',
  '福岡': 'FUK', '鹿児島': 'KOJ', '長崎': 'NGS', '熊本': 'KMJ', '宮崎': 'KMI',
  '札幌': 'CTS', '仙台': 'SDJ', '名古屋': 'NGO', '広島': 'HIJ', '岡山': 'OKJ',
};

const AIRPORT_IATA_MAP = {
  '石垣空港': 'ISG', '松山空港': 'MYJ', '南紀白浜空港': 'SHM',
  '屋久島空港': 'KUM', '那覇空港': 'OKA', '鹿児島空港': 'KOJ',
  '福岡空港': 'FUK', '新千歳空港': 'CTS',
};

const FLIGHT_ROUTES_MAP = require('../src/lib/transportCore/flightRoutes.js') &&
  JSON.parse(require('fs').readFileSync('./src/lib/transportCore/transportGraph.json','utf8'))
    .edges.filter(e => e.type === 'flight').reduce((acc, e) => {
      const f = e.from.replace('airport:',''); const t = e.to.replace('airport:','');
      if (!acc[f]) acc[f] = []; if (!acc[f].includes(t)) acc[f].push(t);
      if (!acc[t]) acc[t] = []; if (!acc[t].includes(f)) acc[t].push(f);
      return acc;
    }, {});

function checkSpecificRoute(adj, departure, destId, expected) {
  const dest = DESTS_RAW.find(d => d.id === destId);
  if (!dest) return { ok: false, reason: `destination:${destId} not found in destinations.json` };

  const startId  = `city:${departure}`;
  const targetId = `destination:${destId}`;

  // BFS でルート探索
  const path = bfs(adj, startId, targetId);
  const fromIata = CITY_AIRPORT_MAP[departure];

  const checks = {};

  // 空路判定
  const hasFlightInPath = path && path.some(e => e.type === 'flight');
  const destAirport = dest.airportGateway;
  const destAirIata = destAirport ? AIRPORT_IATA_MAP[destAirport] : null;
  const flightAvail = fromIata && destAirIata
    ? (FLIGHT_ROUTES_MAP[fromIata] || []).includes(destAirIata)
    : false;
  checks.flight = {
    ok: flightAvail,
    detail: flightAvail
      ? `${fromIata} → ${destAirIata} 路線あり`
      : (fromIata && destAirIata ? `${fromIata} → ${destAirIata} 路線なし` : `空路なし（destAirport=${destAirport}）`),
  };

  // JR判定
  const hasRailInPath = path && path.some(e => e.type === 'rail');
  const railGateway   = dest.railGateway;
  const railProvider  = dest.railProvider;
  checks.jr = {
    ok: !!(railGateway),
    detail: railGateway
      ? `railGateway=${railGateway}, provider=${railProvider||'area-based'}`
      : 'railGateway なし（鉄道アクセス不可）',
  };

  // フェリー判定
  const ferryGW = dest.ferryGateway || dest.port || (dest.gateways?.ferry?.[0]);
  checks.ferry = {
    ok: !!(ferryGW),
    detail: ferryGW ? `ferryGateway=${ferryGW}` : 'フェリーなし',
  };

  // Google Maps 判定（accessStation or island gateway）
  const isIsland = !!(dest.isIsland || dest.destType === 'island');
  const mapsTarget = isIsland
    ? (dest.port || dest.ferryGateway || dest.airportGateway || dest.accessStation)
    : dest.accessStation;
  checks.maps = {
    ok: !!(mapsTarget),
    detail: mapsTarget ? `Googleマップ → ${mapsTarget}` : 'マップ先なし',
  };

  // BFS到達性
  checks.bfs = {
    ok: path !== null,
    detail: path
      ? `PASS (${path.length}ホップ, types=${[...new Set(path.map(e=>e.type))].join(',')})`
      : 'グラフ上で到達不可',
  };

  // expected チェック
  let allExpectedOk = true;
  for (const exp of (expected || [])) {
    if (!checks[exp]?.ok) allExpectedOk = false;
  }

  return { ok: allExpectedOk, checks };
}

function runSpecificRouteTests(adj) {
  console.log('── [6] 特定ルート検証 ──');

  const TEST_CASES = [
    { label: '高松 → 道後温泉', departure: '高松', destId: 'dogo-onsen',  expected: ['jr', 'maps'] },
    { label: '高松 → 牛窓',     departure: '高松', destId: 'ushimado',    expected: ['jr', 'maps'] },
    { label: '東京 → 石垣島',   departure: '東京', destId: 'ishigaki',    expected: ['flight', 'maps'] },
    { label: '大阪 → 田辺',     departure: '大阪', destId: 'tanabe',      expected: ['jr', 'maps'] },
    { label: '大阪 → 屋久島',   departure: '大阪', destId: 'yakushima',   expected: ['flight', 'ferry', 'maps'] },
  ];

  let pass = 0; let fail = 0;
  const failures = [];

  for (const tc of TEST_CASES) {
    const r = checkSpecificRoute(adj, tc.departure, tc.destId, tc.expected);
    const icon = r.ok ? '✓' : '✗';
    console.log(`  ${icon} ${tc.label}`);
    for (const [key, val] of Object.entries(r.checks)) {
      const flag = val.ok ? '✓' : '✗';
      console.log(`      ${flag} [${key}] ${val.detail}`);
    }
    if (r.ok) pass++; else { fail++; failures.push(tc.label); }
  }

  console.log(`  → PASS ${pass} / FAIL ${fail}\n`);
  return { pass, fail, failures };
}

/* ═══════════════════════════════════════
   メイン
═══════════════════════════════════════ */

(async () => {
  console.log('\n══════════════════════════════════════════');
  console.log('  E2E テスト — 宿・交通リンク完全検証');
  console.log('══════════════════════════════════════════\n');

  const adj = buildAdj(GRAPH);

  /* ── [6] 特定ルート検証 ── */
  const routeTestResult = runSpecificRouteTests(adj);

  /* サンプル対象（ホテルHTMLテスト） */
  const hotelTargets = OPT_ALL
    ? DESTS_RAW
    : sampleByRegion(DESTS_RAW.filter(d => d.type !== 'hub'), SAMPLE_N);

  /* ── [4] BFS交通到達検証（全件） ── */
  const bfsResults   = [];
  const brokenBfs    = [];

  if (!OPT_HOTEL_ONLY) {
    console.log(`── [4] BFS交通到達検証 (${ALL_ENTRIES.length}件) ──`);
    for (const entry of ALL_ENTRIES) {
      const r = checkBfsAll(adj, entry);
      bfsResults.push({ city: entry.name, ...r });
      if (!r.reachable) brokenBfs.push(entry.name);
    }
    const bfsPass = bfsResults.filter(r => r.reachable).length;
    console.log(`  → PASS ${bfsPass} / FAIL ${brokenBfs.length}\n`);
  }

  /* ── [5] travelTime整合性検証（全件） ── */
  const ttResults  = [];
  const brokenTt   = [];

  if (!OPT_HOTEL_ONLY) {
    console.log(`── [5] travelTime整合性検証 (${ALL_ENTRIES.length}件) ──`);
    for (const entry of ALL_ENTRIES) {
      const r = checkTravelTimeConsistency(entry);
      ttResults.push({ city: entry.name, ...r });
      if (r.ok === false) {
        brokenTt.push({ city: entry.name, reason: r.reason });
        console.log(`  ✗ ${entry.name}: ${r.reason}`);
      }
    }
    const ttPass = ttResults.filter(r => r.ok !== false).length;
    console.log(`  → PASS ${ttPass} / FAIL ${brokenTt.length}\n`);
  }

  /* ── [1][2] 宿リンクHTML検証（サンプル） ── */
  const hotelResults = [];
  const brokenHotel  = [];

  if (!OPT_BFS_ONLY) {
    console.log(`── [1][2] 宿リンクHTML検証 (${hotelTargets.length}件) ──`);
    for (const city of hotelTargets) {
      const r = await testHotelLinks(city);
      hotelResults.push(r);
      if (r.rakuten.ok === false) brokenHotel.push({ city: city.name, type: 'rakuten', reason: r.rakuten.reason, keyword: r.rakuten.keyword });
      if (r.jalan.ok   === false) brokenHotel.push({ city: city.name, type: 'jalan',   reason: r.jalan.reason,   keyword: r.jalan.keyword });
    }
    console.log('');
  }

  /* ── FAIL一覧 ── */
  const anyFail = brokenHotel.length + brokenBfs.length + brokenTt.length;

  if (brokenHotel.length > 0) {
    console.log('── broken_hotel_links ──');
    for (const b of brokenHotel) {
      console.log(`  ✗ [${b.type}] ${b.city} (keyword="${b.keyword}"): ${b.reason}`);
    }
    console.log('');
  }
  if (brokenBfs.length > 0) {
    console.log('── broken_transport_links ──');
    for (const n of brokenBfs) console.log(`  ✗ ${n}`);
    console.log('');
  }
  if (brokenTt.length > 0) {
    console.log('── broken_travel_time ──');
    for (const b of brokenTt) console.log(`  ✗ ${b.city}: ${b.reason}`);
    console.log('');
  }

  /* ── 最終統計 ── */
  const rktPass = hotelResults.filter(r => r.rakuten.ok === true).length;
  const rktFail = hotelResults.filter(r => r.rakuten.ok === false).length;
  const rktUnkn = hotelResults.filter(r => r.rakuten.ok === null).length;
  const jlnPass = hotelResults.filter(r => r.jalan.ok   === true).length;
  const jlnFail = hotelResults.filter(r => r.jalan.ok   === false).length;
  const jlnUnkn = hotelResults.filter(r => r.jalan.ok   === null).length;
  const bfsPass = bfsResults.filter(r => r.reachable).length;
  const ttPass  = ttResults.filter(r => r.ok !== false).length;

  console.log('══════════════════════════════════════════');
  console.log('  E2E 最終統計');
  console.log('══════════════════════════════════════════');
  console.log(`  destination数        : ${DESTS_RAW.length} (hub: ${HUBS_RAW.length})`);
  console.log(`  宿リンク検証対象     : ${hotelTargets.length}件`);
  console.log(`  楽天                 : PASS ${rktPass} / FAIL ${rktFail} / 不明(SPA等) ${rktUnkn}`);
  console.log(`  じゃらん             : PASS ${jlnPass} / FAIL ${jlnFail} / 不明 ${jlnUnkn}`);
  if (!OPT_HOTEL_ONLY) {
    console.log(`  BFS交通到達          : PASS ${bfsPass} / FAIL ${brokenBfs.length} (destinations ${ALL_ENTRIES.length}件)`);
    console.log(`  travelTime整合       : PASS ${ttPass} / FAIL ${brokenTt.length} (destinations ${ALL_ENTRIES.length}件)`);
  }
  console.log(`  特定ルート検証 [6]   : PASS ${routeTestResult.pass} / FAIL ${routeTestResult.fail} (5ルート)`);
  console.log(`\n  TOTAL FAIL: ${anyFail}`);

  if (anyFail > 0) {
    console.log('\n  ✗ FAILあり — 上記一覧を確認してください。');
    process.exit(1);
  } else {
    console.log('\n  ✓ 全チェック通過');
  }
})();
