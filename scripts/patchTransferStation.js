/**
 * finalAccess に transferStation を追加する。
 * 「出す価値ある乗換駅」のみ手動設定。
 *
 * 選定基準：
 * - JR → 私鉄の乗換が発生する
 * - 乗換駅が有名 or ユーザーが知っておくべき
 * - 直通ではなく明示的な乗換が必要
 */
import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEST_PATH = resolve(__dirname, '../src/data/destinations.json');
const destinations = JSON.parse(readFileSync(DEST_PATH, 'utf-8'));

// ── 既存 train エントリに transferStation を追加 ──
const TRANSFER_PATCHES = {
  // 近鉄系（大阪で乗換）
  'asuka':    { transferStation: '大阪阿部野橋駅' },
  'yoshino':  { transferStation: '大阪阿部野橋駅' },
  // 南海系（難波で乗換）
  'koyasan':  { transferStation: '難波駅' },
  // 東武系
  'nikko':    { transferStation: '宇都宮駅' },
  'kawagoe':  { transferStation: '大宮駅' },
  // 秩父鉄道（熊谷で乗換）
  'chichibu': { transferStation: '熊谷駅' },
};

// ── 新規 train エントリ（有名観光地） ──
const NEW_TRAIN_ACCESS = {
  // 関西
  'arima-onsen': { type: 'train', from: '三宮', line: '神戸電鉄', to: '有馬温泉', transferStation: '三宮駅' },
};

let patched = 0;
let added = 0;

for (const dest of destinations) {
  // 既存 train に transferStation 追加
  const patch = TRANSFER_PATCHES[dest.id];
  if (patch && dest.finalAccess?.type === 'train') {
    dest.finalAccess.transferStation = patch.transferStation;
    patched++;
    console.log(`  ✓ [patch] ${dest.name}: +transferStation ${patch.transferStation}`);
  }

  // 新規 train エントリ
  const newFa = NEW_TRAIN_ACCESS[dest.id];
  if (newFa && (!dest.finalAccess || dest.finalAccess.type === 'walk')) {
    dest.finalAccess = newFa;
    added++;
    console.log(`  ✓ [new]   ${dest.name}: ${newFa.from} → ${newFa.line} → ${newFa.to} (transfer: ${newFa.transferStation})`);
  }
}

writeFileSync(DEST_PATH, JSON.stringify(destinations, null, 2) + '\n', 'utf-8');
console.log(`\npatch: ${patched}件 / new: ${added}件`);
