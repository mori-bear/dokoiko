/**
 * bfsTest.mjs — BFS ルートエンジン動作確認
 *
 * 成功条件（3ルート）:
 *   1. 高松 → 橿原神宮前（鉄道ルート）
 *   2. 高松 → 座間味（飛行機 + フェリー）
 *   3. 高松 → 壱岐（新幹線 + フェリー）
 *
 * 実行: node scripts/bfsTest.mjs
 */

import { fileURLToPath } from 'url';
import { dirname, join }  from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root      = join(__dirname, '..');

const { buildRoute, GRAPH }          = await import(`file://${root}/src/engine/bfsEngine.js`);
const { resolveTransportLinks }      = await import(`file://${root}/src/features/dokoiko/transportRenderer.js`);

/* ── テスト対象（gateway フィールドで BFS を起動） ── */
const CASES = [
  {
    label: '高松 → 橿原神宮前（鉄道ルート）',
    from:  '高松',
    dest:  { id: 'kashihara', name: '橿原神宮前', displayName: '橿原神宮前', gateway: '橿原神宮前' },
  },
  {
    label: '高松 → 座間味（飛行機 + フェリー）',
    from:  '高松',
    dest:  { id: 'zamami-island', name: '座間味', displayName: '座間味島', gateway: '座間味' },
  },
  {
    label: '高松 → 壱岐（新幹線 + フェリー）',
    from:  '高松',
    dest:  { id: 'iki-island', name: '壱岐', displayName: '壱岐', gateway: '壱岐' },
  },
];

let pass = 0;
let fail = 0;
const errors = [];

function ok(msg) { pass++; }
function ng(msg) { fail++; errors.push(msg); console.log(`  ✗ ${msg}`); }

console.log('\n========== BFS ルートテスト ==========\n');

/* ── ① BFS raw ステップ確認 ── */
console.log('--- raw steps (bfsEngine.buildRoute) ---');
for (const { label, from, dest } of CASES) {
  console.log(`\n▶ ${label}`);
  const steps = buildRoute(from, dest);
  if (!Array.isArray(steps) || steps.length === 0) {
    ng(`${label}: steps 空`);
    continue;
  }
  steps.forEach((s, i) => {
    const idx = ['①', '②', '③', '④'][i];
    console.log(`  ${idx} ${s.from ?? ''} → ${s.to ?? ''}（${s.type}）`);
  });
  ok();
}

/* ── ② フル統合確認（resolveTransportLinks） ── */
console.log('\n--- links (transportRenderer.resolveTransportLinks) ---');
for (const { label, from, dest } of CASES) {
  console.log(`\n▶ ${label}`);
  const links = resolveTransportLinks(dest, from);

  if (!Array.isArray(links) || links.length === 0) {
    ng(`${label}: links 空`);
    continue;
  }

  const note    = links.find(l => l.type === 'note');
  const hasNote = !!note;
  const hasURL  = links.some(l => l.url);

  if (!hasNote) ng(`${label}: ステップノートなし`);
  else          ok();
  if (!hasURL)  ng(`${label}: URLリンクなし`);
  else          ok();

  /* URL 形式チェック */
  for (const l of links.filter(l => l.url)) {
    try { new URL(l.url); ok(); }
    catch { ng(`${label}: 不正URL ${l.url?.slice(0, 60)}`); }
  }

  /* 表示 */
  if (note) console.log(`  Note: ${note.label}`);
  links.filter(l => l.url).forEach(l =>
    console.log(`  [${l.type}] ${l.url.slice(0, 70)}`),
  );
}

/* ── サマリ ── */
console.log('\n══════════════════════════════════');
console.log(`  総計: PASS ${pass} / FAIL ${fail}`);
if (errors.length) {
  console.log('\n  エラー:');
  errors.forEach(e => console.log(`    - ${e}`));
}
console.log(fail === 0 ? '  ✓ 全チェック通過' : '  ✗ エラーあり');
console.log('══════════════════════════════════\n');
process.exit(fail > 0 ? 1 : 0);
