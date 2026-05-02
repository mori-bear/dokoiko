/**
 * checkHotelLinksDeep.js — 全宿リンク HTTP 深度チェック
 * ESM / Node 18+ built-in fetch 使用
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function fetchUrl(url, timeout = 8000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const res = await fetch(url, {
      method: 'HEAD',
      signal: controller.signal,
      redirect: 'manual',
      headers: {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15',
      },
    });
    clearTimeout(timer);
    const code = res.status;
    if (code === 200)                      return { status: 'OK',        statusCode: code, url };
    if (code === 301 || code === 302 || code === 303 || code === 307 || code === 308)
                                           return { status: 'REDIRECT',  statusCode: code, url };
    if (code === 404)                      return { status: 'NOT_FOUND', statusCode: code, url };
    return                                        { status: 'ERROR',     statusCode: code, url };
  } catch (err) {
    clearTimeout(timer);
    if (err.name === 'AbortError') return { status: 'TIMEOUT', statusCode: null, url };
    return { status: 'ERROR', statusCode: err.code ?? err.message, url };
  }
}

const DEST_FILE = path.join(__dirname, '../src/data/destinations.json');
const destinations = JSON.parse(fs.readFileSync(DEST_FILE, 'utf-8'));

const results = {
  rakuten: { ok: 0, redirect: 0, not_found: 0, error: 0, timeout: 0 },
  jalan:   { ok: 0, redirect: 0, not_found: 0, error: 0, timeout: 0 },
};
const broken = [];

console.log(`宿リンク全件深度チェック開始 (${destinations.length}件) ...\n`);

let i = 0;
for (const dest of destinations) {
  i++;
  if (i % 100 === 0) process.stdout.write(`  ${i}/${destinations.length}件処理済み...\n`);

  const rakutenUrl = dest.hotelLinks?.rakuten ?? dest.hotelLinks?.rakutenArea ?? null;
  if (rakutenUrl) {
    const r = await fetchUrl(rakutenUrl);
    if (r.status === 'OK' || r.status === 'REDIRECT') {
      results.rakuten.ok++;
    } else {
      results.rakuten[r.status === 'NOT_FOUND' ? 'not_found'
                    : r.status === 'TIMEOUT'   ? 'timeout' : 'error']++;
      if (r.status !== 'TIMEOUT') {
        broken.push({ name: dest.name, service: '楽天', status: r.status, statusCode: r.statusCode, url: rakutenUrl });
      }
    }
  }

  const jalanUrl = dest.hotelLinks?.jalan ?? null;
  if (jalanUrl) {
    const r = await fetchUrl(jalanUrl);
    if (r.status === 'OK' || r.status === 'REDIRECT') {
      results.jalan.ok++;
    } else {
      results.jalan[r.status === 'NOT_FOUND' ? 'not_found'
                  : r.status === 'TIMEOUT'   ? 'timeout' : 'error']++;
      if (r.status !== 'TIMEOUT') {
        broken.push({ name: dest.name, service: 'じゃらん', status: r.status, statusCode: r.statusCode, url: jalanUrl });
      }
    }
  }

  await new Promise(r => setTimeout(r, 200));
}

console.log('\n=== 結果サマリー ===\n');
console.log('楽天トラベル:');
console.log('  OK/REDIRECT:', results.rakuten.ok,        '件');
console.log('  NOT_FOUND:  ', results.rakuten.not_found, '件');
console.log('  ERROR:      ', results.rakuten.error,     '件');
console.log('  TIMEOUT:    ', results.rakuten.timeout,   '件');
console.log('');
console.log('じゃらん:');
console.log('  OK/REDIRECT:', results.jalan.ok,        '件');
console.log('  NOT_FOUND:  ', results.jalan.not_found, '件');
console.log('  ERROR:      ', results.jalan.error,      '件');
console.log('  TIMEOUT:    ', results.jalan.timeout,   '件');

if (broken.length > 0) {
  console.log(`\n問題あり ${broken.length}件:`);
  broken.forEach(b => {
    console.log(`  ${b.name} (${b.service}): ${b.status} [${b.statusCode}]`);
    console.log(`    ${b.url}`);
  });
} else {
  console.log('\n全件正常です！');
}
