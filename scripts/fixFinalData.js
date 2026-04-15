// scripts/fixFinalData.js
// ① onsen系 stayArea を「温泉名」に統一
// ② 非JR / 実在しない bookingStation を修正
// ③ 龍神温泉など bookingStation 欠落を補完

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DESTS_PATH = path.join(__dirname, '../src/data/destinations.json');
const dests = JSON.parse(fs.readFileSync(DESTS_PATH, 'utf-8'));

// ── ① stayArea 上書きテーブル ────────────────────────────────────────
// id → { rakuten, jalan } を上書き
// 「温泉名」がある場合は温泉名を優先、なければ観光地名
const STAY_AREA_OVERRIDE = {
  // 温泉地：「温泉」を付けて検索精度を上げる
  'atami':            { rakuten: '熱海温泉',     jalan: '熱海温泉' },
  'beppu':            { rakuten: '別府温泉',     jalan: '別府温泉' },
  'hakone':           { rakuten: '箱根温泉',     jalan: '箱根温泉' },
  'shuzenji':         { rakuten: '修善寺温泉',   jalan: '修善寺温泉' },
  'shirahama':        { rakuten: '白浜温泉',     jalan: '白浜温泉' },
  'yufuin':           { rakuten: '湯布院温泉',   jalan: '湯布院温泉' },
  'zao':              { rakuten: '蔵王温泉',     jalan: '蔵王温泉' },
  'toyako':           { rakuten: '洞爺湖温泉',   jalan: '洞爺湖温泉' },
  'noboribetsu':      { rakuten: '登別温泉',     jalan: '登別温泉' },
  'ibusuki':          { rakuten: '指宿温泉',     jalan: '指宿温泉' },
  'jozankei':         { rakuten: '定山渓温泉',   jalan: '定山渓温泉' },
  'unzen':            { rakuten: '雲仙温泉',     jalan: '雲仙温泉' },
  'ikaho':            { rakuten: '伊香保温泉',   jalan: '伊香保温泉' },
  'echigoyuzawa':     { rakuten: '越後湯沢温泉', jalan: '越後湯沢温泉' },
  'yamaga':           { rakuten: '山鹿温泉',     jalan: '山鹿温泉' },
  'oga-onsen':        { rakuten: '男鹿温泉',     jalan: '男鹿温泉' },
  'akan':             { rakuten: '阿寒湖温泉',   jalan: '阿寒湖温泉' },
  'shikotsu':         { rakuten: '支笏湖温泉',   jalan: '支笏湖温泉' },
  'myokoukogen':      { rakuten: '妙高高原温泉', jalan: '妙高高原温泉' },
  'nikko':            { rakuten: '日光温泉',     jalan: '日光温泉' },
  // 龍神温泉：stayAreaが「白浜」になっているのを修正
  'ryujin-onsen':     { rakuten: '龍神温泉',     jalan: '龍神温泉' },
  // 田辺：white浜で宿検索が正しい（白浜温泉エリア）
  'tanabe':           { rakuten: '白浜温泉',     jalan: '白浜温泉' },
  // 小国：黒川温泉エリアで検索
  'oguni':            { rakuten: '黒川温泉',     jalan: '黒川温泉' },
  // 美作：湯郷温泉エリアで検索
  'mimasaka':         { rakuten: '湯郷温泉',     jalan: '湯郷温泉' },
  // 宮ノ下（箱根の一部）→ 箱根温泉
  'miyanoshita':      { rakuten: '箱根温泉',     jalan: '箱根温泉' },
};

// ── ② bookingStation 修正テーブル ────────────────────────────────────
// id → 正しい bookingStation（null = レンタカー）
const BOOKING_OVERRIDE = {
  // 龍神温泉: JR紀伊田辺駅からバスでアクセス
  'ryujin-onsen':     '紀伊田辺駅',
  // 道後温泉: 路面電車「道後温泉駅」→ JR松山駅
  'dogo-onsen':       '松山駅',
  // 太宰府: 西鉄のみ → JRアクセスなし → null
  'dazaifu':          null,
  // 柳川: 西鉄のみ → null
  'yanagawa':         null,
  // 江の島: 小田急・江ノ電のみ → JR藤沢駅
  'enoshima':         '藤沢駅',
  // 岬（大阪）: 南海みさき公園駅のみ → null
  'misaki-osaka':     null,
  // つくば: TXのみ → null
  'tsukuba':          null,
  // 琴平: 琴電ではなくJR琴平駅が実在する（JR土讃線）→ そのまま「琴平駅」
  // 伏見: 伏見稲荷 → JR稲荷駅（奈良線）あり → 稲荷駅
  'fushimi':          '稲荷駅',
  // 堺: 堺東駅（南海）→ JR堺市駅
  'sakai':            '堺市駅',
};

let stayFixed = 0, bookingFixed = 0;
const log = [];

for (const dest of dests) {
  if (dest.type !== 'destination') continue;

  // ① stayArea 修正
  const sa = STAY_AREA_OVERRIDE[dest.id];
  if (sa) {
    const prev = JSON.stringify(dest.stayArea);
    dest.stayArea = sa;
    log.push(`[stayArea] ${dest.name}(${dest.id}): ${prev} → ${JSON.stringify(sa)}`);
    stayFixed++;
  }

  // ② bookingStation 修正
  if (dest.id in BOOKING_OVERRIDE) {
    const newBs = BOOKING_OVERRIDE[dest.id];
    const prev = dest.bookingStation;
    if (prev !== newBs) {
      log.push(`[booking] ${dest.name}(${dest.id}): ${prev} → ${newBs}`);
      dest.bookingStation = newBs;
      bookingFixed++;
    }
  }
}

fs.writeFileSync(DESTS_PATH, JSON.stringify(dests, null, 2), 'utf-8');

console.log(`\nstayArea修正: ${stayFixed}件`);
console.log(`bookingStation修正: ${bookingFixed}件`);
console.log('\n--- 変更ログ ---');
log.forEach(l => console.log(l));
