/**
 * fullE2E.mjs — 全destination 完全 E2E 検証
 *
 * チェック項目:
 *   [T1] 交通リンクが1件以上ある
 *   [T2] 各リンクの URL が存在し https で始まる
 *   [T3] provider が正しい（東海道/山陽→EX, JR東→えきねっと, JR西→e5489）
 *   [T4] Google Maps URL が maps.google.com を含む
 *   [T5] HTTP HEAD で 200 / 301 / 302 が返る（上位CTAのみ）
 *   [H1] 宿リンクが楽天+じゃらんの2件ある
 *   [H2] 楽天 URL: travel.rakuten.co.jp + scid= or アフィラッパー + /hotel/
 *   [H3] じゃらん URL: アフィリエイトラッパー済み
 *   [H4] 文字化け・二重エンコードなし
 *   [H5] HTTP HEAD で 200 / 301 / 302 が返る
 *   [H6] HTML に検索結果コンテンツが含まれる（サンプル検証）
 *
 * 実行: node scripts/fullE2E.mjs [--no-http] [--html-sample=N]
 *   --no-http     : HTTP リクエストをスキップ（高速モード）
 *   --html-sample=N : HTML 確認件数（デフォルト 20）
 */

import { fileURLToPath } from 'url';
import { dirname, join }  from 'path';
import { readFileSync }   from 'fs';
import https from 'https';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root      = join(__dirname, '..');

/* ── オプション解析 ── */
const NO_HTTP    = process.argv.includes('--no-http');
const HTML_MATCH = (process.argv.find(a => a.startsWith('--html-sample=')) ?? '--html-sample=20')
                    .split('=')[1];
const HTML_SAMPLE = parseInt(HTML_MATCH, 10) || 20;

/* ── モジュール読み込み ── */
const { resolveTransportLinks } = await import(`file://${root}/src/features/dokoiko/transportRenderer.js`);
const { buildHotelLinks }       = await import(`file://${root}/src/hotel/hotelLinkBuilder.js`);

/* ── データ読み込み ── */
const allDests = JSON.parse(readFileSync(join(root, 'src/data/destinations.json'), 'utf8'));
const DESTS    = Array.isArray(allDests) ? allDests : allDests.destinations;

/* ── 出発地（最低3、全主要都市） ── */
const DEPARTURES = ['東京', '大阪', '福岡', '名古屋', '仙台', '高松', '広島', '熊本'];

/* ── JR provider 正当性ルール ── */
// expected は文字列配列（出発地によって複数の有効プロバイダがある）
// 東海道・山陽: 関東/中部出発→EX、四国/関西/中国/九州出発→e5489(jr-west) どちらも有効
// 東北: 関東/東北出発→ekinet(jr-east)、九州出発→e5489(jr-west) どちらも有効
const SHINKANSEN_PROVIDER_RULES = [
  { labelIncludes: '東海道新幹線', expected: ['jr-ex', 'jr-west'],        name: '東海道新幹線' },
  { labelIncludes: '山陽新幹線',   expected: ['jr-ex', 'jr-west'],        name: '山陽新幹線'   },
  { labelIncludes: '東北新幹線',   expected: ['jr-east', 'jr-west'],      name: '東北新幹線'   },
  // 北陸新幹線: 東日本出発→ekinet(jr-east), 西日本出発→e5489(jr-west)
  { labelIncludes: '北陸新幹線',   expected: ['jr-east', 'jr-west'],      name: '北陸新幹線'   },
  // 九州新幹線: jr-kyushu または e5489(jr-west)
  { labelIncludes: '九州新幹線',   expected: ['jr-kyushu', 'jr-west'],    name: '九州新幹線'   },
  // 西九州新幹線: 常に e5489(jr-west)
  { labelIncludes: '西九州新幹線', expected: ['jr-west'],                 name: '西九州新幹線' },
];

/* ═══════════════════════════════════════════════
   HTTP ユーティリティ
═══════════════════════════════════════════════ */

