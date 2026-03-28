/**
 * hotelTest.mjs — 宿リンク静的検証スクリプト
 *
 * 実行: node scripts/hotelTest.mjs
 *
 * 検証項目:
 *   [H1]  楽天: アフィリエイトURL (hb.afl.rakuten.co.jp) を使用
 *   [H2]  楽天: pc= パラメータ内に travel.rakuten.co.jp/yado/ を含む
 *   [H3]  楽天: /pack/ を含まない（パックページ禁止）
 *   [H4]  じゃらん: ValueCommerce ラッパー (ck.jp.ap.valuecommerce.com) を使用
 *   [H5]  じゃらん: vc_url 内に jalan.net を含む
 *   [H6]  じゃらん: vc_url デコード後の URL に keyword= が含まれる
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
const { buildHotelLinks } = await import(join(ROOT, 'src/hotel/hotelLinkBuilder.js'));

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
const hotelSrc     = readFileSync(join(ROOT, 'src/hotel/hotelLinkBuilder.js'), 'utf8');
const affiliateDb  = JSON.parse(readFileSync(join(ROOT, 'src/data/affiliateProviders.json'), 'utf8'));

check(affiliateDb.rakuten.affiliateBaseUrl.includes('hb.afl.rakuten.co.jp'),
  '[H-src] 楽天アフィリエイトURL hb.afl.rakuten.co.jp が存在しない');
check(affiliateDb.rakuten.hotelBaseUrl.includes('travel.rakuten.co.jp/yado/'),
  '[H-src] 楽天 travel.rakuten.co.jp/yado/{area}/ URLが存在しない');
check(!hotelSrc.includes('/pack/'),
  '[H-src] 楽天に /pack/ URL が含まれている（禁止）');
check(hotelSrc.includes('jalan.net'),
  '[H-src] じゃらん jalan.net が存在しない');
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
    // H2: pc= パラメータ内に /yado/ を含む（エンコード済みでも可）
    const pcEncoded = new URL(rakuten.url).searchParams.get('pc') ?? '';
    const pcDecoded = decodeURIComponent(pcEncoded);
    check(
      pcDecoded.includes('travel.rakuten.co.jp/yado/') || pcDecoded.includes('travel.rakuten.co.jp/'),
      `[H2] 楽天 pc= に travel.rakuten.co.jp が含まれない: ${id}`, id,
    );
    // H3: /pack/ 禁止
    check(!rakuten.url.includes('/pack/'),
      `[H3] 楽天 URL に /pack/ が含まれている: ${id}`, id);
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
    // H5: vc_url パラメータ内に jalan.net を含む
    try {
      const vcEncoded = new URL(jalan.url).searchParams.get('vc_url') ?? '';
      const vcDecoded = decodeURIComponent(vcEncoded);
      check(vcDecoded.includes('jalan.net'),
        `[H5] じゃらん vc_url に jalan.net がない: ${id}`, id);
      // H6: vc_url デコード後に keyword= が含まれる
      check(vcDecoded.includes('keyword=') || vcDecoded.includes('keyword%3D'),
        `[H6] じゃらん vc_url に keyword= がない: ${id}`, id);
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
