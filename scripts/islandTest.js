import { readFileSync } from 'node:fs';
import { buildTransportContext } from '../src/engine/transportEngine.js';
const destinations = JSON.parse(readFileSync(new URL('../src/data/destinations.json', import.meta.url), 'utf8'));

const CASES = [
  { departure: '大阪', destId: 'awaji' },       // 橋接続（バス/車）
  { departure: '高松', destId: 'naoshima' },     // フェリー島
  { departure: '高松', destId: 'shodoshima' },   // フェリー島
  { departure: '東京', destId: 'ishigaki' },     // フライト島
  { departure: '東京', destId: 'miyajima' },     // フェリー島（本州から近い）
  { departure: '東京', destId: 'izu-oshima' },   // フェリー島（東京から）
  { departure: '大阪', destId: 'yakushima' },    // フェリー島（遠い）
];

for (const { departure, destId } of CASES) {
  const city = destinations.find(d => d.id === destId);
  if (!city) { console.log(`⚠ ${destId} not found`); continue; }
  const tc = buildTransportContext(departure, city);
  const best = tc.bestRoute;
  const dr = best.displayRoute;
  const main = best.mainSegment;
  const name = city.displayName || city.name;
  const ICON = { flight: '✈️', shinkansen: '🚄', ferry: '⛴', highway_bus: '🚌', bus: '🚍', car: '🚗' };
  const displayType = best.islandDisplayType;
  const icon = displayType ? (ICON[displayType] ?? '🚃') : main ? (ICON[main.type] ?? '🚃') : '🚃';

  console.log(`\n${departure} → ${name} (${city.destType}${city.isIsland ? '/island' : ''}) islandType=${best.islandDisplayType ?? 'none'}`);
  console.log(`  ${icon} ${dr.from} → ${dr.to}`);
  console.log(`  ${tc.reason}`);
  if (dr.needsAccess) {
    const verb = { walk: '徒歩', bus: 'バス', car: '車' }[best.finalAccess] ?? '徒歩';
    console.log(`  📍 ${dr.destName}エリアへ（${verb}）`);
  }
  if (main) console.log(`  CTA: [${main.type}] ${main.from} → ${main.to}`);
  else console.log(`  CTA: 地図のみ`);
}
