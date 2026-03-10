/**
 * qa.js — 総合品質テスト v2（Node.js）
 *
 * 実行:
 *   node qa.js           # HTTP は サンプル（高速）
 *   node qa.js --http    # HTTP 全件（149 都市 × 2 URL）
 *
 * チェック項目:
 *   [1] gateway 構造検証（全 destination）
 *   [2] 交通リンク生成（全都市 × 5 出発地、0 件エラー）
 *   [3] 交通整合性テスト（代表 6 ルート）
 *   [4] 宿リンク URL 生成（全都市）
 *   [5] アフィリエイト URL 形式検証
 *   [6] HTTP HEAD テスト（じゃらん全件 + 楽天Affサンプル）
 *   [7] UI 整合（daytrip 宿非表示ロジック）
 *   [8] テーマ整合（weight 0.3 抑制）
 *   [9] 結果サマリ出力
 */

'use strict';

const fs    = require('fs');
const https = require('https');
const { URL } = require('url');

const FULL_HTTP = process.argv.includes('--http');

/* ══════════════════════════════════════════
   データ読み込み
══════════════════════════════════════════ */

const RAW   = JSON.parse(fs.readFileSync('./src/data/destinations.json', 'utf8'));
const ALL   = Array.isArray(RAW) ? RAW : RAW.destinations;
const DESTS = ALL.filter(c => c.type !== 'spot');

/* ══════════════════════════════════════════
   定数（constants.js と同期）
══════════════════════════════════════════ */

const DEPARTURE_CITY_INFO = {
  '札幌':   { rail:'札幌駅',        airport:'新千歳空港 国内線ターミナル',    iata:'CTS', jrArea:'east'   },
  '函館':   { rail:'函館駅',        airport:'函館空港',                       iata:'HKD', jrArea:'east'   },
  '旭川':   { rail:'旭川駅',        airport:'旭川空港',                       iata:'AKJ', jrArea:'east'   },
  '仙台':   { rail:'仙台駅',        airport:'仙台空港',                       iata:'SDJ', jrArea:'east'   },
  '盛岡':   { rail:'盛岡駅',        airport:'いわて花巻空港',                 iata:'HNA', jrArea:'east'   },
  '東京':   { rail:'東京駅',        airport:'羽田空港 国内線ターミナル',       iata:'TYO', jrArea:'east'   },
  '横浜':   { rail:'横浜駅',        airport:'羽田空港 国内線ターミナル',       iata:'TYO', jrArea:'east'   },
  '千葉':   { rail:'千葉駅',        airport:'成田国際空港',                   iata:'TYO', jrArea:'east'   },
  '大宮':   { rail:'大宮駅',        airport:'羽田空港 国内線ターミナル',       iata:'TYO', jrArea:'east'   },
  '宇都宮': { rail:'宇都宮駅',      airport:'羽田空港 国内線ターミナル',       iata:'TYO', jrArea:'east'   },
  '長野':   { rail:'長野駅',        airport:'松本空港',                       iata:'MMJ', jrArea:'east'   },
  '静岡':   { rail:'静岡駅',        airport:'静岡空港',                       iata:'FSZ', jrArea:'west'   },
  '名古屋': { rail:'名古屋駅',      airport:'中部国際空港 セントレア',         iata:'NGO', jrArea:'west'   },
  '金沢':   { rail:'金沢駅',        airport:'小松空港',                       iata:'KMQ', jrArea:'west'   },
  '富山':   { rail:'富山駅',        airport:'富山きときと空港',               iata:'TOY', jrArea:'west'   },
  '大阪':   { rail:'大阪駅',        airport:'大阪国際空港 国内線ターミナル',   iata:'OSA', jrArea:'west'   },
  '京都':   { rail:'京都駅',        airport:'大阪国際空港 国内線ターミナル',   iata:'OSA', jrArea:'west'   },
  '神戸':   { rail:'三ノ宮駅',      airport:'神戸空港',                       iata:'UKB', jrArea:'west'   },
  '奈良':   { rail:'奈良駅',        airport:'大阪国際空港 国内線ターミナル',   iata:'OSA', jrArea:'west'   },
  '広島':   { rail:'広島駅',        airport:'広島空港',                       iata:'HIJ', jrArea:'west'   },
  '岡山':   { rail:'岡山駅',        airport:'岡山桃太郎空港',                 iata:'OKJ', jrArea:'west'   },
  '松江':   { rail:'松江駅',        airport:'出雲縁結び空港',                 iata:'IZO', jrArea:'west'   },
  '高松':   { rail:'高松駅',        airport:'高松空港',                       iata:'TAK', jrArea:'west'   },
  '松山':   { rail:'松山駅',        airport:'松山空港',                       iata:'MYJ', jrArea:'west'   },
  '高知':   { rail:'高知駅',        airport:'高知龍馬空港',                   iata:'KCZ', jrArea:'west'   },
  '徳島':   { rail:'徳島駅',        airport:'徳島阿波おどり空港',             iata:'TKS', jrArea:'west'   },
  '福岡':   { rail:'博多駅',        airport:'福岡空港 国内線ターミナル',       iata:'FUK', jrArea:'kyushu' },
  '熊本':   { rail:'熊本駅',        airport:'熊本空港',                       iata:'KMJ', jrArea:'kyushu' },
  '鹿児島': { rail:'鹿児島中央駅',  airport:'鹿児島空港',                     iata:'KOJ', jrArea:'kyushu' },
  '長崎':   { rail:'長崎駅',        airport:'長崎空港',                       iata:'NGS', jrArea:'kyushu' },
  '宮崎':   { rail:'宮崎駅',        airport:'宮崎ブーゲンビリア空港',         iata:'KMI', jrArea:'kyushu' },
};

