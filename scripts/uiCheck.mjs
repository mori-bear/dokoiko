/**
 * uiCheck.mjs — tabidokoiko.com 本番UI最終検証
 * 20回GOボタンを押して宿リンクのUI・遷移を確認
 */

import { chromium } from 'playwright';

const PROD_URL = 'https://tabidokoiko.com';
const TRIALS   = 20;
const ngItems  = [];
let   passCount = 0;

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  locale: 'ja-JP',
  timezoneId: 'Asia/Tokyo',
  viewport: { width: 390, height: 844 },
});

console.log(`\n=== tabidokoiko.com 本番UI最終検証 ===`);
console.log(`${TRIALS}回ランダム抽選 → 宿リンクUI・遷移確認\n`);

for (let i = 1; i <= TRIALS; i++) {
  const page = await context.newPage();
  const label = `[${String(i).padStart(2)}/${TRIALS}]`;

  try {
    /* ── 本番サイトを開く ── */
    await page.goto(PROD_URL, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});

    /* ── 出発地・日程をランダム選択してGO ── */
    const fromSel = page.locator('select').first();
    const opts    = await fromSel.locator('option').allTextContents();
    const validOpts = opts.filter(o => o.trim() && !o.includes('選択'));
    if (validOpts.length > 0) {
      const pick = validOpts[Math.floor(Math.random() * validOpts.length)];
      await fromSel.selectOption({ label: pick });
    }

    /* GOボタンを押す */
    const goBtn = page.locator('button').filter({ hasText: /GO|行こ|決定|検索/ }).first();
    if (await goBtn.isVisible()) {
      await goBtn.click();
    } else {
      /* フォームsubmit fallback */
      await page.keyboard.press('Enter');
    }

    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
    await new Promise(r => setTimeout(r, 1500));

    /* ── 結果取得 ── */
    const destName = await page.locator('h1, h2, .dest-name, [class*="dest"]').first()
      .textContent().catch(() => '(不明)');

    /* ── UI確認: 宿リンクセクション ── */
    const hotelSection = page.locator('[class*="hotel"], [class*="stay"], [class*="yado"]').first();
    const hotelVisible = await hotelSection.isVisible().catch(() => false);

    /* ── 楽天・じゃらんリンク存在確認 ── */
    const rakutenLinks = await page.locator('a[href*="rakuten"], a[href*="hb.afl"]').count();
    const jalanLinks   = await page.locator('a[href*="jalan"], a[href*="valuecommerce"]').count();

    const issues = [];

    if (!hotelVisible && rakutenLinks === 0 && jalanLinks === 0) {
      issues.push('宿リンクセクションが非表示');
    }
    if (rakutenLinks === 0) {
      issues.push('楽天リンクなし');
    }
    if (jalanLinks === 0) {
      issues.push('じゃらんリンクなし');
    }

    /* ── リンクのhref確認 ── */
    if (rakutenLinks > 0) {
      const href = await page.locator('a[href*="rakuten"], a[href*="hb.afl"]').first().getAttribute('href');
      if (!href?.includes('hb.afl.rakuten.co.jp') && !href?.includes('travel.rakuten.co.jp')) {
        issues.push(`楽天リンク href 異常: ${href?.slice(0, 80)}`);
      }
    }

    if (jalanLinks > 0) {
      const href = await page.locator('a[href*="jalan"], a[href*="valuecommerce"]').first().getAttribute('href');
      if (!href?.includes('valuecommerce.com') && !href?.includes('jalan.net')) {
        issues.push(`じゃらんリンク href 異常: ${href?.slice(0, 80)}`);
      }
    }

    if (issues.length === 0) {
      process.stdout.write(`${label} ${destName?.trim().slice(0, 15).padEnd(15)} 楽天×${rakutenLinks} じゃらん×${jalanLinks} ✓\n`);
      passCount++;
    } else {
      process.stdout.write(`${label} ${destName?.trim().slice(0, 15).padEnd(15)} ❌ ${issues.join(' / ')}\n`);
      ngItems.push({ trial: i, dest: destName?.trim(), issues });
    }

  } catch (err) {
    process.stdout.write(`${label} 例外: ${err.message?.slice(0, 80)}\n`);
    ngItems.push({ trial: i, dest: '(例外)', issues: [err.message?.slice(0, 120)] });
  } finally {
    await page.close();
  }

  await new Promise(r => setTimeout(r, 800));
}

await context.close();
await browser.close();

/* ── 結果出力 ── */
console.log(`\nPASS: ${passCount}  FAIL: ${ngItems.length}  TOTAL: ${TRIALS}`);

if (ngItems.length === 0) {
  console.log('\n✅ 全件 PASS — 公開問題なし');
  process.exit(0);
}

console.log('\n────────────────────────────────');
console.log('❌ NG 一覧');
console.log('────────────────────────────────');
for (const item of ngItems) {
  const critical = item.issues.some(i =>
    i.includes('楽天リンクなし') || i.includes('じゃらんリンクなし') || i.includes('例外')
  );
  console.log(`\n[${item.trial}] ${item.dest}  致命度: ${critical ? 'critical' : 'minor'}`);
  item.issues.forEach(iss => console.log(`  - ${iss}`));
}

process.exit(1);
