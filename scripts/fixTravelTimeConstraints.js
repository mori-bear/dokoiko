import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const destFile = path.join(__dirname, '../src/data/destinations.json');
const data = JSON.parse(fs.readFileSync(destFile, 'utf8'));

const TRAVEL_KEY_MAP = {
  '東京': 'tokyo',   '大阪': 'osaka',      '名古屋': 'nagoya',
  '福岡': 'fukuoka', '札幌': 'sapporo',    '仙台': 'sendai',
  '広島': 'hiroshima','高松': 'takamatsu', '那覇': 'naha',
  '金沢': 'kanazawa', '和歌山': 'wakayama',
};

const MAX_1NIGHT_MINUTES = 180;
let fixedCount = 0;

data.forEach(dest => {
  if (!dest.departures?.length || !dest.travelTime) return;
  dest.departures.forEach(dep => {
    const key = TRAVEL_KEY_MAP[dep];
    if (!key) return;
    const minutes = dest.travelTime[key];
    if (!minutes || minutes <= MAX_1NIGHT_MINUTES) return;
    if (dest.stayAllowed?.includes('1night')) {
      dest.stayAllowed = dest.stayAllowed.filter(s => s !== 'daytrip' && s !== '1night');
      if (!dest.stayAllowed.includes('2night')) dest.stayAllowed.push('2night');
      fixedCount++;
      console.log(`✅ ${dest.name}（${dep}から${minutes}分）→ 2night のみ`);
    }
  });
});

fs.writeFileSync(destFile, JSON.stringify(data, null, 2), 'utf8');
console.log(`\n📊 修正件数: ${fixedCount}件`);