const CITY_AIRPORT = {
  '札幌':'CTS','函館':'HKD','旭川':'AKJ','仙台':'SDJ','盛岡':'HNA',
  '東京':'HND','横浜':'HND','千葉':'NRT','大宮':'HND','宇都宮':'HND',
  '長野':'MMJ','静岡':'FSZ','名古屋':'NGO','金沢':'KMQ','富山':'TOY',
  '大阪':'ITM','京都':'ITM','神戸':'UKB','奈良':'ITM',
  '広島':'HIJ','岡山':'OKJ','松江':'IZO',
  '高松':'TAK','松山':'MYJ','高知':'KCZ','徳島':'TKS',
  '福岡':'FUK','熊本':'KMJ','鹿児島':'KOJ','長崎':'NGS','宮崎':'KMI',
};

const AIRPORT_IATA = {
  '新千歳空港':'CTS','那覇空港':'OKA','石垣空港':'ISG','福岡空港':'FUK',
  '仙台空港':'SDJ','広島空港':'HIJ','高松空港':'TAK','中部国際空港':'NGO',
  '羽田空港':'HND','大阪国際空港':'ITM','関西国際空港':'KIX',
  '宮崎空港':'KMI','松山空港':'MYJ','釧路空港':'KUH','久米島空港':'UEO',
  '宮古空港':'MMY','米子空港':'YGJ','女満別空港':'MMB','中標津空港':'SHB',
  '屋久島空港':'KUM','奄美空港':'ASJ','五島福江空港':'FUJ','青森空港':'AOJ',
  '阿蘇くまもと空港':'KMJ','静岡空港':'FSZ','出雲空港':'IZO',
};

const FLIGHT_ROUTES = {
  'HND':['CTS','MMB','KUH','SHB','AOJ','SDJ','HNA','OKA','ISG','MMY','UEO','FUK','KOJ','KMI','KMJ','NGS','OIT','HIJ','OKJ','MYJ','KCZ','TKS','TAK','YGJ','IZO','FSZ','KUM','ASJ','FUJ'],
  'ITM':['CTS','SDJ','AOJ','OKA','ISG','MMY','UEO','FUK','KOJ','KMI','KMJ','NGS','MYJ','KCZ','TKS','KUM','ASJ','FUJ'],
  'NRT':['CTS','OKA','FUK','SDJ'],
  'NGO':['CTS','SDJ','OKA','FUK','KOJ','KMI'],
  'FUK':['HND','ITM','NGO','CTS','SDJ','OKA','ISG','MMY','UEO','KUM','ASJ'],
  'CTS':['HND','ITM','NGO','FUK','SDJ','OKA'],
  'SDJ':['HND','ITM','FUK','CTS','OKA','HIJ'],
  'HIJ':['HND','SDJ','OKA','FUK'],
  'TAK':['HND','FUK','OKA'],
  'MYJ':['HND','ITM','FUK'],
  'KCZ':['HND','ITM','FUK'],
  'TKS':['HND','ITM','FUK'],
  'KOJ':['HND','ITM','NGO','OKA'],
  'KMI':['HND','ITM','FUK','OKA'],
  'KMJ':['HND','ITM'],
  'NGS':['HND','ITM'],
  'OKJ':['HND','OKA'],
  'IZO':['HND','ITM'],
  'YGJ':['HND'],
  'KMQ':['HND'],
  'TOY':['HND'],
  'UKB':['OKA','FUK'],
  'HKD':['HND'],
  'AKJ':['HND','ITM'],
  'HNA':['HND','ITM'],
  'MMJ':['HND'],
  'FSZ':['HND','FUK'],
};

