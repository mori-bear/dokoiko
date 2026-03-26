/**
 * Phase 3 UI 表示例デモ — 近距離 / 中距離 / 長距離
 * 実行: node scripts/phase3demo.mjs
 */
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const _root = join(dirname(fileURLToPath(import.meta.url)), '..');
const { resolveTransportLinks } = await import(`${_root}/src/transport/resolveTransportLinks.js`);
const DESTS = JSON.parse(readFileSync(`${_root}/src/data/destinations.json`, 'utf8'));

function findDest(id) { return DESTS.find(d => d.id === id); }

function renderLinks(links, departure) {
  for (const l of links) {
    if (l.type === 'summary') {
      const route = (l.waypoints?.length >= 2) ? l.waypoints.join(' → ') : departure;
      const tr    = l.transfers === 0 ? '直通' : `乗換${l.transfers}回`;
      const badge = l.stayRecommend === 'daytrip-ok' ? ' ✅日帰りOK' : ' 🌙1泊以上推奨';
      console.log(`  📍 ${route}（${tr}）${badge}`);
    } else if (l.type === 'main-cta') {
      if (l.cta?.label) {
        console.log(`  ▶ [予約ボタン] ${l.cta.label}`);
        if (l.bookingTarget) console.log(`    └ ${l.bookingTarget}`);
      }
    } else if (l.type === 'step-group') {
      console.log(`  ${l.stepLabel}`);
      if (l.cta?.label) console.log(`    └ [${l.cta.label}]`);
      if (l.caution)    console.log(`    ⚠ ${l.caution}`);
    }
  }
}

const patterns = [
  { label: '【近距離】 大阪 → 有馬温泉', departure: '大阪', destId: 'arima-onsen', travelTime: 60  },
  { label: '【中距離】 東京 → 奈良',     departure: '東京', destId: 'nara',      travelTime: 180 },
  { label: '【長距離】 大阪 → 霧島',     departure: '大阪', destId: 'kirishima', travelTime: 360 },
];

for (const { label, departure, destId, travelTime } of patterns) {
  const city = findDest(destId);
  if (!city) { console.log(`\n=== ${label} — destination(${destId}) not found ===\n`); continue; }
  city.travelTimeMinutes = travelTime;  // 通常は selectionEngine が設定
  const links = resolveTransportLinks(city, departure);
  console.log(`\n${'─'.repeat(60)}`);
  console.log(`${label}`);
  console.log('─'.repeat(60));
  renderLinks(links, departure);
}