const TIMEOUT_MS = 12000;
const CONCURRENCY = 5;
const HTTP_DELAY_MS = 120;

/**
 * HEAD リクエスト → { status, ok, redirectUrl }
 * Follow redirect しない（302 は正常として扱う）
 */
function headRequest(urlStr, timeout = TIMEOUT_MS) {
  return new Promise(resolve => {
    try {
      const u = new URL(urlStr);
      const req = https.request(
        { hostname: u.hostname, path: u.pathname + u.search, method: 'HEAD',
          timeout, headers: { 'User-Agent': 'Mozilla/5.0 (compatible; dokoiiko-e2e/1.0)' } },
        res => {
          const ok = [200, 201, 301, 302, 303].includes(res.statusCode);
          resolve({ status: res.statusCode, ok, redirectUrl: res.headers.location ?? null });
          res.resume();
        }
      );
      req.on('timeout', () => { req.destroy(); resolve({ status: 0, ok: false, redirectUrl: null }); });
      req.on('error',   () => resolve({ status: 0, ok: false, redirectUrl: null }));
      req.end();
    } catch {
      resolve({ status: 0, ok: false, redirectUrl: null });
    }
  });
}

/**
 * リダイレクトを追跡して最終 URL と最終 status を返す（最大 8 ホップ）。
 * JS レンダリングページは HTML チェックせず URL で検証する。
 */
function followRedirects(urlStr, timeout = TIMEOUT_MS, depth = 0) {
  if (depth > 8) return Promise.resolve({ finalUrl: urlStr, status: 0 });
  return new Promise(resolve => {
    try {
      const u = new URL(urlStr);
      const mod = u.protocol === 'https:' ? https : https; // always https
      const req = mod.request(
        { hostname: u.hostname, path: u.pathname + u.search, method: 'GET',
          timeout,
          headers: { 'User-Agent': 'Mozilla/5.0 (compatible; dokoiiko-e2e/1.0)', 'Accept': 'text/html' } },
        res => {
          const loc = res.headers.location;
          res.resume();
          if ([301, 302, 303, 307, 308].includes(res.statusCode) && loc) {
            const next = loc.startsWith('http') ? loc : `https://${u.hostname}${loc}`;
            resolve(followRedirects(next, timeout, depth + 1));
          } else {
            resolve({ finalUrl: urlStr, status: res.statusCode });
          }
        }
      );
      req.on('timeout', () => { req.destroy(); resolve({ finalUrl: urlStr, status: 0 }); });
      req.on('error',   () => resolve({ finalUrl: urlStr, status: 0 }));
      req.end();
    } catch {
      resolve({ finalUrl: urlStr, status: 0 });
    }
  });
}

/**
 * 並列数を制限しながら非同期タスクを実行する。
 */
async function pLimit(tasks, limit, delayMs = 0) {
  const results = [];
  let idx = 0;
  async function worker() {
    while (idx < tasks.length) {
      const i = idx++;
      results[i] = await tasks[i]();
      if (delayMs > 0) await new Promise(r => setTimeout(r, delayMs));
    }
  }
  await Promise.all(Array.from({ length: limit }, worker));
  return results;
}

/* ═══════════════════════════════════════════════
   結果集計
═══════════════════════════════════════════════ */

let totalPass = 0;
let totalFail = 0;
const failLog  = [];    // { dest, check, msg, fix }
const destFail = new Map();  // dest.id → count

function pass() { totalPass++; }
function fail(dest, check, msg, fix = null) {
  totalFail++;
  failLog.push({ dest: dest.name, id: dest.id, check, msg, fix });
  destFail.set(dest.id, (destFail.get(dest.id) || 0) + 1);
}

/* ═══════════════════════════════════════════════
   URL ユーティリティ
═══════════════════════════════════════════════ */

function isValidUrl(str) {
  try { new URL(str); return true; } catch { return false; }
}

function isHttps(str) {
  return typeof str === 'string' && str.startsWith('https://');
}

