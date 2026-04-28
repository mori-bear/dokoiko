#!/usr/bin/env node
/**
 * checkHotelLinks.js — 全目的地のホテルリンク健全性チェック
 *
 * HEADリクエストで HTTP ステータスを確認し、切れたリンクを一覧表示する。
 * 週次 or 手動で実行。
 *
 * 使い方: node scripts/checkHotelLinks.js
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function checkUrl(url, timeoutMs = 8000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: 'HEAD',
      signal: controller.signal,
      redirect: 'follow',
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; dokoiko-link-checker/1.0)' },
    });
    clearTimeout(timer);
    return { status: res.status < 400 ? 'OK' : 'ERROR', statusCode: res.status };
  } catch (err) {
    clearTimeout(timer);
    if (err.name === 'AbortError') return { status: 'TIMEOUT', statusCode: null };
    return { status: 'ERROR', statusCode: err.code ?? err.message };
  }
}

async function main() {
  console.log('🔍 ホテルリンク健全性チェック開始...\n');

  const destFile = path.join(__dirname, '../src/data/destinations.json');
  const destinations = JSON.parse(fs.readFileSync(destFile, 'utf-8'));

  let okCount = 0;
  let errorCount = 0;
  let timeoutCount = 0;
  const brokenLinks = [];

  const targets = destinations.filter(
    d => d.hotelLinks && (d.hotelLinks.rakuten || d.hotelLinks.jalan)
  );
  console.log(`対象: ${targets.length}件の目的地\n`);

  for (const dest of targets) {
    for (const service of ['rakuten', 'jalan']) {
      const url = dest.hotelLinks?.[service];
      if (!url) continue;

      const result = await checkUrl(url);
      if (result.status === 'OK') {
        okCount++;
      } else if (result.status === 'TIMEOUT') {
        timeoutCount++;
        brokenLinks.push({ destination: dest.name, service, url, statusCode: 'TIMEOUT' });
      } else {
        errorCount++;
        brokenLinks.push({ destination: dest.name, service, url, statusCode: result.statusCode });
      }
    }
    // レート制限対応
    await new Promise(r => setTimeout(r, 100));
  }

  console.log('✅ チェック完了\n');
  console.log('📊 結果サマリー:');
  console.log(`  OK:      ${okCount}件`);
  console.log(`  ERROR:   ${errorCount}件`);
  console.log(`  TIMEOUT: ${timeoutCount}件\n`);

  if (brokenLinks.length > 0) {
    console.log(`⚠️  問題リンク (${brokenLinks.length}件):\n`);
    for (const link of brokenLinks) {
      console.log(`  ${link.destination} (${link.service})`);
      console.log(`    Status: ${link.statusCode}`);
      console.log(`    URL: ${link.url}\n`);
    }
    process.exit(1);
  } else {
    console.log('✨ 全リンク健全です！\n');
  }
}

main().catch(err => { console.error(err); process.exit(1); });
