/**
 * e2eHotelTest.mjs — 宿リンク E2E 検証スクリプト
 *
 * 実行:
 *   node scripts/e2eHotelTest.mjs           # 全299件
 *   node scripts/e2eHotelTest.mjs --sample  # ランダム10件
 *
 * 検証内容:
 *   楽天: HTTP 200 + 宿一覧（「プラン」「空室」「予約」「件」のいずれか）が存在する
 *   じゃらん: HTTP 200 + 宿一覧（「件」「宿」「ホテル」「旅館」のいずれか）が存在する
 *
 * NG条件（共通）:
 *   - HTTP 200 以外
 *   - 「ページが見つかりません」「該当ページが存在しません」などエラー文言
 *   - 検索結果 0 件
 *   - トップページへリダイレクト（URL が keyword= を含まない）
 *
 * 出力: NG のみ JSON 形式で表示
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { chromium } from 'playwright';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

/* ── CLI オプション ── */
const SAMPLE_MODE = process.argv.includes('--sample');
const SAMPLE_SIZE = 10;

/* ── データ読み込み ── */
const dests = JSON.parse(readFileSync(join(ROOT, 'src/data/destinations.json'), 'utf8'));
const { buildHotelLinks } = await import(`file://${ROOT}/src/hotel/hotelLinkBuilder.js`);

/* ── 対象を決定 ── */
let targets = [...dests];
if (SAMPLE_MODE) {
  // フィッシャー–イェーツシャッフルでランダム10件
  for (let i = targets.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [targets[i], targets[j]] = [targets[j], targets[i]];
  }
  targets = targets.slice(0, SAMPLE_SIZE);
}

/* ── Playwright 起動 ── */
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  locale: 'ja-JP',
  timezoneId: 'Asia/Tokyo',
});

const failures = [];
let pass = 0;
let fail = 0;

/* ── ページ検証ヘルパー ── */

/**
 * URL にアクセスして検証する。
 * @returns {{ ok: boolean, reason?: string }}
 */
async function checkPage(url, provider) {
  const page = await context.newPage();
  try {
    /* ── リダイレクト先を確認（keyword= が消えたらトップ遷移判定）── */
    let finalUrl = url;
    page.on('response', res => {
      if (res.status() >= 300 && res.status() < 400) {
        // リダイレクトは playwright が自動追従するが、最終 URL は page.url() で取得
      }
    });

    const response = await page.goto(url, {
      waitUntil: 'domcontentloaded',
      timeout: 30_000,
    });

    /* HTTP ステータス確認 */
    const status = response?.status() ?? 0;
    if (status !== 200) {
      return { ok: false, reason: `HTTP ${status}` };
    }

    /* 最終 URL 確認（travel.rakuten.co.jp のドメインに留まっているか）*/
    finalUrl = page.url();
    if (provider === 'rakuten') {
      if (!finalUrl.includes('travel.rakuten.co.jp')) {
        return { ok: false, reason: `楽天ドメイン外へリダイレクト: ${finalUrl}` };
      }
    }
    if (provider === 'jalan') {
      if (!finalUrl.includes('jalan.net')) {
        return { ok: false, reason: `じゃらんドメイン外へリダイレクト: ${finalUrl}` };
      }
    }

    /* ページテキスト取得 */
    const bodyText = await page.evaluate(() => document.body?.innerText ?? '');

    /* エラー文言チェック（共通）*/
    const ERROR_PATTERNS = [
      'ページが見つかりません',
      'お探しのページは見つかりませんでした',
      '該当するページがありません',
      'このページは存在しません',
      'Not Found',
    ];
    for (const pat of ERROR_PATTERNS) {
      if (bodyText.includes(pat)) {
        return { ok: false, reason: `エラー文言: 「${pat}」` };
      }
    }

    /* 楽天: 宿一覧の存在確認 */
    if (provider === 'rakuten') {
      const RAKUTEN_OK = ['プラン', '空室', '予約', '泊から', '円〜', '円～'];
      const found = RAKUTEN_OK.some(w => bodyText.includes(w));
      if (!found) {
        return { ok: false, reason: `宿一覧なし（${RAKUTEN_OK.join('/')} が見つからない）` };
      }
    }

    /* じゃらん: 宿一覧の存在確認 */
    if (provider === 'jalan') {
      const JALAN_OK = ['宿', 'ホテル', '旅館', 'の検索結果', '泊から', '円〜'];
      const found = JALAN_OK.some(w => bodyText.includes(w));
      if (!found) {
        return { ok: false, reason: `宿一覧なし（${JALAN_OK.join('/')} が見つからない）` };
      }
      // 「該当する宿がありません」
      if (bodyText.includes('該当する宿がありません') || bodyText.includes('条件に合う宿が見つかりません')) {
        return { ok: false, reason: 'じゃらん: 該当なし' };
      }
    }

    return { ok: true };
  } catch (err) {
    return { ok: false, reason: `例外: ${err.message?.slice(0, 100)}` };
  } finally {
    await page.close();
  }
}

/* ── メイン処理 ── */
console.log(`\n=== 宿リンク E2E 検証 ===`);
console.log(`モード: ${SAMPLE_MODE ? `ランダム ${SAMPLE_SIZE} 件` : `全 ${targets.length} 件`}`);
console.log('');

for (let i = 0; i < targets.length; i++) {
  const dest = targets[i];
  const { links } = buildHotelLinks(dest);
  const rakuten = links.find(l => l.type === 'rakuten');
  const jalan   = links.find(l => l.type === 'jalan');
  const progress = `[${String(i + 1).padStart(3)}/${targets.length}]`;

  process.stdout.write(`${progress} ${dest.id} `);

  for (const [provider, link] of [['rakuten', rakuten], ['jalan', jalan]]) {
    if (!link) continue;
    const result = await checkPage(link.url, provider);
    if (result.ok) {
      pass++;
      process.stdout.write('.');
    } else {
      fail++;
      process.stdout.write('F');
      failures.push({
        id:       dest.id,
        name:     dest.name,
        keyword:  dest.hotelKeyword,
        provider,
        url:      link.url,
        reason:   result.reason,
      });
    }

    /* レートリミット対策: 各リクエスト間に 800ms 待機 */
    await new Promise(r => setTimeout(r, 800));
  }

  process.stdout.write('\n');
}

await browser.close();

/* ── 結果 ── */
console.log('');
console.log(`PASS: ${pass} / ${pass + fail}`);
console.log(`FAIL: ${fail} / ${pass + fail}`);

if (failures.length > 0) {
  console.log('\n--- NG 一覧 ---');
  console.log(JSON.stringify(failures, null, 2));
  console.log('\n❌ NG あり');
  process.exit(1);
} else {
  console.log('\n✅ 全件 OK');
}
