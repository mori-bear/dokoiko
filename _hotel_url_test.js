'use strict';
/**
 * 宿リンク URL テスト
 * 全 destination × 楽天・じゃらん の target URL を GET し
 * 以下をエラー判定:
 *   - HTTP 404
 *   - トップページへリダイレクト（最終 URL がトップドメインに変わる）
 *   - 検索結果 0 件（HTML 内の 0件文言を検出）
 *
 * Usage:
 *   node _hotel_url_test.js             # 全246件（並列10）
 *   node _hotel_url_test.js --dry       # URL一覧のみ（HTTP なし）
 *   node _hotel_url_test.js --concur=5  # 並列数指定
 */

const fs    = require('fs');
const https = require('https');
const http  = require('http');
const { URL } = require('url');

const DRY_RUN  = process.argv.includes('--dry');
const CONCUR   = parseInt((process.argv.find(a => a.startsWith('--concur=')) || '--concur=10').split('=')[1]);
const TIMEOUT  = 15000;

const areas = JSON.parse(fs.readFileSync('src/data/hotelAreas.json', 'utf8'));
const dests = JSON.parse(fs.readFileSync('src/data/destinations.json', 'utf8'));
const areaMap = new Map(areas.map(a => [a.id, a]));

function resolveKeyword(dest) {
  if (dest.hotelArea) {
    const area = areaMap.get(dest.hotelArea);
    if (area?.rakutenKeyword) return area.rakutenKeyword;
  }
  return `${dest.prefecture} ${dest.city}`;
}

/* ── URL 生成 ── */

function rakutenUrl(kw) {
  return `https://kw.travel.rakuten.co.jp/keyword/Search.do?f_query=${encodeURIComponent(kw)}`;
}

function jalanUrl(kw) {
  return `https://www.jalan.net/uw/uwp1700/uww1701.do?keyword=${encodeURIComponent(kw)}`;
}

/* ── HTTP GET（リダイレクト追跡・最大5hop） ── */

function httpGet(rawUrl, hopCount = 0) {
  return new Promise(resolve => {
    if (hopCount > 5) return resolve({ status: 0, finalUrl: rawUrl, body: '', error: 'too many redirects' });

    let parsed;
    try { parsed = new URL(rawUrl); } catch {
      return resolve({ status: 0, finalUrl: rawUrl, body: '', error: 'invalid url' });
    }

    const mod = parsed.protocol === 'https:' ? https : http;
    const opts = {
      hostname: parsed.hostname,
      path:     parsed.pathname + parsed.search,
      method:   'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36',
        'Accept':     'text/html,application/xhtml+xml',
        'Accept-Language': 'ja,en;q=0.9',
      },
      timeout: TIMEOUT,
    };

    const req = mod.request(opts, res => {
      const status = res.statusCode;
      const loc    = res.headers['location'];

      // リダイレクト
      if ((status === 301 || status === 302 || status === 303 || status === 307 || status === 308) && loc) {
        const next = loc.startsWith('http') ? loc : `${parsed.protocol}//${parsed.hostname}${loc}`;
        res.resume();
        return httpGet(next, hopCount + 1).then(resolve);
      }

      // Body 読み取り（最大 128KB）
      let body = '';
      res.setEncoding('utf8');
      res.on('data', chunk => { if (body.length < 131072) body += chunk; });
      res.on('end', () => resolve({ status, finalUrl: rawUrl, body, error: null }));
    });

    req.on('timeout', () => { req.destroy(); resolve({ status: 0, finalUrl: rawUrl, body: '', error: 'timeout' }); });
    req.on('error', e => resolve({ status: 0, finalUrl: rawUrl, body: '', error: e.message }));
    req.end();
  });
}

/* ── エラー判定 ── */

const RAKUTEN_TOP_PATTERNS = [
  'travel.rakuten.co.jp/top',
  'travel.rakuten.co.jp/"',
  '<title>楽天トラベル</title>',
];
const RAKUTEN_ZERO_PATTERNS = [
  '該当する宿泊施設はありません',
  '0件見つかりました',
  '検索結果0件',
  'ご指定の条件に合う宿泊施設が見つかりませんでした',
];

const JALAN_TOP_PATTERNS = [
  'jalan.net/index.html',
  '<title>じゃらんnet</title>',
  'window.location="/"',
];
const JALAN_ZERO_PATTERNS = [
  '0件見つかりました',
  '宿・ホテルが見つかりませんでした',
  'ご指定の条件に合う宿が見つかりません',
  '該当する施設はありませんでした',
  'searchResultCount">0<',
  '結果：0件',
];

