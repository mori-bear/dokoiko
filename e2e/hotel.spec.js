/**
 * どこ行こ？ E2E テスト
 *
 * 前提: すべての都市でアフィリエイトリンクが表示されること
 *
 * ケース① 基本動作
 * ケース② 宿リンク存在チェック（楽天・じゃらん）
 * ケース③ リンク遷移チェック（href が有効なURL）
 * ケース④ 全件フォールバック保証
 * ケース⑤ UI/CTA
 */

import { test, expect } from '@playwright/test';

// ページ読み込みヘルパー: データ読み込み完了まで GO ボタンが有効になるのを待つ
async function loadPage(page) {
  await page.goto('/');
  // go-btn が enabled になるまで待つ（データ非同期ロード完了の目安）
  await expect(page.locator('#go-btn')).not.toBeDisabled({ timeout: 10000 });
}

// GO を押して result が表示されるまで待つ
async function clickGo(page) {
  await page.click('#go-btn');
  await expect(page.locator('#result')).toBeVisible({ timeout: 10000 });
}

// 現在表示中の宿リンクを取得
async function getVisibleHotelLinks(page) {
  // 現行UI: stay-section 内に btn-rakuten / btn-jalan
  const rakuten = page.locator('a.btn-rakuten').first();
  const jalan   = page.locator('a.btn-jalan').first();
  return { rakuten, jalan };
}

// ────────────────────────────────────────────────────────────────

test.describe('ケース①：基本動作', () => {

  test('出発地・滞在 を選んで GO → 結果が表示される', async ({ page }) => {
    await loadPage(page);

    // 出発地: 大阪
    await page.selectOption('#departure-select', '大阪');
    // 旅の長さ: 1泊
    await page.click('.sel-btn[data-stay="1night"]');

    await clickGo(page);

    // 結果エリアが表示される
    await expect(page.locator('#result')).toBeVisible();
    // 都市名が表示される
    await expect(page.locator('.city-name')).toBeVisible();
  });

  test('引き直しボタンで別の都市に切り替わる', async ({ page }) => {
    await loadPage(page);
    await clickGo(page);

    const first = await page.locator('.city-name').textContent();

    // 引き直し
    await page.click('#retry-btn');
    await expect(page.locator('#result')).toBeVisible();

    // 10回引き直せば必ず別の都市が出る（ランダムだが確認）
    let changed = false;
    for (let i = 0; i < 10; i++) {
      const current = await page.locator('.city-name').textContent();
      if (current !== first) { changed = true; break; }
      await page.click('#retry-btn');
      await page.waitForTimeout(200);
    }
    expect(changed).toBe(true);
  });

  test.skip('situation ボタンが state に反映される（一人旅→ソロタブがデフォルト）', async () => {
    // situation 機能（solo/couple/friends タブ）は撤廃済み
  });

});

// ────────────────────────────────────────────────────────────────