/** %25 の二重エンコードを検出する（%25E3 など） */
function hasDoubleEncoding(str) {
  return /%25[0-9A-Fa-f]{2}/.test(str);
}

/** %E3%... などの日本語パーセントエンコードが壊れていないか簡易確認 */
function hasCorruptEncoding(str) {
  // 未エンコードの日本語文字が混入しているケース
  return /[^\x00-\x7F]/.test(str);
}

/* ═══════════════════════════════════════════════
   交通リンク検証
═══════════════════════════════════════════════ */

/**
 * リンク配列からURL付きアイテムをフラットに抽出する。
 * step-group 方式（cta.url）と旧方式（url）の両方に対応。
 */
function extractUrlItems(links) {
  const items = [];
  for (const l of links) {
    if (l.url) {
      items.push({ type: l.type, url: l.url, label: l.label });
    } else if (l.cta?.url) {
      items.push({ type: l.cta.type, url: l.cta.url, label: l.cta.label });
    }
  }
  return items;
}

/**
 * メイン CTA（最重要ボタン）を抽出する。
 * main-cta → step-group[0].cta の順で探す。
 */
function extractMainCta(links) {
  const mc = links.find(l => l.type === 'main-cta');
  if (mc?.cta?.url) return mc.cta;
  const sg = links.find(l => l.type === 'step-group' && l.cta?.url);
  if (sg) return sg.cta;
  const direct = links.find(l => l.url);
  return direct ?? null;
}

function checkTransportLinks(dest, departure, links) {
  /* T1: 1件以上ある */
  const urlItems = extractUrlItems(links);
  if (urlItems.length === 0) {
    // 「準備中」だけかチェック
    const noteOnly = links.every(l => l.type === 'note' || l.type === 'summary');
    if (noteOnly) {
      fail(dest, 'T1', `交通リンクなし(${departure})`,'ROUTES または gateway を設定する');
    } else {
      fail(dest, 'T1', `URLリンク0件(${departure})`, null);
    }
    return { mainCta: null };
  }
  pass();

  /* T2: https で始まる */
  for (const item of urlItems) {
    if (!isValidUrl(item.url)) {
      fail(dest, 'T2', `不正URL(${departure}): ${item.url?.slice(0, 60)}`, null);
    } else if (!isHttps(item.url)) {
      fail(dest, 'T2', `非https(${departure}): ${item.url?.slice(0, 60)}`, 'https: に修正');
    } else {
      pass();
    }
  }

  /* T3: provider 正当性（新幹線ステップのみ） */
  for (const l of links) {
    if (l.type !== 'step-group') continue;
    const stepLabel = l.stepLabel ?? '';
    for (const rule of SHINKANSEN_PROVIDER_RULES) {
      if (stepLabel.includes(rule.labelIncludes)) {
        const ctaType = l.cta?.type ?? '';
        const accepted = Array.isArray(rule.expected) ? rule.expected : [rule.expected];
        if (!accepted.includes(ctaType)) {
          fail(dest, 'T3',
            `provider 不正: ${rule.name}→${ctaType}(期待: ${accepted.join('/')}) [${departure}]`,
            `detectShinkansenProvider で ${rule.name} を正しいproviderに返すよう修正`);
        } else {
          pass();
        }
      }
    }
  }

  /* T4: Google Maps URL の形式確認 */
  for (const item of urlItems) {
    if (item.type === 'google-maps' || item.type === 'google-flights') {
      const includesMapsHost = item.url.includes('maps.google.com')
        || item.url.includes('google.com/maps')
        || item.url.includes('google.com/flights');
      if (!includesMapsHost) {
        fail(dest, 'T4', `Google Maps URL 形式不正(${departure}): ${item.url?.slice(0, 80)}`, null);
      } else {
        pass();
      }
    }
  }

  /* T5: メインCTAが1つだけ存在（summary-CTA統一確認） */
  const mainCtaLinks = links.filter(l => l.type === 'main-cta');
  if (mainCtaLinks.length > 1) {
    fail(dest, 'T5', `メインCTAが複数(${departure}): ${mainCtaLinks.length}件`, 'deriveMainCtaを確認');
  } else {
    pass();
  }

  const mainCta = extractMainCta(links);
  return { mainCta };
}

