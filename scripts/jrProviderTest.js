import { readFileSync } from 'node:fs';
import { buildTransportContext } from '../src/engine/transportEngine.js';
const d = JSON.parse(readFileSync(new URL('../src/data/destinations.json', import.meta.url), 'utf8'));

const CASES = [
  // [出発, destId, 期待するcta.type, 説明]
  ['東京',  'matsushima',    'jr-east',   '東京→松島（東日本内）→ えきねっと'],
  ['大阪',  'fukuoka-city',  'skyscanner','大阪→福岡（flightが選ばれる→航空券CTA）'],
  ['大阪',  'beppu',         'jr-west',   '大阪→別府（西→九州）→ e5489'],
  ['福岡',  'beppu',         'jr-kyushu', '福岡→別府（九州内）→ 九州ネット'],
  ['高松',  'nara',          'jr-west',   '高松→奈良（四国→近畿）→ e5489'],
  ['東京',  'nara',          'jr-ex',     '東京→奈良（東→西跨ぎ）→ EX'],
  ['東京',  'kamakura',      'jr-east',   '東京→鎌倉（関東内）→ えきねっと'],
  ['高松',  'kirishima',     'jr-west',   '高松→霧島（四国→九州）→ e5489'],
  ['福岡',  'kirishima',     'jr-kyushu', '福岡→霧島（九州内）→ 九州ネット'],
  ['東京',  'atami',         'jr-east',   '東京→熱海（東日本内）→ えきねっと'],
];

let pass = 0, fail = 0;
for (const [dep, destId, expected, desc] of CASES) {
  const c = d.find(x => x.id === destId);
  if (!c) { console.log(`⚠ ${destId} not found`); continue; }
  const tc = buildTransportContext(dep, c);
  const actual = tc.cta?.type ?? null;
  const ok = actual === expected;
  console.log(`${ok ? '✓' : '❌'} ${desc}: cta=${actual} ${ok ? '' : `(expected ${expected})`}`);
  if (ok) pass++; else fail++;
}
console.log(`\n結果: PASS ${pass} / FAIL ${fail}`);
