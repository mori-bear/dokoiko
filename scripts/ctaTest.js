/**
 * ctaTest.js — CTA行動ベース検証スクリプト
 *
 * 実行: node scripts/ctaTest.js
 *
 * 検証項目:
 *   [1] shinkansen → 🚄 新幹線を予約する（えきねっと/e5489/EX/JR九州）がDBに存在する
 *   [2] IC在来線 → ICカードでそのまま改札通れます の注記が存在する
 *   [3] ferry → 「フェリーを予約する」ラベルが存在する
 *   [4] flight → Skyscanner リンク生成が存在する
 *   [5] 旧式ラベル「🚄 予約する（...）」を使っていない（trainProviders.json）
 *   [6] step-group 方式が実装されている（resolveTransportLinks.js）
 *   [7] hotelLinkBuilder が正しいURL形式を使用している
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

/* ── ファイル読み込み ── */
const linkBuilderSrc     = readFileSync(join(__dirname, '../src/transport/linkBuilder.js'), 'utf8');
const resolverSrc        = readFileSync(join(__dirname, '../src/transport/resolveTransportLinks.js'), 'utf8');
const trainProvidersSrc  = readFileSync(join(__dirname, '../src/data/trainProviders.json'), 'utf8');
const renderSrc          = readFileSync(join(__dirname, '../src/features/dokoiko/render.js'), 'utf8');
const hotelSrc           = readFileSync(join(__dirname, '../src/hotel/hotelLinkBuilder.js'), 'utf8');
const styleSrc           = readFileSync(join(__dirname, '../style.css'), 'utf8');

/* ── テストフレームワーク ── */
let pass = 0;
let fail = 0;
const errors = [];

function check(condition, msg, context) {
  if (condition) {
    pass++;
    process.stdout.write('.');
  } else {
    fail++;
    errors.push({ msg, context });
    process.stdout.write('F');
  }
}

console.log('\n=== CTA 行動ベース検証 ===\n');

/* ── [5] 旧式JRラベル禁止（🚄 予約する（...）形式）── */
// 新方式: 「🚄 新幹線を予約する（...）」。旧方式「🚄 予約する（...）」は禁止。
check(!trainProvidersSrc.includes('🚄 予約する（'), '旧式JRラベル「🚄 予約する（...）」が trainProviders.json に残存', 'trainProviders.json');
check(!linkBuilderSrc.includes('🚄 予約する（'),    '旧式JRラベル「🚄 予約する（...）」が linkBuilder.js に残存', 'linkBuilder.js');

/* ── [1] JRラベル新方式（trainProviders.json に 🚄 新幹線を予約する が含まれる）── */
check(trainProvidersSrc.includes('🚄 新幹線を予約する（えきねっと）'), '🚄 新幹線を予約する（えきねっと） が trainProviders.json にない', 'trainProviders.json');
check(trainProvidersSrc.includes('🚄 新幹線を予約する（EX'),          '🚄 新幹線を予約する（EX...） が trainProviders.json にない', 'trainProviders.json');
check(trainProvidersSrc.includes('🚄 新幹線を予約する（e5489）'),      '🚄 新幹線を予約する（e5489） が trainProviders.json にない', 'trainProviders.json');
check(trainProvidersSrc.includes('🚄 新幹線を予約する（JR九州）'),     '🚄 新幹線を予約する（JR九州） が trainProviders.json にない', 'trainProviders.json');

/* ── [2] IC在来線の注記 ── */
check(resolverSrc.includes('ICカードでそのまま改札通れます'), 'IC在来線注記テキストが存在しない', 'resolveTransportLinks.js');
check(resolverSrc.includes('isIcRail'), 'IC判定関数 isIcRail が存在しない', 'resolveTransportLinks.js');

/* ── [3] フェリーラベル ── */
check(linkBuilderSrc.includes('フェリーを予約する'), 'フェリー予約ラベルが存在しない', 'linkBuilder.js');

/* ── [4] Skyscanner ── */
check(resolverSrc.includes('buildSkyscannerLink'), 'Skyscannerリンク生成が存在しない', 'resolveTransportLinks.js');
check(linkBuilderSrc.includes('skyscanner.jp'),    'Skyscanner URLが存在しない', 'linkBuilder.js');

