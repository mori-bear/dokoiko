/**
 * cleanRoutes.mjs — routes.js から destinations.json に存在しない孤児エントリを削除
 * 実行: node scripts/cleanRoutes.mjs
 */
import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

const { ROUTES, CITY_TO_SHINKANSEN } = await import(`file://${root}/src/features/dokoiko/routes.js`);
const dests = JSON.parse(readFileSync(join(root, 'src/data/destinations.json'), 'utf8'));
const validIds = new Set(dests.map(d => d.id));

const before = Object.keys(ROUTES).length;
const validRoutes = Object.fromEntries(
  Object.entries(ROUTES).filter(([id]) => validIds.has(id))
);
const after = Object.keys(validRoutes).length;
const removed = Object.keys(ROUTES).filter(id => !validIds.has(id));

console.log(`削除前: ${before}件 → 削除後: ${after}件（${before - after}件削除）`);
console.log('削除ID:', removed.join(', '));

// routes.js を再生成
const routesContent = `export const CITY_TO_SHINKANSEN = ${JSON.stringify(CITY_TO_SHINKANSEN, null, 2)};

export const ROUTES = ${JSON.stringify(validRoutes, null, 2)};
`;

writeFileSync(join(root, 'src/features/dokoiko/routes.js'), routesContent, 'utf8');
console.log('routes.js を更新しました');
