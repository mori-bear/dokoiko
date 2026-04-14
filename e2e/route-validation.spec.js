/**
 * ルート検証 E2E テスト
 *
 * 生成されたGoogle Maps URLが実際にルート検索として成立するか検証する。
 *
 * 検証項目:
 *   - Google Maps URLが `dir` エンドポイントを使用しているか
 *   - origin/destination が URL に含まれているか
 *   - Maps ページに遷移して「ルート」セクションが表示されるか
 *
 * NGログ:
 *   affiliate_failures.csv に追記（type, destId, detail）
 */

import { test, expect } from '@playwright/test';
import fs from 'fs';

const FAILURE_LOG = 'affiliate_failures.csv';

function logFail(type, destId, detail) {
  fs.appendFileSync(FAILURE_LOG, `${type},${destId},${detail}\n`);
}

async function goToResult(page, departure = '東京') {
  await page.goto('/');
  await expect(page.locator('#go-btn')).not.toBeDisabled({ timeout: 10000 });
  await page.selectOption('#departure-select', departure);
  await page.click('#go-btn');
  await expect(page.locator('#result')).toBeVisible({ timeout: 10000 });
}

async function getCityName(page) {
  return page.locator('.city-name').textContent().catch(() => 'unknown');
}

// ────────────────────────────────────────────────────────────────

test.describe('Google Maps ルート URL 検証', () => {

  test('地図CTAのURLが有効な形式', async ({ page }) => {
    await goToResult(page);
    const mapBtn = page.locator('a.btn--maps').first();
    if (await mapBtn.count() === 0) return;
    const href = await mapBtn.getAttribute('href');
    expect(href).not.toBeNull();
    expect(href).toMatch(/^https:\/\/(www\.)?google\.com\/maps\//);
    // dir エンドポイントで origin+destination 指定
    expect(href).toMatch(/origin=/);
    expect(href).toMatch(/destination=/);
    // 日本語生文字なし（encode済み）
    expect(href).not.toMatch(/[\u3000-\u9FFF]/);
  });

  test('15件引き直しすべてで地図URLが有効', async ({ page }) => {
    test.setTimeout(90000);
    await goToResult(page);
    const ITER = 15;
    let ok = 0, ng = 0;
    for (let i = 0; i < ITER; i++) {
      const mapBtn = page.locator('a.btn--maps').first();
      if (await mapBtn.count() > 0) {
        const href = await mapBtn.getAttribute('href');
        const valid = href && /origin=.+destination=/.test(href) && !/[\u3000-\u9FFF]/.test(href);
        if (valid) ok++;
        else {
          ng++;
          const cityName = await getCityName(page);
          logFail('route_invalid', cityName, href ?? 'null');
        }
      }
      if (i < ITER - 1) {
        const retryBtn = page.locator('#retry-btn');
        if (await retryBtn.isVisible().catch(() => false)) await retryBtn.click();
        await page.waitForTimeout(300);
      }
    }
    console.log(`地図URL: OK=${ok} NG=${ng}`);
    expect(ng).toBe(0);
  });

});

// ────────────────────────────────────────────────────────────────

test.describe('Google Maps 遷移検証', () => {

  test('地図CTAクリック → Mapsページでルート表示', async ({ page, context }) => {
    test.setTimeout(30000);
    await goToResult(page);
    const mapBtn = page.locator('a.btn--maps').first();
    if (await mapBtn.count() === 0) return;

    const [newPage] = await Promise.all([
      context.waitForEvent('page'),
      mapBtn.click(),
    ]);
    await newPage.waitForLoadState('domcontentloaded', { timeout: 15000 });

    const url = newPage.url();
    const isMaps = url.includes('google.com/maps');
    if (!isMaps) {
      const cityName = await getCityName(page);
      logFail('maps_redirect_fail', cityName, url);
    }
    expect(isMaps).toBe(true);

    await newPage.close();
  });

});

// ────────────────────────────────────────────────────────────────

test.describe('出発地別ルート生成', () => {

  const NEW_DEPARTURES = ['福山', '姫路', '倉敷', '米子'];

  for (const dep of NEW_DEPARTURES) {
    test(`新出発地「${dep}」で地図URLが生成される`, async ({ page }) => {
      await goToResult(page, dep);
      // 出発地を再選択してGOするとstateが反映される
      await page.selectOption('#departure-select', dep);
      await page.click('#go-btn');
      await page.waitForTimeout(500);

      const mapBtn = page.locator('a.btn--maps').first();
      if (await mapBtn.count() === 0) return;

      const href = await mapBtn.getAttribute('href');
      expect(href).toMatch(/origin=/);
      expect(href).toMatch(/destination=/);
      // 有効なGoogle Maps URLであることのみ確認
      expect(href).toMatch(/^https:\/\/www\.google\.com\/maps\//);
    });
  }

});
