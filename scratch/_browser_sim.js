/**
 * _browser_sim.js — ブラウザ動作完全シミュレーション
 *
 * 実行: node _browser_sim.js
 *
 * 検証項目:
 *   [A] 202件全件表示シミュレーション
 *   [B] 宿リンク（楽天/じゃらん）URL構造 + HTTPアクセス検証
 *   [C] Google Maps URL（origin=出発駅, destination=accessStation）
 *   [D] UI フィールド（prefecture/city/accessStation）全件
 *   [E] マップデータ（lat/lng 全件・travelTime カテゴリ）
 *   [F] 200回ランダムシミュレーション（ユーザー操作相当）
 */

'use strict';

const fs    = require('fs');
const https = require('https');
const { URL } = require('url');

/* ═══════════════════════════════
   データ読み込み
═══════════════════════════════ */
const HUBS = JSON.parse(fs.readFileSync('./src/data/hubs.json', 'utf8'));
const DESTS = JSON.parse(fs.readFileSync('./src/data/destinations.json', 'utf8'));
const ALL = [...HUBS, ...DESTS];
const GRAPH = JSON.parse(fs.readFileSync('./src/data/transportGraph.json', 'utf8'));

/* ═══════════════════════════════
   定数（constants.js と同期）
═══════════════════════════════ */
const DEPARTURE_CITY_INFO = {
  '札幌':   { rail:'札幌駅',       iata:'CTS', jrArea:'east'   },
  '函館':   { rail:'函館駅',       iata:'HKD', jrArea:'east'   },
  '旭川':   { rail:'旭川駅',       iata:'AKJ', jrArea:'east'   },
  '仙台':   { rail:'仙台駅',       iata:'SDJ', jrArea:'east'   },
  '盛岡':   { rail:'盛岡駅',       iata:'HNA', jrArea:'east'   },
  '東京':   { rail:'東京駅',       iata:'TYO', jrArea:'east'   },
  '横浜':   { rail:'横浜駅',       iata:'TYO', jrArea:'east'   },
  '千葉':   { rail:'千葉駅',       iata:'TYO', jrArea:'east'   },
  '大宮':   { rail:'大宮駅',       iata:'TYO', jrArea:'east'   },
  '宇都宮': { rail:'宇都宮駅',     iata:'TYO', jrArea:'east'   },
  '長野':   { rail:'長野駅',       iata:'MMJ', jrArea:'east'   },
  '静岡':   { rail:'静岡駅',       iata:'FSZ', jrArea:'west'   },
  '名古屋': { rail:'名古屋駅',     iata:'NGO', jrArea:'west'   },
  '金沢':   { rail:'金沢駅',       iata:'KMQ', jrArea:'west'   },
  '富山':   { rail:'富山駅',       iata:'TOY', jrArea:'west'   },
  '大阪':   { rail:'大阪駅',       iata:'OSA', jrArea:'west'   },
  '京都':   { rail:'京都駅',       iata:'OSA', jrArea:'west'   },
  '神戸':   { rail:'三ノ宮駅',     iata:'UKB', jrArea:'west'   },
  '奈良':   { rail:'奈良駅',       iata:'OSA', jrArea:'west'   },
  '広島':   { rail:'広島駅',       iata:'HIJ', jrArea:'west'   },
  '岡山':   { rail:'岡山駅',       iata:'OKJ', jrArea:'west'   },
  '松江':   { rail:'松江駅',       iata:'IZO', jrArea:'west'   },
  '高松':   { rail:'高松駅',       iata:'TAK', jrArea:'west'   },
  '松山':   { rail:'松山駅',       iata:'MYJ', jrArea:'west'   },
  '高知':   { rail:'高知駅',       iata:'KCZ', jrArea:'west'   },
  '徳島':   { rail:'徳島駅',       iata:'TKS', jrArea:'west'   },
  '福岡':   { rail:'博多駅',       iata:'FUK', jrArea:'kyushu' },
  '熊本':   { rail:'熊本駅',       iata:'KMJ', jrArea:'kyushu' },
  '鹿児島': { rail:'鹿児島中央駅', iata:'KOJ', jrArea:'kyushu' },
  '長崎':   { rail:'長崎駅',       iata:'NGS', jrArea:'kyushu' },
  '宮崎':   { rail:'宮崎駅',       iata:'KMI', jrArea:'kyushu' },
};
const ALL_DEPS = Object.keys(DEPARTURE_CITY_INFO);