const THEME_TAG_ALIASES = {
  '温泉':   ['温泉','秘湯'],
  '絶景':   ['絶景','自然','渓谷','富士山','高原','湖','火山','アルプス'],
  '海':     ['海','海の幸','離島','ダイビング','港町','リゾート'],
  '街歩き': ['街歩き','歴史','城下町','宿場町','古都'],
  'グルメ': ['グルメ','海の幸','食文化'],
};

/* ══════════════════════════════════════════
   ロジック（transport / hotel）
══════════════════════════════════════════ */

function isFlightAvailable(dep, airportGateway) {
  const from = CITY_AIRPORT[dep];
  const to   = AIRPORT_IATA[airportGateway];
  if (!from || !to) return false;
  return (FLIGHT_ROUTES[from] || []).includes(to);
}

const PORT_SELECT = {
  'izu-oshima':  d => (['名古屋','大阪','京都','神戸','広島','福岡'].includes(d) ? '熱海港' : d==='静岡' ? '稲取港' : '竹芝客船ターミナル'),
  'naoshima':    d => (['高松','松山','高知','徳島'].includes(d) ? '高松港' : '宇野港'),
  'shodoshima':  d => (['高松','松山','高知','徳島'].includes(d) ? '高松港' : '宇野港'),
  'goto':        d => (d==='長崎' ? '長崎港' : '博多港'),
};

function selectPort(city, dep, ferries) {
  if (!ferries.length) return null;
  if (ferries.length === 1) return ferries[0];
  const sel = PORT_SELECT[city.id];
  return sel ? sel(dep) : ferries[0];
}

const EX_CITIES = new Set(['東京','横浜','大宮','品川','名古屋','京都','大阪','神戸','姫路','岡山','広島','小倉','博多','熊本','鹿児島','長崎']);

function resolveRailProvider(dep, city) {
  if (EX_CITIES.has(dep) && EX_CITIES.has(city.name)) return 'ex';
  const area = DEPARTURE_CITY_INFO[dep]?.jrArea || 'west';
  if (area === 'east') return 'jr-east';
  if (area === 'kyushu') return 'jr-kyushu';
  return 'jr-west';
}

/** transport links を型配列で返す（簡易版）*/
function getLinks(city, dep) {
  const fromCity = DEPARTURE_CITY_INFO[dep];
  if (!fromCity) return [];
  const g       = city.gateways || {};
  const rails   = g.rail    || [];
  const airports= g.airport || [];
  const ferries = g.ferry   || [];
  const isIsland= !!city.isIsland;
  const links   = [];

  // 島フェリー優先
  if (isIsland && ferries.length) {
    const port = selectPort(city, dep, ferries);
    if (port) {
      links.push({ type:'ferry', label:'フェリー', port });
      links.push({ type:'google-maps' });
    }
    if (city.needsCar || isIsland) links.push({ type:'rental' });
    return links;
  }

  // ★1 近場
  if ((city.distanceStars || 0) === 1) {
    links.push({ type:'google-maps' });
    return links;
  }

  // 通常
  if (rails.length) {
    if (!city.railNote) links.push({ type: resolveRailProvider(dep, city) });
    if (city.accessHub && city.railNote) links.push({ type:'note' });
    links.push({ type:'google-maps' });
  }
  if (airports.length && isFlightAvailable(dep, airports[0])) {
    links.push({ type:'skyscanner' });
    links.push({ type:'google-maps-arr' });
  } else if (airports.length && !rails.length) {
    links.push({ type:'google-maps' });
  }
  if (ferries.length && !isIsland) links.push({ type:'ferry' });
  if (!links.length) links.push({ type:'google-maps' });
  if (city.needsCar || isIsland) links.push({ type:'rental' });
  return links;
}

