/**
 * probeMainCta.js — 修正対象7件 + shima について main-cta を実機呼出で取得する診断スクリプト
 */
import { resolveTransportLinks } from '../src/transport/resolveTransportLinks.js';
import { loadJson } from '../src/lib/loadJson.js';

const data = await loadJson('../src/data/destinations.json', import.meta.url);
const arr = Array.isArray(data) ? data : (data.destinations || Object.values(data));

const ids = ['kashihara','koyasan','kinugawa-onsen','tokoname','inuyama','chichibu','arashiyama','shima'];
const departures = ['東京','大阪','名古屋','福岡','高松'];

for (const id of ids) {
  const city = arr.find(d => d.id === id);
  if (!city) { console.log(`${id}: NOT FOUND`); continue; }
  console.log(`\n=== ${id} (${city.name}) railProvider=${city.railProvider} ===`);
  for (const dep of departures) {
    let links = null;
    try {
      links = resolveTransportLinks(city, dep) ?? [];
    } catch (e) {
      console.log(`  ${dep}: ERROR ${e.message}`);
      continue;
    }
    const mainCta = links.find(l => l.type === 'main-cta');
    if (!mainCta) {
      console.log(`  ${dep}: main-cta なし`);
    } else {
      console.log(`  ${dep}: cta.type=${mainCta.cta?.type} url=${mainCta.cta?.url}`);
    }
  }
}
