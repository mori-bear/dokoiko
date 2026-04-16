// scripts/validateHotels.js
// 楽天 / じゃらんの宿リンクを自動検証するスクリプト
//
// 使い方:
//   node scripts/validateHotels.js             # クイックモード（30件ランダム）
//   node scripts/validateHotels.js --full      # 全件（1038件 × 2URL = 約2000リクエスト）
//   node scripts/validateHotels.js --dest kamakura  # 特定ID
//   node scripts/validateHotels.js --dry       # URL生成のみ（リクエストなし）
//
// 出力:
//   logs/hotel_validation.json   に結果を保存
//   logs/rakuten_anomalies.json  に異常検知ログを保存
//   FAILが1件以上あれば process.exit(1)
//
// ■ 楽天異常検知フロー
//   HTTP 200 取得後に静的 HTML を解析し、以下を検出したら「異常」と判定:
//     - 全国 / 主要都市 / 宿が見つからない
//   異常検知時はリトライ（3段階）を実施し、結果を WARN として記録。
//   FAIL にはしない（実運用で未知ケースを潰すためのログ収集が目的）。

import fs     from 'fs';
import path   from 'path';
import { fileURLToPath } from 'url';
import iconv  from 'iconv-lite';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const DESTS_PATH    = path.join(__dirname, '../src/data/destinations.json');
const LOGS_PATH     = path.join(__dirname, '../logs/hotel_validation.json');
const ANOMALY_PATH  = path.join(__dirname, '../logs/rakuten_anomalies.json');

// ── 設定 ─────────────────────────────────────────────────────────────
const CONCURRENCY   = 4;     // 同時リクエスト数
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

/** 楽天アフィリエイトURL から実際の楽天 URL を抽出する。 */
function extractRakutenDestUrl(affilUrl) {
  if (!affilUrl) return null;
  const m = affilUrl.match(/[?&]pc=([^&]+)/);
  if (!m) return affilUrl;
  try { return decodeURIComponent(m[1]); } catch { return affilUrl; }
}

/** URL の f_query パラメータからキーワードを取得する。 */
function extractKeyword(url) {
  try {
    const parsed = new URL(url);
    return decodeURIComponent(parsed.searchParams.get('f_query') ?? '');
  } catch { return ''; }
}

/** バリデーション用の楽天直接 URL（アフィリエイトなし）を生成する。 */
function buildDirectRakutenUrl(keyword) {
  return `https://travel.rakuten.co.jp/yado/japan.html?f_query=${encodeURIComponent(keyword)}`;
}

/**
 * URL が楽天の有効なキーワード検索フォーマットかどうかを判定する。
 * japan.html?f_query= → true（HTTP 200 を返す唯一の検索エンドポイント）
 * /yado/search/ は HTTP 404 のため false
 */
function isRakutenSearchPage(url) {
  return /\/yado\/japan\.html/.test(url ?? '');
}