/* ═══════════════════════════════
   ロジック（app.js相当）
═══════════════════════════════ */

/** src/hotel/hotelLinkBuilder.js と同期 */
function resolveKeyword(city) {
  if (city.hotelHub && city.hotelHub !== city.name) return city.hotelHub;
  if (city.prefecture && city.city) return `${city.prefecture} ${city.city}`;
  return city.hotelSearch || city.name;
}

function buildRakutenTarget(city) {
  const kw = resolveKeyword(city);
  return `https://kw.travel.rakuten.co.jp/keyword/Search.do?f_keyword=${encodeURIComponent(kw)}`;
}

function buildJalanTarget(city) {
  const kw = resolveKeyword(city);
  return `https://www.jalan.net/uw/uwp2011/uww2011init.do?keyword=${encodeURIComponent(kw)}`;
}

const RAKUTEN_AFF = 'https://hb.afl.rakuten.co.jp/hgc/5113ee4b.8662cfc5.5113ee4c.119de89a/?pc=';
const VC_BASE     = 'https://ck.jp.ap.valuecommerce.com/servlet/referral?sid=3764408&pid=892559858&vc_url=';

function buildHotelLinks(city) {
  return [
    { type:'rakuten', label:`${city.name}の宿を見る（楽天）`, url: RAKUTEN_AFF + buildRakutenTarget(city) },
    { type:'jalan',   label:`${city.name}の宿を見る（じゃらん）`, url: VC_BASE + encodeURIComponent(buildJalanTarget(city)) },
  ];
}

/** src/transport/transportRenderer.js resolveTransportLinks 相当 */
function buildGoogleMapsUrl(city, departure) {
  const fromCity = DEPARTURE_CITY_INFO[departure];
  const origin   = fromCity?.rail || departure;
  const dest     = city.accessStation || `${city.name} ${city.prefecture}`;
  return `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(dest)}&travelmode=transit`;
}

/** mapView.js DEPARTURE_KEY */
const DEPARTURE_KEY = {
  '東京':'tokyo','横浜':'tokyo','千葉':'tokyo','大宮':'tokyo','宇都宮':'tokyo',
  '仙台':'tokyo','盛岡':'tokyo',
  '名古屋':'nagoya','静岡':'nagoya','長野':'nagoya','富山':'nagoya','金沢':'nagoya',
  '大阪':'osaka','京都':'osaka','神戸':'osaka','奈良':'osaka',
  '広島':'osaka','岡山':'osaka','松江':'osaka',
  '高松':'takamatsu','松山':'takamatsu','高知':'takamatsu','徳島':'takamatsu',
  '福岡':'fukuoka','熊本':'fukuoka','鹿児島':'fukuoka','長崎':'fukuoka','宮崎':'fukuoka',
  '札幌':'tokyo','旭川':'tokyo','函館':'tokyo',
};

function getMapCategory(dest, departure) {
  const key = DEPARTURE_KEY[departure];
  if (!key || !dest.travelTime) return 'other';
  const min = dest.travelTime[key];
  if (min === null || min === undefined) return 'other';
  if (min < 120) return 'daytrip';
  if (min < 300) return '1night';
  if (min < 480) return '2night';
  return 'other';
}

