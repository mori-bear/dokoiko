/**
 * buildDestinationIndex.js — 一覧表示用軽量インデックスを生成
 *
 * 入力: src/data/destinations.json
 * 出力: src/data/destinations_index.json
 *
 * フォーマット:
 *   { name, prefecture, destType, area, hub, tags, priority }
 *
 * priority ルール:
 *   - タグに「世界遺産」「有名」「観光地」を含む → high
 *   - onsenLevel >= 3 → high
 *   - それ以外 → destinations.json の stayPriority (medium/low)
 *
 * ソート: priority(high→medium→low) → destType → name
 *
 * 使い方:
 *   node scripts/buildDestinationIndex.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const SRC  = path.join(ROOT, 'src/data/destinations.json');
const DEST = path.join(ROOT, 'src/data/destinations_index.json');

const DESTS = JSON.parse(fs.readFileSync(SRC, 'utf8'));

/* ── 都道府県 → 地方マッピング ── */
const PREF_TO_AREA = {
  '北海道': '北海道',
  '青森県': '東北', '岩手県': '東北', '宮城県': '東北',
  '秋田県': '東北', '山形県': '東北', '福島県': '東北',
  '茨城県': '関東', '栃木県': '関東', '群馬県': '関東',
  '埼玉県': '関東', '千葉県': '関東', '東京都': '関東', '神奈川県': '関東',
  '新潟県': '中部', '富山県': '中部', '石川県': '中部', '福井県': '中部',
  '山梨県': '中部', '長野県': '中部', '岐阜県': '中部',
  '静岡県': '中部', '愛知県': '中部',
  '三重県': '関西', '滋賀県': '関西', '京都府': '関西',
  '大阪府': '関西', '兵庫県': '関西', '奈良県': '関西', '和歌山県': '関西',
  '鳥取県': '中国', '島根県': '中国', '岡山県': '中国',
  '広島県': '中国', '山口県': '中国',
  '徳島県': '四国', '香川県': '四国', '愛媛県': '四国', '高知県': '四国',
  '福岡県': '九州', '佐賀県': '九州', '長崎県': '九州',
  '熊本県': '九州', '大分県': '九州', '宮崎県': '九州',
  '鹿児島県': '九州', '沖縄県': '九州',
};

/* region フィールドからの補完マッピング（prefecture未設定時） */
const REGION_TO_AREA = {
  '北海道': '北海道',
  '東北':   '東北',
  '関東':   '関東',
  '伊豆諸島': '関東',
  '中部':   '中部',
  '近畿':   '関西',
  '中国':   '中国',
  '四国':   '四国',
  '九州':   '九州',
  '沖縄':   '九州',
};

/** priorityを決定する */
const HIGH_TAGS = new Set(['世界遺産', '有名', '観光地']);

function calcPriority(d) {
  const allTags = [
    ...(d.primary   ?? []),
    ...(d.secondary ?? []),
    ...(d.tags      ?? []),
  ];
  if (allTags.some(t => HIGH_TAGS.has(t))) return 'high';
  if ((d.onsenLevel ?? 0) >= 3) return 'high';
  // それ以外: 既存の stayPriority を流用（medium / low）
  return d.stayPriority === 'low' ? 'low' : 'medium';
}

/** 表示用タグ（primary優先、なければtags）最大5件 */
function buildTags(d) {
  const src = d.primary?.length ? d.primary : (d.tags ?? []);
  return src.slice(0, 5);
}

/** area解決: prefecture → region の順 */
function resolveArea(d) {
  if (d.prefecture) {
    const a = PREF_TO_AREA[d.prefecture];
    if (a) return a;
  }
  return REGION_TO_AREA[d.region] ?? d.region ?? '';
}

/* ── 変換 ── */
const PRIORITY_ORDER = { high: 0, medium: 1, low: 2 };

const index = DESTS
  .filter(d => d.type !== 'spot')   // スポットは除外
  .map(d => ({
    name:       d.displayName || d.name,
    prefecture: d.prefecture ?? '',
    destType:   d.destType   ?? '',
    area:       resolveArea(d),
    hub:        d.hubCity    ?? d.hub ?? '',
    tags:       buildTags(d),
    priority:   calcPriority(d),
  }))
  .sort((a, b) => {
    const pd = (PRIORITY_ORDER[a.priority] ?? 1) - (PRIORITY_ORDER[b.priority] ?? 1);
    if (pd !== 0) return pd;
    const td = (a.destType ?? '').localeCompare(b.destType ?? '', 'ja');
    if (td !== 0) return td;
    return (a.name ?? '').localeCompare(b.name ?? '', 'ja');
  });

fs.writeFileSync(DEST, JSON.stringify(index, null, 2), 'utf8');

/* ── サマリ出力 ── */
const priorityDist = { high: 0, medium: 0, low: 0 };
const areaDist = {};
index.forEach(d => {
  priorityDist[d.priority] = (priorityDist[d.priority] ?? 0) + 1;
  areaDist[d.area] = (areaDist[d.area] ?? 0) + 1;
});

console.log(`[buildDestinationIndex] 完了: ${index.length}件`);
console.log(`  priority 分布:`, priorityDist);
console.log(`  area 分布:`, areaDist);
console.log(`  出力先: ${path.relative(ROOT, DEST)}`);
