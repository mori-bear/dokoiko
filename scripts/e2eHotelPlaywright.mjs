/**
 * e2eHotelPlaywright.mjs — 宿アフィリエイト収益検証スクリプト
 *
 * 実行:
 *   node scripts/e2eHotelPlaywright.mjs              # 全件
 *   node scripts/e2eHotelPlaywright.mjs --sample     # ランダム20件
 *   node scripts/e2eHotelPlaywright.mjs --id nikko   # 特定IDのみ
 *   node scripts/e2eHotelPlaywright.mjs --json       # NG件をJSON出力
 *
 * 収益導線の完全検証:
 *   1. リダイレクト追跡（楽天AFL / じゃらんVC）
 *   2. アフィリエイトパラメータ確認
 *      楽天: scid= が最終URLに存在
 *      じゃらん: vos= が最終URLに存在
 *   3. 宿一覧DOM確認（宿0件NG / 「該当なし」NG）
 *
 * NG判定:
 *   - HTTP 404
 *   - トップページへのリダイレクト
 *   - 宿0件 / 「該当する宿がありません」
 *   - アフィリエイトパラメータ消失（scid / vos）
 *
 * 出力: NGのみ { id, keyword, url, finalUrl, reason }
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { chromium } from 'playwright';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

/* ── CLI オプション ── */
const SAMPLE_MODE = process.argv.includes('--sample');
const SAMPLE_SIZE = 20;
const JSON_MODE   = process.argv.includes('--json');
const ID_FLAG_IDX = process.argv.indexOf('--id');
const FILTER_ID   = ID_FLAG_IDX >= 0 ? process.argv[ID_FLAG_IDX + 1] : null;

/* ── データ読み込み ── */
const dests = JSON.parse(readFileSync(join(ROOT, 'src/data/destinations.json'), 'utf8'));
const { buildHotelLinks } = await import(`file://${ROOT}/src/hotel/hotelLinkBuilder.js`);

/* ── 対象決定 ── */
let targets = [...dests];
if (FILTER_ID) {
  targets = targets.filter(d => d.id === FILTER_ID);
  if (targets.length === 0) {
    console.error(`ERROR: id="${FILTER_ID}" が見つかりません`);
    process.exit(1);
  }
} else if (SAMPLE_MODE) {
  for (let i = targets.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [targets[i], targets[j]] = [targets[j], targets[i]];
  }
  targets = targets.slice(0, SAMPLE_SIZE);
}

/* ══════════════════════════════════════════
   判定定数
   ══════════════════════════════════════════ */

/* 楽天: 宿一覧OKワード（これらのいずれかが DOM に存在すれば宿一覧あり） */
const RAKUTEN_OK_WORDS = ['プラン', '空室', '泊から', '円〜', '円～', '一泊', '素泊', '朝食'];

/* 楽天: NG文言 */
const RAKUTEN_NG_WORDS = [
  'ページが見つかりません',
  'お探しのページは見つかりませんでした',
  'このページは存在しません',
  'Not Found',
];

/* じゃらん: 宿一覧OKワード */
const JALAN_OK_WORDS = ['の検索結果', '泊から', '宿・ホテル', '件の宿', '円〜', '件中'];

/* じゃらん: NG文言 */
const JALAN_NG_WORDS = [
  '該当する宿がありません',
  '条件に合う宿が見つかりません',
  '該当ページが存在しません',
  'ページが見つかりません',
  'お探しのページは',
  'Not Found',
];

/* 待機時間 */
const REQ_INTERVAL_MS = 1200;

/* ══════════════════════════════════════════
   DOM テキスト取得（リトライ付き）
   じゃらん VC リダイレクト後の JS ナビゲーションで
   "Execution context destroyed" が起きうるため 3 回リトライ
   ══════════════════════════════════════════ */

async function getBodyText(page, maxAttempts = 3) {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      await page.waitForLoadState('domcontentloaded', { timeout: 5000 }).catch(() => {});
      const text = await page.evaluate(() => document.body?.innerText ?? '');
      if (text.length >= 200) return text;
    } catch {
      /* context destroyed — 待機して再試行 */
    }
    if (attempt < maxAttempts - 1) {
      await new Promise(r => setTimeout(r, 1500));
    }
  }
  /* 最終試行 */
  try {
    return await page.evaluate(() => document.body?.innerText ?? '');
  } catch {
    return '';
  }
}