/* ═══════════════════════════════
   HTTP ヘルパー
═══════════════════════════════ */
function httpsGet(targetUrl, maxBytes = 400_000, timeout = 15000) {
  return new Promise(resolve => {
    try {
      const parsed = new URL(targetUrl);
      const req = https.request(
        { hostname: parsed.hostname, path: parsed.pathname + parsed.search,
          method: 'GET', timeout,
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36', 'Accept-Language': 'ja,en;q=0.9' } },
        res => {
          let body = '';
          res.on('data', chunk => {
            body += chunk;
            if (Buffer.byteLength(body) >= maxBytes) req.destroy();
          });
          res.on('end', () => resolve({ status: res.statusCode, ok: res.statusCode < 400, body }));
          res.on('error', () => resolve({ status:0, ok:false, body:'' }));
        }
      );
      req.on('timeout', () => { req.destroy(); resolve({ status:0, ok:false, body:'', err:'timeout' }); });
      req.on('error',   e  => resolve({ status:0, ok:false, body:'', err:e.message }));
      req.end();
    } catch(e) { resolve({ status:0, ok:false, body:'', err:e.message }); }
  });
}

function httpsHead(targetUrl, timeout = 8000) {
  return new Promise(resolve => {
    try {
      const parsed = new URL(targetUrl);
      const req = https.request(
        { hostname: parsed.hostname, path: parsed.pathname + parsed.search,
          method: 'HEAD', timeout,
          headers: { 'User-Agent': 'Mozilla/5.0 (compatible; DokoikoSim/1.0)' } },
        res => { resolve({ status: res.statusCode, ok: res.statusCode < 400 }); res.resume(); }
      );
      req.on('timeout', () => { req.destroy(); resolve({ status:0, ok:false, err:'timeout' }); });
      req.on('error',   e  => resolve({ status:0, ok:false, err:e.message }));
      req.end();
    } catch(e) { resolve({ status:0, ok:false, err:e.message }); }
  });
}

async function runBatched(tasks, n = 8) {
  const out = [];
  for (let i = 0; i < tasks.length; i += n) {
    out.push(...await Promise.all(tasks.slice(i, i+n).map(t => t())));
    if (i + n < tasks.length) await new Promise(r => setTimeout(r, 200));
  }
  return out;
}

/* ═══════════════════════════════
   スコアカード
═══════════════════════════════ */
class Scorecard {
  constructor(name) { this.name = name; this.pass = 0; this.fail = 0; this.errors = []; }
  ok()          { this.pass++; }
  ng(msg)       { this.fail++; this.errors.push(msg); }
  check(c, msg) { c ? this.ok() : this.ng(msg); }
  print() {
    const icon = this.fail === 0 ? '✓' : '✗';
    process.stdout.write(`${icon} ${this.name}: PASS ${this.pass} / FAIL ${this.fail}\n`);
    this.errors.slice(0, 8).forEach(e => process.stdout.write(`    ✗ ${e}\n`));
    if (this.errors.length > 8) process.stdout.write(`    ... 他 ${this.errors.length-8} 件\n`);
  }
}

/* ═══════════════════════════════
   メイン
═══════════════════════════════ */
(async () => {
  const scorecards = [];

  console.log('═══════════════════════════════════════════════');
  console.log('  ブラウザ動作シミュレーション');
  console.log(`  destinations: ${DESTS.length}件 / hubs: ${HUBS.length}件`);
  console.log('═══════════════════════════════════════════════\n');

  /* ─────────────────────────────────
     [A] 202件全件表示シミュレーション
  ──────────────────────────────────*/
  {
    const sc = new Scorecard('[A] 202件全件表示');
    let covered = 0;
    const missingFields = [];

    DESTS.forEach(city => {
      // app.js draw() が必要とするフィールドを確認
      sc.check(!!city.name,        `${city.id}: name 欠落`);
      sc.check(!!city.prefecture,  `${city.id}: prefecture 欠落`);
      sc.check(!!city.city,        `${city.id}: city(市区町村) 欠落`);
      sc.check(!!city.accessStation, `${city.id}: accessStation 欠落`);
      sc.check(!!city.type,        `${city.id}: type 欠落`);
      sc.check(!!city.destType,    `${city.id}: destType 欠落`);
      sc.check(Array.isArray(city.tags) && city.tags.length > 0, `${city.id}: tags 空`);
      sc.check(city.weight > 0,    `${city.id}: weight 0以下`);

      // stayAllowed → travelTime ベースで代替済み（古い項目は必須でない）
      // hotelHub は島/特殊地域のみ（必須でない）
      covered++;
    });

    sc.check(covered === 202, `202件未達: ${covered}件`);
    console.log(`  全件スキャン: ${covered}/${DESTS.length}`);
    sc.print();
    scorecards.push(sc);
  }

  /* ─────────────────────────────────
     [B] 宿リンク URL 構造検証（全202件）
  ──────────────────────────────────*/
  {
    const sc = new Scorecard('[B] 宿リンク URL 構造（全202件）');

    DESTS.forEach(city => {
      const kw   = resolveKeyword(city);
      const rUrl = RAKUTEN_AFF + buildRakutenTarget(city);
      const jUrl = VC_BASE + encodeURIComponent(buildJalanTarget(city));

      // keyword が prefecture + city 形式であること（hotelHub例外除く）
      if (!city.hotelHub || city.hotelHub === city.name) {
        const expected = `${city.prefecture} ${city.city}`;
        sc.check(kw === expected, `${city.id}: keyword="${kw}" (期待:"${expected}")`);
      }

      // keyword が空でないこと
      sc.check(kw.trim().length > 0, `${city.id}: keyword 空`);

      // 楽天 URL 構造
      sc.check(rUrl.startsWith('https://hb.afl.rakuten.co.jp'), `${city.id}: 楽天 affiliate URL 不正`);
      sc.check(rUrl.includes('kw.travel.rakuten.co.jp/keyword/Search.do'), `${city.id}: 楽天 Search URL 不正`);
      sc.check(rUrl.includes(`f_keyword=${encodeURIComponent(kw)}`), `${city.id}: 楽天 keyword encode 不正`);

      // じゃらん URL 構造（二重エンコード）
      sc.check(jUrl.startsWith('https://ck.jp.ap.valuecommerce.com'), `${city.id}: じゃらん VC URL 不正`);
      sc.check(jUrl.includes('uwp2011'), `${city.id}: じゃらん uwp2011 欠落`);
      sc.check(jUrl.includes(encodeURIComponent(encodeURIComponent(kw))),
        `${city.id}: じゃらん keyword 二重エンコード不正 (kw="${kw}")`);
    });

    sc.print();
    scorecards.push(sc);
  }

  /* ─────────────────────────────────
     [B2] 宿リンク HTTP アクセス検証（サンプル各地域2件）
  ──────────────────────────────────*/
  {
    const sc = new Scorecard('[B2] 宿リンク HTTP 接続（サンプル）');

    // 地域ごと2件サンプル
    const byRegion = {};
    DESTS.forEach(d => {
      const r = d.region || 'other';
      if (!byRegion[r]) byRegion[r] = [];
      if (byRegion[r].length < 2) byRegion[r].push(d);
    });
    const sample = Object.values(byRegion).flat();
    console.log(`  対象: ${sample.length} 都市 × 2 URL`);

    // 楽天: kw.travel → 200 チェック
    // じゃらん: jalan.net → 200 チェック
    const tasks = [];
    sample.forEach(city => {
      const rTarget = buildRakutenTarget(city);
      const jTarget = buildJalanTarget(city);
      tasks.push(() => httpsHead(rTarget).then(r => ({ city, svc:'楽天', url:rTarget, ...r })));
      tasks.push(() => httpsHead(jTarget).then(r => ({ city, svc:'じゃらん', url:jTarget, ...r })));
    });

    process.stdout.write(`  送信中 (${tasks.length} req)... `);
    const results = await runBatched(tasks, 8);
    console.log('完了');

    results.forEach(r => {
      if (r.ok) sc.ok();
      else sc.ng(`[${r.svc}] ${r.city.name}: ${r.err || 'HTTP '+r.status}`);
    });

    sc.print();
    scorecards.push(sc);
  }

  /* ─────────────────────────────────
     [C] Google Maps URL 検証（全202件 × 全31出発地）
  ──────────────────────────────────*/
  {
    const sc = new Scorecard('[C] Google Maps URL（全件×全出発地）');
    let checked = 0;

    DESTS.forEach(city => {
      ALL_DEPS.forEach(dep => {
        const fromCity = DEPARTURE_CITY_INFO[dep];
        const origin   = fromCity.rail;
        const destAcc  = city.accessStation || `${city.name} ${city.prefecture}`;
        const url      = buildGoogleMapsUrl(city, dep);

        // origin = 出発駅
        sc.check(url.includes(`origin=${encodeURIComponent(origin)}`),
          `${dep}→${city.id}: origin が "${origin}" でない`);
        // destination = accessStation
        sc.check(url.includes(`destination=${encodeURIComponent(destAcc)}`),
          `${dep}→${city.id}: dest が "${destAcc}" でない`);
        // travelmode=transit
        sc.check(url.includes('travelmode=transit'),
          `${dep}→${city.id}: travelmode=transit 欠落`);
        checked++;
      });
    });

    console.log(`  チェック: ${checked} ルート`);
    sc.print();
    scorecards.push(sc);
  }

  /* ─────────────────────────────────
     [D] UI フィールド検証（全202件）
  ──────────────────────────────────*/
  {
    const sc = new Scorecard('[D] UI フィールド（全202件）');

    DESTS.forEach(city => {
      // render.js が使うフィールド
      // <h2>city.name</h2>
      sc.check(city.name.trim().length > 0, `${city.id}: name 空`);

      // <p class="city-sub">${city.prefecture}${city.city}
      sc.check(!!city.prefecture && city.prefecture.endsWith('県') || city.prefecture.endsWith('道') ||
               city.prefecture.endsWith('都') || city.prefecture.endsWith('府'),
        `${city.id}: prefecture 形式不正 (${city.prefecture})`);
      sc.check(!!city.city, `${city.id}: city(市区町村) 欠落`);

      // <p class="city-station">最寄駅：${city.accessStation}
      sc.check(!!city.accessStation, `${city.id}: accessStation 欠落`);

      // accessStation が「駅」「港」「空港」「ターミナル」「バスターミナル」「停」のどれかで終わること
      const validSuffix = ['駅','港','空港','ターミナル','停','フェリーターミナル','バスセンター'];
      sc.check(
        validSuffix.some(s => city.accessStation.endsWith(s)),
        `${city.id}: accessStation 形式不正 (${city.accessStation})`
      );

      // tags: 表示3件
      sc.check(Array.isArray(city.tags) && city.tags.length > 0, `${city.id}: tags 空`);

      // description 存在チェック（任意だが警告）
      // spots or landmarks 任意
    });

    sc.print();
    scorecards.push(sc);
  }

  /* ─────────────────────────────────
     [E] マップデータ検証（全件表示・出発地変更）
  ──────────────────────────────────*/
  {
    const sc = new Scorecard('[E] マップデータ');

    // lat/lng が全件あること
    const withLatLng = DESTS.filter(d => d.lat && d.lng);
    sc.check(withLatLng.length === DESTS.length, `lat/lng あり: ${withLatLng.length}/${DESTS.length}`);

    // travelTime が全件あること
    const travelKeys = ['tokyo','osaka','nagoya','fukuoka','takamatsu'];
    const withTT = DESTS.filter(d => d.travelTime && travelKeys.every(k => d.travelTime[k] !== undefined));
    sc.check(withTT.length === DESTS.length, `travelTime 全5都市: ${withTT.length}/${DESTS.length}`);

    // 全出発地でカテゴリが正しく計算されること
    let catOk = 0, catFail = 0;
    ALL_DEPS.forEach(dep => {
      DESTS.forEach(dest => {
        const cat = getMapCategory(dest, dep);
        const validCat = ['daytrip','1night','2night','other'];
        if (validCat.includes(cat)) catOk++;
        else { catFail++; sc.ng(`${dep}→${dest.id}: 不正カテゴリ "${cat}"`); }
      });
    });

    // 出発地変更で色が変わること: 東京と福岡でカテゴリ分布が異なること
    const tokyoCats = DESTS.map(d => getMapCategory(d, '東京'));
    const fukuokaCats = DESTS.map(d => getMapCategory(d, '福岡'));
    const tokyoDaytrip = tokyoCats.filter(c => c === 'daytrip').length;
    const fukuokaDaytrip = fukuokaCats.filter(c => c === 'daytrip').length;
    sc.check(tokyoDaytrip !== fukuokaDaytrip || tokyoDaytrip > 0,
      '出発地変更でカテゴリが変化しない（東京/福岡のdaytrip同数）');

    // 全件が DEPARTURE_KEY に対応する出発地でカバーされていること
    const allDepsHaveKey = ALL_DEPS.every(d => DEPARTURE_KEY[d] !== undefined);
    sc.check(allDepsHaveKey, '一部出発地に DEPARTURE_KEY マッピングなし');

    console.log(`  lat/lng: ${withLatLng.length}/${DESTS.length}`);
    console.log(`  travelTime全5都市: ${withTT.length}/${DESTS.length}`);
    console.log(`  カテゴリ計算: ok=${catOk}, fail=${catFail}`);
    console.log(`  出発地変更テスト: 東京daytrip=${tokyoDaytrip}, 福岡daytrip=${fukuokaDaytrip}`);
    sc.print();
    scorecards.push(sc);
  }

  /* ─────────────────────────────────
     [F] 200回ランダムシミュレーション
  ──────────────────────────────────*/
  {
    const sc = new Scorecard('[F] 200回ランダムシミュレーション');
    const STAY_TYPES = ['daytrip','1night','2night'];
    const THEMES = [null,'温泉','絶景','海','街歩き','グルメ'];

    // シード固定LCG
    let seed = 0xDEADBEEF;
    function rng(n) {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed % n;
    }

    const issues = { noHotel:0, noMaps:0, noUI:0, noTransport:0 };

    for (let i = 0; i < 200; i++) {
      const dep       = ALL_DEPS[rng(ALL_DEPS.length)];
      const city      = DESTS[rng(DESTS.length)];
      const stayType  = STAY_TYPES[rng(STAY_TYPES.length)];
      const theme     = THEMES[rng(THEMES.length)];
      const fromCity  = DEPARTURE_CITY_INFO[dep];

      // ── 宿リンク ──
      const hotelLinks = buildHotelLinks(city);
      const hasRakuten = hotelLinks.some(l => l.type === 'rakuten' && l.url.includes('rakuten'));
      const hasJalan   = hotelLinks.some(l => l.type === 'jalan'   && l.url.includes('jalan'));
      if (!hasRakuten || !hasJalan) {
        issues.noHotel++;
        sc.ng(`[${i+1}] ${dep}→${city.name}(${stayType}): 宿リンク不正 R=${hasRakuten} J=${hasJalan}`);
        continue;
      }

      // ── 宿キーワード ──
      const kw = resolveKeyword(city);
      if (!kw || kw.trim().length === 0) {
        sc.ng(`[${i+1}] ${city.name}: keyword 空`);
        continue;
      }
      // prefecture + city 形式チェック（hotelHub例外除く）
      if (!city.hotelHub || city.hotelHub === city.name) {
        const expected = `${city.prefecture} ${city.city}`;
        if (kw !== expected) {
          sc.ng(`[${i+1}] ${city.name}: keyword="${kw}" (期待="${expected}")`);
          continue;
        }
      }

      // ── Google Maps ──
      const mapsUrl  = buildGoogleMapsUrl(city, dep);
      const origin   = fromCity.rail;
      const destAcc  = city.accessStation;
      if (!mapsUrl.includes(`origin=${encodeURIComponent(origin)}`)) {
        issues.noMaps++;
        sc.ng(`[${i+1}] ${dep}→${city.name}: Maps origin 不正 (期待="${origin}")`);
        continue;
      }
      if (!destAcc || !mapsUrl.includes(`destination=${encodeURIComponent(destAcc)}`)) {
        issues.noMaps++;
        sc.ng(`[${i+1}] ${dep}→${city.name}: Maps destination 不正 (accessStation="${destAcc}")`);
        continue;
      }
      if (!mapsUrl.includes('travelmode=transit')) {
        issues.noMaps++;
        sc.ng(`[${i+1}] ${dep}→${city.name}: travelmode=transit 欠落`);
        continue;
      }

      // ── UI フィールド ──
      if (!city.name || !city.prefecture || !city.city || !city.accessStation) {
        issues.noUI++;
        sc.ng(`[${i+1}] ${city.name}: UI フィールド欠落`);
        continue;
      }

      // ── マップカテゴリ ──
      const cat = getMapCategory(city, dep);
      if (!['daytrip','1night','2night','other'].includes(cat)) {
        sc.ng(`[${i+1}] ${dep}→${city.name}: 不正カテゴリ "${cat}"`);
        continue;
      }

      // ── すべて OK ──
      sc.ok();
    }

    console.log(`  ランダムテスト200回: ok=${sc.pass}, fail=${sc.fail}`);
    console.log(`  内訳: 宿不正=${issues.noHotel} / Maps不正=${issues.noMaps} / UI欠落=${issues.noUI} / 交通なし=${issues.noTransport}`);
    sc.print();
    scorecards.push(sc);
  }

  /* ─────────────────────────────────
     [G] accessStation 形式自動修正チェック
  ──────────────────────────────────*/
  {
    const sc = new Scorecard('[G] accessStation 形式検証');
    const validSuffixes = ['駅','港','空港','ターミナル','停','フェリーターミナル','バスセンター','バスターミナル'];
    const invalid = DESTS.filter(d => d.accessStation && !validSuffixes.some(s => d.accessStation.endsWith(s)));

    if (invalid.length > 0) {
      console.log(`  ⚠ accessStation 形式不正 ${invalid.length} 件:`);
      invalid.forEach(d => console.log(`    ${d.id}: "${d.accessStation}"`));
      sc.ng(`accessStation 形式不正: ${invalid.length}件 — ${invalid.map(d=>`${d.id}(${d.accessStation})`).join(', ')}`);
    } else {
      sc.ok();
      console.log(`  全${DESTS.length}件 accessStation 形式 OK`);
    }

    sc.print();
    scorecards.push(sc);
  }

  /* ═══════════════════════════════
     結果サマリ
  ═══════════════════════════════ */
  const totalFail = scorecards.reduce((s,c) => s + c.fail, 0);
  const totalPass = scorecards.reduce((s,c) => s + c.pass, 0);

  console.log('\n═══════════════════════════════════════════════');
  console.log('  ブラウザシミュレーション 結果サマリ');
  console.log('═══════════════════════════════════════════════');
  scorecards.forEach(sc => {
    const icon = sc.fail === 0 ? '✓' : '✗';
    console.log(`  ${icon} ${sc.name}: PASS ${sc.pass} / FAIL ${sc.fail}`);
  });
  console.log(`\n  総計: PASS ${totalPass} / FAIL ${totalFail}`);

  if (totalFail === 0) {
    console.log('\n  ✓ 全チェック通過 — 本番リリース可');
  } else {
    console.log(`\n  ✗ FAIL ${totalFail} 件`);
    console.log('\n  失敗詳細:');
    scorecards.forEach(sc => {
      if (sc.fail > 0) {
        console.log(`\n  【${sc.name}】`);
        sc.errors.forEach(e => console.log(`    ✗ ${e}`));
      }
    });
    process.exitCode = 1;
  }
})();
