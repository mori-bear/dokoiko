// scripts/addNewDestinations.js
// 新規目的地を destinations.json に追加する（1回限り実行）
// node scripts/addNewDestinations.js

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DESTS_PATH = path.join(__dirname, '../src/data/destinations.json');

const dests = JSON.parse(fs.readFileSync(DESTS_PATH, 'utf-8'));

// 既存確認
const existingIds = new Set(dests.map(d => d.id));
const existingNames = new Set(dests.map(d => d.name));

const NEW_DESTINATIONS = [
  // ① 蔵王温泉（山形県・温泉）
  {
    id: 'zaou-onsen',
    name: '蔵王温泉',
    type: 'destination',
    region: '東北',
    hub: 'yamagata',
    stayAllowed: ['1night'],
    departures: ['仙台', '東京'],
    weight: 1.5,
    description: '硫黄の香りが漂う高原の温泉郷。冬は樹氷の絶景スキー場、夏は登山と温泉が楽しめる四季の聖地。',
    tags: ['温泉', 'スキー', '自然', '山'],
    spots: ['蔵王温泉大露天風呂', '樹氷高原', '刈田岳'],
    shinkansenAccess: false,
    requiresCar: false,
    hotelSearch: '蔵王温泉',
    gateways: {
      rail: ['山形駅'],
      airport: [],
      bus: ['蔵王温泉バスターミナル'],
      ferry: [],
    },
    accessHub: '山形',
    railNote: 'バス',
    secondaryTransport: 'bus',
    destType: 'onsen',
    railGateway: '山形駅',
    busGateway: '蔵王温泉バスターミナル',
    ferryGateway: null,
    airportGateway: null,
    prefecture: '山形県',
    lat: 38.3614,
    lng: 140.4467,
    stayBias: 1,
    airportHub: null,
    railProvider: 'ekinet',
    travelTime: {
      tokyo: 130,
      osaka: 280,
      nagoya: 240,
      fukuoka: 360,
      takamatsu: 330,
    },
    stayRecommendation: '1night',
    city: '山形市',
    hubStation: '山形駅',
    accessStation: '山形駅',
    hotelArea: 'yamagata',
    hotelKeyword: '蔵王温泉',
    access: {
      steps: [
        { type: 'rail', to: '山形駅', provider: 'えきねっと' },
        { type: 'local', from: '山形駅', to: '蔵王温泉バスターミナル', method: 'バス' },
      ],
    },
    fallbackCity: '山形',
    gateway: '山形駅',
    gatewayStations: [{ name: '山形駅', type: 'major', priority: 1 }],
    localAccess: { type: 'bus', from: '山形駅', to: '蔵王温泉バスターミナル' },
    situations: ['solo', 'couple', 'friends'],
    catch: '湯けむりの向こうに雪山が見えた。',
    primary: ['温泉', 'スキー'],
    secondary: ['自然', '山'],
    onsenLevel: 3,
    hasDirectFlight: false,
    mapPoint: '蔵王温泉大露天風呂',
    subType: 'onsen',
    stayDescription: '硫黄の湯に浸かって、夜は旅館でゆっくり過ごす。非日常が積み重なる温泉滞在。',
    hubCity: '蔵王温泉',
    stayPriority: 'high',
    representativeStation: '山形駅',
    finalAccess: { type: 'bus', from: '山形駅' },
    accessPoint: { type: 'station', name: '山形' },
    bookingStation: { name: '山形駅', company: 'JR' },
    mainSpot: '蔵王温泉大露天風呂',
    stayArea: { rakuten: '蔵王温泉', jalan: '蔵王温泉' },
  },

  // ② 美ヶ原（長野県・高原/山岳）
  {
    id: 'utsukushigahara',
    name: '美ヶ原',
    type: 'destination',
    region: '中部',
    hub: 'matsumoto-n',
    stayAllowed: ['1night'],
    departures: ['東京', '名古屋', '長野'],
    weight: 1.3,
    description: '標高2000mの溶岩台地に広がる日本最大の高原牧場。雲上の散歩道から北アルプスの全容を望む絶景の地。',
    tags: ['自然', '高原', '絶景', '山'],
    spots: ['美しの塔', '王ヶ頭', '牧場'],
    shinkansenAccess: false,
    requiresCar: true,
    hotelSearch: '美ヶ原',
    gateways: {
      rail: ['松本駅'],
      airport: [],
      bus: [],
      ferry: [],
    },
    accessHub: '松本',
    railNote: 'レンタカー',
    secondaryTransport: null,
    destType: 'mountain',
    railGateway: '松本駅',
    busGateway: null,
    ferryGateway: null,
    airportGateway: null,
    prefecture: '長野県',
    lat: 36.0976,
    lng: 138.0656,
    stayBias: 1,
    airportHub: null,
    railProvider: 'ekinet',
    travelTime: {
      tokyo: 160,
      osaka: 180,
      nagoya: 130,
      fukuoka: 330,
      takamatsu: 260,
    },
    stayRecommendation: '1night',
    city: '松本市',
    hubStation: '松本駅',
    accessStation: '松本駅',
    hotelArea: 'nagano',
    hotelKeyword: '美ヶ原',
    access: {
      steps: [
        { type: 'rail', to: '松本駅', provider: 'えきねっと' },
        { type: 'local', from: '松本駅', to: '美ヶ原高原', method: 'レンタカー' },
      ],
    },
    fallbackCity: '松本',
    gateway: '松本駅',
    gatewayStations: [{ name: '松本駅', type: 'major', priority: 1 }],
    localAccess: { type: 'car', from: '松本駅' },
    situations: ['solo', 'couple', 'friends'],
    catch: '雲の上に立ったら、全部見えた。',
    primary: ['自然', '絶景'],
    secondary: ['高原', '山'],
    onsenLevel: 0,
    hasDirectFlight: false,
    mapPoint: '美しの塔',
    subType: 'mountain',
    stayDescription: '高原の山小屋か松本市街の宿で1泊。翌朝の雲海が本番。',
    hubCity: '松本',
    stayPriority: 'medium',
    representativeStation: '松本駅',
    finalAccess: { type: 'car', from: '松本駅' },
    accessPoint: { type: 'station', name: '松本' },
    bookingStation: { name: '松本駅', company: 'JR' },
    mainSpot: '美しの塔',
    stayArea: { rakuten: '松本', jalan: '松本' },
  },

  // ③ 宇治（京都府・街歩き）
  {
    id: 'uji',
    name: '宇治',
    type: 'destination',
    region: '近畿',
    hub: 'kyoto-t',
    stayAllowed: ['daytrip', '1night'],
    departures: ['京都', '大阪', '奈良'],
    weight: 1.4,
    description: '世界遺産・平等院が建つ抹茶の聖地。宇治川沿いを歩き、茶室でいただく抹茶が旅の記憶に溶け込む。',
    tags: ['寺社', '抹茶', '世界遺産', '街歩き'],
    spots: ['平等院', '宇治上神社', '源氏物語ミュージアム'],
    shinkansenAccess: false,
    requiresCar: false,
    hotelSearch: '宇治',
    gateways: {
      rail: ['宇治駅', 'JR宇治駅'],
      airport: [],
      bus: [],
      ferry: [],
    },
    accessHub: null,
    railNote: null,
    secondaryTransport: null,
    destType: 'city',
    railGateway: '宇治駅',
    busGateway: null,
    ferryGateway: null,
    airportGateway: null,
    prefecture: '京都府',
    lat: 34.8886,
    lng: 135.7993,
    stayBias: 0.8,
    airportHub: null,
    railProvider: 'e5489',
    travelTime: {
      tokyo: 210,
      osaka: 40,
      nagoya: 95,
      fukuoka: 175,
      takamatsu: 130,
    },
    stayRecommendation: 'daytrip',
    city: '宇治市',
    hubStation: '京都駅',
    accessStation: '宇治駅',
    hotelArea: 'kyoto',
    hotelKeyword: '宇治',
    access: {
      steps: [{ type: 'rail', to: '宇治駅', provider: 'e5489' }],
    },
    fallbackCity: '京都',
    gateway: '京都駅',
    gatewayStations: [{ name: '京都駅', type: 'major', priority: 1 }],
    localAccess: { type: 'rail', from: '京都駅', to: '宇治駅' },
    situations: ['solo', 'couple', 'friends'],
    catch: '平等院の鳳凰堂を見て、抹茶ソフトを食べた。それだけで十分だった。',
    primary: ['寺社', '抹茶'],
    secondary: ['街歩き', '世界遺産'],
    onsenLevel: 0,
    hasDirectFlight: false,
    mapPoint: '平等院',
    subType: 'urban',
    stayDescription: '宇治川沿いの旅館か京都市内のホテルを拠点に。早朝の平等院は空いていて美しい。',
    hubCity: '宇治',
    stayPriority: 'low',
    representativeStation: '宇治駅',
    finalAccess: { type: 'walk' },
    accessPoint: { type: 'station', name: '宇治' },
    bookingStation: { name: '京都駅', company: 'JR' },
    mainSpot: '平等院',
    stayArea: { rakuten: '宇治', jalan: '宇治' },
  },
];

let added = 0;
for (const dest of NEW_DESTINATIONS) {
  if (existingIds.has(dest.id)) {
    console.log(`スキップ（id重複）: ${dest.id}`);
    continue;
  }
  if (existingNames.has(dest.name)) {
    console.log(`スキップ（name重複）: ${dest.name}`);
    continue;
  }
  dests.push(dest);
  added++;
  console.log(`追加: ${dest.name}`);
}

fs.writeFileSync(DESTS_PATH, JSON.stringify(dests, null, 2), 'utf-8');
console.log(`\n✓ 完了: ${added}件追加 / 合計 ${dests.filter(d => d.type === 'destination').length}件`);
