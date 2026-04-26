// scripts/generateDestinationOgp.cjs
// 目的地別OGP画像（1200x630, 白背景）を node-canvas で生成する。
//
// 仕様:
//   - 上部に「どこ行こ？」（小さめ・グレー）
//   - 中央に目的地名（大きめ・黒・太字）
//   - 下部に都道府県名（中くらい・グレー）
//   - 右下に tabidokoiko.com（小さめ・グレー）
//
// 使い方:
//   node scripts/generateDestinationOgp.cjs                 # 全1067件
//   node scripts/generateDestinationOgp.cjs --sample        # 先頭10件のみ
//   node scripts/generateDestinationOgp.cjs id1 id2 ...     # 指定IDのみ

const { createCanvas } = require('canvas');
const fs   = require('fs');
const path = require('path');

const W = 1200;
const H = 630;

const FONT_FAMILY = '"Hiragino Sans", "Noto Sans CJK JP", sans-serif';

const SAMPLE_IDS = [
  'kamakura', 'arima-onsen', 'ogijima', 'dewa-sanzan',
  'hakone', 'yakushima', 'miyajima', 'onuma', 'hanno', 'ishigaki',
];

const argv = process.argv.slice(2);
const useSample   = argv.includes('--sample');
const idArgs      = argv.filter(a => !a.startsWith('--'));

const DATA_FILE   = path.resolve(__dirname, '../src/data/destinations.json');
const OUT_DIR     = path.resolve(__dirname, '../assets/ogp');

const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
const arr  = Array.isArray(data) ? data : (data.destinations || Object.values(data));

let targets;
if (idArgs.length > 0) {
  const set = new Set(idArgs);
  targets = arr.filter(d => set.has(d.id));
} else if (useSample) {
  const set = new Set(SAMPLE_IDS);
  targets = arr.filter(d => set.has(d.id));
} else {
  targets = arr.filter(d => d.type === 'destination');
}

fs.mkdirSync(OUT_DIR, { recursive: true });

function fitFontSize(ctx, text, maxWidth, baseSize, weight = 'bold') {
  let size = baseSize;
  while (size > 24) {
    ctx.font = `${weight} ${size}px ${FONT_FAMILY}`;
    if (ctx.measureText(text).width <= maxWidth) return size;
    size -= 4;
  }
  return size;
}

function renderOne(dest) {
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');

  // 背景
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, W, H);

  ctx.textAlign    = 'center';
  ctx.textBaseline = 'middle';

  // 上部: ブランド名
  ctx.fillStyle = '#9a9a9a';
  ctx.font = `36px ${FONT_FAMILY}`;
  ctx.fillText('どこ行こ？', W / 2, 90);

  // 中央: 目的地名（横幅 1000px に収まるよう自動縮小）
  const name = dest.displayName || dest.name || '';
  ctx.fillStyle = '#1c1c1c';
  const titleSize = fitFontSize(ctx, name, 1000, 140, 'bold');
  ctx.font = `bold ${titleSize}px ${FONT_FAMILY}`;
  ctx.fillText(name, W / 2, H / 2);

  // 下部中央: 都道府県名
  if (dest.prefecture) {
    ctx.fillStyle = '#7a7a7a';
    ctx.font = `48px ${FONT_FAMILY}`;
    ctx.fillText(dest.prefecture, W / 2, H / 2 + 120);
  }

  // 右下: ドメイン
  ctx.textAlign = 'right';
  ctx.fillStyle = '#bdbdbd';
  ctx.font = `28px ${FONT_FAMILY}`;
  ctx.fillText('tabidokoiko.com', W - 40, H - 40);

  const outPath = path.join(OUT_DIR, `${dest.id}.png`);
  fs.writeFileSync(outPath, canvas.toBuffer('image/png'));
  return outPath;
}

let total = 0;
let totalBytes = 0;
const t0 = Date.now();
for (const d of targets) {
  const p = renderOne(d);
  total++;
  totalBytes += fs.statSync(p).size;
}
const dt = ((Date.now() - t0) / 1000).toFixed(1);

console.log(`✓ ${total}件生成 / ${(totalBytes / 1024 / 1024).toFixed(2)}MB / ${dt}秒`);
console.log(`  平均: ${(totalBytes / total / 1024).toFixed(1)}KB/枚`);
console.log(`  出力先: ${OUT_DIR}`);
