#!/usr/bin/env node
/**
 * add-transport.cjs
 * destinations.json の各エントリに transport フィールドを追加し、
 * distanceStars の誤りを修正するスクリプト。
 */

'use strict';

const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../src/data/destinations.json');
const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

// ===== distanceStars 修正マップ =====
const distanceCorrections = {
  'sendai-t': 2,      // 東京→仙台 1h40min → ★2
  'okayama-o': 1,     // 大阪→岡山 45min → ★1
  'hiroshima-o': 2,   // 大阪→広島 1h30min → ★2
  'wakayama': 2,      // 大阪→和歌山 1h → ★2
};

// ===== privateRail の railGateway セット =====
const privateRailGateways = new Set([
  '箱根湯本駅',   // 小田急・箱根登山鉄道
  '有馬温泉駅',   // 阪急・神鉄
  '高野山駅',     // 南海高野線
  '修善寺駅',     // 伊豆箱根鉄道
  '琴平駅',       // 高松琴平電鉄(琴電)
]);

// car が主要な id セット
const carPrimaryIds = new Set([
  'shiretoko',
  'aso-f',
  'aso-kumamoto',
]);

// bus が主要な id セット（高速バス or 路線バスが唯一の手段）
const busDestinations = {
  'ryujin-onsen':   ['御坊駅', '和歌山駅'],
  'shirakawago-t':  ['新宿駅', '東京駅'],
  'shirakawago-n':  ['名鉄バスセンター'],
  'shirakawago-k':  ['金沢駅'],
  'awaji':          ['三ノ宮駅', '大阪駅'],
  'takachiho':      ['延岡駅', '熊本駅'],
  'kurokawa-onsen': ['博多駅', '熊本駅'],
  'fujikawaguchiko':['新宿駅'],
};

function classifyTransport(entry) {
  const id = entry.id;
  const access = entry.access;
  const { railGateway, railNote, airportGateway, ferryGateway } = access;

  // 1. car 専用エントリ
  if (carPrimaryIds.has(id)) {
    const result = { main: 'car' };
    if (railGateway) result.railGateway = railGateway;
    return result;
  }

  // 2. ferry のみ（rail/air なし）
  if (ferryGateway && !railGateway && !airportGateway) {
    return { main: 'ferry' };
  }

  // 3. air のみ（rail なし）
  if (airportGateway && !railGateway) {
    return { main: 'air', airport: airportGateway };
  }

  // 4. privateRail
  if (railGateway && privateRailGateways.has(railGateway)) {
    return { main: 'privateRail', railGateway };
  }

  // 5. bus
  if (busDestinations[id]) {
    const result = { main: 'bus', busFrom: busDestinations[id] };
    if (railGateway) result.railGateway = railGateway;
    return result;
  }

  // 6. jr (rail あり)
  if (railGateway) {
    const result = { main: 'jr', railGateway };
    if (airportGateway) result.airport = airportGateway;
    return result;
  }

  // 7. ferry フォールバック
  if (ferryGateway) {
    return { main: 'ferry' };
  }

  // 8. air フォールバック
  if (airportGateway) {
    return { main: 'air', airport: airportGateway };
  }

  // 9. car フォールバック
  return { main: 'car' };
}

// ===== メイン処理 =====
let corrections = 0;
let additions = 0;

const updated = data.map(entry => {
  // spot-* / access フィールドなし → スキップ
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

  // キー順序を保ちつつ access の直後に transport を挿入
  const result = {};
  for (const key of Object.keys(entry)) {
    if (key === 'transport') continue; // 古い transport は除去
    result[key] = entry[key];
    if (key === 'access') {
      result['transport'] = transport;
      additions++;
    }
  }

  // access がなかった場合（到達しないはずだが念のため）
  if (!result['transport']) {
    result['transport'] = transport;
    additions++;
  }

  return result;
});

fs.writeFileSync(filePath, JSON.stringify(updated, null, 2), 'utf-8');

console.log('Done.');
console.log(`  Entries processed: ${data.length} total`);
console.log(`  transport fields added: ${additions}`);
console.log(`  distanceStars corrected: ${corrections}`);
