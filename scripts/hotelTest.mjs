/**
 * hotelTest.mjs — 宿リンク静的検証スクリプト
 *
 * 実行: node scripts/hotelTest.mjs
 *
 * 検証項目:
 *   [H1]  楽天: アフィリエイトURL (hb.afl.rakuten.co.jp) を使用
 *   [H2]  楽天: pc= デコード後に travel.rakuten.co.jp/yado/list/ + keyword= を含む
 *   [H3]  楽天: /pack/ を含まない（パックページ禁止）
 *   [H-enc-r] 楽天: pc= に二重エンコード（%25）がない
 *   [H4]  じゃらん: ValueCommerce ラッパー (ck.jp.ap.valuecommerce.com) を使用
 *   [H5]  じゃらん: vc_url デコード後に jalan.net を含む
 *   [H6]  じゃらん: vc_url デコード後に keyword= が含まれる
 *   [H-enc-j] じゃらん: vc_url に二重エンコード（%25）がない
 *   [H7]  全 destination: リンクが最低1件返る
 *   [H8]  全 destination: heading が存在する
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

/* ── affiliateProviders.json 静的チェック ── */
const affiliateDb = JSON.parse(readFileSync(join(ROOT, 'src/data/affiliateProviders.json'), 'utf8'));
const hotelSrc    = readFileSync(join(ROOT, 'src/hotel/hotelLinkBuilder.js'), 'utf8');

check(affiliateDb.rakuten.affiliateBaseUrl.includes('hb.afl.rakuten.co.jp'),
  '[H-src] 楽天アフィリエイトURL hb.afl.rakuten.co.jp が存在しない');
check(affiliateDb.rakuten.hotelSearchUrl.includes('travel.rakuten.co.jp/yado/list/'),
  '[H-src] 楽天 hotelSearchUrl が travel.rakuten.co.jp/yado/list/ でない');
check(!hotelSrc.includes('/pack/'),
  '[H-src] 楽天に /pack/ URL が含まれている（禁止）');
check(affiliateDb.jalan.hotelSearchUrl.includes('jalan.net'),
  '[H-src] じゃらん hotelSearchUrl に jalan.net が存在しない');
check(hotelSrc.includes('valuecommerce.com'),
  '[H-src] じゃらん ValueCommerce ラッパーが存在しない');

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
    // H-tls: https チェック
    check(rakuten.url.startsWith('https://'),
      `[H-tls] 楽天 URL が https でない: ${id}`, id);
    // H1: アフィリエイトラッパー使用
    check(rakuten.url.includes('hb.afl.rakuten.co.jp'),
      `[H1] 楽天 URL にアフィリエイトラッパーがない: ${id}`, id);
    // H2: pc= デコード後に yado/list/ + keyword= を含む
    const pcEncoded = new URL(rakuten.url).searchParams.get('pc') ?? '';
    const pcDecoded = decodeURIComponent(pcEncoded);
    check(
      pcDecoded.includes('travel.rakuten.co.jp/yado/list/') && pcDecoded.includes('keyword='),
      `[H2] 楽天 pc= が yado/list/?keyword= 形式でない: ${id}`, id,
    );
    // H3: /pack/ 禁止
    check(!rakuten.url.includes('/pack/'),
      `[H3] 楽天 URL に /pack/ が含まれている: ${id}`, id);
    // H-enc-r: 二重エンコード禁止（pc= 内に %25 があれば二重）
    check(!pcEncoded.includes('%25'),
      `[H-enc-r] 楽天 pc= に二重エンコード(%25)がある: ${id}`, id);
  } else {
    noRakuten++;
  }

  if (jalan) {
    jalanCount++;
    // H-tls: https チェック
    check(jalan.url.startsWith('https://'),
      `[H-tls] じゃらん URL が https でない: ${id}`, id);
    // H4: ValueCommerce ラッパー使用
    check(jalan.url.includes('valuecommerce.com'),
      `[H4] じゃらん URL に ValueCommerce ラッパーがない: ${id}`, id);
    // H5 / H6 / H-enc-j
    try {
      const vcEncoded = new URL(jalan.url).searchParams.get('vc_url') ?? '';
      const vcDecoded = decodeURIComponent(vcEncoded);
      check(vcDecoded.includes('jalan.net'),
        `[H5] じゃらん vc_url に jalan.net がない: ${id}`, id);
      check(vcDecoded.includes('keyword='),
        `[H6] じゃらん vc_url に keyword= がない: ${id}`, id);
      // H-enc-j: 二重エンコード禁止（vc_url 内に %25 があれば二重）
      check(!vcEncoded.includes('%25'),
        `[H-enc-j] じゃらん vc_url に二重エンコード(%25)がある: ${id}`, id);
    } catch (e) {
      check(false, `[H-parse] じゃらん URL パースエラー: ${id} — ${e.message}`, id);
    }
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
