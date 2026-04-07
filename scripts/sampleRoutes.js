/**
 * sampleRoutes.js — 指定3件のルート出力
 * node scripts/sampleRoutes.js
 */
import { readFileSync } from 'node:fs';
import { buildTransportContext } from '../src/engine/transportEngine.js';

const destinations = JSON.parse(readFileSync(new URL('../src/data/destinations.json', import.meta.url), 'utf8'));

const SAMPLES = [
  { departure: '高松', destId: 'kirishima' },
  { departure: '高松', destId: 'asuka' },
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
  if (dr.needsAccess) {
    const verb = { walk: '徒歩', bus: 'バス', car: '車' }[city.finalAccess] ?? '徒歩';
    console.log(`  📍 ${dr.destName}エリアへ（${verb}でアクセス）`);
  } else if (city.finalAccess === 'bus') {
    console.log(`  📍 駅からバスでアクセス`);
  } else if (city.finalAccess === 'car') {
    console.log(`  📍 車があると便利`);
  }
  console.log(``);
  // CTA（実UIと同じロジック: mainSegment優先 → ctaフォールバック）
  const mainCta = tc.stepGroups.find(sg => sg.type === 'main-cta')?.cta;
  const suppressBooking = best.islandDisplayType === 'bus' || best.islandDisplayType === 'car';
  console.log(`  [地図で行き方を見る]`);
  if (suppressBooking) { /* skip */ }
  else if (mainSeg && mainCta) {
    const to = clean(mainSeg.to);
    const from = clean(mainSeg.from);
    if (mainSeg.type === 'shinkansen' || mainSeg.type === 'highway_bus') {
      console.log(`  [${ICON[mainSeg.type]} ${to}まで予約]`);
    } else {
      console.log(`  [${ICON[mainSeg.type]} ${from} → ${to} を予約]`);
    }
  } else if (mainCta) {
    // bookableセグメントなしだがCTA存在 → ctaDestinationでフォールバック
    const JR = new Set(['jr-east','jr-west','jr-kyushu','jr-ex','jr-window']);
    const FLIGHT = new Set(['skyscanner','google-flights']);
    const ctaDest = best.ctaDestination || clean(dr.to);
    if (JR.has(mainCta.type))          console.log(`  [🚄 ${ctaDest}まで予約]`);
    else if (FLIGHT.has(mainCta.type)) console.log(`  [✈️ ${ctaDest}への航空券]`);
    else if (mainCta.type === 'ferry') console.log(`  [⛴ ${ctaDest}へのフェリー]`);
    else console.log(`  [${mainCta.label}]`);
  }
}
