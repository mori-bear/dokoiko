/**
 * uiTest.mjs — UI State 単体テスト
 *
 * 実行: node scripts/uiTest.mjs
 *
 * チェック項目:
 *   [1] state が正しい初期値を持つ
 *   [2] state.stayType が更新できる
 *   [3] state.theme が更新できる
 *   [4] state.departure が更新できる
 *   [5] state が同一オブジェクト参照（シングルトン）である
 *   [6] handlers.js が state.js を import している（ソースコード検証）
 *   [7] app.js が state.js を import している（ソースコード検証）
 *   [8] index.html に data-stay 属性が存在する
 *   [9] index.html に data-theme 属性が存在する
 *   [10] index.html に debug div が存在する
 */

import { fileURLToPath } from 'url';
import { dirname, join }  from 'path';
import { readFileSync }   from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root      = join(__dirname, '..');

/* ── state モジュール import ── */
const { state } = await import(`file://${root}/src/state.js`);

/* ── ソースコード読み込み ── */
const handlersSrc = readFileSync(join(root, 'src/ui/handlers.js'), 'utf8');
const appSrc      = readFileSync(join(root, 'app.js'), 'utf8');
const htmlSrc     = readFileSync(join(root, 'index.html'), 'utf8');

/* ── テストフレームワーク ── */
let pass = 0, fail = 0;
const errors = [];

function check(condition, msg) {
  if (condition) { pass++; process.stdout.write('.'); }
  else           { fail++; errors.push(msg); process.stdout.write('F'); }
}

console.log('\n=== UI State テスト ===\n');

/* [1] 初期値 */
check(state.departure === '東京',  'departure 初期値が "東京" でない');
check(state.stayType  === '1night', 'stayType 初期値が "1night" でない');
check(state.theme     === null,     'theme 初期値が null でない');
check(Array.isArray(state.destinations), 'destinations が配列でない');
check(Array.isArray(state.pool),         'pool が配列でない');

/* [2] stayType 更新 */
state.stayType = 'daytrip';
check(state.stayType === 'daytrip', 'stayType が daytrip に更新されない');

state.stayType = '2night';
check(state.stayType === '2night', 'stayType が 2night に更新されない');

/* [3] theme 更新 */
state.theme = '温泉';
check(state.theme === '温泉', 'theme が "温泉" に更新されない');

state.theme = null;
check(state.theme === null, 'theme が null に戻せない');

/* [4] departure 更新 */
state.departure = '大阪';
check(state.departure === '大阪', 'departure が "大阪" に更新されない');

state.departure = '東京';
check(state.departure === '東京', 'departure が "東京" に戻せない');

/* [5] シングルトン確認 — 再 import しても同じ参照 */
const { state: state2 } = await import(`file://${root}/src/state.js`);
check(state === state2, 'state が同一参照でない（シングルトン破綻）');

/* [6] handlers.js が state.js を import している */
check(
  handlersSrc.includes("from '../state.js'"),
  "handlers.js が ../state.js を import していない",
);

/* [7] app.js が state.js を import している */
check(
  appSrc.includes("from './src/state.js'"),
  "app.js が ./src/state.js を import していない",
);

/* [8] data-stay 属性が HTML に存在する */
check(htmlSrc.includes('data-stay='),  'index.html に data-stay 属性が存在しない');

/* [9] data-theme 属性が HTML に存在する */
check(htmlSrc.includes('data-theme='), 'index.html に data-theme 属性が存在しない');

/* [10] debug div が HTML に存在する */
check(htmlSrc.includes('id="debug"'), 'index.html に id="debug" が存在しない');

/* ── サマリ ── */
console.log('\n');
if (errors.length) {
  console.log('FAIL 一覧:');
  errors.forEach(e => console.log(`  [FAIL] ${e}`));
  console.log('');
}
console.log(`PASS: ${pass} / ${pass + fail}`);
console.log(`FAIL: ${fail} / ${pass + fail}`);
console.log(fail === 0 ? '\n✅ 全チェック PASS' : '\n❌ 修正が必要なチェックがあります');
process.exit(fail > 0 ? 1 : 0);
