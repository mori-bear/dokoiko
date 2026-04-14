/**
 * debugRanking.js — 各出発地ごとの上位20件を出力してランキング品質検証
 *
 * 使い方:
 *   node scripts/debugRanking.js                  # 主要出発地7つ
 *   node scripts/debugRanking.js --dep=東京,大阪  # 指定出発地
 *   node scripts/debugRanking.js --limit=30       # 上位N件
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const { buildShuffledPool } = await import('../src/engine/selectionEngine.js');
const { calculateTravelTimeMinutes, haversineKm } = await import('../src/engine/distanceCalculator.js');

const DESTS = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/data/destinations.json'), 'utf8'));

const DEP_ARG = process.argv.find(a => a.startsWith('--dep='));
const DEPS = DEP_ARG
  ? DEP_ARG.split('=')[1].split(',')
  : ['東京', '大阪', '名古屋', '福岡', '仙台', '札幌', '広島'];

const LIMIT_ARG = process.argv.find(a => a.startsWith('--limit='));
const LIMIT = LIMIT_ARG ? parseInt(LIMIT_ARG.split('=')[1], 10) : 20;

/**
 * travelTimeBonus: selectionEngine と同一の指数減衰式
 * Math.exp(-min / 90) で急減衰。selectionEngine.js の travelTimeScore と一致。
 */
function travelTimeBonus(min) {
  return Math.exp(-min / 90);
}

/** selectionEngine.js と同一 */
const DEST_TYPE_BOOST = {
  onsen:     1.5,
  island:    1.3,
  mountain:  1.2,
  remote:    1.2,
  city:      1.0,
  sight:     0.9,
  peninsula: 1.0,
};

/** selectionEngine.js と同一 — 県庁所在地ペナルティ */
const PREF_CAPITALS = new Set([
  '札幌', '青森', '盛岡', '仙台', '秋田', '山形', '福島',
  '水戸', '宇都宮', '前橋', '東京', '横浜', '新潟',
  '富山', '金沢', '福井', '甲府', '長野', '岐阜', '静岡',
  '名古屋', '津', '大津', '京都', '大阪', '神戸', '奈良',
  '和歌山', '鳥取', '松江', '岡山', '広島', '山口',
  '徳島', '高松', '松山', '高知',
  '福岡', '佐賀', '長崎', '熊本', '大分', '宮崎', '鹿児島', '那覇',
]);

const SAPPORO = [43.0642, 141.3469];

/**
 * selectionEngine と同一の travelTime 補正を適用する。
 * 札幌発: hubCity='札幌'で一律60minになる目的地を座標距離で補正。
 */
function applyDepartureCorrection(travelMin, departure, dest) {
  if (departure === '札幌' && travelMin <= 60 && dest.lat && dest.lng) {
    const distKm = haversineKm(SAPPORO[0], SAPPORO[1], dest.lat, dest.lng);
    return Math.max(30, Math.min(Math.round(distKm), 360));
  }
  return travelMin;
}

/**
 * shuffleは確率的なので、安定したランキング検証のため adjustedScore decreasing で表示。
 * adjustedScore = weight × travelTimeBonus により出発地ごとの距離を反映。
 * selectionEngine.js と同一のパラメータ・補正を適用してエンジン挙動を近似。
 */
function rankByWeight(dests, departure) {
  return dests
    .filter(d => {
      // daytrip/1night 制限なしで全件対象
      if (!d.lat || !d.lng) return false;
      return true;
    })
    .map(d => {
      const rawMin = calculateTravelTimeMinutes(departure, d);
      const travelMin = applyDepartureCorrection(rawMin, departure, d);
      const base    = d.weight ?? 1;
      const capW    = PREF_CAPITALS.has(d.name) ? 0.6 : 1;
      const dtW     = DEST_TYPE_BOOST[d.destType] ?? 1;
      const ttW     = travelTimeBonus(travelMin);
      // 近郊cityペナルティ: selectionEngine.js と同一
      const nearCityW = (d.destType === 'city' && travelMin < 45 && base < 1.1)
        ? 0.5 : 1;
      const adjustedScore = base * capW * dtW * ttW * nearCityW;
      return { ...d, travelMin, adjustedScore };
    })
    .filter(d => d.travelMin && d.travelMin < 600) // 10時間以内
    .sort((a, b) => b.adjustedScore - a.adjustedScore);
}

for (const dep of DEPS) {
  console.log(`\n══════════════════════════════════`);
  console.log(`  ${dep} 発 上位${LIMIT}件`);
  console.log(`══════════════════════════════════`);

  const ranked = rankByWeight(DESTS, dep).slice(0, LIMIT);

  const header = 'rank | score  | weight | type     | name'.padEnd(44) + ' | pref   | access       | travel';
  console.log(header);
  console.log('-'.repeat(105));

  ranked.forEach((d, i) => {
    const ap = d.accessPoint
      ? `${d.accessPoint.type}:${d.accessPoint.name.slice(0, 8)}`
      : 'none';
    const name = (d.displayName || d.name).padEnd(14).slice(0, 14);
    console.log(
      `${String(i + 1).padStart(4)}`,
      `| ${d.adjustedScore.toFixed(2).padEnd(6)}`,
      `| ${String(d.weight ?? 1).padEnd(6)}`,
      `| ${String(d.destType ?? '?').padEnd(8)}`,
      `| ${name}`,
      `| ${(d.prefecture ?? '').padEnd(5)}`,
      `| ${ap.padEnd(14)}`,
      `| ${d.travelMin}min`
    );
  });

  // サマリ: 上位20件のdestType分布
  const typeDist = {};
  ranked.forEach(d => typeDist[d.destType] = (typeDist[d.destType] ?? 0) + 1);
  const typeStr = Object.entries(typeDist).sort((a,b) => b[1]-a[1]).map(([t,n]) => `${t}:${n}`).join(' ');
  console.log(`  上位${LIMIT}内訳: ${typeStr}`);
}
