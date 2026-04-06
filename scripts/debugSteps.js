import { readFileSync } from 'node:fs';
import { buildTransportContext } from '../src/engine/transportEngine.js';
const destinations = JSON.parse(readFileSync(new URL('../src/data/destinations.json', import.meta.url), 'utf8'));

for (const destId of ['ishigaki', 'kamakura']) {
  const city = destinations.find(d => d.id === destId);
  const tc = buildTransportContext('東京', city);
  console.log(`\n=== ${destId} ===`);
  for (const sg of tc.stepGroups) {
    if (sg.type === 'step-group') {
      console.log(`  stepLabel: "${sg.stepLabel}"`);
    }
  }
}
