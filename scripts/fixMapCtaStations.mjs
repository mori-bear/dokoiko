/**
 * fixMapCtaStations.mjs
 *
 * routes.json の mapCTA.to が駅名（〜駅）になっている場合に
 * 観光スポット名（finalPoint > spots[0] > city.name）に更新する。
 *
 * 対象: 315件（mapCTA.to が "〜駅" で終わるエントリ）
 *
 * Usage: node scripts/fixMapCtaStations.mjs
 */

import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const routesPath = join(ROOT, 'src/data/routes.json');
const destsPath  = join(ROOT, 'src/data/destinations.json');

const routes = JSON.parse(readFileSync(routesPath, 'utf8'));
const dests  = JSON.parse(readFileSync(destsPath,  'utf8'));

// destをIDで引けるMap
const destMap = new Map(dests.map(d => [d.id, d]));

let fixed = 0;
let skipped = 0;

for (const [id, route] of Object.entries(routes)) {
  if (!route.mapCTA?.to) continue;
  if (!route.mapCTA.to.endsWith('駅')) continue;

  const city = destMap.get(id);
  if (!city) {
    console.warn(`⚠ destination not found for route id: ${id}`);
    skipped++;
    continue;
  }

  // 優先順位: finalPoint > spots[0] > city.name
  const newTo =
    city.finalPoint ||
    (Array.isArray(city.spots) && city.spots.length > 0 ? city.spots[0] : null) ||
    city.name;

  if (!newTo) {
    console.warn(`⚠ no replacement found for ${id} (mapCTA.to="${route.mapCTA.to}")`);
    skipped++;
    continue;
  }

  const oldTo = route.mapCTA.to;
  route.mapCTA.to = newTo;
  fixed++;
  console.log(`✓ ${id}: "${oldTo}" → "${newTo}"`);
}

writeFileSync(routesPath, JSON.stringify(routes, null, 2) + '\n', 'utf8');
console.log(`\n完了: ${fixed}件更新, ${skipped}件スキップ`);
