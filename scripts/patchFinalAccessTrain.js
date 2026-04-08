/**
 * 私鉄アクセスが必要な目的地に finalAccess.type = "train" を設定する。
 * JR到達点（gatewayCity）から私鉄で最寄り駅へ向かうパターン。
 */
import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEST_PATH = resolve(__dirname, '../src/data/destinations.json');
const destinations = JSON.parse(readFileSync(DEST_PATH, 'utf-8'));

const TRAIN_ACCESS = {
  'asuka':      { type: 'train', from: '橿原神宮前', line: '近鉄吉野線',   to: '飛鳥' },
  'yoshino':    { type: 'train', from: '橿原神宮前', line: '近鉄吉野線',   to: '吉野' },
  'koyasan':    { type: 'train', from: '橋本',       line: '南海高野線',   to: '高野山' },
  'nikko':      { type: 'train', from: '下今市',     line: '東武日光線',   to: '日光' },
  'kurama':     { type: 'train', from: '出町柳',     line: '叡山電鉄',     to: '鞍馬' },
  'kibune':     { type: 'train', from: '出町柳',     line: '叡山電鉄',     to: '貴船口' },
  'takao':      { type: 'train', from: '高尾',       line: 'ケーブルカー', to: '高尾山' },
  'enoshima':   { type: 'train', from: '藤沢',       line: '江ノ電',       to: '江ノ島' },
  'chichibu':   { type: 'train', from: '熊谷',       line: '秩父鉄道',     to: '秩父' },
  'kawagoe':    { type: 'train', from: '大宮',       line: '東武東上線',   to: '川越' },
};

let patched = 0;
for (const dest of destinations) {
  const fix = TRAIN_ACCESS[dest.id];
  if (fix) {
    dest.finalAccess = fix;
    patched++;
    console.log(`  ✓ ${dest.name}: ${fix.from} → ${fix.line} → ${fix.to}`);
  }
}

writeFileSync(DEST_PATH, JSON.stringify(destinations, null, 2) + '\n', 'utf-8');
console.log(`\n${patched} 件パッチ適用`);
