/**
 * validateRoutes.js — 全destination × 主要出発地で経路品質を監視（warning only）
 *
 * 【方針転換 2026-04】
 * transportGraph は「参考ルート」として扱い、正確な経路はGoogleマップに委譲。
 * detour / too_long / unreachable は FAIL ではなく WARNING として記録のみ。
 *
 * 出力: route_validation_warnings.csv（旧 failures から改名）
 * QA合格条件: 本スクリプトのFAIL件数は合否に影響しない
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const { resolveRoute } = await import('../src/engine/routeResolver.js');
const { DEPARTURE_COORDS } = await import('../src/config/constants.js');
const { calcDistanceKm } = await import('../src/utils/geo.js');

const DESTS = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/data/destinations.json'), 'utf8'));
const MAIN_DEPS = ['東京', '大阪', '名古屋', '福岡', '仙台', '札幌', '広島'];
const OUT_CSV = path.join(ROOT, 'route_validation_warnings.csv');

const rows = ['type,departure,destId,destName,directKm,expectedMin,actualMin,detail'];
let unreachable = 0, detour = 0, tooLong = 0, ok = 0;

for (const dep of MAIN_DEPS) {
  const depCoords = DEPARTURE_COORDS[dep];
  if (!depCoords) continue;

  for (const dest of DESTS) {
    if (!dest.lat || !dest.lng) continue;
    const directKm = calcDistanceKm(depCoords, dest);

    let route;
    try {
      route = resolveRoute(dep, dest);
    } catch {
      route = null;
    }

    if (!route?.steps?.length) {
      unreachable++;
      rows.push(`unreachable,${dep},${dest.id},${dest.displayName || dest.name},${Math.round(directKm)},-,-,resolveRoute null`);
      continue;
    }

    const totalMin = route.steps.reduce((s, x) => s + (x.minutes ?? 0), 0);
    const expectedMin = Math.max(30, (directKm / 100) * 60 + 30);

    if (totalMin >= 600) {
      tooLong++;
      rows.push(`too_long,${dep},${dest.id},${dest.displayName || dest.name},${Math.round(directKm)},${Math.round(expectedMin)},${totalMin},total≥10h`);
      continue;
    }

    // 近距離（<300km）のみ遠回り判定（長距離は妥当）
    if (directKm < 300 && totalMin > expectedMin * 1.5) {
      detour++;
      rows.push(`detour,${dep},${dest.id},${dest.displayName || dest.name},${Math.round(directKm)},${Math.round(expectedMin)},${totalMin},ratio=${(totalMin / expectedMin).toFixed(2)}`);
      continue;
    }

    ok++;
  }
}

fs.writeFileSync(OUT_CSV, rows.join('\n'));
console.log(`[validateRoutes] (WARNING ONLY - not a FAIL)`);
console.log(`  OK=${ok}, unreachable=${unreachable}, detour=${detour}, too_long=${tooLong}`);
console.log(`  → ${OUT_CSV}`);
console.log('  ※正確な経路はGoogleマップに委譲。本検証はモニタリング目的のみ');
// 常にexit 0（QA合否に影響させない）