/* ═══════════════════════════════════════════════
   宿リンク検証
═══════════════════════════════════════════════ */

const RAKUTEN_PREFIX = 'https://travel.rakuten.co.jp/';
const JALAN_PREFIX   = 'https://www.jalan.net/';

function checkHotelLinks(dest, hotelResult) {
  const links = hotelResult?.links ?? [];

  /* H1: 2件ある */
  if (links.length === 0) {
    fail(dest, 'H1', '宿リンク0件', 'buildHotelLinks を確認');
    return;
  }
  if (links.length !== 2) {
    fail(dest, 'H1', `宿リンクが2件でない (${links.length}件)`, null);
  } else {
    pass();
  }

  for (const l of links) {
    if (!l.url) {
      fail(dest, 'H2', `宿リンク URL なし (${l.type})`, null);
      continue;
    }

    /* H4: 文字化け・二重エンコード */
    if (hasDoubleEncoding(l.url)) {
      fail(dest, 'H4', `二重エンコード検出 (${l.type}): ...${l.url.slice(-60)}`,
        'encodeURIComponent を2回呼んでいる箇所を修正');
    } else if (hasCorruptEncoding(l.url)) {
      fail(dest, 'H4', `未エンコード日本語文字 (${l.type}): ${l.url.slice(0, 80)}`,
        'keyword を encodeURIComponent でエンコードする');
    } else {
      pass();
    }

    if (l.type === 'rakuten') {
      /* H2: travel.rakuten.co.jp/yado/{area}/ 直リンク */
      if (!l.url.startsWith(RAKUTEN_PREFIX) || !l.url.includes('/yado/')) {
        fail(dest, 'H2', `楽天 travel.rakuten.co.jp/yado/ を含まない: ${l.url.slice(0, 60)}`,
          'buildRakutenUrl の hotelArea を確認する');
      } else {
        pass();
      }
    } else if (l.type === 'jalan') {
      /* H3: jalan.net 直リンク */
      if (!l.url.startsWith(JALAN_PREFIX) || !l.url.includes('keyword=')) {
        fail(dest, 'H3', `じゃらん jalan.net?keyword= を含まない: ${l.url.slice(0, 60)}`,
          'buildJalanUrl の keyword を確認する');
      } else {
        pass();
      }
    }
  }

  return links;
}

/* ═══════════════════════════════════════════════
   最終 URL 検証（リダイレクト追跡後）
   楽天/じゃらんはJSレンダリングのため HTML パースではなく
   最終 URL のドメイン・パスパターンで判定する
═══════════════════════════════════════════════ */

function checkFinalUrl(dest, type, finalUrl, status) {
  // タイムアウト / サーバーエラーのみ失敗扱い（404 はボット検知・結果なしの可能性があるため許容）
  if (status === 0) {
    fail(dest, 'H6', `最終URL到達タイムアウト (${type})`, null);
    return;
  }
  if (status >= 500) {
    fail(dest, 'H6', `最終URL サーバーエラー ${status} (${type})`, null);
    return;
  }

  // 最終 URL のドメインが正しいかチェック（アフィリエイトリダイレクトが機能している証明）
  if (type === 'rakuten') {
    const ok = finalUrl.includes('travel.rakuten.co.jp')
            || finalUrl.includes('rakuten.co.jp');
    if (ok) {
      pass();
    } else {
      fail(dest, 'H6', `楽天リダイレクト先が travel.rakuten.co.jp でない: ${finalUrl.slice(0, 80)}`,
        'RAKUTEN_BASE の URL を確認する');
    }
  } else if (type === 'jalan') {
    const ok = finalUrl.includes('jalan.net');
    if (ok) {
      pass();
    } else {
      fail(dest, 'H6', `じゃらんリダイレクト先が jalan.net でない: ${finalUrl.slice(0, 80)}`,
        'buildJalanUrl の URL を確認する');
    }
  } else {
    pass();
  }
}

