/**
 * ctaTest.js — CTA行動ベース検証スクリプト
 *
 * 実行: node scripts/ctaTest.js
 *
 * 検証項目:
 *   [1] shinkansen → EX / えきねっと / e5489 がラベルに存在する
 *   [2] IC在来線 → ICカードでそのまま乗車できます の注記が存在する
 *   [3] ferry → 「フェリーを予約する」ラベルが存在する
 *   [4] flight → Skyscanner リンク生成が存在する
 *   [5] 全ファイルで旧式ラベル「予約する（...）」を使っていない
 *   [6] step-group 方式が実装されている
 *   [7] hotelLinkBuilder が正しいURL形式を使用している
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

/* ── ファイル読み込み ── */
const linkBuilderSrc = readFileSync(join(__dirname, '../src/transport/linkBuilder.js'), 'utf8');
const rendererSrc    = readFileSync(join(__dirname, '../src/features/dokoiko/transportRenderer.js'), 'utf8');
const renderSrc      = readFileSync(join(__dirname, '../src/features/dokoiko/render.js'), 'utf8');
const hotelSrc       = readFileSync(join(__dirname, '../src/hotel/hotelLinkBuilder.js'), 'utf8');
const styleSrc       = readFileSync(join(__dirname, '../style.css'), 'utf8');

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
// フェリーの「フェリーを予約する（...）」は許可。JR系の「🚄 予約する（...）」のみ禁止。
check(!linkBuilderSrc.includes('🚄 予約する（'), '旧式JRラベル「🚄 予約する（...）」が linkBuilder.js に残存', 'linkBuilder.js');
check(!rendererSrc.includes('🚄 予約する（'), '旧式JRラベル「🚄 予約する（...）」が transportRenderer.js に残存', 'transportRenderer.js');

/* ── [1] JRラベル新方式 ── */
check(linkBuilderSrc.includes('予約する（えきねっと）'),     '予約する（えきねっと） ラベルが存在しない', 'linkBuilder.js');
check(linkBuilderSrc.includes('予約する（EX）'),             '予約する（EX） ラベルが存在しない', 'linkBuilder.js');
check(linkBuilderSrc.includes('予約する（e5489）'),           '予約する（e5489） ラベルが存在しない', 'linkBuilder.js');
check(linkBuilderSrc.includes('予約する（JR九州ネット予約）'), '予約する（JR九州ネット予約） ラベルが存在しない', 'linkBuilder.js');

/* ── [2] IC在来線の注記 ── */
check(rendererSrc.includes('ICカードでそのまま改札通れます'), 'IC在来線注記テキストが存在しない', 'transportRenderer.js');
check(rendererSrc.includes('isIcRail'), 'IC判定関数 isIcRail が存在しない', 'transportRenderer.js');

/* ── [3] フェリーラベル ── */
check(linkBuilderSrc.includes('フェリーを予約する'), 'フェリー予約ラベルが存在しない', 'linkBuilder.js');

/* ── [4] Skyscanner ── */
check(rendererSrc.includes('buildSkyscannerLink'), 'Skyscannerリンク生成が存在しない', 'transportRenderer.js');
check(linkBuilderSrc.includes('skyscanner.jp'),    'Skyscanner URLが存在しない', 'linkBuilder.js');

/* ── [6] step-group 方式 ── */
check(rendererSrc.includes("type: 'step-group'"), 'step-group 型の出力が存在しない', 'transportRenderer.js');
check(rendererSrc.includes("type: 'summary'"),    'summary 型の出力が存在しない', 'transportRenderer.js');
check(!rendererSrc.includes('detectMainMode'),    '旧式 detectMainMode が残存している', 'transportRenderer.js');
// 「現在準備中」のフォールバック note は許可。ステップノート（全行程1行）が残っていないことを確認。
check(!rendererSrc.includes("noteLabels.join"), '旧式 noteLabels.join（全行程1行）が残存している', 'transportRenderer.js');

/* ── render.js が step-group を処理している ── */
check(renderSrc.includes('step-group'), 'render.js が step-group を処理していない', 'render.js');
check(renderSrc.includes('step-card'),  'render.js にステップカード表示が存在しない', 'render.js');
check(renderSrc.includes('step-card-header'), 'render.js にステップヘッダが存在しない', 'render.js');
check(renderSrc.includes('btn--route-main'),  'render.js にルートメインCTAボタンクラスが存在しない', 'render.js');
check(renderSrc.includes('step-card-caution'), 'render.js にCTA注記が存在しない', 'render.js');

/* ── style.css にステップカードスタイルが存在する ── */
check(styleSrc.includes('.step-card'),        'style.css に .step-card が存在しない', 'style.css');
check(styleSrc.includes('.step-card-header'), 'style.css に .step-card-header が存在しない', 'style.css');
check(styleSrc.includes('.btn--route-main'),  'style.css に .btn--route-main が存在しない', 'style.css');
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
check(
  hotelSrc.includes('safeEncode'),
  'safeEncode 関数が存在しない',
  'hotelLinkBuilder.js',
);
check(
  hotelSrc.includes('dest.hotelKeyword') || hotelSrc.includes('dest.name'),
  'hotelLinkBuilder のキーワード解決ロジック（hotelKeyword/name）が存在しない',
  'hotelLinkBuilder.js',
);
check(
  hotelSrc.includes('dest.hotelArea'),
  'hotelLinkBuilder が dest.hotelArea を使用していない',
  'hotelLinkBuilder.js',
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
