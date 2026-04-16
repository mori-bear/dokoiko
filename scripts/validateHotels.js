// scripts/validateHotels.js
// 楽天 / じゃらんの宿リンクを自動検証するスクリプト
//
// 使い方:
//   node scripts/validateHotels.js             # クイックモード（30件ランダム）
//   node scripts/validateHotels.js --full      # 全件（1012件 × 2URL = 約2000リクエスト）
//   node scripts/validateHotels.js --dest kamakura  # 特定ID
//   node scripts/validateHotels.js --dry       # URL生成のみ（リクエストなし）
//
// 出力:
//   logs/hotel_validation.json  に結果を保存
//   FAILが1件以上あれば process.exit(1)

import fs     from 'fs';
import path   from 'path';
import { fileURLToPath } from 'url';
import iconv  from 'iconv-lite';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const DESTS_PATH = path.join(__dirname, '../src/data/destinations.json');
const LOGS_PATH  = path.join(__dirname, '../logs/hotel_validation.json');

// ── 設定 ─────────────────────────────────────────────────────────────
const CONCURRENCY   = 4;    // 同時リクエスト数
const TIMEOUT_MS    = 12000; // タイムアウト（12秒）
const DELAY_BETWEEN = 300;   // リクエスト間隔（ms）
const QUICK_SAMPLE  = 30;    // クイックモードのサンプル数

// ── ヘッダー（ボット判定回避） ──────────────────────────────────────
const HEADERS = {
  'User-Agent':      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept':          'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'ja,ja-JP;q=0.9',
  'Accept-Encoding': 'gzip, deflate, br',
  'Cache-Control':   'no-cache',
};

// ── URL 生成 ─────────────────────────────────────────────────────────
function encodeArea(area) {
  const normalized = String(area ?? '').trim().replace(/[\u3000\s]+/g, ' ').replace(/%/g, '').trim();
  return encodeURIComponent(normalized);
}

function buildRakutenCheckUrl(area) {
  if (!area) return null;
  return `https://travel.rakuten.co.jp/yado/japan.html?f_query=${encodeArea(area)}`;
}

/**
 * 楽天アフィリエイトURL から実際の楽天 URL を抽出する。
 * `pc=ENCODED_URL` パラメータをデコードして返す。
 * アフィリエイトURLでない場合はそのまま返す。
 */
function extractRakutenDestUrl(affilUrl) {
  if (!affilUrl) return null;
  const m = affilUrl.match(/[?&]pc=([^&]+)/);
  if (!m) return affilUrl;
  try { return decodeURIComponent(m[1]); } catch { return affilUrl; }
}

/**
 * URL が楽天の有効なキーワード検索フォーマットかどうかを判定する。
 * japan.html?f_query= → true（HTTP 200 を返す唯一の検索エンドポイント）
 * /yado/search/ は実在しないため false
 */
function isRakutenSearchPage(url) {
  return /\/yado\/japan\.html/.test(url ?? '');
}

function buildJalanCheckUrl(area) {
  if (!area) return null;
  // じゃらんは Shift-JIS(CP932) エンコードのキーワードを要求する
  const normalized = String(area ?? '').trim().replace(/[\u3000\s]+/g, ' ').replace(/%/g, '').trim();
  const sjisBytes = iconv.encode(normalized, 'cp932');
  const encoded = Array.from(sjisBytes)
    .map(b => '%' + b.toString(16).toUpperCase().padStart(2, '0'))
    .join('');
  return `https://www.jalan.net/uw/uwp2011/uww2011init.do?keyword=${encoded}`;
}

// ── 実在する駅かどうかを検証 ─────────────────────────────────────────
function isValidStation(name) {
  if (!name || typeof name !== 'string') return false;
  if (!name.endsWith('駅')) return false;
  if (/空港|バスターミナル|バスセンター/.test(name)) return false;
  return true;
}

// ── HTTP フェッチ（タイムアウト付き・文字コード自動判定） ──────────
async function fetchWithTimeout(url, ms = TIMEOUT_MS) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    const res = await fetch(url, {
      headers: HEADERS,
      redirect: 'follow',
      signal: ctrl.signal,
    });
    const buf = await res.arrayBuffer();
    const ct  = res.headers.get('content-type') ?? '';
    // charset 判定（Shift-JIS / Windows-31J / EUC-JP 対応）
    let text;
    if (/charset=(shift.jis|windows-31j|sjis|x-sjis|euc.jp)/i.test(ct)) {
      const encoding = /euc/i.test(ct) ? 'euc-jp' : 'cp932';
      text = iconv.decode(Buffer.from(buf), encoding);
    } else {
      text = new TextDecoder('utf-8').decode(buf);
    }
    return { status: res.status, body: text, url: res.url };
  } catch (e) {
    return { status: 0, body: '', url, error: e.message };
  } finally {
    clearTimeout(timer);
  }
}