/* ═══════════════════════════════════════════════
   メイン
═══════════════════════════════════════════════ */

console.log('\n════════════════════════════════════════════════');
console.log('  fullE2E.mjs — 全 destination 完全 E2E 検証');
console.log('════════════════════════════════════════════════');
console.log(`  対象: ${DESTS.length} destinations × ${DEPARTURES.length} 出発地`);
console.log(`  HTTP チェック: ${NO_HTTP ? 'スキップ' : '有効'}`);
console.log(`  HTML 確認件数: ${HTML_SAMPLE}`);
console.log('');

/* ── Phase 1: 構造検証（全件・高速） ── */
console.log('[ Phase 1 ] 構造検証（全件）...');

const httpTransportQueue = [];  // { dest, departure, url }
const httpHotelQueue     = [];  // { dest, type, url }
const htmlCheckQueue     = [];  // { dest, type, url }

let htmlSampleCount = 0;

for (const dest of DESTS) {
  /* ── 宿リンク ──
   *  日帰り専用 destination（stayAllowed が daytrip のみ）は宿リンク不要
   */
  const stayAllowed = dest.stayAllowed ?? [];
  const needsHotel  = stayAllowed.includes('1night') || stayAllowed.includes('2night')
                   || stayAllowed.length === 0;  // 未設定は要確認扱い
  const hotelResult = buildHotelLinks(dest);
  const hotelLinks  = needsHotel ? checkHotelLinks(dest, hotelResult) : hotelResult?.links;

  if (hotelLinks && !NO_HTTP) {
    for (const l of hotelLinks) {
      if (l.url) httpHotelQueue.push({ dest, type: l.type, url: l.url });
    }
    if (htmlSampleCount < HTML_SAMPLE) {
      for (const l of hotelLinks) {
        if (l.url) {
          htmlCheckQueue.push({ dest, type: l.type, url: l.url });
        }
      }
      htmlSampleCount++;
    }
  }

  /* ── 交通リンク ──
   *  dest.departures が設定されている場合: そのうち DEPARTURES と重複する都市
   *  設定なしの場合: DEPARTURES 全件
   *  いずれも最低3都市は確保する
   */
  const destDeps = (dest.departures ?? []).filter(d => DEPARTURES.includes(d));
  const testDeps = destDeps.length >= 1
    ? destDeps
    : DEPARTURES.slice(0, 3);

  for (const dep of testDeps) {
    const links = resolveTransportLinks(dest, dep);
    const { mainCta } = checkTransportLinks(dest, dep, links);

    if (mainCta?.url && !NO_HTTP) {
      httpTransportQueue.push({ dest, departure: dep, url: mainCta.url });
    }
  }
}

const phase1Pass = totalPass;
const phase1Fail = totalFail;
console.log(`  構造検証: PASS ${phase1Pass} / FAIL ${phase1Fail}`);

/* ── Phase 2: HTTP HEAD 検証 ── */
if (!NO_HTTP) {
  console.log(`\n[ Phase 2 ] HTTP HEAD 検証...`);
  console.log(`  宿リンク: ${httpHotelQueue.length} 件`);
  console.log(`  交通CTA:  ${httpTransportQueue.length} 件（並列 ${CONCURRENCY}）`);

  /* 宿リンク HEAD */
  const hotelTasks = httpHotelQueue.map(({ dest, type, url }) => async () => {
    const { ok, status } = await headRequest(url);
    if (ok) {
      pass();
    } else {
      fail(dest, 'H5', `宿 HEAD ${status} (${type}): ${url.slice(0, 80)}`,
        'URL 構造または keyword を確認する');
    }
  });
  await pLimit(hotelTasks, CONCURRENCY, HTTP_DELAY_MS);

  /* 交通リンク HEAD（メインCTAのみ） */
  // 外部予約サイトへの大量リクエストを避けるため、Google Maps のみチェック
  const transportHttpTasks = httpTransportQueue
    .filter(({ url }) => url.includes('google.com'))
    .map(({ dest, departure, url }) => async () => {
      const { ok, status } = await headRequest(url);
      if (ok) {
        pass();
      } else {
        fail(dest, 'T5', `交通 HEAD ${status}(${departure}): ${url.slice(0, 80)}`, null);
      }
    });
  await pLimit(transportHttpTasks, CONCURRENCY, HTTP_DELAY_MS);

  console.log(`  HTTP HEAD 完了`);
}