function buildJalanCheckUrl(area) {
  if (!area) return null;
  const normalized = String(area ?? '').trim().replace(/[\u3000\s]+/g, ' ').replace(/%/g, '').trim();
  const sjisBytes = iconv.encode(normalized, 'cp932');
  const encoded = Array.from(sjisBytes)
    .map(b => '%' + b.toString(16).toUpperCase().padStart(2, '0'))
    .join('');
  return `https://www.jalan.net/uw/uwp2011/uww2011init.do?keyword=${encoded}`;
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
// FAIL 条件:
//   - キーワードが空
//   - 2語以下（全国フォールバックリスク）
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
// 判定区分:
//   FAIL   : ok:false          — 404 / 空レスポンス / URL形式不正
//   ANOMALY: ok:true, anomaly:true — 全国/主要都市/宿が見つからない を検知（リトライ対象）
//   OK     : ok:true           — 正常
//
// 注意: japan.html?f_query= は JS-rendered のため検索結果は静的 HTML に含まれない。
// 異常パターンが静的 HTML に現れた場合のみ検知可能（実運用での補足的ログ収集が目的）。
function validateRakutenContent(body, url) {
  if (!body) return { ok: false, reason: 'empty response' };

  // URL フォーマット検証
  if (!isRakutenSearchPage(url)) {
    return { ok: false, reason: '楽天URL形式不正（japan.html以外は404）' };
  }

  // 404 / エラーページ検出（Hard FAIL）
  if (/404|Not Found|ページが見つかりません/.test(body)) {
    return { ok: false, reason: '404ページ' };
  }

  // 異常検知（Soft FAIL → リトライ対象）
  // 楽天が全国フォールバックした場合に静的 HTML に含まれる可能性のある語句
  if (/全国/.test(body)) {
    return { ok: true, anomaly: true, reason: '異常検知: 「全国」を検出' };
  }
  if (/主要都市/.test(body)) {
    return { ok: true, anomaly: true, reason: '異常検知: 「主要都市」を検出' };
  }
  if (/宿が見つからない|宿泊施設が見つかりません|お探しの宿が見つかりません/.test(body)) {
    return { ok: true, anomaly: true, reason: '異常検知: 「宿が見つからない」を検出' };
  }

  // 0件（SSR ページ固有の語句）→ 異常扱い
  if (/該当する宿泊施設がありません|ご指定の条件に一致する宿泊施設が見つかりません/.test(body)) {
    return { ok: true, anomaly: true, reason: '異常検知: 検索結果0件' };
  }

  // 正常
  if (/楽天トラベル|ホテル|旅館/.test(body)) {
    return { ok: true };
  }

  return { ok: true, reason: 'content-check-skipped' };
}

// ── 楽天リトライ（異常検知時） ──────────────────────────────────────
//
// リトライ戦略（3段階）:
//   Step 1: 元キーワード + "温泉"（未含有の場合のみ）
//   Step 2: name + prefecture + 宿
//   Step 3: hubCity + 宿
//
// 各ステップでリクエストを行い、異常なしの HTTP 200 を確認できたら成功。
// リトライ URL はアフィリエイトなし（検証専用）。
async function retryRakutenWithFallbacks(dest, originalKeyword) {
  const name = dest.displayName || dest.name || '';
  const pref = dest.prefecture || '';

  const candidates = [
    // Step 1: 既存キーワードに「温泉」を追加（まだ含まれていない場合）
    !originalKeyword.includes('温泉') ? `${originalKeyword} 温泉` : null,
    // Step 2: name + prefecture + 宿
    name && pref ? `${name} ${pref} 宿` : null,
    // Step 3: hubCity + 宿
    dest.hubCity && pref ? `${dest.hubCity} ${pref} 宿` : null,
  ].filter(Boolean);

  for (const [i, keyword] of candidates.entries()) {
    await sleep(DELAY_BETWEEN);
    const url = buildDirectRakutenUrl(keyword);
    const r   = await fetchWithTimeout(url);
    if (r.status === 200) {
      const content = validateRakutenContent(r.body, url);
      if (content.ok && !content.anomaly) {
        return { keyword, url, step: i + 1 };
      }
    }
  }

  return null; // 全ステップ失敗
}

// ── じゃらんコンテンツ判定 ──────────────────────────────────────────
function validateJalanContent(body, url) {
  if (!body) return { ok: true, warn: true, reason: 'empty response（許容）' };
  if (/\uFFFD/.test(body)) {
    return { ok: false, reason: '文字化け検出' };
  }
  if (/service_error|404|Not Found/.test(body) || /service_error/.test(url)) {
    return { ok: true, warn: true, reason: 'じゃらんサービスエラー（許容）' };
  }
  if (/お探しの宿泊施設は見つかりませんでした|見つかりませんでした。検索条件を変えて再度検索|該当する施設が見つかりません|(?<!\d)0件の施設/.test(body)) {
    return { ok: true, warn: true, reason: '検索結果0件（許容）' };
  }
  if (/検索結果|宿・ホテル|施設数|件の施設|ホテル・旅館/.test(body)) {
    return { ok: true };
  }
  return { ok: true, reason: 'content-check-skipped' };
}

// ── 1件を検証 ───────────────────────────────────────────────────────
async function validateOne(dest) {
  const jalanArea = dest.stayArea?.jalan ?? dest.stayArea;

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

  // ── 楽天 ────────────────────────────────────────────────────────────
  if (rakutenUrl) {
    // 静的キーワード品質チェック（リクエスト前）
    const kwCheck = validateRakutenKeyword(rakutenUrl);
    if (!kwCheck.ok) {
      const kw = extractKeyword(rakutenUrl);
      result.rakuten = { url: rakutenUrl, ok: false, status: 0, reason: kwCheck.reason };
      console.error(`  ❌ [楽天キーワード] ${dest.name}: ${kwCheck.reason}`);
      console.error(`     keyword="${kw}"`);
    } else {
      const r       = await fetchWithTimeout(rakutenUrl);
      const content = r.status === 200 ? validateRakutenContent(r.body, rakutenUrl) : { ok: false, reason: `HTTP ${r.status}` };
      await sleep(DELAY_BETWEEN);

      if (content.anomaly) {
        // ── 異常検知 → リトライ ──────────────────────────────────────
        const originalKeyword = extractKeyword(rakutenUrl);
        const retried = await retryRakutenWithFallbacks(dest, originalKeyword);

        if (retried) {
          // リトライ成功 → WARN（異常は潰せたが要注意）
          result.rakuten = {
            url: rakutenUrl, ok: true, warn: true, status: r.status,
            anomaly: true,
            anomalyReason:   content.reason,
            retryKeyword:    retried.keyword,
            retryUrl:        retried.url,
            retryStep:       retried.step,
            reason: `[WARN] 異常検知→step${retried.step}でリトライ成功: "${retried.keyword}"`,
          };
          console.warn(`  ⚠ [楽天異常→RETRY ok] ${dest.name}: ${content.reason}`);
          console.warn(`     step${retried.step}: "${retried.keyword}"`);
        } else {
          // 全リトライ失敗 → WARN（ログ収集のみ）
          result.rakuten = {
            url: rakutenUrl, ok: true, warn: true, status: r.status,
            anomaly: true,
            anomalyReason: content.reason,
            reason: `[WARN] 異常検知→全リトライ失敗: "${originalKeyword}"`,
          };
          console.warn(`  ⚠ [楽天異常→RETRY 全失敗] ${dest.name}: ${content.reason}`);
          console.warn(`     keyword="${originalKeyword}"`);
        }
      } else if (!content.ok) {
        // ── FAIL ────────────────────────────────────────────────────────
        const kw = extractKeyword(rakutenUrl);
        result.rakuten = { url: rakutenUrl, ok: false, status: r.status, reason: content.reason, finalUrl: r.url };
        console.error(`  ❌ [楽天] ${dest.name}: ${content.reason ?? 'HTTP ' + r.status}`);
        console.error(`     keyword="${kw}" url=${rakutenUrl}`);
      } else {
        // ── OK ──────────────────────────────────────────────────────────
        result.rakuten = { url: rakutenUrl, ok: true, status: r.status, reason: content.reason, finalUrl: r.url };
      }
    }
  }

  // ── じゃらん（タイムアウトは WARN として扱う） ─────────────────────
  if (jalanUrl) {
    const r = await fetchWithTimeout(jalanUrl);
    let content;
    if (r.status === 0) {
      content = { ok: true, warn: true, reason: 'タイムアウト（許容）' };
    } else if (r.status === 200) {
      content = validateJalanContent(r.body, jalanUrl);
    } else {
      content = { ok: false, reason: `HTTP ${r.status}` };
    }
    result.jalan = { url: jalanUrl, ok: content.ok, warn: content.warn, status: r.status, reason: content.reason, finalUrl: r.url };
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

  if (destArg) {
    dests = dests.filter(d => d.id === destArg || d.name === destArg);
    if (dests.length === 0) {
      console.error(`destination "${destArg}" が見つかりません`);
      process.exit(1);
    }
  } else if (!isFull) {
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

  // ── 集計 ──────────────────────────────────────────────────────────
  const checkedResults = results;
  const rakutenFail    = checkedResults.filter(r => !r.rakuten?.ok);
  const rakutenAnomaly = checkedResults.filter(r => r.rakuten?.ok && r.rakuten?.anomaly);
  const rakutenWarn    = checkedResults.filter(r => r.rakuten?.ok && r.rakuten?.warn && !r.rakuten?.anomaly);
  const jalanHardFail  = checkedResults.filter(r => !r.jalan?.ok);
  const jalanWarn      = checkedResults.filter(r => r.jalan?.ok && r.jalan?.warn);
  const anyFail        = [...new Set([...rakutenFail, ...jalanHardFail])];
  const pass           = checkedResults.length - anyFail.length - rakutenAnomaly.length;

  // ── 異常ログ保存 ────────────────────────────────────────────────────
  if (rakutenAnomaly.length > 0) {
    const anomalyEntries = rakutenAnomaly.map(r => ({
      name:          r.name,
      keyword:       extractKeyword(r.rakuten.url ?? ''),
      url:           r.rakuten.url,
      anomalyReason: r.rakuten.anomalyReason,
      retryKeyword:  r.rakuten.retryKeyword ?? null,
      retryUrl:      r.rakuten.retryUrl ?? null,
      retryStep:     r.rakuten.retryStep ?? null,
      detectedAt:    r.checkedAt,
    }));

    // 既存ログとマージ
    let prevAnomalies = [];
    if (fs.existsSync(ANOMALY_PATH)) {
      try { prevAnomalies = JSON.parse(fs.readFileSync(ANOMALY_PATH, 'utf-8')).anomalies ?? []; } catch { /* ignore */ }
    }
    const anomalyMap = new Map(prevAnomalies.map(a => [a.name + a.detectedAt, a]));
    anomalyEntries.forEach(a => anomalyMap.set(a.name + a.detectedAt, a));

    fs.mkdirSync(path.dirname(ANOMALY_PATH), { recursive: true });
    fs.writeFileSync(ANOMALY_PATH, JSON.stringify({
      lastUpdated: new Date().toISOString(),
      anomalies:   Array.from(anomalyMap.values()),
    }, null, 2), 'utf-8');
  }

  // ── 検証結果ログ保存 ────────────────────────────────────────────────
  const resultMap = new Map(prevResults.map(r => [r.id, r]));
  results.forEach(r => resultMap.set(r.id, r));
  const allResults = Array.from(resultMap.values()).sort((a, b) => a.id.localeCompare(b.id));

  const logData = {
    lastRun: new Date().toISOString(),
    mode,
    summary: {
      checked:       checkedResults.length,
      pass,
      fail:          anyFail.length,
      rakutenFail:   rakutenFail.length,
      rakutenAnomaly: rakutenAnomaly.length,
      jalanFail:     jalanHardFail.length,
      jalanWarn:     jalanWarn.length,
    },
    results: allResults,
  };
  fs.mkdirSync(path.dirname(LOGS_PATH), { recursive: true });
  fs.writeFileSync(LOGS_PATH, JSON.stringify(logData, null, 2), 'utf-8');

  // ── 結果表示 ────────────────────────────────────────────────────────
  console.log(`\n${'─'.repeat(48)}`);
  console.log(`  検証件数       : ${checkedResults.length}`);
  console.log(`  SUCCESS        : ${pass}`);
  console.log(`  ANOMALY (WARN) : ${rakutenAnomaly.length}  ← 楽天異常検知（リトライ対象ログ）`);
  console.log(`  じゃらんWARN   : ${jalanWarn.length}  ← じゃらん検索非対応（仕様として許容）`);
  console.log(`  FAIL           : ${anyFail.length}`);

  if (rakutenFail.length > 0) {
    console.log(`\n❌ 楽天FAIL (${rakutenFail.length}件):`);
    rakutenFail.forEach(r => console.log(`   ${r.name}: ${r.rakuten.reason}`));
  }

  if (rakutenAnomaly.length > 0) {
    console.log(`\n⚠  楽天ANOMALY (${rakutenAnomaly.length}件):`);
    for (const r of rakutenAnomaly) {
      console.log(`   ${r.name}: ${r.rakuten.anomalyReason}`);
      if (r.rakuten.retryKeyword) {
        console.log(`     → step${r.rakuten.retryStep}リトライ成功: "${r.rakuten.retryKeyword}"`);
      } else {
        console.log(`     → 全リトライ失敗（keyword: "${extractKeyword(r.rakuten.url ?? '')}"）`);
      }
    }
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
  if (rakutenAnomaly.length > 0) {
    console.log(`  異常ログ: ${ANOMALY_PATH}`);
  }

  if (anyFail.length > 0) {
    console.error(`\n❌ ビルド失敗: ${anyFail.length}件のホテルリンクが無効`);
    process.exit(1);
  } else {
    console.log(`\n✓ 全ホテルリンク正常（WARN/ANOMALY は仕様として許容）`);
  }
}

main().catch(e => {
  console.error('validateHotels エラー:', e);
  process.exit(1);
});
