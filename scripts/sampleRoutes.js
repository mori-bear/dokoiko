/**
 * sampleRoutes.js — 指定3件のルート出力
 * node scripts/sampleRoutes.js
 */
import { readFileSync } from 'node:fs';
import { buildTransportContext } from '../src/engine/transportEngine.js';

const destinations = JSON.parse(readFileSync(new URL('../src/data/destinations.json', import.meta.url), 'utf8'));

const SAMPLES = [
  { departure: '高松', destId: 'asuka' },     // JR→私鉄（近鉄）
  { departure: '東京', destId: 'hakone' },     // JR→バス
  { departure: '東京', destId: 'nikko' },      // JR→私鉄（東武）
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
  console.log(`  finalAccess: ${JSON.stringify(city.finalAccess)}`);
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
  const chainCta = best.jrChainCta;
  const icon = chainCta ? (ICON[chainCta.type] ?? '🚃') : '🚃';
  const clean = (n) => n.replace(/駅$|空港$|港$/, '');

  console.log(`\n  ── UI ──`);
  console.log(`  ${icon} ${dr.from} → ${dr.to}`);
  console.log(`  ${tc.reason}`);
  const fa = typeof city.finalAccess === 'object' ? city.finalAccess : { type: city.finalAccess ?? 'walk' };
  const gw = chainCta ? clean(chainCta.to) : null;
  if (fa.type === 'train' && fa.line) {
    const shortLine = fa.line.replace(/(線|本線)$/, '');
    const from = gw || clean(fa.from || '');
    const to = clean(fa.to || '') || name;
    console.log(`  → ${from}から${shortLine}で${to}へ`);
  } else if (fa.type === 'bus') {
    const from = gw || (fa.from ? fa.from.replace(/駅$/, '') : '駅');
    console.log(`  → ${from}からバスでアクセス`);
  } else if (fa.type === 'car') {
    console.log(`  → レンタカーでアクセス`);
  }
  console.log(``);
  // CTA（JRチェーンベース）
  const mainCta = tc.stepGroups.find(sg => sg.type === 'main-cta')?.cta;
  console.log(``);
  console.log(`  [地図で行き方を見る]`);
  const suppressBk = best.islandDisplayType === 'bus' || best.islandDisplayType === 'car';
  if (!suppressBk && chainCta && mainCta) {
    const from = clean(chainCta.from); const to = clean(chainCta.to);
    const HINT = { shinkansen:'新幹線区間', limited:'特急区間', jr:'JR区間', flight:'直行便', ferry:'フェリー区間' };
    const hint = HINT[chainCta.type] ?? '';
    console.log(`  [${from} → ${to}だけ予約${hint ? `（${hint}）` : ''}]`);
  }
}
