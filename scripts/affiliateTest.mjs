/**
 * affiliateTest.mjs — アフィリエイトリンク完全性テスト
 *
 * 実行: node scripts/affiliateTest.mjs
 *
 * チェック項目:
 *   [1] 楽天URLが hb.afl.rakuten.co.jp ラッパー経由
 *   [2] 楽天内部URLが /hotel/search.do を使用（/pack/ 禁止）
 *   [3] じゃらんURLが valuecommerce.com ラッパー経由
 *   [4] じゃらんURLが多重エンコードされていない
 *   [5] 全アフィリエイトURLが有効な形式
 *   [6] キーワードが hotelSearch > displayName > name の優先順で解決されている
 */

import { fileURLToPath } from 'url';
import { dirname, join }  from 'path';
import { readFileSync }   from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root      = join(__dirname, '..');

const { buildHotelLinks } = await import(`file://${root}/src/hotel/hotelLinkBuilder.js`);

const allDests = JSON.parse(readFileSync(join(root, 'src/data/destinations.json'), 'utf8'));

const RAKUTEN_WRAPPER = 'https://hb.afl.rakuten.co.jp/hgc/5113ee4b.8662cfc5.5113ee4c.119de89a/?pc=';
const JALAN_WRAPPER   = 'https://ck.jp.ap.valuecommerce.com/servlet/referral?sid=3764408&pid=892559858&vc_url=';

let pass = 0;
let fail = 0;
const errors = [];

function ok()    { pass++; }
function ng(msg) { fail++; errors.push(msg); }

console.log('\n=== アフィリエイトリンク検証 ===\n');

for (const dest of allDests) {
  const label = `${dest.name}(${dest.id})`;
  const hotel = buildHotelLinks(dest);

  /* リンク件数 */
  if (!hotel?.links?.length) {
    ng(`${label}: 宿リンク0件`);
    continue;
  }
  if (hotel.links.length !== 2) {
    ng(`${label}: 宿リンクが2件でない（${hotel.links.length}件）`);
    continue;
  }

  for (const l of hotel.links) {
    /* [5] URL形式 */
    let urlObj;
    try { urlObj = new URL(l.url); ok(); }
    catch { ng(`${label} ${l.type}: 不正URL ${l.url?.slice(0, 60)}`); continue; }

    if (l.type === 'rakuten') {
      /* [1] ラッパー確認 */
      if (!l.url.startsWith(RAKUTEN_WRAPPER)) {
        ng(`${label} 楽天: アフィリエイトラッパー未適用`);
        continue;
      }
      ok();

      /* [2] /hotel/search.do かつ /pack/ 禁止 */
      const inner = decodeURIComponent(urlObj.searchParams.get('pc') || '');
      if (!inner.includes('/hotel/search.do')) {
        ng(`${label} 楽天: /hotel/search.do を使っていない（inner=${inner.slice(0, 60)}）`);
      } else ok();
      if (inner.includes('/pack/')) {
        ng(`${label} 楽天: /pack/ URLが含まれている（禁止）`);
      } else ok();

    } else if (l.type === 'jalan') {
      /* [3] ラッパー確認 */
      if (!l.url.startsWith(JALAN_WRAPPER)) {
        ng(`${label} じゃらん: アフィリエイトラッパー未適用`);
        continue;
      }
      ok();

      /* [4] 多重エンコード検出 */
      const vcUrl = urlObj.searchParams.get('vc_url') || '';
      if (vcUrl.includes('%25')) {
        ng(`${label} じゃらん: 多重エンコード検出（%25 が含まれる）`);
      } else ok();
    }
  }

  /* [6] キーワード解決順 — hotelSearch が設定されていれば使われているか */
  if (dest.hotelSearch) {
    const rakuten = hotel.links.find(l => l.type === 'rakuten');
    if (rakuten) {
      // URL全体をデコードしてキーワードが含まれるか確認
      const fullDecoded = decodeURIComponent(rakuten.url);
      if (!fullDecoded.includes(dest.hotelSearch)) {
        ng(`${label}: hotelSearch "${dest.hotelSearch}" がURLに反映されていない`);
      } else ok();
    }
  }
}

/* ── サマリ ── */
console.log('══════════════════════════════════');
console.log(`  対象: ${allDests.length}件`);
console.log(`  PASS: ${pass} / FAIL: ${fail}`);
if (errors.length) {
  const preview = errors.slice(0, 20);
  console.log(`\n  エラー（先頭${preview.length}件）:`);
  preview.forEach(e => console.log(`    - ${e}`));
  if (errors.length > 20) console.log(`    ... 他${errors.length - 20}件`);
}
console.log(fail === 0 ? '\n✅ 全チェック PASS' : '\n❌ 修正が必要なチェックがあります');
console.log('══════════════════════════════════\n');
process.exit(fail > 0 ? 1 : 0);