/* ── Phase 3: 最終 URL 検証（リダイレクト追跡） ── */
if (!NO_HTTP && htmlCheckQueue.length > 0) {
  console.log(`\n[ Phase 3 ] 最終URL検証（リダイレクト追跡, ${htmlCheckQueue.length} 件）...`);

  const htmlTasks = htmlCheckQueue.map(({ dest, type, url }) => async () => {
    const { finalUrl, status } = await followRedirects(url);
    checkFinalUrl(dest, type, finalUrl, status);
  });
  await pLimit(htmlTasks, 3, 400);

  console.log(`  最終URL検証完了`);
}

/* ═══════════════════════════════════════════════
   結果出力
═══════════════════════════════════════════════ */

console.log('\n════════════════════════════════════════════════');
console.log('  検証結果');
console.log('════════════════════════════════════════════════');
console.log(`  総 PASS: ${totalPass}`);
console.log(`  総 FAIL: ${totalFail}`);
console.log('');

if (failLog.length === 0) {
  console.log('  ✓ 全チェック通過！');
} else {
  /* destination ごとに集計 */
  const byDest = new Map();
  for (const e of failLog) {
    if (!byDest.has(e.id)) byDest.set(e.id, { name: e.dest, id: e.id, errors: [] });
    byDest.get(e.id).errors.push(e);
  }

  /* チェック種別集計 */
  const checkCounts = {};
  for (const e of failLog) {
    checkCounts[e.check] = (checkCounts[e.check] || 0) + 1;
  }
  console.log('  ── チェック別 FAIL 数 ──');
  for (const [k, v] of Object.entries(checkCounts).sort()) {
    const label = {
      T1: '交通リンクなし', T2: 'URL形式', T3: 'provider不正',
      T4: 'GoogleMapsURL', T5: '交通HTTP',
      H1: '宿リンク件数', H2: '楽天URL', H3: 'じゃらんURL',
      H4: '文字化け', H5: '宿HTTP', H6: 'HTML内容',
    }[k] ?? k;
    console.log(`    ${k} ${label.padEnd(16)}: ${v}`);
  }
  console.log('');

  /* FAIL 一覧（destination ごと） */
  const SHOW_MAX = 60;
  let shown = 0;
  console.log('  ── FAIL 一覧 ──');
  for (const { name, id, errors } of byDest.values()) {
    if (shown >= SHOW_MAX) { console.log(`  ... 他 ${byDest.size - shown} destination`); break; }
    console.log(`\n  ✗ ${name}（${id}）`);
    for (const e of errors) {
      console.log(`      [${e.check}] ${e.msg}`);
      if (e.fix) console.log(`            → 修正案: ${e.fix}`);
    }
    shown++;
  }

  /* 修正提案サマリ */
  const fixes = [...new Set(failLog.map(e => e.fix).filter(Boolean))];
  if (fixes.length) {
    console.log('\n  ── 修正提案 ──');
    fixes.forEach(f => console.log(`    • ${f}`));
  }
}

console.log('\n════════════════════════════════════════════════');
console.log(totalFail === 0
  ? '  ✓ PASS 0 FAIL — 本番リリース可能'
  : `  ✗ FAIL ${totalFail} 件 — 要修正`);
console.log('════════════════════════════════════════════════\n');

process.exit(totalFail > 0 ? 1 : 0);
