// scripts/generateOgp.cjs
// 汎用OGP画像（1200x630, 白背景）を node-canvas で生成する。

const { createCanvas } = require('canvas');
const fs   = require('fs');
const path = require('path');

const W = 1200;
const H = 630;

const canvas = createCanvas(W, H);
const ctx = canvas.getContext('2d');

// 背景
ctx.fillStyle = '#ffffff';
ctx.fillRect(0, 0, W, H);

ctx.textAlign    = 'center';
ctx.textBaseline = 'middle';

// メインタイトル
ctx.fillStyle = '#1c1c1c';
ctx.font = 'bold 120px "Hiragino Sans", "Noto Sans CJK JP", sans-serif';
ctx.fillText('どこ行こ？', W / 2, H / 2 - 30);

// サブコピー
ctx.fillStyle = '#8a8a8a';
ctx.font = '36px "Hiragino Sans", "Noto Sans CJK JP", sans-serif';
ctx.fillText('まだ知らない街と、出会おう。', W / 2, H / 2 + 80);

const outPath = path.join(__dirname, '../assets/ogp.png');
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, canvas.toBuffer('image/png'));

console.log(`✓ OGP画像生成: ${outPath}`);
console.log(`  ${W}x${H} / ${(fs.statSync(outPath).size / 1024).toFixed(1)}KB`);