function checkRakuten(result) {
  if (result.error)  return { ok: false, reason: `ERROR:${result.error}` };
  if (result.status === 404) return { ok: false, reason: '404' };
  if (result.status === 0)   return { ok: false, reason: `接続失敗` };
  const body = result.body;
  for (const p of RAKUTEN_TOP_PATTERNS) {
    if (body.includes(p)) return { ok: false, reason: 'トップページにリダイレクト' };
  }
  for (const p of RAKUTEN_ZERO_PATTERNS) {
    if (body.includes(p)) return { ok: false, reason: '検索結果0件' };
  }
  // 宿一覧の存在チェック
  if (!body.includes('hotelName') && !body.includes('hotel-name') && !body.includes('宿泊施設')) {
    return { ok: false, reason: '宿一覧が見つからない' };
  }
  return { ok: true, reason: null };
}

function checkJalan(result) {
  if (result.error)  return { ok: false, reason: `ERROR:${result.error}` };
  if (result.status === 404) return { ok: false, reason: '404' };
  if (result.status === 0)   return { ok: false, reason: `接続失敗` };
  const body = result.body;
  for (const p of JALAN_TOP_PATTERNS) {
    if (body.includes(p)) return { ok: false, reason: 'トップページにリダイレクト' };
  }
  for (const p of JALAN_ZERO_PATTERNS) {
    if (body.includes(p)) return { ok: false, reason: '検索結果0件' };
  }
  // 宿一覧の存在チェック
  if (!body.includes('yad') && !body.includes('宿') && !body.includes('ホテル')) {
    return { ok: false, reason: '宿一覧が見つからない' };
  }
  return { ok: true, reason: null };
}

/* ── 並列実行ヘルパー ── */

async function runConcurrent(tasks, limit) {
  const results = [];
  let i = 0;
  async function worker() {
    while (i < tasks.length) {
      const idx = i++;
      results[idx] = await tasks[idx]();
    }
  }
  const workers = Array.from({ length: Math.min(limit, tasks.length) }, worker);
  await Promise.all(workers);
  return results;
}

/* ── メイン ── */

async function main() {
  console.log(`\n宿リンク URL テスト — ${dests.length}件 × 2サービス`);
  console.log(`並列数: ${CONCUR} | タイムアウト: ${TIMEOUT}ms\n`);

  const rows = dests.map(d => ({
    id: d.id,
    name: d.name,
    kw: resolveKeyword(d),
    rUrl: rakutenUrl(resolveKeyword(d)),
    jUrl: jalanUrl(resolveKeyword(d)),
  }));

  if (DRY_RUN) {
    rows.forEach(r => console.log(`${r.id}\t${r.kw}\n  楽天: ${r.rUrl}\n  じゃらん: ${r.jUrl}`));
    return;
  }

  const errors = [];
  let pass = 0;
  let tested = 0;

  const tasks = rows.flatMap(row => [
    async () => {
      const res = await httpGet(row.rUrl);
      const chk = checkRakuten(res);
      tested++;
      if (!chk.ok) {
        errors.push({ id: row.id, name: row.name, service: '楽天', reason: chk.reason, url: row.rUrl, kw: row.kw });
        process.stdout.write('R');
      } else {
        pass++;
        process.stdout.write('.');
      }
      if (tested % 50 === 0) process.stdout.write(` ${tested}\n`);
    },
    async () => {
      const res = await httpGet(row.jUrl);
      const chk = checkJalan(res);
      tested++;
      if (!chk.ok) {
        errors.push({ id: row.id, name: row.name, service: 'じゃらん', reason: chk.reason, url: row.jUrl, kw: row.kw });
        process.stdout.write('J');
      } else {
        pass++;
        process.stdout.write('.');
      }
      if (tested % 50 === 0) process.stdout.write(` ${tested}\n`);
    },
  ]);

  await runConcurrent(tasks, CONCUR);
  process.stdout.write('\n\n');

  /* 結果出力 */
  const total = rows.length * 2;
  console.log(`=== 結果サマリー ===`);
  console.log(`PASS: ${pass} / ${total}`);
  console.log(`FAIL: ${errors.length} / ${total}`);

  if (errors.length) {
    console.log(`\n--- FAIL 一覧 ---`);
    errors.forEach(e => {
      console.log(`[${e.service}] ${e.id}（${e.name}） — ${e.reason}`);
      console.log(`  keyword: ${e.kw}`);
      console.log(`  URL: ${e.url}`);
    });

    // エラーのある destination のキーワードを修正候補として提示
    const failedIds = [...new Set(errors.map(e => e.id))];
    console.log(`\n--- キーワード修正候補 (${failedIds.length}件) ---`);
    failedIds.forEach(id => {
      const dest = dests.find(d => d.id === id);
      const area = areaMap.get(dest?.hotelArea);
      console.log(`${id}: prefecture="${dest?.prefecture}" city="${dest?.city}" hotelArea="${dest?.hotelArea}" rakutenKeyword="${area?.rakutenKeyword}"`);
    });
  }

  /* JSON レポート出力 */
  const report = {
    tested: new Date().toISOString(),
    total,
    pass,
    fail: errors.length,
    errors,
  };
  fs.writeFileSync('docs/hotel_url_test_result.json', JSON.stringify(report, null, 2));
  console.log(`\n詳細: docs/hotel_url_test_result.json`);
}

main().catch(err => { console.error(err); process.exit(1); });
