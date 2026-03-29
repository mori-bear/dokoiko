/**
 * hotelTest.mjs — 宿リンク静的検証スクリプト
 *
 * 実行: node scripts/hotelTest.mjs
 *
 * 検証項目:
 *   [H-r1]  楽天: URL が https://travel.rakuten.co.jp/search/ で始まる
 *   [H-r2]  楽天: keyword= パラメータが存在する
 *   [H-r3]  楽天: 二重エンコード（%25）なし
 *   [H-j1]  じゃらん: URL が https://www.jalan.net/search/ を含む
 *   [H-j2]  じゃらん: keyword= パラメータが存在する
 *   [H-j3]  じゃらん: 二重エンコード（%25）なし
 *   [H-kw]  全 destination: hotelKeyword フィールドが存在する
 *   [H7]    全 destination: links が最低1件返る
 *   [H8]    全 destination: heading が存在する
 *   [H-tls] 全URL: https で始まる
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const dests = JSON.parse(readFileSync(join(ROOT, 'src/data/destinations.json'), 'utf8'));
const { buildHotelLinks } = await import(`file://${ROOT}/src/hotel/hotelLinkBuilder.js`);

let pass = 0;
let fail = 0;
const errors = [];

function check(condition, msg, context = '') {
  if (condition) {
    pass++;
    process.stdout.write('.');
  } else {
    fail++;
    errors.push({ msg, context });
    process.stdout.write('F');
  }
}

console.log('\n=== 宿リンク静的検証 ===\n');

let rakutenCount = 0;
let jalanCount   = 0;
let noRakuten    = 0;

for (const dest of dests) {
  const id = dest.id;

  // H-kw: hotelKeyword フィールドが存在する
  check(
    typeof dest.hotelKeyword === 'string' && dest.hotelKeyword.length > 0,
    `[H-kw] hotelKeyword が未設定: ${id}`, id,
  );

  const result = buildHotelLinks(dest);

  // H7: links が存在する
  check(Array.isArray(result.links) && result.links.length > 0,
    `[H7] links が空: ${id}`, id);

  // H8: heading が存在する
  check(typeof result.heading === 'string' && result.heading.length > 0,
    `[H8] heading が空: ${id}`, id);

  const rakuten = result.links.find(l => l.type === 'rakuten');
  const jalan   = result.links.find(l => l.type === 'jalan');

  if (rakuten) {
    rakutenCount++;
    // H-tls
    check(rakuten.url.startsWith('https://'),
      `[H-tls] 楽天 URL が https でない: ${id}`, id);
    // H-r1: travel.rakuten.co.jp/yado/ を含む（エリアページ）または travel.rakuten.co.jp/ のみ（フォールバック）
    check(rakuten.url.startsWith('https://travel.rakuten.co.jp/'),
      `[H-r1] 楽天 URL が travel.rakuten.co.jp/ で始まらない: ${id} (${rakuten.url})`, id);
    // H-r3: 二重エンコードなし
    check(!rakuten.url.includes('%25'),
      `[H-r3] 楽天 URL に二重エンコード(%25)がある: ${id}`, id);
  } else {
    noRakuten++;
  }

  if (jalan) {
    jalanCount++;
    // H-tls
    check(jalan.url.startsWith('https://'),
      `[H-tls] じゃらん URL が https でない: ${id}`, id);
    // H-j1: uww2011init.do を含む
    check(jalan.url.includes('jalan.net/uw/uwp2011/uww2011init.do'),
      `[H-j1] じゃらん URL が uww2011init.do 形式でない: ${id} (${jalan.url})`, id);
    // H-j2: keyword= が URL に含まれる
    check(jalan.url.includes('keyword='),
      `[H-j2] じゃらん URL に keyword= がない: ${id}`, id);
    // H-j3: 二重エンコードなし
    check(!jalan.url.includes('%25'),
      `[H-j3] じゃらん URL に二重エンコード(%25)がある: ${id}`, id);
  }
}

/* ── 結果 ── */
console.log('\n');
console.log(`対象 destination: ${dests.length}件`);
console.log(`楽天リンクあり: ${rakutenCount}件 / なし: ${noRakuten}件`);
console.log(`じゃらんリンクあり: ${jalanCount}件`);
console.log('');

if (errors.length) {
  console.log('FAIL 一覧:');
  errors.forEach(e => console.log(`  [FAIL] ${e.msg}${e.context ? `  (${e.context})` : ''}`));
  console.log('');
}

console.log(`PASS: ${pass} / ${pass + fail}`);
console.log(`FAIL: ${fail} / ${pass + fail}`);

if (fail === 0) {
  console.log('\n✅ 全チェック PASS');
} else {
  console.log('\n❌ 修正が必要なチェックがあります');
  process.exit(1);
}