/* ══════════════════════════════════════════
   収益検証コア
   ══════════════════════════════════════════ */

/**
 * @param {string} url        - アフィリエイトURL（楽天AFL or じゃらんVC）
 * @param {'rakuten'|'jalan'} provider
 * @param {import('playwright').BrowserContext} context
 * @returns {Promise<{finalUrl: string, reason: string} | null>}
 *   null = PASS、オブジェクト = NG（reason に理由）
 */
async function checkRevenue(url, provider, context) {
  const page = await context.newPage();
  let finalUrl = url;

  try {
    /* ── Step 1: ナビゲーション（リダイレクト追跡） ── */
    let response = null;

    try {
      response = await page.goto(url, {
        waitUntil: 'domcontentloaded',
        timeout: 35_000,
      });
    } catch (navErr) {
      /* リダイレクトチェーン途中でのエラー（context destroyed 等）
       * page.url() が有効なら続行する */
      finalUrl = page.url() || url;
      if (!finalUrl || finalUrl === 'about:blank') {
        return { finalUrl: url, reason: `ナビゲーション失敗: ${navErr.message?.slice(0, 120)}` };
      }
      /* ページには到達しているので続行 */
    }

    /* JS ナビゲーション（リダイレクト後の追加遷移）が落ち着くまで待機
     * タイムアウトは許容（その時点の URL を使う） */
    await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});
    finalUrl = page.url() || finalUrl;

    const status = response?.status() ?? 200;

    /* ── Step 2: HTTP ステータス確認 ── */
    if (status === 404) {
      return { finalUrl, reason: `HTTP 404` };
    }

    /* ── Step 3: 遷移先ドメイン確認 ── */
    if (provider === 'rakuten') {
      if (!finalUrl.includes('travel.rakuten.co.jp')) {
        return {
          finalUrl,
          reason: `楽天AFL: travel.rakuten.co.jp に遷移せず → ${finalUrl}`,
        };
      }
      /* トップページへのリダイレクト（エリアパス未登録） */
      try {
        const urlObj = new URL(finalUrl);
        if (urlObj.pathname === '/' || urlObj.pathname === '') {
          return {
            finalUrl,
            reason: `楽天: トップページへリダイレクト（hotelAreas.json にエリアパス未登録の可能性）`,
          };
        }
      } catch { /* URL パース失敗は無視 */ }
    }

    if (provider === 'jalan') {
      if (!finalUrl.includes('jalan.net')) {
        return {
          finalUrl,
          reason: `じゃらん: jalan.net に遷移せず → ${finalUrl}`,
        };
      }
    }

    /* ── Step 4: アフィリエイトパラメータ確認 ── */
    if (provider === 'rakuten' && !finalUrl.includes('scid=')) {
      return {
        finalUrl,
        reason: `楽天AFL: アフィリエイトパラメータ(scid=)が最終URLに存在しない`,
      };
    }

    if (provider === 'jalan' && !finalUrl.includes('vos=')) {
      return {
        finalUrl,
        reason: `じゃらん: アフィリエイトパラメータ(vos=)が最終URLに存在しない`,
      };
    }

    /* ── Step 5: DOM取得 ── */
    let bodyText = await getBodyText(page);

    /* ── Step 6: NG文言チェック ── */
    const ngWords = provider === 'rakuten' ? RAKUTEN_NG_WORDS : JALAN_NG_WORDS;
    for (const w of ngWords) {
      if (bodyText.includes(w)) {
        return { finalUrl, reason: `NG文言「${w}」を検出` };
      }
    }

    /* ── Step 7: 宿一覧DOM確認 ── */
    const okWords = provider === 'rakuten' ? RAKUTEN_OK_WORDS : JALAN_OK_WORDS;
    let hasHotels = okWords.some(w => bodyText.includes(w));

    if (!hasHotels && bodyText.length > 100) {
      /* OKワード未発見 → 2秒後にリトライ（レートリミット対策） */
      await new Promise(r => setTimeout(r, 2000));
      try {
        bodyText = await page.evaluate(() => document.body?.innerText ?? '');
        finalUrl  = page.url() || finalUrl;
        hasHotels = okWords.some(w => bodyText.includes(w));
      } catch { /* ignore */ }
    }

    if (!hasHotels) {
      return {
        finalUrl,
        reason: `宿一覧なし（${okWords.slice(0, 3).join(' / ')} が見つからない）`,
      };
    }

    return null; /* PASS */

  } catch (err) {
    return {
      finalUrl: (() => { try { return page.url() || url; } catch { return url; } })(),
      reason: `例外: ${err.message?.slice(0, 120)}`,
    };
  } finally {
    await page.close();
  }
}

