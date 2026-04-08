/**
 * sampleRoutes.js — 指定3件のルート出力
 * node scripts/sampleRoutes.js
 */
import { readFileSync } from 'node:fs';
import { buildTransportContext } from '../src/engine/transportEngine.js';

const destinations = JSON.parse(readFileSync(new URL('../src/data/destinations.json', import.meta.url), 'utf8'));

const SAMPLES = [
  { departure: '高松', destId: 'asuka' },        // JR→近鉄（mid+transfer/walk）
  { departure: '高松', destId: 'koyasan' },      // JR→南海（mid+transfer/walk）
  { departure: '高松', destId: 'sakaiminato' },  // JR全通（allJR）
  { departure: '東京', destId: 'hakone' },       // JRなし→バス
  { departure: '東京', destId: 'nikko' },        // JR→東武（transfer/same）
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
  // allJR時はfinalAccess非表示
  if (chainCta?.allJR) { /* skip */ }
  else if (fa.type === 'train' && fa.line) {
    const COMPANIES = ['近鉄','南海','小田急','東武','西武','京王','京急','京成','京阪','阪急','阪神','名鉄','相鉄','東急','江ノ電','神戸電鉄','JR'];
    const company = COMPANIES.find(c => fa.line.startsWith(c)) || fa.line.replace(/(線|本線)$/, '');
    const to = clean(fa.to || '') || name;
    const trObj = typeof fa.transferStation === 'object' ? fa.transferStation : null;
    const trClean = trObj ? clean(trObj.name) : null;
    const mid = typeof fa.midStation === 'object' ? fa.midStation?.name : fa.midStation;
    const midClean = mid ? clean(mid) : null;
    const isSame = trObj?.access === 'same';
    if (midClean && trClean && !isSame) {
      console.log(`  → ${midClean} → ${trClean}で${company} → ${to}`);
    } else if (isSame) {
      console.log(`  → ${company}で${to}`);
    } else if (trClean) {
      console.log(`  → ${trClean}で${company} → ${to}`);
    } else {
      console.log(`  → ${company}で${to}`);
    }
  } else if (fa.type === 'bus') {
    const dest = city.displayName || city.name || '';
    console.log(`  → バスで${dest}`);
  } else if (fa.type === 'car') {
    const dest = city.displayName || city.name || '';
    console.log(`  → 車で${dest}`);
  }
  console.log(``);
  // CTA（JRチェーンベース）
  const mainCta = tc.stepGroups.find(sg => sg.type === 'main-cta')?.cta;
  console.log(``);
  const suppressBk = best.islandDisplayType === 'bus' || best.islandDisplayType === 'car';
  if (!suppressBk && chainCta && mainCta) {
    const from = clean(chainCta.from); const to = clean(chainCta.to);
    const PROV = { 'jr-east':'えきねっと', 'jr-west':'e5489', 'jr-kyushu':'九州ネット予約', 'jr-ex':'EX', 'skyscanner':'Skyscanner' };
    const TYPE = { shinkansen:'新幹線', limited:'特急', flight:'飛行機', ferry:'フェリー' };
    const prov = PROV[mainCta.type] ?? '';
    const hint = TYPE[chainCta.type] ?? '';
    console.log(`  [👉 ${from} → ${to}]`);
    console.log(`  [${prov || '予約'}${hint ? `（${hint}）` : ''}]`);
  } else {
    console.log(`  [👉 そのまま行く（予約不要）]`);
  }
}
