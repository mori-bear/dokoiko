/**
 * stationAudit.js — 全destinationのaccessStation/gateway/hubCityを駅DBで検証
 * node scripts/stationAudit.js
 */
import { readFileSync } from 'node:fs';

const destinations = JSON.parse(readFileSync(new URL('../src/data/destinations.json', import.meta.url), 'utf8'));
const lifetraceStations = JSON.parse(readFileSync('/Users/moririn/MORI-LAB/projects/lifetrace-ios/LifeTrace/Data/GIS/stations.json', 'utf8'));

// 駅名セット（「駅」なしでもマッチ）
const stationNames = new Set();
for (const s of lifetraceStations) {
  stationNames.add(s.name);
  stationNames.add(s.name + '駅');
}

function checkStation(name) {
  if (!name) return null;
  const clean = name.replace(/駅$/, '');
  return stationNames.has(clean) || stationNames.has(clean + '駅') || stationNames.has(name);
}

// 集計
const issues = [];
let noAccess = 0;
let accessOk = 0;
let accessMissing = 0;
let accessIsArea = 0;

for (const d of destinations) {
  const name = d.displayName || d.name;
  const access = d.accessStation;

  if (!access) {
    noAccess++;
    continue;
  }

  // 空港・港・バスターミナルはスキップ（駅DBにない）
  if (/空港$|港$|バスターミナル$|バス停$|フェリーターミナル$/.test(access)) {
    accessOk++;
    continue;
  }

  if (checkStation(access)) {
    accessOk++;
  } else {
    accessMissing++;
    // エリア名っぽい（「駅」がついていない）
    if (!access.endsWith('駅')) {
      accessIsArea++;
    }
    issues.push({
      id: d.id,
      name,
      accessStation: access,
      hubCity: d.hubCity || '',
      gateway: d.gateway || d.railGateway || '',
      isArea: !access.endsWith('駅'),
    });
  }
}

console.log('=== accessStation 検証結果 ===');
console.log(`  total: ${destinations.length}`);
console.log(`  accessStation設定あり: ${accessOk + accessMissing}`);
console.log(`  駅DB確認OK: ${accessOk}`);
console.log(`  駅DB未確認: ${accessMissing} (うちエリア名: ${accessIsArea})`);
console.log(`  accessStation未設定: ${noAccess}`);

if (issues.length > 0) {
  console.log(`\n=== 問題あり (${issues.length}件) ===`);
  for (const i of issues.slice(0, 30)) {
    console.log(`  ${i.id}: access="${i.accessStation}" hub="${i.hubCity}" gw="${i.gateway}" ${i.isArea ? '⚠エリア名' : ''}`);
  }
  if (issues.length > 30) console.log(`  ... 他 ${issues.length - 30}件`);
}

// gateway/hubCityも検証
let gwOk = 0, gwMissing = 0;
for (const d of destinations) {
  const gw = d.gateway || d.railGateway;
  if (!gw) continue;
  if (/空港$|港$/.test(gw)) { gwOk++; continue; }
  if (checkStation(gw)) gwOk++;
  else gwMissing++;
}
console.log(`\n=== gateway 検証 ===`);
console.log(`  OK: ${gwOk} / 未確認: ${gwMissing}`);

// representativeStation がないことを確認
const hasRepStation = destinations.filter(d => d.representativeStation).length;
console.log(`\n=== representativeStation ===`);
console.log(`  設定あり: ${hasRepStation} / ${destinations.length}`);
