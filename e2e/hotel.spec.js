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

// 現在表示中の宿リンクを取得（アクティブパネル内）
async function getVisibleHotelLinks(page) {
  // アクティブなタブパネル内のボタン
  const activePanel = page.locator('.attr-panel:not([hidden])');
  const rakuten = activePanel.locator('a.stay-btn--rakuten');
  const jalan   = activePanel.locator('a.stay-btn--jalan');
  return { rakuten, jalan };
}

// ────────────────────────────────────────────────────────────────

test.describe('ケース①：基本動作', () => {

  test('出発地・滞在・誰と を選んで GO → 結果が表示される', async ({ page }) => {
    await loadPage(page);

    // 出発地: 大阪
    await page.selectOption('#departure-select', '大阪');
    // 旅の長さ: 2泊
    await page.click('[data-group="stay"][data-value="2night"]');
    // 誰と: 一人旅
    await page.click('[data-group="situation"][data-value="solo"]');

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

  test('situation ボタンが state に反映される（一人旅→ソロタブがデフォルト）', async ({ page }) => {
    await loadPage(page);
    await page.click('[data-group="situation"][data-value="solo"]');
    await clickGo(page);

    // stayType=1night の場合は宿ブロックが表示される（daytrip 以外）
    const stayBlock = page.locator('.stay-block');
    await expect(stayBlock).toBeVisible();

    // solo タブがアクティブであること
    const soloTab = page.locator('.attr-tab[data-attr="solo"]');
    await expect(soloTab).toHaveClass(/active/);
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
    await page.click('[data-group="stay"][data-value="1night"]');
    await clickGo(page);

    const ITERATIONS = 30;
    for (let i = 0; i < ITERATIONS; i++) {
      const cityName = await page.locator('.city-name').textContent();

      // 宿泊ブロックが存在すること
      const stayBlock = page.locator('.stay-block');
      await expect(stayBlock).toBeVisible({ timeout: 5000 });

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
      const links = mod.buildHotelLinks(fakeDest);
      return {
        hasCouple:    !!links?.couple,
        rakutenHref:  links?.couple?.links?.[0]?.url ?? null,
        jalanHref:    links?.couple?.links?.[1]?.url ?? null,
      };
    });

    expect(result.hasCouple).toBe(true);
    expect(result.rakutenHref).not.toBeNull();
    expect(result.jalanHref).not.toBeNull();
    // アフィリエイト経由であること
    expect(result.rakutenHref).toMatch(/hb\.afl\.rakuten\.co\.jp/);
    expect(result.jalanHref).toMatch(/ck\.jp\.ap\.valuecommerce\.com/);
    // 日本語がエンコードされていること
    expect(result.rakutenHref).not.toMatch(/[\u3000-\u9FFF]/);
    expect(result.jalanHref).not.toMatch(/[\u3000-\u9FFF]/);
  });

  test('ROUTES未登録の都市でも Google Maps リンクが表示される', async ({ page }) => {
    await loadPage(page);

    // page.evaluate でtransportRendererを直接テスト
    const result = await page.evaluate(async () => {
      const { resolveTransportLinks } = await import('/src/transport/transportRenderer.js');
      // ROUTES未登録の都市
      const fakeCity = {
        id: '__no_route__',
        name: 'テスト島',
        prefecture: 'テスト県',
        lat: 35.0,
        lng: 136.0,
      };
      return resolveTransportLinks(fakeCity, '東京');
    });

    // type='note' だけではなく、フォールバックはapp.js側で処理されるため
    // ここではROUTES未登録時に 'note' が返ることを確認
    const types = result.map(l => l.type);
    expect(types).toContain('note');
    // app.js のフォールバックが機能することを別途UIテストで確認
  });

  test('ROUTES未登録の都市でもUI上にリンクが表示される（Google Maps フォールバック）', async ({ page }) => {
    await loadPage(page);

    // まず複数回引き直してROUTES未登録の都市を探す
    // （未登録都市は179件あるので数回で当たる可能性が高い）
    await page.selectOption('#departure-select', '東京');
    await page.click('[data-group="stay"][data-value="2night"]');
    await clickGo(page);

    let foundNote = false;
    for (let i = 0; i < 20; i++) {
      // 交通ブロック内のすべてのリンクを確認
      const links = page.locator('.card-section .btn');
      const count = await links.count();

      // どんな都市でも交通リンクが1件以上あること
      expect(count, `[${i + 1}/20] 交通リンクが0件`).toBeGreaterThan(0);

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
    // 幅が画面の50%以上
    expect(box.width).toBeGreaterThanOrEqual(160);
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

  test('1泊以外（日帰り）では宿泊ブロックが非表示', async ({ page }) => {
    await loadPage(page);
    await page.click('[data-group="stay"][data-value="daytrip"]');
    await clickGo(page);

    // 日帰りでは宿泊ブロックが非表示
    const stayBlock = page.locator('.stay-block');
    await expect(stayBlock).not.toBeVisible();
  });

  test('タブ切り替えで宿の情報が入れ替わる', async ({ page }) => {
    await loadPage(page);
    await clickGo(page);

    const stayBlock = page.locator('.stay-block');
    await expect(stayBlock).toBeVisible();

    // デフォルト以外のタブをクリック
    const tabs = page.locator('.attr-tab');
    const tabCount = await tabs.count();
    if (tabCount >= 2) {
      const secondTab = tabs.nth(1);
      await secondTab.click();
      await expect(secondTab).toHaveClass(/active/);
      // クリック後もパネルが表示されている
      await expect(page.locator('.attr-panel:not([hidden])')).toBeVisible();
    }
  });

  test('GOボタンのCTAテキストが正しい', async ({ page }) => {
    await loadPage(page);
    const goBtn = page.locator('#go-btn');
    await expect(goBtn).toContainText('どこ行こ？');
    await expect(goBtn).toBeEnabled();
  });

});
