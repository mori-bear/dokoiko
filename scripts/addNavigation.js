/**
 * scripts/addNavigation.js
 * 秘境・山奥・温泉郷 系 destination に navigation フィールドを追加する。
 *
 * navigation = { name, lat, lng }
 *   name : Google Maps でナビするときのランドマーク名（目的地名と異なる場合）
 *   lat  : ナビ先の緯度
 *   lng  : ナビ先の経度
 *
 * 目的：「行ける気がしない」を「行けそう」に変える
 *   - 目的地（体験）: 霧島温泉郷
 *   - ナビ地点（現実）: 霧島神宮
 */

import fs   from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DESTS_PATH = path.join(__dirname, '../src/data/destinations.json');

// ── ナビ地点マスタ ──────────────────────────────────────────────────
// id → { name, lat, lng }
const NAV_MASTER = {
  // 霧島: 目的地は霧島温泉郷、ナビ先は霧島神宮
  'kirishima': {
    name: '霧島神宮',
    lat:  31.9373,
    lng:  130.8637,
  },
  // 黒川温泉: 目的地は温泉郷、ナビ先は旅館街入口
  'kurokawa-k': {
    name: '黒川温泉 旅館街',
    lat:  33.0958,
    lng:  131.0487,
  },
  // 知床: 目的地は自然地帯、ナビ先はウトロ温泉（玄関口）
  'shiretoko': {
    name: 'ウトロ温泉（知床の玄関口）',
    lat:  44.0872,
    lng:  144.9578,
  },
  // 祖谷: 目的地は渓谷、ナビ先はかずら橋
  'iya': {
    name: '祖谷のかずら橋',
    lat:  33.8613,
    lng:  133.8867,
  },
  // 高千穂: 目的地は神話の里、ナビ先は高千穂峡
  'takachiho': {
    name: '高千穂峡',
    lat:  32.7063,
    lng:  131.3076,
  },
  // 奥入瀬: 目的地は渓流エリア、ナビ先は石ヶ戸（中心部入口）
  'oirase': {
    name: '奥入瀬渓流 石ヶ戸',
    lat:  40.4593,
    lng:  140.9107,
  },
  // 奥飛騨温泉郷: 目的地は温泉地帯、ナビ先は平湯バスターミナル
  'okuhida-onsen': {
    name: '平湯バスターミナル',
    lat:  36.2755,
    lng:  137.4732,
  },
  // 白川郷: 目的地は合掌造り集落、ナビ先は萩町バスターミナル
  'shirakawago-t': {
    name: '白川郷 荻町バスターミナル',
    lat:  36.2565,
    lng:  136.9058,
  },
  // 定山渓: 目的地は温泉街、ナビ先は二見公園（中心）
  'jozankei': {
    name: '定山渓温泉 二見公園',
    lat:  42.9749,
    lng:  141.0908,
  },
  // 大歩危: 目的地は渓谷、ナビ先は遊覧船のりば
  'oboke': {
    name: '大歩危峡 遊覧船のりば',
    lat:  33.9000,
    lng:  133.8924,
  },
  // 後生掛温泉: 深山の温泉、ナビ先は温泉入口
  'hachimantai-onsen': {
    name: '後生掛温泉',
    lat:  39.9454,
    lng:  140.8337,
  },
  // 宝川温泉: 深山の温泉、ナビ先は旅館入口
  'takarakawa-onsen': {
    name: '宝川温泉汪泉閣',
    lat:  36.8942,
    lng:  138.9558,
  },
};

// ── メイン ──────────────────────────────────────────────────────────
const dests = JSON.parse(fs.readFileSync(DESTS_PATH, 'utf-8'));

let added   = 0;
let updated = 0;

for (const dest of dests) {
  const nav = NAV_MASTER[dest.id];
  if (!nav) continue;

  const existing = dest.navigation;
  if (existing && existing.name === nav.name && existing.lat === nav.lat && existing.lng === nav.lng) {
    continue; // 変更なし
  }

  const wasUpdate = !!existing;
  dest.navigation = nav;
  wasUpdate ? updated++ : added++;
  console.log(`${wasUpdate ? '↺' : '✓'} ${dest.name.padEnd(12)} → ${nav.name}`);
}

fs.writeFileSync(DESTS_PATH, JSON.stringify(dests, null, 2), 'utf-8');
console.log(`\n追加: ${added}件 / 更新: ${updated}件`);
