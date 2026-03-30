/**
 * hotelTest.mjs — 宿リンク静的検証スクリプト
 *
 * 実行: node scripts/hotelTest.mjs
 *
 * 検証項目:
 *   [H-r1]  楽天: hb.afl.rakuten.co.jp アフィリエイト経由
 *   [H-r2]  楽天: pc= パラメータで travel.rakuten.co.jp に飛ぶ
 *   [H-r3]  楽天: 二重エンコード（%25%25）なし
 *   [H-j1]  じゃらん: valuecommerce.com 経由
 *   [H-j2]  じゃらん: vc_url= に uww2011init.do キーワードURLが含まれる
 *   [H-j3]  じゃらん: keyword の二重エンコードなし
 *   [H-kw]  全 destination: hotelKeyword フィールドが存在する
 *   [H7]    全 destination: links が最低1件返る
 *   [H8]    全 destination: heading が存在する
 *   [H-tls] 全URL: https で始まる
 *   [H-afl] 楽天: アフィリエイトID が含まれる
 *   [H-vc]  じゃらん: ValueCommerce sid/pid が含まれる
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const dests      = JSON.parse(readFileSync(join(ROOT, 'src/data/destinations.json'), 'utf8'));
const affiliate  = JSON.parse(readFileSync(join(ROOT, 'src/data/affiliateProviders.json'), 'utf8'));
const { buildHotelLinks } = await import(`file://${ROOT}/src/hotel/hotelLinkBuilder.js`);

const RAKUTEN_AFID = affiliate.rakuten.affiliateId;
const JALAN_VC_SID = affiliate.jalan.vcSid;
const JALAN_VC_PID = affiliate.jalan.vcPid;

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
    // H-r1: アフィリエイト経由（hb.afl.rakuten.co.jp）
    check(rakuten.url.startsWith('https://hb.afl.rakuten.co.jp/'),
      `[H-r1] 楽天 URL がアフィリエイト経由でない: ${id} (${rakuten.url})`, id);
    // H-r2: pc= パラメータで travel.rakuten.co.jp に飛ぶ
    check(rakuten.url.includes('travel.rakuten.co.jp'),
      `[H-r2] 楽天 URL の pc= に travel.rakuten.co.jp が含まれない: ${id}`, id);
    // H-r3: 二重エンコード（%2525 等）なし
    check(!rakuten.url.includes('%2525'),
      `[H-r3] 楽天 URL に二重エンコード(%2525)がある: ${id}`, id);
    // H-afl: アフィリエイトID が含まれる
    check(rakuten.url.includes(RAKUTEN_AFID),
      `[H-afl] 楽天 URL にアフィリエイトID(${RAKUTEN_AFID})がない: ${id}`, id);
  } else {
    noRakuten++;
  }

  if (jalan) {
    jalanCount++;
    // H-tls
    check(jalan.url.startsWith('https://'),
      `[H-tls] じゃらん URL が https でない: ${id}`, id);
    // H-j1: ValueCommerce 経由
    check(jalan.url.startsWith('https://ck.jp.ap.valuecommerce.com/'),
      `[H-j1] じゃらん URL が ValueCommerce 経由でない: ${id} (${jalan.url})`, id);
    // H-j2: vc_url= に uww2011init.do が含まれる
    check(jalan.url.includes('uww2011init.do') && jalan.url.includes('keyword%3D'),
      `[H-j2] じゃらん vc_url に keyword 付き uww2011init.do がない: ${id}`, id);
    // H-j3: keyword 二重エンコードなし（%2525 等）
    check(!jalan.url.includes('%2525'),
      `[H-j3] じゃらん URL に二重エンコード(%2525)がある: ${id}`, id);
    // H-vc: ValueCommerce sid/pid が含まれる
    check(jalan.url.includes(`sid=${JALAN_VC_SID}`) && jalan.url.includes(`pid=${JALAN_VC_PID}`),
      `[H-vc] じゃらん URL に ValueCommerce sid/pid がない: ${id}`, id);
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
