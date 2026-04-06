/**
 * segmentTest.js — セグメント分解の検証（Node.js対応）
 * node scripts/segmentTest.js
 */
import { readFileSync } from 'node:fs';
import { buildTransportContext } from '../src/engine/transportEngine.js';

const destinations = JSON.parse(readFileSync(new URL('../src/data/destinations.json', import.meta.url), 'utf8'));

const TEST_CASES = [
  { departure: '高松', destId: 'asuka' },
  { departure: '東京', destId: 'naoshima' },
  { departure: '東京', destId: 'ishigaki' },
  { departure: '大阪', destId: 'kamakura' },
  { departure: '高松', destId: 'onomichi' },
  { departure: '東京', destId: 'atami' },
];

let pass = 0;
let fail = 0;

for (const { departure, destId } of TEST_CASES) {
  const city = destinations.find(d => d.id === destId);
  if (!city) {
    console.log(`⚠ ${destId} not found, skip`);
    continue;
  }

  const tc = buildTransportContext(departure, city);
  const best = tc.bestRoute;
  const segments = best.segments ?? [];
  const waypoints = best.waypoints ?? [];
  const bookable = segments.filter(s => s.bookable);

  console.log(`\n═══ ${departure} → ${city.displayName || city.name} ═══`);
  console.log(`  transportType: ${best.transportType}`);
  console.log(`  waypoints: ${waypoints.join(' → ')}`);
  console.log(`  segments (${segments.length}):`);
  for (const s of segments) {
    const mark = s.bookable ? '✓ 予約可' : '  ローカル';
    console.log(`    ${mark}  ${s.from} → ${s.to}（${s.mode}）[${s.type}]`);
  }
  if (bookable.length > 0) {
    console.log(`  CTA: ${bookable[0].from} → ${bookable[0].to}（${bookable[0].type}）`);
  } else {
    console.log(`  CTA: 地図のみ`);
  }

  // bookable区間が出発地→最終目的地と同じ = 嘘CTA
  const destName = city.displayName || city.name;
  const hasInvalid = bookable.some(s =>
    s.type === 'shinkansen' && s.from === departure && s.to === destName
  );

  if (hasInvalid) {
    console.log(`  ❌ FAIL: 非実在区間CTA`);
    fail++;
  } else {
    console.log(`  ✓ PASS`);
    pass++;
  }
}

console.log(`\n═══ 結果: PASS ${pass} / FAIL ${fail} ═══`);
process.exit(fail > 0 ? 1 : 0);
