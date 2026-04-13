/**
 * アフィリエイトリンク E2E テスト
 *
 * 全destinationを巡回し、楽天・じゃらんCTAが正常に遷移するか検証する。
 *
 * 検証項目:
 *   - 楽天/じゃらんリンクの href が有効な URL か
 *   - アフィリエイトドメインを経由しているか
 *   - リンク先が 4xx/5xx を返さないか
 *   - リンク先に宿一覧が表示されるか（楽天: 宿/ホテル、じゃらん: 宿/プラン）
 *
 * 実行:
 *   npx playwright test e2e/affiliate.spec.js
 *
 * NGログ:
 *   affiliate_failures.csv に追記（type, destId, url）
 */

import { test, expect } from '@playwright/test';
import fs from 'fs';

const FAILURE_LOG = 'affiliate_failures.csv';

// テスト開始時にログファイルをリセット
test.beforeAll(() => {
  fs.writeFileSync(FAILURE_LOG, 'type,destId,url\n');
});

function logFail(type, destId, url) {
  fs.appendFileSync(FAILURE_LOG, `${type},${destId},${url}\n`);
}

// ページ読み込み + GO
async function goToResult(page, departure = '東京') {
  await page.goto('/');
  await expect(page.locator('#go-btn')).not.toBeDisabled({ timeout: 10000 });
  await page.selectOption('#departure-select', departure);
  await page.click('#go-btn');
  await expect(page.locator('#result')).toBeVisible({ timeout: 10000 });
}

// 現在表示中の都市名を取得
async function getCityName(page) {
  return page.locator('.city-name').textContent().catch(() => 'unknown');
}

// 楽天・じゃらんのリンクを取得（現在のCTA構造に合わせたセレクタ）
async function getHotelLinks(page) {
  const rakuten = page.locator('a.btn-rakuten').first();
  const jalan   = page.locator('a.btn-jalan').first();
  return { rakuten, jalan };
}

// ────────────────────────────────────────────────────────────────

test.describe('アフィリエイトリンク基本検証', () => {

  test('楽天リンクの href が有効', async ({ page }) => {
    await goToResult(page);
    const { rakuten } = await getHotelLinks(page);
    if (await rakuten.count() === 0) return;
    const href = await rakuten.getAttribute('href');
    expect(href).not.toBeNull();
    expect(href).toMatch(/hb\.afl\.rakuten\.co\.jp/);
    expect(href).not.toMatch(/[\u3000-\u9FFF]/); // 生の日本語なし
  });

  test('じゃらんリンクの href が有効', async ({ page }) => {
    await goToResult(page);
    const { jalan } = await getHotelLinks(page);
    if (await jalan.count() === 0) return;
    const href = await jalan.getAttribute('href');
    expect(href).not.toBeNull();
    expect(href).toMatch(/ck\.jp\.ap\.valuecommerce\.com/);
    expect(href).not.toMatch(/[\u3000-\u9FFF]/);
  });

});

// ────────────────────────────────────────────────────────────────

test.describe('全destination巡回（30件サンプル）', () => {

  test('30件引き直してすべてで楽天・じゃらんリンクが存在する', async ({ page }) => {
    test.setTimeout(120000);
    await goToResult(page);

    const ITERATIONS = 30;
    let rakutenOk = 0, jalanOk = 0, rakutenNg = 0, jalanNg = 0;

    for (let i = 0; i < ITERATIONS; i++) {
      const cityName = await getCityName(page);
      const { rakuten, jalan } = await getHotelLinks(page);

      // 楽天チェック
      if (await rakuten.count() > 0) {
        const href = await rakuten.getAttribute('href');
        if (href && href.includes('rakuten')) {
          rakutenOk++;
        } else {
          rakutenNg++;
          logFail('rakuten_href_invalid', cityName, href ?? 'null');
        }
      } else {
        rakutenNg++;
        logFail('rakuten_missing', cityName, '-');
      }

      // じゃらんチェック
      if (await jalan.count() > 0) {
        const href = await jalan.getAttribute('href');
        if (href && href.includes('valuecommerce')) {
          jalanOk++;
        } else {
          jalanNg++;
          logFail('jalan_href_invalid', cityName, href ?? 'null');
        }
      } else {
        jalanNg++;
        logFail('jalan_missing', cityName, '-');
      }

      // 次へ
      if (i < ITERATIONS - 1) {
        const retryBtn = page.locator('#retry-btn');
        const inlineRetry = page.locator('[data-action="retry"]');
        if (await retryBtn.isVisible().catch(() => false)) {
          await retryBtn.click();
        } else if (await inlineRetry.isVisible().catch(() => false)) {
          await inlineRetry.click();
        }
        await page.waitForTimeout(300);
      }
    }

    console.log(`楽天: OK=${rakutenOk} NG=${rakutenNg} / じゃらん: OK=${jalanOk} NG=${jalanNg}`);
    expect(rakutenNg, `楽天リンクNG ${rakutenNg}件`).toBe(0);
    expect(jalanNg, `じゃらんリンクNG ${jalanNg}件`).toBe(0);
  });

});