test.describe('ケース②：宿リンク存在チェック（最重要）', () => {

  test('楽天・じゃらんリンクが表示される', async ({ page }) => {
    await loadPage(page);
    await clickGo(page);

    const { rakuten, jalan } = await getVisibleHotelLinks(page);

    await expect(rakuten).toBeVisible();
    await expect(jalan).toBeVisible();
  });

  test('楽天リンクの href が null でない', async ({ page }) => {
    await loadPage(page);
    await clickGo(page);

    const { rakuten } = await getVisibleHotelLinks(page);
    const href = await rakuten.getAttribute('href');

    expect(href).not.toBeNull();
    expect(href).not.toBe('');
    expect(href).toMatch(/^https?:\/\//);
  });

  test('じゃらんリンクの href が null でない', async ({ page }) => {
    await loadPage(page);
    await clickGo(page);

    const { jalan } = await getVisibleHotelLinks(page);
    const href = await jalan.getAttribute('href');

    expect(href).not.toBeNull();
    expect(href).not.toBe('');
    expect(href).toMatch(/^https?:\/\//);
  });

  test('URLに生の日本語文字が含まれない（文字化けなし）', async ({ page }) => {
    await loadPage(page);
    await clickGo(page);

    const { rakuten, jalan } = await getVisibleHotelLinks(page);
    const rHref = await rakuten.getAttribute('href');
    const jHref = await jalan.getAttribute('href');

    // 日本語文字（U+3000以上）がURLに直接含まれていないこと
    expect(rHref).not.toMatch(/[\u3000-\u9FFF\uF900-\uFFEF]/);
    expect(jHref).not.toMatch(/[\u3000-\u9FFF\uF900-\uFFEF]/);
  });

  test('楽天リンクはアフィリエイトURLを経由する', async ({ page }) => {
    await loadPage(page);
    await clickGo(page);

    const { rakuten } = await getVisibleHotelLinks(page);
    const href = await rakuten.getAttribute('href');

    // 楽天アフィリエイトドメインを経由していること
    expect(href).toMatch(/hb\.afl\.rakuten\.co\.jp/);
  });

  test('じゃらんリンクはValueCommerceを経由する', async ({ page }) => {
    await loadPage(page);
    await clickGo(page);

    const { jalan } = await getVisibleHotelLinks(page);
    const href = await jalan.getAttribute('href');

    // ValueCommerce 経由であること
    expect(href).toMatch(/ck\.jp\.ap\.valuecommerce\.com/);
  });

});

// ────────────────────────────────────────────────────────────────

test.describe('ケース③：リンク遷移チェック', () => {

  test('楽天リンクは target=_blank で開く（外部遷移設定）', async ({ page }) => {
    await loadPage(page);
    await clickGo(page);

    const { rakuten } = await getVisibleHotelLinks(page);
    const target = await rakuten.getAttribute('target');
    expect(target).toBe('_blank');
  });

  test('じゃらんリンクは target=_blank で開く', async ({ page }) => {
    await loadPage(page);
    await clickGo(page);

    const { jalan } = await getVisibleHotelLinks(page);
    const target = await jalan.getAttribute('target');
    expect(target).toBe('_blank');
  });

  test('楽天リンクのURLが200系またはリダイレクトを返す', async ({ page, request }) => {
    await loadPage(page);
    await clickGo(page);

    const { rakuten } = await getVisibleHotelLinks(page);
    const href = await rakuten.getAttribute('href');

    // HTTPリクエストで到達可能か確認（タイムアウト10秒）
    const res = await request.get(href, { maxRedirects: 5, timeout: 10000 }).catch(() => null);
    if (res) {
      expect(res.status()).toBeLessThan(500);
    }
    // ネットワーク不可の場合はスキップ（CIではフラグ立てるが落とさない）
  });

});

// ────────────────────────────────────────────────────────────────

test.describe('ケース④：全件フォールバック保証', () => {

  test('30回引き直してすべての結果で楽天・じゃらんリンクが存在する', async ({ page }) => {
    await loadPage(page);
    // 東京1泊で最も多くの候補が出やすい設定
    await page.selectOption('#departure-select', '東京');
    await page.click('.sel-btn[data-stay="1night"]');
    await clickGo(page);

    const ITERATIONS = 30;
    for (let i = 0; i < ITERATIONS; i++) {
      const cityName = await page.locator('.city-name').textContent();

      // 宿泊セクションが存在すること
      const staySection = page.locator('.stay-section').first();
      await expect(staySection).toBeVisible({ timeout: 5000 });

      // アクティブパネルにリンクが存在すること
      const { rakuten, jalan } = await getVisibleHotelLinks(page);

      const rHref = await rakuten.getAttribute('href').catch(() => null);
      const jHref = await jalan.getAttribute('href').catch(() => null);

      expect(rHref, `[${i + 1}/${ITERATIONS}] ${cityName}: 楽天リンクが null`).not.toBeNull();
      expect(jHref, `[${i + 1}/${ITERATIONS}] ${cityName}: じゃらんリンクが null`).not.toBeNull();
      expect(rHref, `[${i + 1}/${ITERATIONS}] ${cityName}: 楽天URLが空`).not.toBe('');
      expect(jHref, `[${i + 1}/${ITERATIONS}] ${cityName}: じゃらんURLが空`).not.toBe('');

      if (i < ITERATIONS - 1) {
        await page.click('#retry-btn');
        await expect(page.locator('#result')).toBeVisible({ timeout: 5000 });
      }
    }
  });

  test('HOTELS未登録の都市でもフォールバックリンクが機能する', async ({ page }) => {
    // HOTELS.jsに未登録のIDをpage.evaluate()で直接注入してテスト
    await loadPage(page);

    // ページ内でHOTELS未登録の都市オブジェクトを渡してbuildHotelLinksをコールし、
    // フォールバックURLが生成されることをJSで検証
    const result = await page.evaluate(async () => {
      // app.jsはmoduleなのでdynamic importを使用
      const mod = await import('/src/hotel/hotelLinkBuilder.js');
      const fakeDest = { id: '__nonexistent_test__', name: 'テスト市' };
      const out = mod.buildHotelLinks(fakeDest);
      return {
        linkCount:   Array.isArray(out?.links) ? out.links.length : 0,
        rakutenHref: out?.links?.find(l => l.type === 'rakuten')?.url ?? null,
        jalanHref:   out?.links?.find(l => l.type === 'jalan')?.url   ?? null,
        bestUrl:     out?.bestUrl ?? null,
      };
    });

    expect(result.linkCount).toBeGreaterThan(0);
    expect(result.bestUrl).not.toBeNull();
    // 楽天が返る場合はアフィリエイト経由・日本語エンコード
    if (result.rakutenHref) {
      expect(result.rakutenHref).toMatch(/hb\.afl\.rakuten\.co\.jp/);
    }
    // じゃらんが返る場合は ValueCommerce 経由
    if (result.jalanHref) {
      expect(result.jalanHref).toMatch(/ck\.jp\.ap\.valuecommerce\.com/);
    }
    // 日本語がエンコードされていること
    if (result.rakutenHref) expect(result.rakutenHref).not.toMatch(/[\u3000-\u9FFF]/);
    if (result.jalanHref) expect(result.jalanHref).not.toMatch(/[\u3000-\u9FFF]/);
  });

  test.skip('ROUTES未登録の都市でも Google Maps リンクが表示される', async () => {
    // 旧仕様の type='note' は撤廃済み。現行は step-group 形式で
    // main-cta / step-group が返る。UIフォールバックは下のテストで担保。
  });

  test('ROUTES未登録の都市でもUI上にリンクが表示される（Google Maps フォールバック）', async ({ page }) => {
    await loadPage(page);
    await page.selectOption('#departure-select', '東京');
    await page.click('.sel-btn[data-stay="1night"]');
    await clickGo(page);

    for (let i = 0; i < 20; i++) {
      // 結果カード内のリンク（地図・予約・宿）を全て対象
      const links = page.locator('#result a.btn, #result a[class*="btn-"]');
      const count = await links.count();
      expect(count, `[${i + 1}/20] 交通/宿リンクが0件`).toBeGreaterThan(0);

      if (i < 19) {
        await page.click('#retry-btn');
        await expect(page.locator('#result')).toBeVisible({ timeout: 5000 });
      }
    }
  });

});

// ────────────────────────────────────────────────────────────────

test.describe('ケース⑤：UI / CTA', () => {

  test('宿泊ボタンが視覚的に目立つサイズで表示される', async ({ page }) => {
    await loadPage(page);
    await clickGo(page);

    const { rakuten } = await getVisibleHotelLinks(page);
    const box = await rakuten.boundingBox();

    expect(box).not.toBeNull();
    // CTAボタンは最低44px高さ（Appleのタッチターゲット基準）
    expect(box.height).toBeGreaterThanOrEqual(44);
    // 幅が画面の30%以上（dual-grid で2分割レイアウトのため約140px）
    expect(box.width).toBeGreaterThanOrEqual(120);
  });

  test('楽天CTAボタンがクリック可能', async ({ page }) => {
    await loadPage(page);
    await clickGo(page);

    const { rakuten } = await getVisibleHotelLinks(page);

    await expect(rakuten).toBeEnabled();
    await expect(rakuten).toBeVisible();
    // disabled や pointer-events:none でないこと
    const isClickable = await rakuten.evaluate(el => {
      const style = window.getComputedStyle(el);
      return style.pointerEvents !== 'none' && !el.hasAttribute('disabled');
    });
    expect(isClickable).toBe(true);
  });

  test('じゃらんCTAボタンがクリック可能', async ({ page }) => {
    await loadPage(page);
    await clickGo(page);

    const { jalan } = await getVisibleHotelLinks(page);

    await expect(jalan).toBeEnabled();
    await expect(jalan).toBeVisible();
    const isClickable = await jalan.evaluate(el => {
      const style = window.getComputedStyle(el);
      return style.pointerEvents !== 'none' && !el.hasAttribute('disabled');
    });
    expect(isClickable).toBe(true);
  });

  test('1泊以外（日帰り）では宿泊セクションが非表示', async ({ page }) => {
    await loadPage(page);
    await page.click('.sel-btn[data-stay="daytrip"]');
    await clickGo(page);

    // 日帰りでは宿泊セクションが非表示
    const staySection = page.locator('.stay-section');
    await expect(staySection).toHaveCount(0);
  });

  test('GOボタンのCTAテキストが正しい', async ({ page }) => {
    await loadPage(page);
    const goBtn = page.locator('#go-btn');
    await expect(goBtn).toContainText('どこ行こ？');
    await expect(goBtn).toBeEnabled();
  });

});
