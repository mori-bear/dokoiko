/**
 * enrichDescriptions.js — 説明文30文字未満の目的地を自動補完
 *
 * 既存の description がある場合は末尾に補足を追加し、
 * 完全に未設定の場合はテンプレートから生成する。
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEST_FILE = path.join(__dirname, '../src/data/destinations.json');

const DEST_TYPE_LABEL = {
  city:      '都市観光',
  onsen:     '温泉',
  sight:     '観光地',
  mountain:  '山岳',
  island:    '島',
  remote:    '秘境',
  peninsula: '半島',
  lake:      '湖',
  coast:     '海岸',
  valley:    '渓谷',
};

function pref(dest) {
  return (dest.prefecture ?? dest.region ?? '').replace(/[都道府県]$/, '');
}

function typeLabel(dest) {
  return DEST_TYPE_LABEL[dest.destType] ?? '観光地';
}

function tags2(dest) {
  return (dest.tags ?? []).filter(t => t.length <= 6).slice(0, 2).join('・');
}

function spot1(dest) {
  return (dest.spots ?? [])[0] ?? '';
}

/**
 * 説明文を30文字以上に補完する。
 * 既存テキストを最大限尊重し、自然な形で延長する。
 */
function enrich(dest) {
  const base = dest.description ?? '';
  if (base.length >= 30) return base;

  const name   = dest.displayName || dest.name;
  const p      = pref(dest);
  const tl     = typeLabel(dest);
  const tg     = tags2(dest);
  const sp     = spot1(dest);

  // 既存テキストがある → 末尾に事実補足を追記
  if (base.length > 0) {
    const suffix = sp && !base.includes(sp.slice(0, 4))
      ? `${sp}など見どころが多い。`
      : tg && !base.includes(tg.split('・')[0])
        ? `${tg}で知られる${p}の${tl}。`
        : `${p}を代表する${tl}のひとつ。`;
    return base + suffix;
  }

  // 説明なし → テンプレートから生成
  if (sp && tg) {
    return `${p}の${tl}、${name}。${sp}をはじめ${tg}で知られる。`;
  }
  if (sp) {
    return `${p}にある${tl}。${sp}が有名で、日本有数の景勝地。`;
  }
  if (tg) {
    return `${p}を代表する${tl}のひとつ。${tg}を目当てに多くの旅行者が訪れる。`;
  }
  return `${p}にある${name}は${tl}として知られ、豊かな自然と文化が魅力。`;
}

const data = JSON.parse(fs.readFileSync(DEST_FILE, 'utf-8'));
let updated = 0;
let skipped = 0;
let stillShort = 0;

for (const dest of data) {
  if (dest.type !== 'destination') { skipped++; continue; }
  const before = dest.description ?? '';
  if (before.length >= 30) { skipped++; continue; }

  const enriched = enrich(dest);
  dest.description = enriched;
  updated++;
  if (enriched.length < 30) {
    stillShort++;
    console.warn(`⚠️ still short (${enriched.length}): ${dest.name} → ${enriched}`);
  }
}

fs.writeFileSync(DEST_FILE, JSON.stringify(data, null, 2), 'utf-8');

console.log(`\n=== enrichDescriptions 結果 ===`);
console.log(`  補完済み: ${updated}件`);
console.log(`  スキップ: ${skipped}件`);
console.log(`  30文字未満残: ${stillShort}件`);
