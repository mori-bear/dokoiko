// scripts/fixSecretPlaces.js
// addSecretPlaces20.js で発生したQAエラーを修正する
// node scripts/fixSecretPlaces.js

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DESTS_PATH   = path.join(__dirname, '../src/data/destinations.json');
const PORTS_PATH   = path.join(__dirname, '../src/data/ports.json');
const FERRIES_PATH = path.join(__dirname, '../src/data/ferries.json');

const dests   = JSON.parse(fs.readFileSync(DESTS_PATH,   'utf-8'));
const ports   = JSON.parse(fs.readFileSync(PORTS_PATH,   'utf-8'));
const ferries = JSON.parse(fs.readFileSync(FERRIES_PATH, 'utf-8'));

// ── 1. ports.json に新規港を追加 ─────────────────────────────────────

const NEW_PORTS = [
  { port: '古仁屋港',  city: '瀬戸内町', prefecture: '鹿児島', lat: 28.3167, lng: 129.4167, accessType: 'flight',  nearestNode: '奄美空港', method: 'バス', hubProvider: null },
  { port: '酒田港',    city: '酒田',     prefecture: '山形',   lat: 38.9111, lng: 139.8333, accessType: 'rail',    nearestNode: '酒田駅',   method: '徒歩', hubProvider: 'ekinet' },
  { port: '岩船港',    city: '村上',     prefecture: '新潟',   lat: 38.4500, lng: 139.3833, accessType: 'rail',    nearestNode: '村上駅',   method: 'バス', hubProvider: 'ekinet' },
  { port: '平良港',    city: '宮古島',   prefecture: '沖縄',   lat: 24.8050, lng: 125.2819, accessType: 'flight',  nearestNode: '宮古空港', method: 'バス', hubProvider: null },
  { port: '萩港',      city: '萩',       prefecture: '山口',   lat: 34.3958, lng: 131.3792, accessType: 'rail',    nearestNode: '東萩駅',   method: 'バス', hubProvider: 'e5489' },
  { port: '牛深港',    city: '天草市',   prefecture: '熊本',   lat: 32.2100, lng: 130.0300, accessType: 'flight',  nearestNode: '熊本空港', method: 'バス', hubProvider: 'jrkyushu' },
  { port: '羽幌港',    city: '羽幌',     prefecture: '北海道', lat: 44.3611, lng: 141.7003, accessType: 'flight',  nearestNode: '旭川空港', method: 'バス', hubProvider: null },
];

const existingPorts = new Set(ports.map(p => p.port));
let portsAdded = 0;
for (const p of NEW_PORTS) {
  if (!existingPorts.has(p.port)) {
    ports.push(p);
    portsAdded++;
    console.log(`港追加: ${p.port}`);
  }
}
fs.writeFileSync(PORTS_PATH, JSON.stringify(ports, null, 2), 'utf-8');
console.log(`✓ ports.json: ${portsAdded}件追加\n`);

// ── 2. ferries.json に新規フェリー路線を追加 ──────────────────────────

const NEW_FERRIES = [
  { destId: 'kakeroma-island',    destName: '加計呂麻島', from: '古仁屋港', to: '加計呂麻島', operator: '瀬戸内町フェリー',      url: 'https://town.setouchi.lg.jp/' },
  { destId: 'tobishima-island',   destName: '飛島',       from: '酒田港',   to: '飛島',       operator: '酒田市フェリー',          url: 'https://www.city.sakata.lg.jp/' },
  { destId: 'awashima-island',    destName: '粟島',       from: '岩船港',   to: '粟島',       operator: '粟島汽船',                url: 'https://awashimakisen.jp/' },
  { destId: 'tarama-island',      destName: '多良間島',   from: '平良港',   to: '多良間島',   operator: '宮古フェリー',            url: 'https://miyako-ferry.co.jp/' },
  { destId: 'mishima-yamaguchi',  destName: '見島',       from: '萩港',     to: '見島',       operator: '萩市営フェリー',          url: 'https://www.city.hagi.lg.jp/' },
  { destId: 'teuri-island',       destName: '天売島',     from: '羽幌港',   to: '天売島',     operator: 'ハートランドフェリー',    url: 'https://heartlandferry.jp/' },
  { destId: 'ushibuka',           destName: '牛深',       from: '牛深港',   to: '蔵之元港',   operator: '天草宝島ライン',          url: 'https://takarajima-line.co.jp/' },
];

const existingFerryDestIds = new Set(ferries.map(f => f.destId));
let ferriesAdded = 0;
for (const f of NEW_FERRIES) {
  if (!existingFerryDestIds.has(f.destId)) {
    ferries.push(f);
    ferriesAdded++;
    console.log(`フェリー追加: ${f.destName} (${f.from} → ${f.to})`);
  }
}
fs.writeFileSync(FERRIES_PATH, JSON.stringify(ferries, null, 2), 'utf-8');
console.log(`✓ ferries.json: ${ferriesAdded}件追加\n`);

// ── 3. destination の個別修正 ─────────────────────────────────────────

const fixes = {
  // 大三島: 橋でつながる島 → island→sight に変更、isIsland削除
  'omishima-island': d => {
    d.destType = 'sight';
    d.isIsland = false;
    d.railGateway = '今治駅';
    d.gateways = { rail: ['今治駅'], airport: [], bus: ['大三島BS'], ferry: [] };
    console.log('fix: 大三島 → destType=sight, gateway=今治駅');
  },
  // 牛深: ferryGateway を追加（牛深港）
  'ushibuka': d => {
    d.ferryGateway = '牛深港';
    d.gateways = { rail: [], airport: [], bus: ['牛深'], ferry: ['牛深港'] };
    console.log('fix: 牛深 → ferryGateway=牛深港');
  },
  // 湯野上温泉: mapPointが駅名 → 観光スポットに変更
  'yunokami-onsen': d => {
    d.mapPoint = '塔のへつり';
    console.log('fix: 湯野上温泉 → mapPoint=塔のへつり');
  },
  // 与論島: hasDirectFlight=true だがルート未定義
  'yoron-island': d => {
    d.hasDirectFlight = false;
    console.log('fix: 与論島 → hasDirectFlight=false');
  },
};

for (const [id, fixFn] of Object.entries(fixes)) {
  const d = dests.find(x => x.id === id);
  if (d) fixFn(d);
  else console.warn(`⚠ 見つからない: ${id}`);
}

fs.writeFileSync(DESTS_PATH, JSON.stringify(dests, null, 2), 'utf-8');
console.log('\n✓ destinations.json 修正完了');
