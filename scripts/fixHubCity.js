import fs   from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEST_FILE = path.join(__dirname, '../src/data/destinations.json');

// fixAllHotels.js の KEYWORD_OVERRIDES_STATIC キーと一致 → hubCity 変更しない
const STATIC_OVERRIDE_KEYS = [
  '霧島', '霧島温泉', '阿蘇', '日田', '高山', '高千穂',
  '黒川', '別府', '湯布院', '由布院', '草津', '箱根',
  '軽井沢', '白川郷', '知床', '屋久島',
];
function isInStaticOverrides(name) {
  return STATIC_OVERRIDE_KEYS.some(k => name.includes(k));
}

// 駅・空港・港などの地物名称から都市名を抽出
const LOCATION_SUFFIXES = [
  '国際空港', 'バスターミナル', 'ターミナル', 'バス停',
  '空港', '港', '駅', '市街',
];
function extractCity(locationName) {
  if (!locationName) return null;
  let city = locationName;
  for (const s of LOCATION_SUFFIXES) {
    if (city.endsWith(s)) {
      city = city.slice(0, -s.length);
      break;
    }
  }
  return city.trim() || null;
}

const data = JSON.parse(fs.readFileSync(DEST_FILE, 'utf-8'));

// 対象: sight / remote / mountain のみ
const TARGET_DEST_TYPES = new Set(['sight', 'remote', 'mountain']);

let modifiedCount = 0;
let hotelLinksResetCount = 0;
const samples = [];

for (const dest of data) {
  if (dest.type !== 'destination') continue;

  const name     = dest.name || '';
  const destType = dest.destType || '';
  const hubCity  = dest.hubCity || '';
  const hubSt    = dest.hubStation  || '';
  const railGW   = dest.railGateway || '';

  // 対象: sight / remote / mountain のみ（city / peninsula / onsen / island / town は除外）
  if (!TARGET_DEST_TYPES.has(destType)) continue;

  // hubCity が自分自身または未設定か
  const hubIsSelf = !hubCity || hubCity === name;
  if (!hubIsSelf) continue;

  // 除外: KEYWORD_OVERRIDES_STATIC 登録済み
  if (isInStaticOverrides(name)) continue;

  // hubCity の推定（優先順位: hubStation > railGateway）
  const newHubCity = extractCity(hubSt) || extractCity(railGW);

  if (!newHubCity || newHubCity === name) continue;

  // 修正適用
  const oldHub = dest.hubCity || '(未設定)';
  dest.hubCity    = newHubCity;
  dest.hotelLinks = null;
  modifiedCount++;
  hotelLinksResetCount++;

  if (samples.length < 10) {
    samples.push({ id: dest.id, name, destType, oldHub, newHubCity });
  }
}

fs.writeFileSync(DEST_FILE, JSON.stringify(data, null, 2), 'utf-8');

console.log(`修正件数: ${modifiedCount}`);
console.log(`hotelLinks リセット件数: ${hotelLinksResetCount}`);
console.log(`\n代表 ${samples.length} 件:`);
for (const s of samples) {
  console.log(`  ${s.id} | ${s.name} (${s.destType}) | ${s.oldHub} → ${s.newHubCity}`);
}
