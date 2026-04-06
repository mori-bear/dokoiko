/**
 * patchDestinations.js — destinations.jsonにrepresentativeStation/finalAccessを追加
 * + エリア名accessStationを実在駅に修正
 *
 * node scripts/patchDestinations.js
 */
import { readFileSync, writeFileSync } from 'node:fs';

const destPath = new URL('../src/data/destinations.json', import.meta.url);
const destinations = JSON.parse(readFileSync(destPath, 'utf8'));
const lifetraceStations = JSON.parse(readFileSync('/Users/moririn/MORI-LAB/projects/lifetrace-ios/LifeTrace/Data/GIS/stations.json', 'utf8'));

// 駅名セット
const stationNames = new Set();
for (const s of lifetraceStations) {
  stationNames.add(s.name);
  stationNames.add(s.name + '駅');
}

function isStation(name) {
  if (!name) return false;
  if (/空港$|港$|バスターミナル$|バス停$|フェリーターミナル$/.test(name)) return true;
  const clean = name.replace(/駅$/, '');
  return stationNames.has(clean) || stationNames.has(clean + '駅') || stationNames.has(name);
}

// エリア名 → 実在駅の手動マッピング（30件の修正）
const AREA_TO_STATION = {
  // 海岸・岬・橋・温泉地（駅名でないもの）
  '越前海岸':     { station: '武生駅',     finalAccess: 'car' },
  '角島大橋':     { station: '特牛駅',     finalAccess: 'car' },
  '旭岳温泉':     { station: '旭川駅',     finalAccess: 'bus' },
  '桂浜':         { station: '高知駅',     finalAccess: 'bus' },
  '室戸岬':       { station: '奈半利駅',   finalAccess: 'bus' },
  '竹田城跡':     { station: '竹田駅',     finalAccess: 'walk' },
  '大歩危小歩危': { station: '大歩危駅',   finalAccess: 'walk' },
  '鳥取砂丘':     { station: '鳥取駅',     finalAccess: 'bus' },
  '東尋坊':       { station: '芦原温泉駅', finalAccess: 'bus' },
  '三朝温泉':     { station: '倉吉駅',     finalAccess: 'bus' },
  '玉造温泉':     { station: '玉造温泉駅', finalAccess: 'walk' },
  '城崎温泉':     { station: '城崎温泉駅', finalAccess: 'walk' },
  '嬉野温泉':     { station: '嬉野温泉駅', finalAccess: 'walk' },
  '黒川温泉':     { station: '阿蘇駅',     finalAccess: 'bus' },
  '湯布院温泉':   { station: '由布院駅',   finalAccess: 'walk' },
  '指宿温泉':     { station: '指宿駅',     finalAccess: 'walk' },
  '銀山温泉':     { station: '大石田駅',   finalAccess: 'bus' },
  '乳頭温泉':     { station: '田沢湖駅',   finalAccess: 'bus' },
  '草津温泉':     { station: '長野原草津口駅', finalAccess: 'bus' },
  '万座温泉':     { station: '万座・鹿沢口駅', finalAccess: 'bus' },
  '四万温泉':     { station: '中之条駅',   finalAccess: 'bus' },
  '白骨温泉':     { station: '松本駅',     finalAccess: 'bus' },
  '奥飛騨温泉':   { station: '高山駅',     finalAccess: 'bus' },
  '白浜温泉':     { station: '白浜駅',     finalAccess: 'bus' },
  '龍神温泉':     { station: '紀伊田辺駅', finalAccess: 'bus' },
  '十和田湖':     { station: '八戸駅',     finalAccess: 'bus' },
  '奥入瀬渓流':   { station: '八戸駅',     finalAccess: 'bus' },
  '白神山地':     { station: '弘前駅',     finalAccess: 'bus' },
  '屋久島':       { station: '屋久島空港', finalAccess: 'bus' },
  '種子島':       { station: '種子島空港', finalAccess: 'car' },
  '阿蘇':         { station: '阿蘇駅',     finalAccess: 'car' },
  '霧島':         { station: '霧島神宮駅', finalAccess: 'bus' },
  '上高地':       { station: '松本駅',     finalAccess: 'bus' },
  '知床':         { station: '知床斜里駅', finalAccess: 'bus' },
  '積丹':         { station: '小樽駅',     finalAccess: 'bus' },
  '富良野':       { station: '富良野駅',   finalAccess: 'walk' },
  '美瑛':         { station: '美瑛駅',     finalAccess: 'walk' },
  '洞爺湖':       { station: '洞爺駅',     finalAccess: 'bus' },
  '支笏湖':       { station: '千歳駅',     finalAccess: 'bus' },
  '層雲峡':       { station: '上川駅',     finalAccess: 'bus' },
  '伊勢神宮':     { station: '伊勢市駅',   finalAccess: 'walk' },
  '熊野古道':     { station: '紀伊田辺駅', finalAccess: 'bus' },
  '高千穂':       { station: '延岡駅',     finalAccess: 'bus' },
  '石見銀山':     { station: '大田市駅',   finalAccess: 'bus' },
  '出雲大社':     { station: '出雲市駅',   finalAccess: 'bus' },
  '那智勝浦':     { station: '紀伊勝浦駅', finalAccess: 'walk' },
  '白川郷':       { station: '高山駅',     finalAccess: 'bus' },
  '五箇山':       { station: '高岡駅',     finalAccess: 'bus' },
};

let patched = 0;
let areaFixed = 0;
let alreadyStation = 0;

for (const d of destinations) {
  const access = d.accessStation || '';
  const name = d.displayName || d.name;

  // ① representativeStation を設定
  if (!d.representativeStation) {
    if (isStation(access)) {
      d.representativeStation = access;
      d.finalAccess = d.finalAccess || 'walk';
    } else if (AREA_TO_STATION[access]) {
      const fix = AREA_TO_STATION[access];
      d.representativeStation = fix.station;
      d.finalAccess = fix.finalAccess;
      areaFixed++;
    } else if (d.gateway || d.railGateway) {
      // gatewayを使用
      d.representativeStation = d.gateway || d.railGateway;
      d.finalAccess = d.finalAccess || 'bus';
    } else {
      // hubCityにfallback
      d.representativeStation = d.hubCity ? d.hubCity + '駅' : null;
      d.finalAccess = d.finalAccess || 'bus';
    }
    patched++;
  }
}

writeFileSync(destPath, JSON.stringify(destinations, null, 2) + '\n', 'utf8');

console.log(`=== パッチ完了 ===`);
console.log(`  patched: ${patched}`);
console.log(`  エリア名修正: ${areaFixed}`);
console.log(`  total destinations: ${destinations.length}`);

// 検証: representativeStation の設定率
const hasRep = destinations.filter(d => d.representativeStation).length;
const hasFinAccess = destinations.filter(d => d.finalAccess).length;
console.log(`  representativeStation: ${hasRep} / ${destinations.length}`);
console.log(`  finalAccess: ${hasFinAccess} / ${destinations.length}`);
