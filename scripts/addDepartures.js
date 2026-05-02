import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const newDepartures = [
  // 北海道
  { name: '釧路', region: '北海道', ref: 'sapporo', lat: 42.9849, lng: 144.3819, nearestHub: 'sapporo', pref: '北海道' },
  { name: '帯広', region: '北海道', ref: 'sapporo', lat: 42.9241, lng: 143.1966, nearestHub: 'sapporo', pref: '北海道' },
  { name: '北見', region: '北海道', ref: 'sapporo', lat: 43.8031, lng: 143.8939, nearestHub: 'sapporo', pref: '北海道' },
  // 東北
  { name: '秋田', region: '東北', ref: 'sendai', lat: 39.7186, lng: 140.1023, nearestHub: 'sendai', pref: '秋田県' },
  { name: '山形', region: '東北', ref: 'sendai', lat: 38.2404, lng: 140.3633, nearestHub: 'sendai', pref: '山形県' },
  { name: '福島', region: '東北', ref: 'sendai', lat: 37.7608, lng: 140.4748, nearestHub: 'sendai', pref: '福島県' },
  { name: '八戸', region: '東北', ref: 'sendai', lat: 40.5122, lng: 141.4883, nearestHub: 'sendai', pref: '青森県' },
  // 関東
  { name: '水戸', region: '関東', ref: 'tokyo', lat: 36.3418, lng: 140.4468, nearestHub: 'tokyo-o', pref: '茨城県' },
  { name: '前橋', region: '関東', ref: 'tokyo', lat: 36.3894, lng: 139.0634, nearestHub: 'tokyo-o', pref: '群馬県' },
  { name: '高崎', region: '関東', ref: 'tokyo', lat: 36.3228, lng: 139.0030, nearestHub: 'tokyo-o', pref: '群馬県' },
  // 中部
  { name: '浜松', region: '中部', ref: 'nagoya', lat: 34.7108, lng: 137.7261, nearestHub: 'nagoya', pref: '静岡県' },
  { name: '岐阜', region: '中部', ref: 'nagoya', lat: 35.4232, lng: 136.7608, nearestHub: 'nagoya', pref: '岐阜県' },
  { name: '福井', region: '中部', ref: 'osaka',  lat: 36.0652, lng: 136.2216, nearestHub: 'kanazawa', pref: '福井県' },
  { name: '甲府', region: '中部', ref: 'tokyo',  lat: 35.6635, lng: 138.5686, nearestHub: 'tokyo-o', pref: '山梨県' },
  // 近畿
  { name: '新宮', region: '近畿', ref: 'osaka', lat: 33.7208, lng: 135.9850, nearestHub: 'osaka-k', pref: '和歌山県' },
  { name: '田辺', region: '近畿', ref: 'osaka', lat: 33.7333, lng: 135.3833, nearestHub: 'osaka-k', pref: '和歌山県' },
  { name: '白浜', region: '近畿', ref: 'osaka', lat: 33.6833, lng: 135.3500, nearestHub: 'osaka-k', pref: '和歌山県' },
  { name: '串本', region: '近畿', ref: 'osaka', lat: 33.4736, lng: 135.7753, nearestHub: 'osaka-k', pref: '和歌山県' },
  // 中国
  { name: '鳥取', region: '中国', ref: 'osaka',   lat: 35.5036, lng: 134.2381, nearestHub: 'osaka-k', pref: '鳥取県' },
  { name: '山口', region: '中国', ref: 'osaka',   lat: 34.1861, lng: 131.4706, nearestHub: 'hiroshima', pref: '山口県' },
  { name: '下関', region: '中国', ref: 'fukuoka', lat: 33.9500, lng: 130.9167, nearestHub: 'fukuoka', pref: '山口県' },
  // 九州
  { name: '佐賀', region: '九州', ref: 'fukuoka', lat: 33.2494, lng: 130.2989, nearestHub: 'fukuoka', pref: '佐賀県' },
  { name: '大分', region: '九州', ref: 'fukuoka', lat: 33.2382, lng: 131.6126, nearestHub: 'fukuoka', pref: '大分県' },
  { name: '別府', region: '九州', ref: 'fukuoka', lat: 33.2847, lng: 131.4911, nearestHub: 'fukuoka', pref: '大分県' },
  // 沖縄
  { name: '石垣', region: '沖縄', ref: 'naha', lat: 24.3408, lng: 124.1556, nearestHub: 'naha', pref: '沖縄県' },
  { name: '宮古', region: '沖縄', ref: 'naha', lat: 24.8056, lng: 125.2814, nearestHub: 'naha', pref: '沖縄県' },
];

const PROXIMITY_MAP = {
  '釧路': ['北海道'], '帯広': ['北海道'], '北見': ['北海道'],
  '秋田': ['東北'],   '山形': ['東北'],   '福島': ['東北'],   '八戸': ['東北'],
  '水戸': ['関東'],   '前橋': ['関東'],   '高崎': ['関東'],
  '浜松': ['静岡', '愛知'],
  '岐阜': ['岐阜', '愛知'],
  '福井': ['福井', '石川'],
  '甲府': ['山梨', '長野'],
  '新宮': ['和歌山', '三重'], '田辺': ['和歌山'], '白浜': ['和歌山'], '串本': ['和歌山'],
  '鳥取': ['鳥取', '島根'],
  '山口': ['山口'],
  '下関': ['山口', '福岡'],
  '佐賀': ['佐賀', '福岡'],
  '大分': ['大分'],
  '別府': ['大分'],
  '石垣': ['沖縄'],
  '宮古': ['沖縄'],
};

const destFile = path.join(__dirname, '../src/data/destinations.json');
const destinations = JSON.parse(fs.readFileSync(destFile, 'utf8'));

let updatedCount = 0;
destinations.forEach(dest => {
  newDepartures.forEach(dep => {
    const targetRegions = PROXIMITY_MAP[dep.name] || [];
    if (targetRegions.some(r => dest.region?.includes(r) || dest.prefecture?.includes(r))) {
      if (!dest.departures) dest.departures = [];
      if (!dest.departures.includes(dep.name)) {
        dest.departures.push(dep.name);
        updatedCount++;
      }
    }
  });
});

fs.writeFileSync(destFile, JSON.stringify(destinations, null, 2), 'utf8');
console.log(`✅ destinations.json 更新: ${updatedCount}件`);
console.log(`✅ 追加出発地: ${newDepartures.length}都市`);
newDepartures.forEach(d => console.log(`   ${d.name}（${d.pref}）`));