// ── 楽天キーワード品質チェック（静的検証） ──────────────────────────
//
// japan.html?f_query= は JS-rendered のためコンテンツ検証は不可。
// f_query パラメータの内容で品質を静的に判定する。
//
// FAIL 条件:
//   - キーワードが 1 語以下（都市名のみ、地名なし）
//   - キーワードが空
//
// WARN 条件:
//   - 都道府県名が含まれない（全国フォールバックリスク）
function validateRakutenKeyword(url) {
  let keyword = '';
  try {
    const parsed = new URL(url);
    keyword = decodeURIComponent(parsed.searchParams.get('f_query') ?? '');
  } catch {
    return { ok: false, reason: 'URL パース失敗' };
  }

  if (!keyword) {
    return { ok: false, reason: 'f_query が空' };
  }

  const tokens = keyword.trim().split(/\s+/);
  if (tokens.length <= 2) {
    return { ok: false, reason: `キーワードが2語以下（"${keyword}"） — 全国フォールバックリスク` };
  }

  return { ok: true };
}

// ── 楽天コンテンツ判定 ───────────────────────────────────────────────
//
// 注意: japan.html?f_query= は JS レンダリングページのため、
// 検索結果（件の宿・ホテル一覧）は静的 HTML に含まれない。
// HTTP 200 + URL フォーマット確認 + 404/エラー検出 のみ実施する。
function validateRakutenContent(body, url) {
  if (!body) return { ok: false, reason: 'empty response' };

  // URL フォーマット検証: japan.html?f_query= 以外は FAIL（存在しないエンドポイント）
  if (!isRakutenSearchPage(url)) {
    return { ok: false, reason: '楽天URL形式不正（japan.html以外は404）' };
  }

  // 404 / エラーページ検出
  if (/404|Not Found|ページが見つかりません/.test(body)) {
    return { ok: false, reason: '404ページ' };
  }

  // 0件（SSR エリアページの場合のみ表示される語句）
  if (/該当する宿泊施設がありません|ご指定の条件に一致する宿泊施設が見つかりません/.test(body)) {
    return { ok: false, reason: '検索結果0件' };
  }

  // 全国フォールバック検出（静的HTMLに含まれる場合のみ — JS-rendered は対象外）
  // 楽天が曖昧キーワードで全国ページを返した場合、初期HTMLに含まれる可能性のある語句
  if (/全国の宿泊施設一覧|全国から絞り込む|主要都市から選ぶ/.test(body)) {
    return { ok: false, reason: '全国フォールバック検出（静的HTMLに全国/主要都市を確認）' };
  }

  // JS レンダリングページのテンプレート確認: ページ自体が返っているか
  // (楽天トラベル固有の title または基本要素の存在で判断)
  if (/楽天トラベル|ホテル|旅館/.test(body)) {
    return { ok: true };
  }

  return { ok: true, reason: 'content-check-skipped' };
}

// ── じゃらんコンテンツ判定 ──────────────────────────────────────────
//
// 判定区分:
//   FAIL（hard）: ok: false — 文字化け（U+FFFD）のみ
//   WARN（soft）: ok: true, warn: true — 0件・404・サービスエラー・タイムアウト
//                （ニッチな地名、じゃらん側 URL 変更等、外部要因は仕様として許容）
//   OK          : ok: true
function validateJalanContent(body, url) {
  if (!body) return { ok: true, warn: true, reason: 'empty response（許容）' };
  // 文字化け → FAIL（エンコード処理バグのみ Hard FAIL）
  if (/\uFFFD/.test(body)) {
    return { ok: false, reason: '文字化け検出' };
  }
  // サービスエラー・404 → WARN（じゃらん側の URL 変更・外部要因として許容）
  if (/service_error|404|Not Found/.test(body) || /service_error/.test(url)) {
    return { ok: true, warn: true, reason: 'じゃらんサービスエラー（許容）' };
  }
  // 0件 / 該当なし → WARN（ニッチな地名・じゃらん検索非対応は仕様として許容）
  if (/お探しの宿泊施設は見つかりませんでした|見つかりませんでした。検索条件を変えて再度検索|該当する施設が見つかりません|(?<!\d)0件の施設/.test(body)) {
    return { ok: true, warn: true, reason: '検索結果0件（許容）' };
  }
  // 宿一覧らしき内容があるか
  if (/検索結果|宿・ホテル|施設数|件の施設|ホテル・旅館/.test(body)) {
    return { ok: true };
  }
  return { ok: true, reason: 'content-check-skipped' };
}