/* ══════════════════════════════════════════
   メイン
   ══════════════════════════════════════════ */

console.log('\n=== 宿アフィリエイト収益検証 ===');
console.log(`モード: ${FILTER_ID ? `ID="${FILTER_ID}"` : SAMPLE_MODE ? `ランダム ${SAMPLE_SIZE} 件` : `全 ${targets.length} 件`}`);
console.log('検証: リダイレクト追跡 → scid/vos確認 → 宿一覧DOM\n');

const browser = await chromium.launch({ headless: true });
const bContext = await browser.newContext({
  userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  locale:     'ja-JP',
  timezoneId: 'Asia/Tokyo',
});

const ngItems   = [];
let passCount   = 0;
let ngCount     = 0;

for (let i = 0; i < targets.length; i++) {
  const dest  = targets[i];
  const kw    = dest.hotelKeyword ?? dest.name;
  const prog  = `[${String(i + 1).padStart(3)}/${targets.length}]`;
  process.stdout.write(`${prog} ${dest.id.padEnd(22)} `);

  const hotelLinks = buildHotelLinks(dest);

  /* 検証対象リンクを収集（メイン + hubLinks） */
  const toCheck = [];
  for (const link of (hotelLinks.links ?? [])) {
    toCheck.push({ link, hub: false });
  }
  if (hotelLinks.hubLinks?.links?.length) {
    for (const link of hotelLinks.hubLinks.links) {
      toCheck.push({ link, hub: true });
    }
  }

  for (const { link, hub } of toCheck) {
    const ng = await checkRevenue(link.url, link.type, bContext);

    if (ng) {
      ngCount++;
      process.stdout.write('F');
      ngItems.push({
        id:       dest.id,
        name:     dest.name,
        keyword:  kw,
        provider: link.type,
        hub,
        url:      link.url,
        finalUrl: ng.finalUrl,
        reason:   ng.reason,
      });
    } else {
      passCount++;
      process.stdout.write('.');
    }

    await new Promise(r => setTimeout(r, REQ_INTERVAL_MS));
  }

  process.stdout.write('\n');
}

await bContext.close();
await browser.close();

/* ══════════════════════════════════════════
   結果出力
   ══════════════════════════════════════════ */

const total = passCount + ngCount;
console.log(`\nPASS: ${passCount}  FAIL: ${ngCount}  TOTAL: ${total}`);

if (ngItems.length === 0) {
  console.log('\n✅ 全リンク収益導線 OK');
  process.exit(0);
}

/* ── NG 一覧 ── */
console.log('\n────────────────────────────────');
console.log('❌ NG 一覧');
console.log('────────────────────────────────');

for (const item of ngItems) {
  const hubLabel = item.hub ? ' [HUB]' : '';
  console.log(`\n[${item.id}] ${item.name}${hubLabel}  keyword="${item.keyword}"  provider=${item.provider}`);
  console.log(`  url:      ${item.url}`);
  console.log(`  finalUrl: ${item.finalUrl}`);
  console.log(`  reason:   ${item.reason}`);
}

/* ── JSON 出力（--json フラグ時） ── */
if (JSON_MODE) {
  console.log('\n--- JSON ---');
  console.log(JSON.stringify(
    ngItems.map(({ id, keyword, url, finalUrl, reason }) => ({ id, keyword, url, finalUrl, reason })),
    null, 2,
  ));
}

console.log('\n❌ NG あり — 修正後に再実行してください');
process.exit(1);
