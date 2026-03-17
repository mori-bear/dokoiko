'use strict';
/**
 * 全 destination 宿リンク実ブラウザテスト
 * 楽天・じゃらん それぞれの target URL を headless Chrome で開き
 * 宿一覧が表示されるか確認する
 *
 * エラー判定:
 *   - 宿が見つかりませんでした / 該当する宿がありません  → 0件エラー
 *   - トップページへリダイレクト / 404                   → URLエラー
 *
 * Usage:
 *   node _hotel_full_test.js            # 全246件（並列3ブラウザ）
 *   node _hotel_full_test.js --concur=5 # 並列数変更
 *   node _hotel_full_test.js --sample   # サンプル10件のみ
 */

const puppeteer = require('puppeteer');
const fs        = require('fs');
const iconv     = require('iconv-lite');

const CONCUR  = parseInt((process.argv.find(a => a.startsWith('--concur=')) || '--concur=3').split('=')[1]);
const SAMPLE  = process.argv.includes('--sample');
const TIMEOUT = 25000;

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

function rakutenTarget(kw) {
  return `https://kw.travel.rakuten.co.jp/keyword/Search.do?f_query=${encodeURIComponent(kw)}`;
}

function jalanTarget(dest) {
  if (dest.hotelArea) {
    const area = areaMap.get(dest.hotelArea);
    if (area?.jalanUrl) return area.jalanUrl;
  }
  const kw = resolveKeyword(dest);
  return `https://www.jalan.net/uw/uwp2011/uww2011init.do?keyword=${encodeURIComponent(kw)}`;
}

/* ── 判定ロジック ── */

function checkRakuten(title, bodyText, finalUrl) {
  if (!finalUrl.includes('kw.travel.rakuten.co.jp') && !finalUrl.includes('travel.rakuten')) {
    return { ok: false, reason: 'トップページへリダイレクト' };
  }
  if (bodyText.includes('該当する宿泊施設はありません') ||
      bodyText.includes('0件見つかりました') ||
      bodyText.includes('検索結果0件') ||
      bodyText.includes('ご指定の条件に合う宿泊施設が見つかりません')) {
    return { ok: false, reason: '検索結果0件' };
  }
  if (!bodyText.includes('宿泊施設') && !bodyText.includes('ホテル') && !bodyText.includes('旅館') && !bodyText.includes('円')) {
    return { ok: false, reason: '宿一覧が確認できない' };
  }
  return { ok: true };
}

function checkJalan(title, bodyText, finalUrl) {
  if (!finalUrl.includes('jalan.net')) {
    return { ok: false, reason: 'トップページへリダイレクト' };
  }
  if (bodyText.includes('お探しの宿泊施設は見つかりませんでした') ||
      bodyText.includes('該当する宿がありません') ||
      bodyText.includes('宿泊施設が見つかりませんでした')) {
    return { ok: false, reason: '検索結果0件' };
  }
  if (!title.includes('該当するホテル・宿一覧') && !bodyText.includes('宿') && !bodyText.includes('ホテル')) {
    return { ok: false, reason: '宿一覧が確認できない' };
  }
  return { ok: true };
}

/* ── ブラウザワーカー ── */

async function testUrl(browser, url, checker) {
  const page = await browser.newPage();
  await page.setExtraHTTPHeaders({ 'Accept-Language': 'ja-JP,ja;q=0.9' });
  await page.setViewport({ width: 1280, height: 900 });
  try {
    await page.goto(url, { waitUntil: 'networkidle2', timeout: TIMEOUT });
    await new Promise(r => setTimeout(r, 1500));
    const finalUrl  = page.url();
    const title     = await page.title().catch(() => '');
    const bodyText  = await page.evaluate(() => document.body.innerText).catch(() => '');
    return checker(title, bodyText, finalUrl);
  } catch (e) {
    return { ok: false, reason: `ERROR: ${e.message.substring(0, 80)}` };
  } finally {
    await page.close();
  }
}

/* ── メイン ── */

async function main() {
  let targets = dests;
  if (SAMPLE) {
    // サンプル: 各地域から均等に選ぶ
    targets = dests.filter((_, i) => i % Math.ceil(dests.length / 10) === 0).slice(0, 10);
    console.log(`[サンプルモード] ${targets.length}件`);
  }

  console.log(`\n宿リンク実ブラウザテスト — ${targets.length}件 × 楽天・じゃらん`);
  console.log(`並列ブラウザ数: ${CONCUR} | タイムアウト: ${TIMEOUT}ms\n`);

  const errors = [];
  let pass = 0;
  let tested = 0;
  const total = targets.length * 2;

  // ブラウザプールを作成
  const browsers = await Promise.all(
    Array.from({ length: CONCUR }, () =>
      puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'] })
    )
  );

  async function runWithBrowser(browserIdx, tasks) {
    const browser = browsers[browserIdx];
    for (const task of tasks) {
      const result = await task(browser);
      tested++;
      if (!result.ok) {
        errors.push(result);
        process.stdout.write(result.service === '楽天' ? 'R' : 'J');
      } else {
        pass++;
        process.stdout.write('.');
      }
      if (tested % 50 === 0) process.stdout.write(` ${tested}/${total}\n`);
    }
  }

  // タスク生成
  const allTasks = [];
  for (const dest of targets) {
    const kw = resolveKeyword(dest);
    const rUrl = rakutenTarget(kw);
    const jUrl = jalanTarget(dest);

    allTasks.push(async (browser) => {
      const result = await testUrl(browser, rUrl, checkRakuten);
      return { ...result, id: dest.id, name: dest.name, service: '楽天', kw, url: rUrl };
    });
    allTasks.push(async (browser) => {
      const result = await testUrl(browser, jUrl, checkJalan);
      return { ...result, id: dest.id, name: dest.name, service: 'じゃらん', kw, url: jUrl };
    });
  }

  // ブラウザごとにタスクを分割して並列実行
  const chunkSize = Math.ceil(allTasks.length / CONCUR);
  const chunks = Array.from({ length: CONCUR }, (_, i) => allTasks.slice(i * chunkSize, (i + 1) * chunkSize));
  await Promise.all(chunks.map((chunk, i) => runWithBrowser(i, chunk)));

  await Promise.all(browsers.map(b => b.close()));
  process.stdout.write('\n\n');

  /* 結果 */
  console.log(`=== テスト結果 ===`);
  console.log(`PASS: ${pass} / ${total}`);
  console.log(`FAIL: ${errors.length} / ${total}`);

  if (errors.length) {
    console.log(`\n--- FAIL 一覧 ---`);
    errors.forEach(e => {
      console.log(`[${e.service}] ${e.id}（${e.name}） — ${e.reason}`);
      console.log(`  keyword: ${e.kw}`);
    });

    // キーワード修正候補
    const byService = { '楽天': [], 'じゃらん': [] };
    errors.forEach(e => byService[e.service].push(e));
    console.log(`\n楽天 FAIL: ${byService['楽天'].length}件`);
    console.log(`じゃらん FAIL: ${byService['じゃらん'].length}件`);
  }

  /* JSON レポート */
  const report = {
    tested: new Date().toISOString(),
    total, pass, fail: errors.length, errors,
  };
  fs.writeFileSync('docs/hotel_url_test_result.json', JSON.stringify(report, null, 2));
  console.log(`\n詳細: docs/hotel_url_test_result.json`);
}

main().catch(e => { console.error(e); process.exit(1); });
