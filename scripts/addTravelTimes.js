import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const destFile = path.join(__dirname, '../src/data/destinations.json');
const data = JSON.parse(fs.readFileSync(destFile, 'utf8'));

// 新出発地 → 近隣既存出発地のマッピング（近似値）
const TRAVEL_TIME_BASE = {
  '釧路':  { base: 'sapporo', offset: 90 },
  '帯広':  { base: 'sapporo', offset: 60 },
  '北見':  { base: 'sapporo', offset: 90 },
  '秋田':  { base: 'sendai',  offset: 60 },
  '山形':  { base: 'sendai',  offset: 30 },
  '福島':  { base: 'sendai',  offset: 30 },
  '八戸':  { base: 'sendai',  offset: 60 },
  '水戸':  { base: 'tokyo',   offset: 45 },
  '前橋':  { base: 'tokyo',   offset: 60 },
  '高崎':  { base: 'tokyo',   offset: 60 },
  '浜松':  { base: 'nagoya',  offset: 30 },
  '岐阜':  { base: 'nagoya',  offset: 20 },
  '福井':  { base: 'kanazawa', offset: 30 },
  '甲府':  { base: 'tokyo',   offset: 90 },
  '新宮':  { base: 'osaka',   offset: 120 },
  '田辺':  { base: 'osaka',   offset: 90 },
  '白浜':  { base: 'osaka',   offset: 100 },
  '串本':  { base: 'osaka',   offset: 120 },
  '鳥取':  { base: 'osaka',   offset: 120 },
  '山口':  { base: 'hiroshima', offset: 60 },
  '下関':  { base: 'fukuoka', offset: 30 },
  '佐賀':  { base: 'fukuoka', offset: 30 },
  '大分':  { base: 'fukuoka', offset: 60 },
  '別府':  { base: 'fukuoka', offset: 70 },
  '石垣':  { base: 'naha',    offset: 60 },
  '宮古':  { base: 'naha',    offset: 50 },
};

const NEW_CITY_KEYS = {
  '釧路': 'kushiro', '帯広': 'obihiro', '北見': 'kitami',
  '秋田': 'akita', '山形': 'yamagata', '福島': 'fukushima',
  '八戸': 'hachinohe', '水戸': 'mito', '前橋': 'maebashi',
  '高崎': 'takasaki', '浜松': 'hamamatsu', '岐阜': 'gifu',
  '福井': 'fukui', '甲府': 'kofu', '新宮': 'shingu',
  '田辺': 'tanabe', '白浜': 'shirahama', '串本': 'kushimoto',
  '鳥取': 'tottori', '山口': 'yamaguchi', '下関': 'shimonoseki',
  '佐賀': 'saga', '大分': 'oita', '別府': 'beppu',
  '石垣': 'ishigaki', '宮古': 'miyako',
};

let updatedCount = 0;
data.forEach(dest => {
  if (!dest.travelTime) return;

  Object.entries(TRAVEL_TIME_BASE).forEach(([cityName, { base, offset }]) => {
    const key = NEW_CITY_KEYS[cityName];
    if (!key || dest.travelTime[key] !== undefined) return;

    const baseTime = dest.travelTime[base];
    if (baseTime == null) return;

    dest.travelTime[key] = Math.round(baseTime + offset);
    updatedCount++;
  });
});

fs.writeFileSync(destFile, JSON.stringify(data, null, 2), 'utf8');
console.log(`✅ travelTime 追加: ${updatedCount}件`);
