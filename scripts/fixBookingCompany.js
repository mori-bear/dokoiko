/**
 * fixBookingCompany.js — bookingStation.company の誤り修正（一回限り）
 *
 * 私鉄駅なのに company:"JR" となっていた7件を修正し、
 * 同時に railProvider も null に修正する。
 *
 * 対象: kashihara / koyasan / kinugawa-onsen / tokoname / inuyama / chichibu / arashiyama
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FILE = path.resolve(__dirname, '../src/data/destinations.json');

const FIXES = {
  'kashihara':       { company: '近鉄',       railProvider: null },
  'koyasan':         { company: '南海',       railProvider: null },
  'kinugawa-onsen':  { company: '東武',       railProvider: null },
  'tokoname':        { company: '名鉄',       railProvider: null },
  'inuyama':         { company: '名鉄',       railProvider: null },
  'chichibu':        { company: '秩父鉄道',   railProvider: null },
  'arashiyama':      { company: '阪急',       railProvider: null },
};

const data = JSON.parse(fs.readFileSync(FILE, 'utf-8'));
const arr = Array.isArray(data) ? data : (data.destinations || Object.values(data));

let updated = 0;
const log = [];
for (const d of arr) {
  const fix = FIXES[d.id];
  if (!fix) continue;
  const beforeCompany = d.bookingStation?.company ?? null;
  const beforeProvider = d.railProvider ?? null;
  if (d.bookingStation) d.bookingStation.company = fix.company;
  d.railProvider = fix.railProvider;
  log.push({
    id: d.id,
    name: d.name,
    company: `${beforeCompany} → ${fix.company}`,
    railProvider: `${beforeProvider} → ${fix.railProvider}`,
  });
  updated++;
}

if (updated !== Object.keys(FIXES).length) {
  console.error(`想定件数(${Object.keys(FIXES).length})と実際(${updated})が不一致`);
  process.exit(1);
}

fs.writeFileSync(FILE, JSON.stringify(arr, null, 2) + '\n');
console.log(`✓ ${updated}件を修正:`);
for (const r of log) {
  console.log(`  ${r.id} (${r.name}) | company: ${r.company} | railProvider: ${r.railProvider}`);
}