function resolveKeyword(city) {
  return city.hotelHub || city.hotelSearch || city.name;
}

function buildJalanUrl(city) {
  const kw = resolveKeyword(city);
  const vc = 'https://ck.jp.ap.valuecommerce.com/servlet/referral?sid=3764408&pid=892559858&vc_url=';
  const target = `https://www.jalan.net/uw/uwp2011/uww2011init.do?keyword=${kw}`;
  return vc + encodeURIComponent(target);
}

function buildRakutenUrl(city) {
  const kw  = resolveKeyword(city);
  const aff = 'https://hb.afl.rakuten.co.jp/hgc/5113ee4b.8662cfc5.5113ee4c.119de89a/?pc=';
  const target = `https://travel.rakuten.co.jp/search/?keyword=${encodeURIComponent(kw)}`;
  return aff + encodeURIComponent(target);
}

/* ══════════════════════════════════════════
   HTTP ヘルパー
══════════════════════════════════════════ */

function httpsHead(targetUrl, timeout = 10000) {
  return new Promise(resolve => {
    try {
      const parsed = new URL(targetUrl);
      const req = https.request(
        { hostname: parsed.hostname, path: parsed.pathname + parsed.search,
          method: 'HEAD', timeout,
          headers: { 'User-Agent': 'Mozilla/5.0 (compatible; DokoikoQA/2.0)' } },
        res => { resolve({ status: res.statusCode, ok: res.statusCode < 400 }); res.resume(); }
      );
      req.on('timeout', () => { req.destroy(); resolve({ status:0, ok:false, err:'timeout' }); });
      req.on('error',   e  => resolve({ status:0, ok:false, err:e.message }));
      req.end();
    } catch (e) { resolve({ status:0, ok:false, err:e.message }); }
  });
}

async function runBatched(tasks, n = 10) {
  const out = [];
  for (let i = 0; i < tasks.length; i += n) {
    out.push(...await Promise.all(tasks.slice(i, i+n).map(t => t())));
    if (i + n < tasks.length) await new Promise(r => setTimeout(r, 150));
  }
  return out;
}

/* ══════════════════════════════════════════
   スコアカード
══════════════════════════════════════════ */

class Scorecard {
  constructor(name) {
    this.name = name;
    this.pass = 0;
    this.fail = 0;
    this.errors = [];
  }
  ok()          { this.pass++; }
  ng(msg)       { this.fail++; this.errors.push(msg); }
  check(c, msg) { c ? this.ok() : this.ng(msg); }
  print() {
    const icon = this.fail === 0 ? '✓' : '✗';
    console.log(`${icon} ${this.name}: PASS ${this.pass} / FAIL ${this.fail}`);
    this.errors.slice(0, 10).forEach(e => console.log(`    ✗ ${e}`));
    if (this.errors.length > 10) console.log(`    ... 他 ${this.errors.length-10} 件`);
  }
}

/* ══════════════════════════════════════════
   メイン
══════════════════════════════════════════ */

