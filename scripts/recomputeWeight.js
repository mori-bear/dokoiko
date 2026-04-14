/**
 * recomputeWeight.js — destination.weight を複合要素で再計算
 *
 * weight = base × accessBonus × penalty × popularity × stayScore × cityTourBonus
 *
 * base(destType):
 *   onsen 1.5 / island 1.3 / mountain 1.2 / city 1.0 / sight 1.0
 *
 * accessBonus(accessPoint.type):
 *   station 1.1 / airport 1.0 / port 0.95 / bus 0.85
 *
 * penalty(route_validation_warnings):
 *   detour ×0.9 / too_long ×0.8
 *
 * popularity:
 *   メジャー観光地（富士山・鎌倉・箱根・京都等）→ 1.2
 *   中堅 → 1.0
 *   マイナー（_generated かつ無名）→ 0.9
 *
 * stayScore:
 *   onsen → 1.0 / island → 1.1 / mountain → 1.1 / 他 → 1.0
 *
 * cityTourBonus:
 *   歴史・街歩き・寺社・城下町 タグあり → 1.15 / なし → 1.0
 *
 * ※ weight上限キャップ: 1.8（超高weight目的地が独占するのを防止）
 * ※ travelTimeScore は出発地依存のため selectionEngine.js で動的適用。
 *
 * 使い方:
 *   node scripts/recomputeWeight.js              # dry-run
 *   node scripts/recomputeWeight.js --apply      # 書き込み
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const APPLY = process.argv.includes('--apply');

const DESTS_FILE = path.join(ROOT, 'src/data/destinations.json');
const WARN_FILE  = path.join(ROOT, 'route_validation_warnings.csv');

const DESTS = JSON.parse(fs.readFileSync(DESTS_FILE, 'utf8'));

const BASE_WEIGHT = {
  onsen:     1.5,
  island:    1.3,
  mountain:  1.2,
  remote:    1.2,
  peninsula: 1.0,
  city:      1.0,
  sight:     1.0,  // 0.9→1.0: 京都・鎌倉・宮島など有名観光地が適切に上位に出るように
  // ── ニッチ拡張 (T7) ──
  hidden:    1.0,  // 隠れ名所：知られていない分ランダム性で出やすく
  view:      1.1,  // 絶景：視覚的魅力が高い
  weird:     0.9,  // 珍スポット：話題性重視・広くは受けない
  ruins:     0.8,  // 遺構：マニア向け・一般受けが低い
  portTown:  1.0,  // 港町：食＋景色バランス良い
  railway:   0.8,  // ローカル線：体験特化・宿は別途必要
};

const ACCESS_BONUS = {
  station: 1.1,
  airport: 1.0,
  port:    0.95,
  bus:     0.85,
};

/** 有名観光地ホワイトリスト（ブースト対象） */
const POPULAR_DESTINATIONS = new Set([
  // 温泉系メジャー
  '熱海', '箱根', '有馬温泉', '城崎温泉', '草津温泉', '道後温泉', '別府', '由布院',
  '黒川温泉', '登別温泉', '下呂温泉', '銀山温泉', '鬼怒川温泉',
  // 観光地メジャー
  '京都', '奈良', '鎌倉', '金沢', '日光', '富士河口湖', '富士山', '白川郷',
  '高山', '伊勢', '松本', '軽井沢', '清里', '日本平',
  // 島・自然メジャー
  '宮島', '屋久島', '石垣島', '宮古島', '直島', '小豆島',
  '富良野', '美瑛', '知床', '阿寒湖', '札幌', '小樽', '函館', '登別',
  '上高地', '立山黒部', '尾瀬', '阿蘇', '高千穂',
  // 都市メジャー
  '横浜', '神戸', '広島', '長崎', '福岡',
]);

/**
 * popularity スコア
 *   メジャー観光地 → 1.2
 *   手動登録（_generatedなし）→ 1.0
 *   自動生成（無名）→ 0.9
 */
function popularityFactor(dest) {
  const name = dest.displayName || dest.name;
  if (POPULAR_DESTINATIONS.has(name)) return 1.2;
  if (dest._generated) return 0.9;
  return 1.0;
}

/** stayScore: 宿泊導線の強さ
 * onsenは selectionEngine 側で DEST_TYPE_BOOST(1.5) が別途掛かるため
 * ここでは1.0に抑え、weight二重ブーストを防ぐ。
 */
