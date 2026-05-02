/**
 * checkHotelLinksPlaywright.js — 宿リンク全件ブラウザ確認
 * 楽天・じゃらんの宿一覧ページを実際にロードして結果を検証する
 */
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function checkHotelPage(page, url, service) {
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForTimeout(2000);

    if (service === 'rakuten') {
      const noResult = await page.locator(':text("該当する宿泊施設はありません"), :text("検索結果が0件")').count();
      if (noResult > 0) return { status: 'NO_RESULT', count: 0 };
      const hotelCount = await page.locator('.hotelList, .hotel-list, [class*="hotel"]').count();
      if (hotelCount > 0) return { status: 'OK', count: hotelCount };
      return { status: 'UNKNOWN', count: 0 };
    }

    if (service === 'jalan') {
      const noResult = await page.locator(':text("条件に合う宿泊施設が見つかりませんでした")').count();
      if (noResult > 0) return { status: 'NO_RESULT', count: 0 };
      const hotelCount = await page.locator('.js-hotel-list-item, [class*="hotelItem"]').count();
      if (hotelCount > 0) return { status: 'OK', count: hotelCount };
      return { status: 'UNKNOWN', count: 0 };
    }
  } catch (e) {
    return { status: 'ERROR', error: e.message };
  }
}

async function main() {
  console.log('宿リンク人間的調査開始...\n');

  const destFile = path.join(__dirname, '../src/data/destinations.json');
  const destinations = JSON.parse(fs.readFileSync(destFile, 'utf8'));

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15',
  });
  const page = await context.newPage();

  const results = { ok: 0, no_result: 0, error: 0, unknown: 0 };
  const problems = [];
  let idx = 0;

  for (const dest of destinations) {
    const rakutenUrl = dest.hotelLinks?.rakuten || dest.hotelLinks?.rakutenArea;
    const jalanUrl   = dest.hotelLinks?.jalan;

    if (rakutenUrl) {
      const result = await checkHotelPage(page, rakutenUrl, 'rakuten');
      if (result.status === 'OK') {
        results.ok++;
      } else if (result.status === 'NO_RESULT') {
        results.no_result++;
        problems.push({ name: dest.name, id: dest.id, service: '楽天', status: 'NO_RESULT', url: rakutenUrl });
      } else if (result.status === 'ERROR') {
        results.error++;
        problems.push({ name: dest.name, id: dest.id, service: '楽天', status: 'ERROR', error: result.error, url: rakutenUrl });
      } else {
        results.unknown++;
      }
    }

    if (jalanUrl) {
      const result = await checkHotelPage(page, jalanUrl, 'jalan');
      if (result.status === 'OK') {
        results.ok++;
      } else if (result.status === 'NO_RESULT') {
        results.no_result++;
        problems.push({ name: dest.name, id: dest.id, service: 'じゃらん', status: 'NO_RESULT', url: jalanUrl });
      } else if (result.status === 'ERROR') {
        results.error++;
        problems.push({ name: dest.name, id: dest.id, service: 'じゃらん', status: 'ERROR', error: result.error, url: jalanUrl });
      } else {
        results.unknown++;
      }
    }

    await page.waitForTimeout(3000);

    idx++;
    if (idx % 10 === 0) {
      console.log(`進捗: ${idx}/${destinations.length}件 (OK:${results.ok} NG:${results.no_result} ERR:${results.error} UNK:${results.unknown})`);
      // 中間保存
      if (problems.length > 0) {
        fs.writeFileSync(
          path.join(__dirname, '../hotel_check_results.json'),
          JSON.stringify(problems, null, 2),
          'utf8',
        );
      }
    }
  }

  await browser.close();

  console.log('\n--- 結果サマリー ---');
  console.log('  OK      :', results.ok);
  console.log('  NO_RESULT:', results.no_result);
  console.log('  ERROR   :', results.error);
  console.log('  UNKNOWN :', results.unknown);

  if (problems.length > 0) {
    fs.writeFileSync(
      path.join(__dirname, '../hotel_check_results.json'),
      JSON.stringify(problems, null, 2),
      'utf8',
    );
    console.log(`\n問題あり ${problems.length} 件 → hotel_check_results.json に保存`);
    problems.forEach(p => console.log(`  ${p.name} (${p.service}): ${p.status}`));
  } else {
    console.log('\n全件正常');
  }
}

main().catch(console.error);
