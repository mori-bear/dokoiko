/**
 * finalAccess を構造化 v2 に変換する。
 *
 * midStation: string → { name, type }
 * transferStation: string → { name, type, access }
 */
import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEST_PATH = resolve(__dirname, '../src/data/destinations.json');
const destinations = JSON.parse(readFileSync(DEST_PATH, 'utf-8'));

const clean = (n) => String(n ?? '').replace(/駅$|空港$|港$/, '');

// 私鉄パターン
const PRIVATE = /近鉄|南海|小田急|東武|西武|京王|京急|京成|京阪|阪急|阪神|名鉄|相鉄|東急|江ノ電|神戸電鉄|秩父鉄道|富山地方|叡山|ケーブル/;

function detectType(line) {
  if (!line) return 'jr';
  return PRIVATE.test(line) ? 'private' : 'jr';
}

// 既知の乗換アクセス種別
const TRANSFER_ACCESS = {
  '大阪阿部野橋': 'walk',   // 天王寺 → 阿部野橋は徒歩
  '難波':         'walk',   // なんば → 難波は徒歩（地下鉄なんば ↔ 南海難波）
  '三宮':         'same',   // 同一駅扱い
  '宇都宮':       'same',
  '大宮':         'same',
  '熊谷':         'same',
};

let converted = 0;
for (const dest of destinations) {
  const fa = dest.finalAccess;
  if (!fa || fa.type !== 'train') continue;

  let changed = false;

  // midStation: string → object
  if (typeof fa.midStation === 'string') {
    fa.midStation = { name: clean(fa.midStation), type: 'jr' };
    changed = true;
  }

  // transferStation: string → object
  if (typeof fa.transferStation === 'string') {
    const name = clean(fa.transferStation);
    const access = TRANSFER_ACCESS[name] ?? 'same';
    fa.transferStation = {
      name,
      type: detectType(fa.line),
      access,
    };
    changed = true;
  }

  if (changed) {
    converted++;
    const mid = fa.midStation ? `mid:${fa.midStation.name}` : '';
    const tr = fa.transferStation ? `tr:${fa.transferStation.name}(${fa.transferStation.access})` : '';
    console.log(`  ✓ ${dest.name}: ${[mid, tr].filter(Boolean).join(' / ')}`);
  }
}

writeFileSync(DEST_PATH, JSON.stringify(destinations, null, 2) + '\n', 'utf-8');
console.log(`\n${converted}件変換完了`);