/* ── [6] step-group 方式（resolveTransportLinks.js）── */
check(resolverSrc.includes("type: 'step-group'"), 'step-group 型の出力が存在しない', 'resolveTransportLinks.js');
check(resolverSrc.includes("type: 'summary'"),    'summary 型の出力が存在しない', 'resolveTransportLinks.js');
check(!resolverSrc.includes('detectMainMode'),    '旧式 detectMainMode が残存している', 'resolveTransportLinks.js');
check(!resolverSrc.includes("noteLabels.join"),   '旧式 noteLabels.join が残存している', 'resolveTransportLinks.js');

/* ── render.js が step-group を処理している ── */
check(renderSrc.includes('step-group'),      'render.js が step-group を処理していない', 'render.js');
check(renderSrc.includes('step-card'),       'render.js にステップカード表示が存在しない', 'render.js');
check(renderSrc.includes('step-card-header'), 'render.js にステップヘッダが存在しない', 'render.js');
check(renderSrc.includes('btn--route-main'), 'render.js にルートメインCTAボタンクラスが存在しない', 'render.js');
check(renderSrc.includes('step-card-caution'), 'render.js にCTA注記が存在しない', 'render.js');
check(renderSrc.includes('step-card-cta'),   'render.js に各ステップCTAボタンが存在しない', 'render.js');

/* ── style.css にステップカードスタイルが存在する ── */
check(styleSrc.includes('.step-card'),         'style.css に .step-card が存在しない', 'style.css');
check(styleSrc.includes('.step-card-header'),  'style.css に .step-card-header が存在しない', 'style.css');
check(styleSrc.includes('.btn--route-main'),   'style.css に .btn--route-main が存在しない', 'style.css');
check(styleSrc.includes('.step-card-caution'), 'style.css に .step-card-caution が存在しない', 'style.css');

/* ── [7] hotelLinkBuilder ── */
check(
  hotelSrc.includes('travel.rakuten.co.jp/yado/'),
  '楽天が travel.rakuten.co.jp/yado/{area}/ URLを使っていない',
  'hotelLinkBuilder.js',
);
check(!hotelSrc.includes('travel.rakuten.co.jp/search'),
  '楽天に /search?keyword= URL が含まれている（404のため禁止）',
  'hotelLinkBuilder.js');
check(!hotelSrc.includes('/pack/'), '楽天にpack URLが含まれている（禁止）', 'hotelLinkBuilder.js');
check(hotelSrc.includes('jalan.net'),       'じゃらんURLが存在しない', 'hotelLinkBuilder.js');
// アフィリエイトURLが実際にコードとして使われていないことを確認（コメントは除外）
const hotelNonComment = hotelSrc.split('\n').filter(l => !l.trimStart().startsWith('*') && !l.trimStart().startsWith('//')).join('\n');
check(
  !hotelNonComment.includes('hb.afl.rakuten') && !hotelNonComment.includes('valuecommerce'),
  'アフィリエイトラッパーが実コードに残存している（hb.afl.rakuten / valuecommerce）',
  'hotelLinkBuilder.js',
);
check(
  hotelSrc.includes('dest.name'),
  'hotelLinkBuilder が dest.name を使用していない',
  'hotelLinkBuilder.js',
);
check(
  hotelSrc.includes('dest.hotelArea'),
  'hotelLinkBuilder が dest.hotelArea を使用していない',
  'hotelLinkBuilder.js',
);

/* ── URL生成禁止（render.js内） ── */
// render.js は URL を生成してはならない（linkBuilder.js 経由のみ）
const renderNonComment = renderSrc.split('\n').filter(l => !l.trimStart().startsWith('//')).join('\n');
check(
  !renderNonComment.includes('encodeURIComponent') && !renderNonComment.includes('new URL('),
  'render.js 内で URL を生成している（encodeURIComponent / new URL）',
  'render.js',
);

/* ── 結果 ── */
console.log('\n');
if (errors.length) {
  console.log('FAIL 一覧:');
  errors.forEach(e => console.log(`  [FAIL] ${e.msg}  (${e.context})`));
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
