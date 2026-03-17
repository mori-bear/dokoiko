#!/usr/bin/env node
/**
 * add-transport.js
 * destinations.json の各エントリに transport フィールドを追加し、
 * distanceStars の誤りを修正するスクリプト。
 */

import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const filePath = join(__dirname, '../src/data/destinations.json');

const data = JSON.parse(readFileSync(filePath, 'utf-8'));

// ===== distanceStars 修正マップ =====
// { id: correctedValue }
const distanceCorrections = {
  // 東京出発: 仙台 1h40min → ★2
  'sendai-t': 2,
  // 大阪出発: 岡山 45min → ★1
  'okayama-o': 1,
  // 大阪出発: 広島 1h30min → ★2
  'hiroshima-o': 2,
  // 大阪出発: 和歌山 1h → ★2
  'wakayama': 2,
};

// ===== transport 分類ロジック =====
// privateRail の駅名セット（主要交通が私鉄な目的地）
const privateRailGateways = new Set([
  '箱根湯本駅',   // 小田急・箱根登山鉄道
  '有馬温泉駅',   // 阪急・神鉄
  '高野山駅',     // 南海高野線
  '修善寺駅',     // 伊豆箱根鉄道
  '琴平駅',       // 高松琴平電鉄(琴電)
]);

// car が主要な id セット (needsCar=true かつ rail/air/ferry が補助的)
const carPrimaryIds = new Set([
  'shiretoko',
  'aso-f',
  'aso-kumamoto',
]);

function classifyTransport(entry) {
  const { access, needsCar, id } = entry;
  const { railGateway, railNote, airportGateway, ferryGateway } = access;

  // 1. 専用の car エントリ
  if (carPrimaryIds.has(id)) {
    return {
      main: 'car',
      railGateway: railGateway || undefined,
      airport: undefined,
      busFrom: undefined,
    };
  }

  // 2. ferry のみ（rail/air なし）
  if (ferryGateway && !railGateway && !airportGateway) {
    return {
      main: 'ferry',
      railGateway: undefined,
      airport: undefined,
      busFrom: undefined,
    };
  }

  // 3. air のみ（rail なし）
  if (airportGateway && !railGateway) {
    return {
      main: 'air',
      railGateway: undefined,
      airport: airportGateway,
      busFrom: undefined,
    };
  }

  // 4. privateRail
  if (railGateway && privateRailGateways.has(railGateway)) {
    return {
      main: 'privateRail',
      railGateway: railGateway,
      airport: undefined,
      busFrom: undefined,
    };
  }

  // 5. bus（railNote にバスあり or 龍神バス、かつ rail なし）
  // ※ railGateway があってもバスが最終手段な場合: shirakawago, awaji, ryujin, takachiho, kurokawa, fujikawaguchiko(highway bus)
  const busDestinations = new Set([
    'ryujin-onsen',
    'shirakawago-t',
    'shirakawago-n',
    'shirakawago-k',  // 金沢出発の白川郷
    'awaji',
    'takachiho',
    'kurokawa-onsen',
    'fujikawaguchiko', // 高速バスが主流
  ]);
  if (busDestinations.has(id)) {
    // busFrom: 出発地の主要バスターミナル or 駅名
    const busFromMap = {
      'ryujin-onsen': ['御坊駅', '和歌山駅'],
      'shirakawago-t': ['新宿駅', '東京駅'],
      'shirakawago-n': ['名鉄バスセンター'],
      'shirakawago-k': ['金沢駅'],
      'awaji': ['三ノ宮駅', '大阪駅'],
      'takachiho': ['延岡駅', '熊本駅'],
      'kurokawa-onsen': ['博多駅', '熊本駅'],
      'fujikawaguchiko': ['新宿駅'],
    };
    return {
      main: 'bus',
      railGateway: railGateway || undefined,
      airport: undefined,
      busFrom: busFromMap[id] || undefined,
    };
  }

  // 6. rail + railNote="バスあり" → 目的地最寄まで JR+バスだが分類は jr（バスは補足）
  // ただし mihonoseki, miyajima(ferry), 等は別途
  if (railGateway) {
    return {
      main: 'jr',
      railGateway: railGateway,
      airport: airportGateway || undefined,
      busFrom: undefined,
    };
  }

  // 7. フォールバック: ferry
  if (ferryGateway) {
    return {
      main: 'ferry',
      railGateway: undefined,
      airport: undefined,
      busFrom: undefined,
    };
  }

  // 8. フォールバック: air
  if (airportGateway) {
    return {
      main: 'air',
      railGateway: undefined,
      airport: airportGateway,
      busFrom: undefined,
    };
  }

  // 9. car フォールバック
  return {
    main: 'car',
    railGateway: undefined,
    airport: undefined,
    busFrom: undefined,
  };
}

// ===== メイン処理 =====
let corrections = 0;
let additions = 0;

const updated = data.map(entry => {
  // spot-* エントリ（access フィールドなし）はスキップ
  if (!entry.access || entry.id.startsWith('spot-')) {
    return entry;
  }

  // distanceStars 修正
  if (distanceCorrections[entry.id] !== undefined) {
    const oldVal = entry.distanceStars;
    entry.distanceStars = distanceCorrections[entry.id];
    if (oldVal !== entry.distanceStars) corrections++;
  }

  // transport フィールドを access の直後に挿入
  const transport = classifyTransport(entry);

  // undefined を除去（JSON にキーを残さない）
  const cleanTransport = {};
  cleanTransport.main = transport.main;
  if (transport.railGateway !== undefined) cleanTransport.railGateway = transport.railGateway;
  if (transport.airport !== undefined) cleanTransport.airport = transport.airport;
  if (transport.busFrom !== undefined) cleanTransport.busFrom = transport.busFrom;

  // 既存の transport があれば上書き、なければ access の直後に挿入
  const keys = Object.keys(entry);
  const accessIdx = keys.indexOf('access');

  // transport が既にある場合は除去して再挿入
  const filtered = {};
  for (const key of keys) {
    if (key === 'transport') continue;
    filtered[key] = entry[key];
    if (key === 'access') {
      filtered['transport'] = cleanTransport;
      additions++;
    }
  }

  // access が見つからなかった場合のフォールバック
  if (!filtered['transport']) {
    filtered['transport'] = cleanTransport;
    additions++;
  }

  return filtered;
});

writeFileSync(filePath, JSON.stringify(updated, null, 2), 'utf-8');

console.log(`Done.`);
console.log(`  Entries processed: ${updated.length}`);
console.log(`  transport fields added: ${additions}`);
console.log(`  distanceStars corrected: ${corrections}`);
