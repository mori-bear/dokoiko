/**
 * sampleRoutes.js — 指定3件のルート出力
 * node scripts/sampleRoutes.js
 */
import { readFileSync } from 'node:fs';
import { buildTransportContext } from '../src/engine/transportEngine.js';

const destinations = JSON.parse(readFileSync(new URL('../src/data/destinations.json', import.meta.url), 'utf8'));

const SAMPLES = [
  { departure: '高松', destId: 'asuka' },
  { departure: '東京', destId: 'fukuoka-city' },
  { departure: '大阪', destId: 'awaji' },
];

for (const { departure, destId } of SAMPLES) {
  const city = destinations.find(d => d.id === destId);
  if (!city) { console.log(`⚠ ${destId} not found`); continue; }

  const tc = buildTransportContext(departure, city);
  const best = tc.bestRoute;
  const segs = best.segments ?? [];
  const bookable = segs.find(s => s.bookable);
  const name = city.displayName || city.name;

  console.log(`\n${'═'.repeat(50)}`);
  console.log(`  ${departure} → ${name}`);
  console.log(`${'═'.repeat(50)}`);
  console.log(`  representativeStation: ${city.representativeStation}`);
  console.log(`  finalAccess: ${city.finalAccess}`);
  console.log(`  transportType: ${best.transportType}`);
  console.log(`  reason: ${tc.reason}`);
  console.log(`  waypoints: ${best.waypoints.join(' → ')}`);
  console.log(`  segments:`);
  for (const s of segs) {
    const mark = s.bookable ? '✓予約可' : '  local';
    console.log(`    ${mark}  ${s.from} → ${s.to}（${s.mode}）`);
  }
  // === 最終UI出力 ===
  const ICON = { flight: '✈️', shinkansen: '🚄', ferry: '⛴', highway_bus: '🚌' };
  const dr = best.displayRoute;
  const mainSeg = best.mainSegment;
  const icon = mainSeg ? (ICON[mainSeg.type] ?? '🚃') : '🚃';
  const FINAL = { walk: '📍 駅から徒歩で行ける', bus: '📍 駅からバスでアクセス', car: '📍 車があると便利' };

  console.log(`\n  ── UI表示 ──`);
  console.log(`  ${icon} ${dr.from} → ${dr.to}`);
  console.log(`  ${tc.reason}`);
  console.log(`  ${FINAL[city.finalAccess] ?? FINAL.walk}`);
  console.log(`  ──`);
  if (mainSeg) {
    const clean = (n) => /空港$|港$/.test(n) ? n : n.replace(/駅$/, '');
    console.log(`  [${mainSeg.type === 'shinkansen' ? '新幹線' : mainSeg.type === 'flight' ? '航空券' : 'フェリー'}を予約（${clean(mainSeg.from)} → ${clean(mainSeg.to)}）]`);
  }
  console.log(`  [地図で${mainSeg ? '全体を' : '行き方を'}見る]`);
}