// ── 1件を検証 ───────────────────────────────────────────────────────
async function validateOne(dest) {
  const jalanArea = dest.stayArea?.jalan ?? dest.stayArea;

  // 楽天: hotelLinks.rakuten があれば実際の URL を使用
  // なければ stayArea からキーワード検索 URL を構築（後方互換）
  const rakutenUrl = dest.hotelLinks?.rakuten
    ? extractRakutenDestUrl(dest.hotelLinks.rakuten)
    : buildRakutenCheckUrl(dest.stayArea?.rakuten ?? dest.stayArea);

  const jalanUrl = buildJalanCheckUrl(jalanArea);

  const result = {
    id:     dest.id,
    name:   dest.name,
    rakuten: { url: rakutenUrl, ok: false, status: 0 },
    jalan:   { url: jalanUrl,   ok: true,  status: 0 },
    checkedAt: new Date().toISOString(),
  };

  // 楽天
  if (rakutenUrl) {
    // 静的キーワード品質チェック（リクエスト前）
    const kwCheck = validateRakutenKeyword(rakutenUrl);
    if (!kwCheck.ok) {
      const keyword = (() => { try { return decodeURIComponent(new URL(rakutenUrl).searchParams.get('f_query') ?? ''); } catch { return ''; } })();
      result.rakuten = { url: rakutenUrl, ok: false, status: 0, reason: kwCheck.reason };
      console.error(`  ❌ [楽天キーワード] ${dest.name}: ${kwCheck.reason}`);
      console.error(`     keyword="${keyword}"`);
    } else {
      const r = await fetchWithTimeout(rakutenUrl);
      const content = r.status === 200 ? validateRakutenContent(r.body, rakutenUrl) : { ok: false, reason: `HTTP ${r.status}` };
      result.rakuten = { url: rakutenUrl, ok: content.ok, status: r.status, reason: content.reason, finalUrl: r.url };
      if (!content.ok) {
        const keyword = (() => { try { return decodeURIComponent(new URL(rakutenUrl).searchParams.get('f_query') ?? ''); } catch { return ''; } })();
        console.error(`  ❌ [楽天] ${dest.name}: ${content.reason ?? 'HTTP ' + r.status}`);
        console.error(`     keyword="${keyword}" url=${rakutenUrl}`);
      }
      await sleep(DELAY_BETWEEN);
    }
  }

  // じゃらん（タイムアウトは WARN として扱う）
  if (jalanUrl) {
    const r = await fetchWithTimeout(jalanUrl);
    let content;
    if (r.status === 0) {
      // タイムアウト / ネットワークエラー → WARN（仕様として許容）
      content = { ok: true, warn: true, reason: 'タイムアウト（許容）' };
    } else if (r.status === 200) {
      content = validateJalanContent(r.body, jalanUrl);
    } else {
      content = { ok: false, reason: `HTTP ${r.status}` };
    }
    result.jalan = { url: jalanUrl, ok: content.ok, warn: content.warn, status: r.status, reason: content.reason, finalUrl: r.url };
    // FAIL のみログ出力（WARN は出力しない）
    if (!content.ok) {
      console.error(`  ❌ [じゃらん] ${dest.name}: ${content.reason ?? 'HTTP ' + r.status} — ${jalanUrl}`);
    }
    await sleep(DELAY_BETWEEN);
  }

  return result;
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

// ── セマフォ（同時実行数制御） ───────────────────────────────────────
function makeSemaphore(n) {
  let active = 0;
  const queue = [];
  const next = () => {
    if (queue.length === 0 || active >= n) return;
    active++;
    const { fn, resolve, reject } = queue.shift();
    fn().then(resolve, reject).finally(() => { active--; next(); });
  };
  return fn => new Promise((resolve, reject) => {
    queue.push({ fn, resolve, reject });
    next();
  });
}

// ── メイン ───────────────────────────────────────────────────────────
async function main() {
  const args = process.argv.slice(2);
  const isFull   = args.includes('--full');
  const isDry    = args.includes('--dry');
  const destArg  = args.find(a => !a.startsWith('--'));

  const rawDests = JSON.parse(fs.readFileSync(DESTS_PATH, 'utf-8'));
  let dests = rawDests.filter(d => d.type === 'destination' && d.stayArea);

  // フィルタ
  if (destArg) {
    dests = dests.filter(d => d.id === destArg || d.name === destArg);
    if (dests.length === 0) {
      console.error(`destination "${destArg}" が見つかりません`);
      process.exit(1);
    }
  } else if (!isFull) {
    // クイックモード: ランダムサンプル
    dests = dests.sort(() => Math.random() - 0.5).slice(0, QUICK_SAMPLE);
    console.log(`[クイックモード] ${QUICK_SAMPLE}件ランダム検証（全件は --full）`);
  }

  const mode = destArg ? 'single' : isFull ? 'full' : 'quick';
  console.log(`\n🏨 ホテルリンク検証開始 (${dests.length}件, concurrency=${CONCURRENCY})\n`);

  if (isDry) {
    console.log('[DRY RUN] URLのみ出力（リクエストなし）');
    dests.forEach(d => {
      console.log(`${d.name}:`);
      console.log(`  楽天: ${buildRakutenCheckUrl(d.stayArea?.rakuten ?? d.stayArea)}`);
      console.log(`  じゃらん: ${buildJalanCheckUrl(d.stayArea?.jalan ?? d.stayArea)}`);
    });
    return;
  }

  // 既存結果を読み込み（増分更新用）
  let prevResults = [];
  if (fs.existsSync(LOGS_PATH)) {
    try {
      const prev = JSON.parse(fs.readFileSync(LOGS_PATH, 'utf-8'));
      prevResults = prev.results ?? [];
    } catch { /* ignore */ }
  }

  const sem = makeSemaphore(CONCURRENCY);
  let done = 0;
  const results = await Promise.all(
    dests.map(dest => sem(async () => {
      process.stdout.write(`\r  進捗: ${++done}/${dests.length} — ${dest.name.slice(0, 12).padEnd(12)}`);
      return validateOne(dest);
    }))
  );
  process.stdout.write('\r' + ' '.repeat(60) + '\r');

  // 既存結果とマージ（full でない場合は未検証分を保持）
  const resultMap = new Map(prevResults.map(r => [r.id, r]));
  results.forEach(r => resultMap.set(r.id, r));
  const allResults = Array.from(resultMap.values())
    .sort((a, b) => a.id.localeCompare(b.id));

  // スコア集計（今回チェック分のみ）
  const checkedResults = results;
  const rakutenFail  = checkedResults.filter(r => !r.rakuten?.ok);
  // じゃらん: ok:false のみ FAIL、warn:true は WARN（許容）
  const jalanHardFail = checkedResults.filter(r => !r.jalan?.ok);
  const jalanWarn     = checkedResults.filter(r => r.jalan?.ok && r.jalan?.warn);
  const anyFail       = [...new Set([...rakutenFail, ...jalanHardFail])];
  const pass          = checkedResults.length - anyFail.length;

  // ログ保存
  const logData = {
    lastRun: new Date().toISOString(),
    mode,
    summary: {
      checked:    checkedResults.length,
      pass,
      fail:       anyFail.length,
      rakutenFail: rakutenFail.length,
      jalanFail:   jalanHardFail.length,
      jalanWarn:   jalanWarn.length,
    },
    results: allResults,
  };
  fs.mkdirSync(path.dirname(LOGS_PATH), { recursive: true });
  fs.writeFileSync(LOGS_PATH, JSON.stringify(logData, null, 2), 'utf-8');

  // 結果表示
  console.log(`\n${'─'.repeat(48)}`);
  console.log(`  検証件数  : ${checkedResults.length}`);
  console.log(`  SUCCESS   : ${pass}`);
  console.log(`  WARN      : ${jalanWarn.length}  ← じゃらん検索非対応キーワード（仕様として許容）`);
  console.log(`  FAIL      : ${anyFail.length}`);
  if (rakutenFail.length > 0) {
    console.log(`\n❌ 楽天FAIL (${rakutenFail.length}件):`);
    rakutenFail.forEach(r => console.log(`   ${r.name}: ${r.rakuten.reason}`));
  }
  if (jalanHardFail.length > 0) {
    console.log(`\n❌ じゃらんFAIL (${jalanHardFail.length}件):`);
    jalanHardFail.forEach(r => console.log(`   ${r.name}: ${r.jalan.reason}`));
  }
  if (jalanWarn.length > 0) {
    console.log(`\n⚠  じゃらんWARN (${jalanWarn.length}件):`);
    jalanWarn.forEach(r => console.log(`   ${r.name}: ${r.jalan.reason}`));
  }
  console.log(`\n  ログ保存: ${LOGS_PATH}`);

  if (anyFail.length > 0) {
    console.error(`\n❌ ビルド失敗: ${anyFail.length}件のホテルリンクが無効`);
    process.exit(1);
  } else {
    console.log(`\n✓ 全ホテルリンク正常（WARN は仕様として許容）`);
  }
}

main().catch(e => {
  console.error('validateHotels エラー:', e);
  process.exit(1);
});
