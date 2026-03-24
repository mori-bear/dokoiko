/**
 * hotelTest.mjs — 宿リンク静的検証スクリプト
 *
 * 実行: node scripts/hotelTest.mjs
 *
 * 検証項目:
 *   [H1] 楽天: /hotel/search.do が URL に含まれる
 *   [H2] 楽天: f_cid= が URL に含まれる（エリアコード方式）
 *   [H3] 楽天: /pack/ を含まない（パックページ禁止）
 *   [H4] じゃらん: jalan.net を含む
 *   [H5] じゃらん: keyword= を含む
 *   [H6] じゃらん: %25 を含まない（二重エンコード禁止）
 *   [H7] 全 destination: リンクが最低1件返る（null 返さない）
 *   [H8] 全 destination: heading が存在する
 *   [H9] 楽天: hotelArea 未設定 dest はリンクなし（null でも links から除外）
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

// destinations.json 読み込み
const dests = JSON.parse(readFileSync(join(ROOT, 'src/data/destinations.json'), 'utf8'));

// hotelLinkBuilder をインポート
const { buildHotelLinks } = await import(join(ROOT, 'src/hotel/hotelLinkBuilder.js'));

/* ── テストフレームワーク ── */
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

/* ── hotelLinkBuilder ソース静的チェック ── */
const hotelSrc = readFileSync(join(ROOT, 'src/hotel/hotelLinkBuilder.js'), 'utf8');

check(
  hotelSrc.includes('travel.rakuten.co.jp/yado/'),
  '[H-src] 楽天 travel.rakuten.co.jp/yado/{area}/ URLが存在しない',
);
check(!hotelSrc.includes('travel.rakuten.co.jp/search'),
  '[H-src] 楽天に /search?keyword= URL が含まれている（404のため禁止）');
check(!hotelSrc.includes('/pack/'),           '[H-src] 楽天に /pack/ URL が含まれている（禁止）');
check(hotelSrc.includes('jalan.net'),         '[H-src] じゃらん jalan.net が存在しない');

/* ── 全 destination 動的チェック ── */
let rakutenCount = 0;
let jalanCount   = 0;
let noRakuten    = 0;

for (const dest of dests) {
  const result = buildHotelLinks(dest);
  const id = dest.id;

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
    // 直リンク（アフィリエイトなし）— そのまま検査
    // H1: travel.rakuten.co.jp を含む
    check(rakuten.url.includes('travel.rakuten.co.jp'),
      `[H1] 楽天 URL に travel.rakuten.co.jp がない: ${id}`, id);
    // H2: travel.rakuten.co.jp/yado/{area}/ 形式（都道府県エリアページ）
    check(
      rakuten.url.includes('travel.rakuten.co.jp/yado/'),
      `[H2] 楽天 URL に travel.rakuten.co.jp/yado/ がない: ${id}`, id,
    );
    // H3: /pack/ 禁止
    check(!rakuten.url.includes('/pack/'),
      `[H3] 楽天 URL に /pack/ が含まれている: ${id}`, id);
    // アフィリエイトラッパー禁止
    check(!rakuten.url.includes('hb.afl.rakuten'),
      `[H-aff] 楽天 URL にアフィリエイトラッパーが残存: ${id}`, id);
    // https チェック
    check(rakuten.url.startsWith('https://'),
      `[H-tls] 楽天 URL が https でない: ${id}`, id);
  } else {
    noRakuten++;
  }

  if (jalan) {
    jalanCount++;
    // H4: jalan.net
    check(jalan.url.includes('jalan.net'),
      `[H4] じゃらん URL に jalan.net がない: ${id}`, id);
    // H5: keyword=
    check(jalan.url.includes('keyword=') || jalan.url.includes('keyword%3D'),
      `[H5] じゃらん URL に keyword= がない: ${id}`, id);
    // H6: 二重エンコード禁止（%25 = エンコードされた %）
    check(!jalan.url.includes('%25'),
      `[H6] じゃらん URL に二重エンコード(%25)がある: ${id}`, id);
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
