/**
 * fixRakutenLinks.js — 楽天トラベル都道府県直リンク (rakutenArea) を追加
 *
 * 安全策:
 *   - 既存 hotelLinks.rakuten / jalan は絶対に上書きしない
 *   - rakutenArea フィールドのみ新規追加
 *   - type === 'destination' のみ対象
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEST_FILE = path.join(__dirname, '../src/data/destinations.json');

// 都道府県名（県/都/道/府 除去後）→ 楽天エリアコード
const PREF_CODE = {
  '北海道': '011', '青森': '021', '岩手': '031', '宮城': '041', '秋田': '051',
  '山形': '061', '福島': '071', '茨城': '081', '栃木': '091', '群馬': '101',
  '埼玉': '111', '千葉': '121', '東京': '131', '神奈川': '141', '新潟': '151',
  '富山': '161', '石川': '171', '福井': '181', '山梨': '191', '長野': '201',
  '岐阜': '211', '静岡': '221', '愛知': '231', '三重': '241', '滋賀': '251',
  '京都': '261', '大阪': '271', '兵庫': '281', '奈良': '291', '和歌山': '301',
  '鳥取': '311', '島根': '321', '岡山': '331', '広島': '341', '山口': '351',
  '徳島': '361', '香川': '371', '愛媛': '381', '高知': '391', '福岡': '401',
  '佐賀': '411', '長崎': '421', '熊本': '431', '大分': '441', '宮崎': '451',
  '鹿児島': '461', '沖縄': '471',
};

function getCode(pref) {
  // "青森県" → "青森"、"東京都" → "東京"、"北海道" → "北海道"（道は除かない）
  const key = pref.replace(/[都府県]$/, '');
  return PREF_CODE[key] ?? null;
}

const data = JSON.parse(fs.readFileSync(DEST_FILE, 'utf-8'));
let added = 0;
let alreadyExists = 0;
let skipped = 0;

for (const dest of data) {
  if (dest.type !== 'destination') continue;
  if (!dest.prefecture) { skipped++; continue; }

  const code = getCode(dest.prefecture);
  if (!code) {
    skipped++;
    console.warn(`⚠️  コード未対応: "${dest.prefecture}" (${dest.id})`);
    continue;
  }

  if (!dest.hotelLinks) dest.hotelLinks = {};

  if (dest.hotelLinks.rakutenArea) {
    alreadyExists++;
    continue;
  }

  // 既存 rakuten / jalan は触らず rakutenArea のみ追加
  dest.hotelLinks.rakutenArea =
    `https://travel.rakuten.co.jp/yad/search/areaSearchMain.do?f_area=${code}`;
  added++;
}

fs.writeFileSync(DEST_FILE, JSON.stringify(data, null, 2), 'utf-8');
console.log(`\n=== fixRakutenLinks 結果 ===`);
console.log(`  rakutenArea 追加    : ${added}件`);
console.log(`  既存（スキップ）     : ${alreadyExists}件`);
console.log(`  prefecture 未設定等  : ${skipped}件`);
