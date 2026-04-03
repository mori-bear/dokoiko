/**
 * fixDuplicates.mjs
 *
 * hubs.json + destinations.json マージ時の重複を解消する。
 *
 * 【変更内容】
 *   A) 8件 id重複 → destinations を pref-slug 形式にリネーム
 *      hub 側は一切変更しない
 *      新id: ${hotelArea}-${旧id}
 *
 *   B) 12件 name重複（id違う・name同じ）→ destinations から削除
 *      hub が同一都市をカバーしているため機能的に問題なし
 *
 * 影響ファイル:
 *   - src/data/destinations.json  (リネーム8件・削除12件)
 *   - src/data/routes.json        (リネームに追従)
 *   - src/data/hotelAreas.json    (リネームに追従・削除に追従)
 *
 * 実行: node scripts/fixDuplicates.mjs
 */

import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname }            from 'path';
import { fileURLToPath }               from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

const DEST_PATH   = resolve(ROOT, 'src/data/destinations.json');
const ROUTES_PATH = resolve(ROOT, 'src/data/routes.json');
const AREAS_PATH  = resolve(ROOT, 'src/data/hotelAreas.json');

const destinations = JSON.parse(readFileSync(DEST_PATH,   'utf8'));
const routes       = JSON.parse(readFileSync(ROUTES_PATH, 'utf8'));
const hotelAreas   = JSON.parse(readFileSync(AREAS_PATH,  'utf8'));

// ─── A) id重複: リネーム ───────────────────────────────────────────────
// 旧id → 新id のマッピング
const RENAME_MAP = {
  'yokohama':   'kanagawa-yokohama',
  'asahikawa':  'hokkaido-asahikawa',
  'kushiro':    'hokkaido-kushiro',
  'hakodate':   'hokkaido-hakodate',
  'mito':       'ibaraki-mito',
  'iida':       'nagano-iida',
  'matsue':     'shimane-matsue',
  'takamatsu':  'kagawa-takamatsu',
};

// ─── B) name重複: 削除 ────────────────────────────────────────────────
// hub が同名でカバーしている destinations を削除
const DELETE_IDS = new Set([
  'sendai', 'matsuyama-city', 'tokushima-city', 'kochi-hirome',
  'matsumoto-city', 'shizuoka-city', 'saga-city', 'kumamoto-city',
  'nagasaki-city', 'kagoshima-city', 'miyazaki-city', 'yamagata-city',
]);

// ─── destinations.json 更新 ───────────────────────────────────────────
let renamedCount = 0, deletedCount = 0;

const updatedDests = destinations
  .filter(d => {
    if (DELETE_IDS.has(d.id)) { deletedCount++; return false; }
    return true;
  })
  .map(d => {
    const newId = RENAME_MAP[d.id];
    if (!newId) return d;
    renamedCount++;
    return { ...d, id: newId };
  });

console.log(`destinations.json: ${destinations.length} → ${updatedDests.length} 件`);
console.log(`  リネーム: ${renamedCount} 件`);
console.log(`  削除:     ${deletedCount} 件`);

// ─── routes.json 更新 ─────────────────────────────────────────────────
const updatedRoutes = {};
let routesRenamed = 0, routesDeleted = 0;

for (const [id, route] of Object.entries(routes)) {
  if (DELETE_IDS.has(id)) { routesDeleted++; continue; }
  const newId = RENAME_MAP[id];
  if (newId) {
    updatedRoutes[newId] = route;
    routesRenamed++;
  } else {
    updatedRoutes[id] = route;
  }
}

console.log(`\nroutes.json: ${Object.keys(routes).length} → ${Object.keys(updatedRoutes).length} 件`);
console.log(`  リネーム: ${routesRenamed} 件`);
console.log(`  削除:     ${routesDeleted} 件`);

// ─── hotelAreas.json 更新 ─────────────────────────────────────────────
// RENAME_MAP に従い id を変換、DELETE_IDS の generated エントリを削除
let areasRenamed = 0, areasDeleted = 0;

const updatedAreas = hotelAreas
  .filter(a => {
    if (DELETE_IDS.has(a.id) && a._generated) { areasDeleted++; return false; }
    return true;
  })
  .map(a => {
    const newId = RENAME_MAP[a.id];
    if (!newId) return a;
    areasRenamed++;
    return { ...a, id: newId };
  });

console.log(`\nhotelAreas.json: ${hotelAreas.length} → ${updatedAreas.length} 件`);
console.log(`  リネーム: ${areasRenamed} 件`);
console.log(`  削除(generated): ${areasDeleted} 件`);

// ─── 書き込み ─────────────────────────────────────────────────────────
writeFileSync(DEST_PATH,   JSON.stringify(updatedDests, null, 2),   'utf8');
writeFileSync(ROUTES_PATH, JSON.stringify(updatedRoutes, null, 2),  'utf8');
writeFileSync(AREAS_PATH,  JSON.stringify(updatedAreas, null, 2),   'utf8');

console.log('\n✓ 全ファイル更新完了');

// ─── 検証 ─────────────────────────────────────────────────────────────
const hubs = JSON.parse(readFileSync(resolve(ROOT, 'src/data/hubs.json'), 'utf8'));
const all  = [...hubs, ...updatedDests];

const idMap = {};
all.forEach(x => { idMap[x.id] = (idMap[x.id]||0)+1; });
const dupIds = Object.entries(idMap).filter(([,c]) => c>1);

const nameMap = {};
all.forEach(x => { nameMap[x.name] = (nameMap[x.name]||0)+1; });
const dupNames = Object.entries(nameMap).filter(([,c]) => c>1);

console.log('\n=== 検証結果 ===');
console.log(`  合算件数: ${all.length}`);
if (dupIds.length === 0) {
  console.log('  ✓ id重複: ゼロ');
} else {
  console.log('  ✗ id重複:', dupIds.map(([id]) => id).join(', '));
}
if (dupNames.length === 0) {
  console.log('  ✓ name重複: ゼロ');
} else {
  console.log('  ✗ name重複:', dupNames.map(([n]) => n).join(', '));
}

// routes 整合性
const destIds   = new Set(updatedDests.map(x => x.id));
const routeIds  = new Set(Object.keys(updatedRoutes));
const orphan    = [...routeIds].filter(id => !destIds.has(id));
const noRoute   = [...destIds].filter(id => !routeIds.has(id));
console.log(`  routes整合: orphan=${orphan.length}, noRoute=${noRoute.length}`);
if (orphan.length > 0) console.log('  orphan routes:', orphan);
if (noRoute.length > 0) console.log('  route欠損:', noRoute);
