/**
 * predeploy-check.js — デプロイ前チェック
 *
 * 実行: node scripts/predeploy-check.js
 *
 * チェック内容:
 *   ① git未追跡ファイル（本番404の最多原因）
 *   ② import先ファイルの存在確認（拡張子なし補完込み）
 *   ③ import-after-await パターン検出
 *   ④ loadJson で参照するJSONファイルの存在確認
 */

import fs   from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

let errors   = 0;
let warnings = 0;

function ok(msg)   { console.log('  ✓', msg); }
function fail(msg) { console.error('  ✗', msg); errors++; }
function warn(msg) { console.warn('  ⚠', msg); warnings++; }

// ─────────────────────────────────────────
// ① git 未追跡ファイルチェック
// ─────────────────────────────────────────
console.log('\n① git 未追跡ファイルチェック');
const untracked = execSync('git ls-files --others --exclude-standard', { cwd: ROOT })
  .toString().trim().split('\n').filter(Boolean)
  .filter(f => f.startsWith('src/') || f === 'app.js' || f === 'index.html');

if (untracked.length === 0) {
  ok('未追跡ファイルなし');
} else {
  untracked.forEach(f => fail(`未追跡: ${f}  ← git add が必要`));
}

// ─────────────────────────────────────────
// ② import先ファイル存在 + パス正確性チェック
// ─────────────────────────────────────────
console.log('\n② import先ファイル存在チェック');

function scanImports(file) {
  const fullPath = path.join(ROOT, file);
  if (!fs.existsSync(fullPath)) { fail(`ファイル自体が存在しない: ${file}`); return; }

  const code  = fs.readFileSync(fullPath, 'utf8');
  const lines = code.split('\n');
  let firstAwaitLine = -1;

  lines.forEach((line, i) => {
    const ln = i + 1;

    // top-level await 検出
    if (firstAwaitLine === -1 && /^(?:const|let|var)\s+\S.*=\s*await\s/.test(line)) {
      firstAwaitLine = ln;
    }

    const m = line.match(/^\s*import\s+.*from\s+['"]([^'"]+)['"]/);
    if (!m) return;
    const importPath = m[1];

    // import-after-await
    if (firstAwaitLine !== -1 && ln > firstAwaitLine) {
      fail(`import-after-await: ${file}:${ln}  "${importPath}"  (await at L${firstAwaitLine})`);
    }

    // 相対パスのみチェック（node_modules は除外）
    if (!importPath.startsWith('.')) return;

    let resolved = path.resolve(path.dirname(fullPath), importPath);
    if (!resolved.endsWith('.js') && !resolved.endsWith('.json') && !resolved.endsWith('.mjs')) {
      resolved += '.js';
    }

    if (!fs.existsSync(resolved)) {
      fail(`404になる: ${file}:${ln}  "${importPath}"  → ${resolved.replace(ROOT + '/', '')}`);
    }
  });
}

const targetFiles = [
  'app.js',
  'src/state.js', 'src/share.js',
  'src/config/constants.js',
  'src/data/index.js',
  'src/engine/bfsEngine.js', 'src/engine/distanceCalculator.js',
  'src/engine/routeResolver.js', 'src/engine/selectionEngine.js',
  'src/features/dokoiko/render.js', 'src/features/dokoiko/routes.js',
  'src/features/dokoiko/travelPlan.js',
  'src/hotel/hotelLinkBuilder.js',
  'src/lib/loadJson.js',
  'src/transport/linkBuilder.js', 'src/transport/resolveTransportLinks.js',
  'src/transport/routeNarrator.js',
  'src/ui/handlers.js',
  'src/utilities/airportMap.js',
  'src/utils/date.js', 'src/utils/geo.js',
];

targetFiles.forEach(scanImports);
if (errors === 0) ok('全 import 先が存在する');

// ─────────────────────────────────────────
// ③ loadJson で参照する JSON ファイルの存在チェック
// ─────────────────────────────────────────
console.log('\n③ loadJson JSON ファイル存在チェック');
const asyncFiles = [
  'src/transport/linkBuilder.js', 'src/engine/bfsEngine.js',
  'src/engine/routeResolver.js', 'src/transport/resolveTransportLinks.js',
  'src/hotel/hotelLinkBuilder.js',
];
let jsonOk = true;
for (const file of asyncFiles) {
  const code = fs.readFileSync(path.join(ROOT, file), 'utf8');
  for (const line of code.split('\n')) {
    const m = line.match(/loadJson\(['"]([^'"]+)['"]/);
    if (!m) continue;
    const jsonPath = m[1];
    const resolved = path.resolve(path.dirname(path.join(ROOT, file)), jsonPath);
    const rel = resolved.replace(ROOT + '/', '');
    if (!fs.existsSync(resolved)) {
      fail(`JSON 404: ${file}  "${jsonPath}"  → ${rel}`);
      jsonOk = false;
    }
  }
}
if (jsonOk) ok('全 JSON ファイルが存在する');

// ─────────────────────────────────────────
// ④ git 追跡済み確認（import先 × git管理）
// ─────────────────────────────────────────
console.log('\n④ import先が git 管理下にあるかチェック');
const trackedSet = new Set(
  execSync('git ls-files', { cwd: ROOT }).toString().trim().split('\n')
);
let gitOk = true;
for (const file of targetFiles) {
  if (!trackedSet.has(file)) {
    fail(`git未追跡: ${file}`);
    gitOk = false;
  }
}
if (gitOk) ok('全 import 対象ファイルが git 管理下にある');

// ─────────────────────────────────────────
// 結果
// ─────────────────────────────────────────
console.log('\n' + '─'.repeat(50));
if (errors === 0) {
  console.log(`✅ Predeploy check OK  (warnings: ${warnings})`);
  console.log('   git push して問題ありません。\n');
  process.exit(0);
} else {
  console.error(`❌ Predeploy check FAILED  errors: ${errors} / warnings: ${warnings}`);
  console.error('   上記エラーを修正してから git push してください。\n');
  process.exit(1);
}