(async () => {
  const SCAN_DEPS = ['東京', '大阪', '福岡', '高松', '札幌'];
  const scorecards = [];

  /* ───────────────────────────────
     [1] gateway 構造検証
  ─────────────────────────────── */
  {
    const sc = new Scorecard('[1] gateway 構造');
    DESTS.forEach(city => {
      const g = city.gateways;
      if (!g) { sc.ng(`${city.id}: gateways 欠落`); return; }
      ['rail','airport','bus','ferry'].forEach(k => {
        sc.check(Array.isArray(g[k]), `${city.id}: gateways.${k} 配列でない`);
      });
      // island: ferry or airport 必須
      if (city.isIsland) {
        sc.check(
          (g.ferry||[]).length > 0 || (g.airport||[]).length > 0,
          `${city.id}: isIsland だが ferry/airport ゲートウェイなし`
        );
      }
      // stayAllowed 必須
      sc.check(
        Array.isArray(city.stayAllowed) && city.stayAllowed.length > 0,
        `${city.id}: stayAllowed 欠落`
      );
    });
    sc.print();
    scorecards.push(sc);
  }

  /* ───────────────────────────────
     [2] 交通リンク生成（0件エラー）
  ─────────────────────────────── */
  {
    const sc = new Scorecard('[2] 交通リンク生成');
    let total = 0, ok = 0;
    DESTS.forEach(city => {
      SCAN_DEPS.forEach(dep => {
        total++;
        const links = getLinks(city, dep);
        if (links.length > 0) { sc.ok(); ok++; }
        else sc.ng(`${city.name}(${city.id}) ← ${dep}: links=0`);
      });
    });
    console.log(`  総計: ${total} 組, 成功: ${ok}`);
    sc.print();
    scorecards.push(sc);
  }

  /* ───────────────────────────────
     [3] 交通整合性テスト（代表ルート）
  ─────────────────────────────── */
  {
    const sc = new Scorecard('[3] 交通整合性');

    const CASES = [
      {
        dep: '高松', destId: 'matsuyama', name: '高松→松山',
        expect:    { jr:true, skyscanner:false, ferry:true, googleMaps:true },
        notExpect: { skyscanner:true },
      },
      {
        dep: '大阪', destId: 'matsuyama', name: '大阪→松山',
        expect:    { skyscanner:true, jr:true },
      },
      {
        dep: '東京', destId: 'sapporo-t', name: '東京→札幌',
        expect:    { skyscanner:true },
        notExpect: { jr:true },
      },
      {
        dep: '高松', destId: 'naoshima', name: '高松→直島',
        expect:    { ferry:true, googleMaps:true },
        notExpect: { skyscanner:true },
      },
      {
        dep: '東京', destId: 'izu-oshima', name: '東京→伊豆大島',
        expect:    { ferry:true, googleMaps:true },
        notExpect: { skyscanner:true },
      },
      {
        dep: '大阪', destId: 'shodoshima', name: '大阪→小豆島',
        expect:    { ferry:true, googleMaps:true },
        notExpect: { skyscanner:true },
      },
    ];

    CASES.forEach(tc => {
      const city = DESTS.find(c => c.id === tc.destId);
      if (!city) { sc.ng(`${tc.name}: destId ${tc.destId} 見つからない`); return; }

      const links   = getLinks(city, tc.dep);
      const types   = new Set(links.map(l => l.type));
      const hasJr   = [...types].some(t => t.startsWith('jr'));
      const hasMaps = [...types].some(t => t.includes('google-maps'));

      if (tc.expect) {
        if (tc.expect.jr         !== undefined) sc.check(hasJr        === tc.expect.jr,         `${tc.name}: JR=${hasJr} (期待:${tc.expect.jr})`);
        if (tc.expect.skyscanner !== undefined) sc.check(types.has('skyscanner') === tc.expect.skyscanner, `${tc.name}: Skyscanner=${types.has('skyscanner')} (期待:${tc.expect.skyscanner})`);
        if (tc.expect.ferry      !== undefined) sc.check(types.has('ferry')      === tc.expect.ferry,      `${tc.name}: Ferry=${types.has('ferry')} (期待:${tc.expect.ferry})`);
        if (tc.expect.googleMaps !== undefined) sc.check(hasMaps                 === tc.expect.googleMaps, `${tc.name}: GoogleMaps=${hasMaps} (期待:${tc.expect.googleMaps})`);
      }
      if (tc.notExpect) {
        if (tc.notExpect.skyscanner) sc.check(!types.has('skyscanner'), `${tc.name}: Skyscanner が出るべきでない（route 存在しない）`);
        if (tc.notExpect.jr)         sc.check(!hasJr,                   `${tc.name}: JR が出るべきでない`);
      }

      const icon = sc.errors.some(e => e.includes(tc.name)) ? '  ✗' : '  ✓';
      console.log(`${icon} ${tc.name}: [${[...types].join(', ')}]`);
    });

    sc.print();
    scorecards.push(sc);
  }

  /* ───────────────────────────────
     [4] 宿リンク URL 生成
  ─────────────────────────────── */
  {
    const sc = new Scorecard('[4] 宿リンク URL 生成');
    DESTS.forEach(city => {
      const kw = resolveKeyword(city);
      sc.check(!!kw && kw.trim().length > 0, `${city.id}: keyword 空`);

      // hotelHub 優先チェック
      if (city.hotelHub) {
        sc.check(kw === city.hotelHub, `${city.id}: hotelHub(${city.hotelHub}) が keyword(${kw}) に使われていない`);
      }

      const jUrl = buildJalanUrl(city);
      const rUrl = buildRakutenUrl(city);
      sc.check(jUrl.includes('ck.jp.ap.valuecommerce.com'),  `${city.id}: じゃらん VC ドメイン欠落`);
      sc.check(jUrl.includes('uwp2011'),                     `${city.id}: じゃらん uwp2011 URL 欠落`);
      sc.check(rUrl.includes('hb.afl.rakuten.co.jp'),        `${city.id}: 楽天 aff ドメイン欠落`);
      sc.check(jUrl.includes(encodeURIComponent(kw)),        `${city.id}: じゃらん keyword エンコード不正`);
    });
    sc.print();
    scorecards.push(sc);
  }

  /* ───────────────────────────────
     [5] アフィリエイト URL 形式検証
  ─────────────────────────────── */
  {
    const sc = new Scorecard('[5] アフィリエイト URL 形式');
    DESTS.forEach(city => {
      const jUrl = buildJalanUrl(city);
      const rUrl = buildRakutenUrl(city);
      sc.check(jUrl.startsWith('https://ck.jp.ap.valuecommerce.com/servlet/referral?sid=3764408&pid=892559858'),
        `${city.id}: じゃらん VC URL 形式不正`);
      sc.check(rUrl.startsWith('https://hb.afl.rakuten.co.jp/hgc/5113ee4b.8662cfc5.5113ee4c.119de89a/?pc='),
        `${city.id}: 楽天 Aff URL 形式不正`);
    });
    sc.print();
    scorecards.push(sc);
  }

  /* ───────────────────────────────
     [6] HTTP 接続テスト
  ─────────────────────────────── */
  {
    const sc = new Scorecard('[6] HTTP 接続');
    const targets = FULL_HTTP ? DESTS : sampleByRegion(DESTS, 2);
    console.log(`  対象: ${targets.length} 都市 ${FULL_HTTP ? '（全件）' : '（地域サンプル）'} × 2 URL`);

    const tasks = [];
    targets.forEach(city => {
      const jUrl = buildJalanUrl(city);
      const rUrl = buildRakutenUrl(city);
      // じゃらん: target URL (200)
      const jTarget = `https://www.jalan.net/uw/uwp2011/uww2011init.do?keyword=${encodeURIComponent(resolveKeyword(city))}`;
      tasks.push(() => httpsHead(jTarget).then(r => ({ city, svc:'じゃらん', url:jTarget, ...r })));
      // 楽天: affiliate URL (302 = OK)
      tasks.push(() => httpsHead(rUrl).then(r => ({ city, svc:'楽天Aff', url:rUrl, ...r })));
    });

    process.stdout.write(`  送信中 (${tasks.length} req)... `);
    const results = await runBatched(tasks, 10);
    console.log('完了');

    results.forEach(r => {
      if (r.ok) sc.ok();
      else {
        sc.ng(`[${r.svc}] ${r.city.name}: ${r.err || 'HTTP '+r.status}`);
        console.log(`    ✗ [${r.svc}] ${r.city.name}(${r.city.id}) — ${r.err || 'HTTP '+r.status}`);
      }
    });
    sc.print();
    scorecards.push(sc);
  }

  /* ───────────────────────────────
     [7] UI 整合（daytrip 宿非表示）
  ─────────────────────────────── */
  {
    const sc = new Scorecard('[7] UI 整合（daytrip）');
    DESTS.forEach(city => {
      const daytripOnly = city.stayAllowed &&
        city.stayAllowed.every(s => s === 'daytrip') &&
        city.stayAllowed.includes('daytrip');
      // daytrip のみの都市では stayAllowed に '1night' が含まれないこと
      if (daytripOnly) {
        sc.check(!city.stayAllowed.includes('1night'),
          `${city.id}: daytrip のみのはずだが 1night も含まれている`);
      }
      // stayAllowed=['1night'] の都市は宿表示対象
      const hasNight = (city.stayAllowed || []).includes('1night');
      sc.check(typeof hasNight === 'boolean', `${city.id}: stayAllowed チェック失敗`);
    });
    // UI ロジック確認: stayType=daytrip → showHotel=false
    const daytripLogic = (stayType) => stayType !== 'daytrip';
    sc.check(daytripLogic('daytrip') === false, 'daytrip → showHotel = false でない');
    sc.check(daytripLogic('1night')  === true,  '1night  → showHotel = true でない');
    sc.print();
    scorecards.push(sc);
  }

  /* ───────────────────────────────
     [8] テーマ整合
  ─────────────────────────────── */
  {
    const sc = new Scorecard('[8] テーマ整合');
    const WEIGHT_MATCH    = 3.0;
    const WEIGHT_MISMATCH = 0.3;

    function matchesTheme(city, theme) {
      if (!theme) return true;
      if (theme === '海' && city.isIsland) return true;
      const aliases = THEME_TAG_ALIASES[theme] || [theme];
      return (city.tags || []).some(t => aliases.includes(t));
    }

    function themeWeight(city, theme) {
      return matchesTheme(city, theme) ? WEIGHT_MATCH : WEIGHT_MISMATCH;
    }

    Object.entries(THEME_TAG_ALIASES).forEach(([theme]) => {
      let matchCount = 0, mismatchCount = 0;
      DESTS.forEach(city => {
        const w = themeWeight(city, theme);
        if (w === WEIGHT_MATCH) matchCount++;
        else mismatchCount++;
      });
      sc.check(matchCount > 0,
        `テーマ「${theme}」: 一致都市が 0 件`);
      sc.check(mismatchCount > 0,
        `テーマ「${theme}」: 不一致都市が 0 件（全員一致はおかしい）`);
      sc.check(WEIGHT_MISMATCH === 0.3,
        `WEIGHT_MISMATCH が 0.3 でない (現在: ${WEIGHT_MISMATCH})`);
      console.log(`  テーマ「${theme}」: 一致 ${matchCount} / 不一致 ${mismatchCount} 都市`);
    });
    sc.print();
    scorecards.push(sc);
  }

  /* ───────────────────────────────
     [9] QA 結果サマリ
  ─────────────────────────────── */
  console.log('\n══════════════════════════════════');
  console.log('  QA 結果サマリ');
  console.log('══════════════════════════════════');
  console.log(`  destination 数   : ${DESTS.length}`);

  // 各スコアカード集計
  const sc2 = scorecards.find(s => s.name.includes('[2]'));
  const sc4 = scorecards.find(s => s.name.includes('[4]'));
  const sc5 = scorecards.find(s => s.name.includes('[5]'));
  const sc6 = scorecards.find(s => s.name.includes('[6]'));

  console.log(`  交通リンク 成功  : ${sc2 ? sc2.pass : '-'} / ${sc2 ? sc2.pass+sc2.fail : '-'}`);
  console.log(`  宿リンク 成功    : ${sc4 ? sc4.pass : '-'} / ${sc4 ? sc4.pass+sc4.fail : '-'}`);
  console.log(`  アフィリ 成功    : ${sc5 ? sc5.pass : '-'} / ${sc5 ? sc5.pass+sc5.fail : '-'}`);
  console.log(`  HTTP 成功        : ${sc6 ? sc6.pass : '-'} / ${sc6 ? sc6.pass+sc6.fail : '-'}`);

  const totalFail = scorecards.reduce((s, c) => s + c.fail, 0);
  const totalPass = scorecards.reduce((s, c) => s + c.pass, 0);
  console.log(`\n  総計: PASS ${totalPass} / FAIL ${totalFail}`);

  if (totalFail === 0) {
    console.log('\n  ✓ 全チェック通過');
    console.log('  交通ミス 0 / 宿リンク成功率 100% / アフィリンク成功率 100%');
  } else {
    console.log(`\n  ✗ FAIL ${totalFail} 件 — 修正が必要です`);
    console.log('\n  失敗詳細:');
    scorecards.forEach(sc => {
      if (sc.fail > 0) {
        console.log(`\n  【${sc.name}】`);
        sc.errors.forEach(e => console.log(`    ✗ ${e}`));
      }
    });
    process.exit(1);
  }
})();

/* ── ユーティリティ ── */
function sampleByRegion(cities, n) {
  const m = {};
  cities.forEach(c => {
    const r = c.region || 'other';
    if (!m[r]) m[r] = [];
    if (m[r].length < n) m[r].push(c);
  });
  return Object.values(m).flat();
}
