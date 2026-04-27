/**
 * 修正5: 青森 daytrip 対応
 *   A) 既存13件: stayAllowed / departures / travelTime.aomori を修正
 *   B) 新規2件: 八甲田山 (hakkoda) / 三内丸山遺跡 (sannai-maruyama) を追加
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEST_FILE = path.join(__dirname, '../src/data/destinations.json');

const data = JSON.parse(fs.readFileSync(DEST_FILE, 'utf-8'));

// ── 修正5-A: 既存エントリ修正 ────────────────────────────────────────────
const FIXES_A = {
  'hirosaki': {
    departures: ['仙台', '東京', '青森'],
  },
  'oirase': {
    stayAllowed: ['daytrip', '1night'],
    departures: ['仙台', '東京', '青森'],
  },
  'osorezan': {
    stayAllowed: ['daytrip', '1night'],
    departures: ['盛岡', '仙台', '青森'],
  },
  'towada-lake': {
    stayAllowed: ['daytrip', '1night'],
  },
  'shimokita': {
    stayAllowed: ['daytrip', '1night', '2night'],
  },
  'tanesashi': {
    departures: ['東京', '仙台', '青森'],
    travelTime: { aomori: 85 },
  },
  'gen_青森_浅虫温泉': {
    departures: ['札幌', '仙台', '東京', '名古屋', '大阪', '広島', '福岡', '青森'],
    travelTime: { aomori: 30 },
  },
  'gen_青森_酸ヶ湯': {
    departures: ['札幌', '仙台', '東京', '名古屋', '大阪', '広島', '福岡', '青森'],
    travelTime: { aomori: 55 },
  },
  'gen_青森_蔦温泉': {
    departures: ['札幌', '仙台', '東京', '名古屋', '大阪', '広島', '福岡', '青森'],
    travelTime: { aomori: 100 },
  },
  'gen_青森_大鰐温泉': {
    departures: ['札幌', '仙台', '東京', '名古屋', '大阪', '広島', '福岡', '青森'],
    travelTime: { aomori: 35 },
  },
  'towada': {
    stayAllowed: ['daytrip', '1night'],
    departures: ['仙台', '盛岡', '青森'],
  },
  'gonosen': {
    stayAllowed: ['daytrip', '1night'],
    departures: ['東京', '仙台', '青森'],
  },
  'akita': {
    stayAllowed: ['daytrip', '1night'],
    departures: ['仙台', '盛岡', '青森'],
  },
};

let fixedCount = 0;
for (const dest of data) {
  const fix = FIXES_A[dest.id];
  if (!fix) continue;
  if (fix.travelTime) {
    dest.travelTime = { ...dest.travelTime, ...fix.travelTime };
    const { travelTime: _, ...rest } = fix;
    Object.assign(dest, rest);
  } else {
    Object.assign(dest, fix);
  }
  console.log(`✅ 修正5-A: ${dest.id} (${dest.name})`);
  fixedCount++;
}
console.log(`  → ${fixedCount}件修正\n`);

// ── 修正5-B: 新規2件追加 ────────────────────────────────────────────────
const NEW_DESTS = [
  {
    id: 'hakkoda',
    name: '八甲田山',
    type: 'destination',
    region: '東北',
    hub: 'morioka',
    hubCity: '青森',
    stayAllowed: ['daytrip', '1night'],
    departures: ['青森'],
    weight: 1.2,
    description: '東北最大の火山群。ブナ林と湿原が広がり、冬はロープウェイからの樹氷が絶景。四季折々の自然が深い。',
    catch: '樹氷の海。青森からたった50分で、こんな世界がある。',
    tags: ['自然', '山', '絶景', '冬', '春'],
    spots: ['八甲田ロープウェイ', '田代平湿原', '睡蓮沼'],
    shinkansenAccess: false,
    requiresCar: true,
    hotelSearch: '青森 八甲田',
    gateways: {
      rail: ['新青森駅'],
      airport: [],
      bus: ['青森駅'],
      ferry: [],
    },
    accessHub: '青森',
    railNote: 'バス・レンタカー',
    secondaryTransport: 'bus',
    destType: 'mountain',
    railGateway: '新青森駅',
    busGateway: null,
    ferryGateway: null,
    airportGateway: null,
    hasDirectFlight: false,
    prefecture: '青森県',
    city: '青森市',
    lat: 40.7733,
    lng: 140.8497,
    stayBias: 0,
    stayRecommendation: '1night',
    railProvider: 'ekinet',
    travelTime: {
      tokyo: 250,
      nagoya: 310,
      osaka: 390,
      takamatsu: 450,
      fukuoka: 460,
      aomori: 50,
    },
    hubStation: '新青森駅',
    accessStation: '新青森駅',
    hotelArea: 'aomori',
    accessType: 'car',
    hotelKeyword: '八甲田',
    gateway: null,
    gatewayStations: [
      { name: '新青森駅', type: 'shinkansen', priority: 1 },
    ],
    situations: ['couple', 'friends', 'solo'],
  },
  {
    id: 'sannai-maruyama',
    name: '三内丸山遺跡',
    type: 'destination',
    region: '東北',
    hub: 'morioka',
    hubCity: '青森',
    stayAllowed: ['daytrip'],
    departures: ['青森'],
    weight: 1.0,
    description: '縄文時代最大級の集落跡。六本柱の大型掘立柱建物が復元された広大な遺跡で、5500年前の暮らしを体感できる。',
    catch: '5500年前の集落が青森にある。縄文のスケールに圧倒される。',
    tags: ['歴史', '文化', '遺跡'],
    spots: ['六本柱建物跡', '大型竪穴建物', '縄文時遊館'],
    shinkansenAccess: false,
    requiresCar: false,
    hotelSearch: '青森',
    gateways: {
      rail: ['新青森駅'],
      airport: [],
      bus: ['青森駅'],
      ferry: [],
    },
    accessHub: '青森',
    railNote: 'バス',
    secondaryTransport: 'bus',
    destType: 'sight',
    railGateway: '新青森駅',
    busGateway: null,
    ferryGateway: null,
    airportGateway: null,
    hasDirectFlight: false,
    prefecture: '青森県',
    city: '青森市',
    lat: 40.6847,
    lng: 140.6417,
    stayBias: 0,
    stayRecommendation: 'daytrip',
    railProvider: 'ekinet',
    travelTime: {
      tokyo: 235,
      nagoya: 295,
      osaka: 375,
      takamatsu: 435,
      fukuoka: 445,
      aomori: 20,
    },
    hubStation: '新青森駅',
    accessStation: '新青森駅',
    hotelArea: 'aomori',
    accessType: 'bus',
    hotelKeyword: '青森',
    gateway: null,
    gatewayStations: [
      { name: '新青森駅', type: 'shinkansen', priority: 1 },
    ],
    situations: ['couple', 'friends', 'solo', 'family'],
  },
];

let addedCount = 0;
for (const newDest of NEW_DESTS) {
  if (data.some(d => d.id === newDest.id)) {
    console.log(`⚠️  SKIP (既存): ${newDest.id}`);
    continue;
  }
  data.push(newDest);
  console.log(`✅ 追加5-B: ${newDest.id} (${newDest.name})`);
  addedCount++;
}
console.log(`  → ${addedCount}件追加\n`);

fs.writeFileSync(DEST_FILE, JSON.stringify(data, null, 2), 'utf-8');
console.log(`完了: 修正${fixedCount}件 + 追加${addedCount}件 → 総計${data.length}件`);