const STAY_SCORE = {
  onsen:    1.0,  // 1.2→1.0: engineでDEST_TYPE_BOOST(1.5)が別途掛かるため二重ブーストを防止
  island:   1.1,
  mountain: 1.1,  // 追加: 上高地・立山黒部など山岳宿泊の強さを反映
  sight:    1.0,
  city:     1.0,
  remote:   1.0,
  peninsula:1.0,
  // ── ニッチ拡張 ──
  hidden:   1.0,
  view:     1.0,
  weird:    1.0,
  ruins:    1.0,
  portTown: 1.1,  // 港町：漁師宿・旅館が充実
  railway:  1.0,
};

/**
 * cityTourBonus: 都市観光タグによるブースト
 * 歴史・街歩き・寺社タグを持つ都市観光系目的地を強化し、
 * 京都・鎌倉・奈良・金沢・長崎などが適切に上位に出るようにする。
 *
 * 注: travelTimeScore は出発地依存のため selectionEngine.js で動的適用する。
 *     recomputeWeight.js はあくまでも静的weight（出発地非依存）を計算する。
 */
const CITY_TOUR_TAGS = new Set(['歴史', '街歩き', '寺社', '古都', '城下町', '宿場町', '城']);

function cityTourBonus(dest) {
  const allTags = [
    ...(dest.primary   ?? []),
    ...(dest.secondary ?? []),
    ...(dest.tags      ?? []),
  ];
  if (allTags.some(t => CITY_TOUR_TAGS.has(t))) return 1.15;
  return 1.0;
}

/**
 * cityDistFactor: city の「どこかの拠点から近すぎる」ペナルティ
 * destinations.json の travelTime オブジェクト最小値を近接度の代理指標として使用。
 * < 60min → 近郊都市（尼崎・大垣・常滑等）→ ×0.85 でペナルティ
 * >= 60min → 独立した目的地（鎌倉・函館等）→ ×1.1 でブースト
 */
function cityDistFactor(dest) {
  if (dest.destType !== 'city') return 1.0;
  const times = Object.values(dest.travelTime ?? {}).filter(v => v != null && v > 0);
  const minT = times.length > 0 ? Math.min(...times) : 180;
  return minT < 60 ? 0.85 : 1.1;
}

/**
 * cityQualityFilter: POPULAR_DESTINATIONS に含まれない city は ×0.8
 * 観光地としての認知度が低い都市（旅行先として弱い）を抑制する。
 */
function cityQualityFilter(dest) {
  if (dest.destType !== 'city') return 1.0;
  const name = dest.displayName || dest.name;
  return POPULAR_DESTINATIONS.has(name) ? 1.0 : 0.8;
}

/* route warning から penalty対象を収集（任意・ファイル無くてもOK） */
const detourIds = new Set();
const tooLongIds = new Set();
if (fs.existsSync(WARN_FILE)) {
  const lines = fs.readFileSync(WARN_FILE, 'utf8').split('\n').slice(1);
  for (const line of lines) {
    const [type, , destId] = line.split(',');
    if (type === 'detour')  detourIds.add(destId);
    if (type === 'too_long') tooLongIds.add(destId);
  }
}

let changed = 0;
const dist = { '0.9': 0, '1.0': 0, '1.2': 0, '1.3': 0, '1.5': 0, other: 0 };

for (const d of DESTS) {
  const base  = BASE_WEIGHT[d.destType] ?? 1.0;
  const access = ACCESS_BONUS[d.accessPoint?.type] ?? 1.0;
  let penalty = 1.0;
  if (detourIds.has(d.id))  penalty *= 0.9;
  if (tooLongIds.has(d.id)) penalty *= 0.8;
  const popularity = popularityFactor(d);
  const stayScore  = STAY_SCORE[d.destType] ?? 1.0;
  const cityBonus  = cityTourBonus(d);
  const cityDist   = cityDistFactor(d);     // city近郊ペナルティ / 独立地ブースト
  const cityQual   = cityQualityFilter(d);  // 非有名city抑制

  const rawWeight = base * access * penalty * popularity * stayScore * cityBonus * cityDist * cityQual;
  const newWeight = Math.round(Math.min(rawWeight, 1.8) * 100) / 100;  // 上限1.8キャップ
  if (d.weight !== newWeight) {
    if (APPLY) d.weight = newWeight;
    changed++;
  }

  const key = newWeight.toFixed(1);
  dist[key] = (dist[key] ?? 0) + 1;
}

console.log(`[recomputeWeight] ${APPLY ? 'APPLY' : 'DRY-RUN'}`);
console.log(`  変更: ${changed}件 / 全${DESTS.length}件`);
console.log(`  route warning: detour=${detourIds.size}, too_long=${tooLongIds.size}`);
console.log(`  新weight分布:`, dist);

if (APPLY) {
  fs.writeFileSync(DESTS_FILE, JSON.stringify(DESTS, null, 2));
  console.log(`\n[recomputeWeight] 書き込み完了`);
}
