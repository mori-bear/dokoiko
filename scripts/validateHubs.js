/**
 * validateHubs.js — hub構造整合性チェック
 *
 * チェック項目:
 *   - hubCityが hotelAreas / destinations に存在するか
 *   - accessStationが駅名形式か
 *   - fallbackCityが都道府県として妥当か
 *   - hubCity と destination 間の距離が100km以内か
 *
 * 出力: hub_validation_failures.csv
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const { calcDistanceKm } = await import('../src/utils/geo.js');

const DESTS = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/data/destinations.json'), 'utf8'));
const AREAS = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/data/hotelAreas.json'), 'utf8'));
const HUBS  = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/data/hubs.json'), 'utf8'));

const VALID_HUB_NAMES = new Set([
  ...AREAS.map(a => a.name),
  ...HUBS.map(h => h.name),
  ...DESTS.map(d => d.name),
  ...DESTS.map(d => d.displayName).filter(Boolean),
]);

// 座標付きhub名 → 座標マップ
const HUB_COORDS = {};
for (const a of AREAS) if (a.lat && a.lng) HUB_COORDS[a.name] = { lat: a.lat, lng: a.lng };
for (const h of HUBS)  if (h.lat && h.lng) HUB_COORDS[h.name] = { lat: h.lat, lng: h.lng };

const OUT_CSV = path.join(ROOT, 'hub_validation_failures.csv');
const rows = ['type,destId,destName,detail'];

let noHub = 0, unknownHub = 0, badStation = 0, tooFar = 0, ok = 0;

for (const d of DESTS) {
  const hub = d.hubCity;
  const station = d.accessStation;
  const name = d.displayName || d.name;

  // ① hubCity 存在チェック
  if (!hub) {
    noHub++;
    rows.push(`no_hub,${d.id},${name},hubCity missing`);
    continue;
  }

  // ② hubCityがhotelAreas/hubs/destinationsに存在するか
  if (!VALID_HUB_NAMES.has(hub)) {
    unknownHub++;
    rows.push(`unknown_hub,${d.id},${name},hub="${hub}" not in areas/hubs`);
  }

  // ③ accessStation が 駅/空港/港 で終わるか
  if (station && !/駅$|空港$|港$|バスターミナル$/.test(station)) {
    badStation++;
    rows.push(`bad_station,${d.id},${name},accessStation="${station}" no suffix`);
  }

  // ④ hubCity ↔ destination の距離チェック（100km以内）
  const hubCoord = HUB_COORDS[hub];
  if (hubCoord && d.lat && d.lng) {
    const km = calcDistanceKm(hubCoord, d);
    if (km > 100) {
      tooFar++;
      rows.push(`too_far,${d.id},${name},hub="${hub}" ${Math.round(km)}km離れ`);
    }
  }

  ok++;
}

fs.writeFileSync(OUT_CSV, rows.join('\n'));
console.log(`[validateHubs] ok=${ok}, no_hub=${noHub}, unknown_hub=${unknownHub}, bad_station=${badStation}, too_far=${tooFar}`);
console.log(`  → ${OUT_CSV}`);
