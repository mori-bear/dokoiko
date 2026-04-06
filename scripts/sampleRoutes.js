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
  const clean = (n) => n.replace(/駅$|空港$|港$/, '');

  console.log(`\n  ── UI ──`);
  console.log(`  ${icon} ${dr.from} → ${dr.to}`);
  console.log(`  ${tc.reason}`);
  if (city.finalAccess === 'bus') console.log(`  📍 駅からバスでアクセス`);
  if (city.finalAccess === 'car') console.log(`  📍 車があると便利`);
  console.log(``);
  console.log(`  [地図で行き方を見る]`);
  if (mainSeg) {
    const to = clean(mainSeg.to);
    const from = clean(mainSeg.from);
    if (mainSeg.type === 'shinkansen' || mainSeg.type === 'highway_bus') {
      console.log(`  [${ICON[mainSeg.type]} ${to}まで予約]`);
    } else {
      console.log(`  [${ICON[mainSeg.type]} ${from} → ${to} を予約]`);
    }
  }
}
