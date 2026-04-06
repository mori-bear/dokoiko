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
  if (bookable) {
    console.log(`  CTA: ${bookable.type === 'shinkansen' ? '新幹線' : bookable.type === 'flight' ? '航空券' : bookable.type === 'ferry' ? 'フェリー' : bookable.type}を予約（${bookable.from} → ${bookable.to}）`);
  } else {
    console.log(`  CTA: 地図で行き方を見る（予約セグメントなし）`);
  }
  const FINAL = { walk: '駅から歩いて行ける', bus: '駅からバスでアクセス', car: '駅から車でアクセス' };
  console.log(`  最終アクセス: ${FINAL[city.finalAccess] ?? ''}`);
}