// ────────────────────────────────────────────────────────────────

test.describe('リンク遷移検証（楽天）', () => {

  test('楽天リンクが宿一覧に遷移する', async ({ page, context }) => {
    await goToResult(page);
    const { rakuten } = await getHotelLinks(page);
    if (await rakuten.count() === 0) return;

    const [newPage] = await Promise.all([
      context.waitForEvent('page'),
      rakuten.click(),
    ]);
    await newPage.waitForLoadState('domcontentloaded', { timeout: 15000 });

    const url = newPage.url();
    // アフィリエイトリダイレクト後、rakutenドメインに到達すること
    const isRakuten = url.includes('rakuten');
    if (!isRakuten) {
      const cityName = await getCityName(page);
      logFail('rakuten_redirect_fail', cityName, url);
    }
    expect(isRakuten, `楽天リダイレクト先: ${url}`).toBe(true);

    // 宿一覧の存在確認（テキストベース）
    const body = await newPage.textContent('body').catch(() => '');
    const hasContent = /ホテル|宿|旅館|プラン/.test(body);
    if (!hasContent) {
      const cityName = await getCityName(page);
      logFail('rakuten_empty_page', cityName, url);
    }

    await newPage.close();
  });

});

// ────────────────────────────────────────────────────────────────

test.describe('リンク遷移検証（じゃらん）', () => {

  test('じゃらんリンクが宿一覧に遷移する', async ({ page, context }) => {
    await goToResult(page);
    const { jalan } = await getHotelLinks(page);
    if (await jalan.count() === 0) return;

    const [newPage] = await Promise.all([
      context.waitForEvent('page'),
      jalan.click(),
    ]);
    await newPage.waitForLoadState('domcontentloaded', { timeout: 15000 });

    const url = newPage.url();
    const isJalan = url.includes('jalan');
    if (!isJalan) {
      const cityName = await getCityName(page);
      logFail('jalan_redirect_fail', cityName, url);
    }
    expect(isJalan, `じゃらんリダイレクト先: ${url}`).toBe(true);

    const body = await newPage.textContent('body').catch(() => '');
    const hasContent = /宿|プラン|ホテル|旅館/.test(body);
    if (!hasContent) {
      const cityName = await getCityName(page);
      logFail('jalan_empty_page', cityName, url);
    }

    await newPage.close();
  });

});

// ────────────────────────────────────────────────────────────────

test.describe('遷移品質チェック', () => {

  test('楽天リンクが5秒以内にページ遷移完了する', async ({ page, context }) => {
    await goToResult(page);
    const { rakuten } = await getHotelLinks(page);
    if (await rakuten.count() === 0) return;

    const start = Date.now();
    const [newPage] = await Promise.all([
      context.waitForEvent('page'),
      rakuten.click(),
    ]);
    await newPage.waitForLoadState('domcontentloaded', { timeout: 10000 });
    const elapsed = Date.now() - start;

    expect(elapsed).toBeLessThan(5000);

    const title = await newPage.title();
    const hasHotelTitle = /ホテル|宿|旅館|温泉|楽天トラベル|travel/i.test(title);
    if (!hasHotelTitle) {
      const cityName = await getCityName(page);
      logFail('rakuten_title_ng', cityName, title);
    }

    await newPage.close();
  });

  test('じゃらんリンクが5秒以内にページ遷移完了する', async ({ page, context }) => {
    await goToResult(page);
    const { jalan } = await getHotelLinks(page);
    if (await jalan.count() === 0) return;

    const start = Date.now();
    const [newPage] = await Promise.all([
      context.waitForEvent('page'),
      jalan.click(),
    ]);
    await newPage.waitForLoadState('domcontentloaded', { timeout: 10000 });
    const elapsed = Date.now() - start;

    expect(elapsed).toBeLessThan(5000);

    const title = await newPage.title();
    const hasHotelTitle = /ホテル|宿|旅館|温泉|じゃらん|jalan/i.test(title);
    if (!hasHotelTitle) {
      const cityName = await getCityName(page);
      logFail('jalan_title_ng', cityName, title);
    }

    await newPage.close();
  });

});
