/**
 * migrateTagsV2.mjs
 * tags → primary / secondary / onsenLevel への移行スクリプト
 *
 * 実行: node scripts/migrateTagsV2.mjs
 */

import fs from 'fs';

const DESTS_PATH = './src/data/destinations.json';
const dests = JSON.parse(fs.readFileSync(DESTS_PATH, 'utf8'));

/* ──────────────────────────────────────────
   onsenLevel 計算ルール
   3: destType=onsen（正式温泉地）
   2: 温泉タグあり かつ 地名に「温泉」「秘湯」含む（実質的温泉地）
   1: 温泉タグあり（温泉は副次的）
   0: 温泉タグなし
────────────────────────────────────────── */
function deriveOnsenLevel(dest) {
  const tags = dest.tags || [];
  if (dest.destType === 'onsen') return 3;
  if (!tags.includes('温泉') && !tags.includes('秘湯')) return 0;
  // 地名に「温泉」「湯」「秘湯」が入っている → 実質的温泉地
  if (/温泉|秘湯/.test(dest.name)) return 2;
  return 1;
}

/* ──────────────────────────────────────────
   primary / secondary 分離
   primary: 目的地を最もよく表す上位3タグ（destType に対応するタグを優先）
   secondary: 補足的なタグ（残り最大3つ）
────────────────────────────────────────── */

// destType に対応する「代表タグ」
const TYPE_PRIORITY_TAG = {
  onsen:    ['温泉', '秘湯'],
  island:   ['離島', '海'],
  mountain: ['山', '高原', '自然'],
  remote:   ['秘境', '山', '自然'],
  sight:    [],  // type優先タグなし
  city:     [],
};

function derivePrimarySecondary(dest) {
  const tags = dest.tags || [];
  if (tags.length === 0) return { primary: [], secondary: [] };

  const typePriority = TYPE_PRIORITY_TAG[dest.destType] ?? [];

  // 優先タグを先頭に並べ替え（存在する場合のみ）
  const prioritized = [
    ...typePriority.filter(t => tags.includes(t)),
    ...tags.filter(t => !typePriority.includes(t)),
  ];

  const primary   = prioritized.slice(0, 3);
  const secondary = prioritized.slice(3, 6);

  return { primary, secondary };
}

/* ──────────────────────────────────────────
   手動オーバーライド（仕様で指定）
────────────────────────────────────────── */
const ONSEN_OVERRIDES = {
  'innoshima':       0,   // 因島 → 0
  'kinosaki-onsen':  3,   // 城崎温泉 → 3（destType=onsenなので同値だが明示）
  'hakone':          3,   // 箱根 → 3
  // 湯郷(yugou)はデータに存在しないためスキップ
};

/* ──────────────────────────────────────────
   移行実行
────────────────────────────────────────── */

let modified = 0;
const report = { level3: [], level2: [], level1: [], level0WithTag: [], noTags: [] };

const migrated = dests.map(dest => {
  const { primary, secondary } = derivePrimarySecondary(dest);
  let onsenLevel = deriveOnsenLevel(dest);

  // 手動オーバーライド
  if (dest.id in ONSEN_OVERRIDES) {
    onsenLevel = ONSEN_OVERRIDES[dest.id];
  }

  const changed =
    JSON.stringify(dest.primary) !== JSON.stringify(primary) ||
    JSON.stringify(dest.secondary) !== JSON.stringify(secondary) ||
    dest.onsenLevel !== onsenLevel;

  if (changed) modified++;

  // レポート分類
  if (onsenLevel === 3) report.level3.push(dest.name);
  else if (onsenLevel === 2) report.level2.push(dest.name);
  else if (onsenLevel === 1) report.level1.push(dest.name);
  else if ((dest.tags || []).includes('温泉')) report.level0WithTag.push(dest.name);
  if (!dest.tags?.length) report.noTags.push(dest.id);

  return { ...dest, primary, secondary, onsenLevel };
});

fs.writeFileSync(DESTS_PATH, JSON.stringify(migrated, null, 2));

/* ──────────────────────────────────────────
   サマリ出力
────────────────────────────────────────── */
console.log(`\n✓ migrateTagsV2 完了`);
console.log(`  修正件数: ${modified} / ${dests.length}`);
console.log(`\n  onsenLevel 分布:`);
console.log(`    Level 3 (主要温泉地): ${report.level3.length}件`);
console.log(`    Level 2 (温泉地名):   ${report.level2.length}件`);
console.log(`    Level 1 (温泉副次的): ${report.level1.length}件`);
console.log(`    Level 0 (温泉なし):   ${dests.length - report.level3.length - report.level2.length - report.level1.length}件`);
console.log(`\n  Level 2 サンプル: ${report.level2.slice(0, 10).join('、')}`);
console.log(`  Level 3 サンプル: ${report.level3.slice(0, 10).join('、')}`);
if (report.noTags.length) {
  console.log(`\n  WARN: tags未設定 ${report.noTags.length}件: ${report.noTags.slice(0, 5).join(', ')}`);
}
