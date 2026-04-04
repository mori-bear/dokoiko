/**
 * subType フィールド一括追加スクリプト
 *
 * destType / primary / tags からサブタイプを導出：
 *   sea      — 海・島・港・ダイビング系
 *   mountain — 山・高原・スキー・渓谷系
 *   urban    — 都市・街歩き・城・グルメ系
 *   remote   — 秘境・山奥・アクセス困難系
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const destPath = path.resolve(__dirname, '../src/data/destinations.json');
const data = JSON.parse(fs.readFileSync(destPath, 'utf8'));

const SEA_TAGS    = new Set(['海', '島', '港', '海水浴', 'ダイビング', 'シュノーケル', '海岸', '漁港', '海鮮', '砂浜']);
const MTN_TAGS    = new Set(['山', '高原', '渓谷', 'スキー', '登山', '温泉', '滝', '峠', '秘境', '自然', '森', '湖', '湿原']);
const REMOTE_TAGS = new Set(['秘境', '山奥', 'へき地', '離島']);

function deriveSubType(dest) {
  const allTags = [
    ...(dest.primary   ?? []),
    ...(dest.secondary ?? []),
    ...(dest.tags      ?? []),
  ];
  const tagSet = new Set(allTags);

  // destType 直接マッピング
  if (dest.destType === 'island')   return 'sea';
  if (dest.destType === 'mountain') return 'mountain';
  if (dest.destType === 'remote')   return 'remote';

  // タグ判定（海 > 山 > remote > urban の優先度）
  const hasSea    = allTags.some(t => SEA_TAGS.has(t));
  const hasMtn    = allTags.some(t => MTN_TAGS.has(t));
  const hasRemote = allTags.some(t => REMOTE_TAGS.has(t));

  if (dest.destType === 'onsen') {
    // 温泉地は海沿いか山かを判定
    if (hasSea && !hasMtn) return 'sea';
    return 'mountain'; // 温泉のデフォルトは山
  }

  if (dest.destType === 'sight' || dest.destType === 'city') {
    if (hasRemote) return 'remote';
    if (hasSea && !hasMtn) return 'sea';
    if (hasMtn && !hasSea) return 'mountain';
    if (hasSea && hasMtn) return 'sea'; // 海と山の両方 → 海を優先（景観的）
    return 'urban';
  }

  return 'urban'; // fallback
}

let updated = 0;
let skipped = 0;

for (const dest of data) {
  if (dest.subType) { skipped++; continue; }
  dest.subType = deriveSubType(dest);
  updated++;
}

fs.writeFileSync(destPath, JSON.stringify(data, null, 2), 'utf8');

// 集計出力
const counts = {};
data.forEach(d => { counts[d.subType] = (counts[d.subType] ?? 0) + 1; });

console.log(`更新: ${updated}件 / スキップ（既設定）: ${skipped}件`);
console.log('subType分布:', counts);
