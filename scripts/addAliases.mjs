/**
 * addAliases.mjs
 *
 * destinations.json と hubs.json に aliases フィールドを追加する。
 *
 * 追加対象:
 *   A) destinations.json: 8件のリネーム済みdest → 旧名バリアント ("横浜市" など)
 *   B) hubs.json: 12件の吸収対象hub → "市" 付き variant
 *
 * 実行: node scripts/addAliases.mjs
 */

import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

const DEST_PATH = resolve(ROOT, 'src/data/destinations.json');
const HUBS_PATH = resolve(ROOT, 'src/data/hubs.json');

// ─── A) destinations のエイリアス追加 ────────────────────────────────
const DEST_ALIASES = {
  'kanagawa-yokohama': ['横浜市'],
  'hokkaido-asahikawa': ['旭川市'],
  'hokkaido-kushiro': ['釧路市'],
  'hokkaido-hakodate': ['函館市'],
  'ibaraki-mito': ['水戸市'],
  'nagano-iida': ['飯田市'],
  'shimane-matsue': ['松江市'],
  'kagawa-takamatsu': ['高松市'],
};

// ─── B) hubs のエイリアス追加（削除して吸収した12都市） ───────────────
const HUB_ALIASES = {
  'sendai-t':    ['仙台市'],
  'matsuyama':   ['松山市'],
  'tokushima':   ['徳島市'],
  'kochi':       ['高知市', 'ひろめ市場'],
  'matsumoto-n': ['松本市'],
  'shizuoka':    ['静岡市'],
  'saga':        ['佐賀市'],
  'kumamoto':    ['熊本市'],
  'nagasaki':    ['長崎市'],
  'kagoshima':   ['鹿児島市'],
  'miyazaki':    ['宮崎市'],
  'yamagata':    ['山形市'],
};

// ─── destinations.json 更新 ───────────────────────────────────────────
const destinations = JSON.parse(readFileSync(DEST_PATH, 'utf8'));
let destUpdated = 0;

const updatedDests = destinations.map(d => {
  const newAliases = DEST_ALIASES[d.id];
  if (!newAliases) return d;
  destUpdated++;
  const existing = d.aliases ?? [];
  const merged = [...new Set([...existing, ...newAliases])];
  return { ...d, aliases: merged };
});

writeFileSync(DEST_PATH, JSON.stringify(updatedDests, null, 2), 'utf8');
console.log(`destinations.json: aliases追加 ${destUpdated} 件`);

// ─── hubs.json 更新 ───────────────────────────────────────────────────
const hubs = JSON.parse(readFileSync(HUBS_PATH, 'utf8'));
let hubUpdated = 0;

const updatedHubs = hubs.map(h => {
  const newAliases = HUB_ALIASES[h.id];
  if (!newAliases) return h;
  hubUpdated++;
  const existing = h.aliases ?? [];
  const merged = [...new Set([...existing, ...newAliases])];
  return { ...h, aliases: merged };
});

writeFileSync(HUBS_PATH, JSON.stringify(updatedHubs, null, 2), 'utf8');
console.log(`hubs.json: aliases追加 ${hubUpdated} 件`);

// ─── 検証 ─────────────────────────────────────────────────────────────
const allEntries = [...updatedHubs, ...updatedDests];

// 全nameとaliasを集めてユニーク確認
const allNames = new Map(); // name/alias → {id, type}
let conflicts = 0;
for (const e of allEntries) {
  const type = e.type ?? 'destination';
  const names = [e.name, ...(e.aliases ?? [])];
  for (const n of names) {
    const key = `${type}::${n}`;
    if (allNames.has(key)) {
      console.log(`  ⚠ 衝突: "${n}" (type=${type}) → ${allNames.get(key)} vs ${e.id}`);
      conflicts++;
    }
    allNames.set(key, e.id);
  }
}

if (conflicts === 0) {
  console.log('\n✓ alias含む name衝突ゼロ');
} else {
  console.log(`\n✗ alias衝突: ${conflicts} 件`);
}

console.log('\n=== aliases サンプル ===');
[...updatedDests, ...updatedHubs].filter(e => e.aliases?.length).forEach(e => {
  console.log(`  ${e.id} (${e.name}): aliases=${JSON.stringify(e.aliases)}`);
});
