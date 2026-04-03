/**
 * addGateway.mjs
 *
 * destinations.json に gateway フィールドを追加する。
 *
 * gateway = JR主要駅（乗り換え拠点）。
 * ここから目的地へローカル線・バス等でアクセスする。
 *
 * 導出ルール:
 *   1. hubStation !== accessStation → gateway = hubStation
 *   2. 既知の支線目的地 → BRANCH_LINE_GATEWAYS で上書き
 *   3. それ以外 → gateway = null（直通アクセス）
 *
 * Usage: node scripts/addGateway.mjs
 */

import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const destsPath = join(ROOT, 'src/data/destinations.json');
const dests = JSON.parse(readFileSync(destsPath, 'utf8'));

/* ─── 支線・非幹線アクセス目的地の手動ゲートウェイ ─── */
const BRANCH_LINE_GATEWAYS = {
  // 越美北線（福井起点）
  'ono-fukui':  '福井駅',   // 越前大野
  'katsuyama':  '福井駅',   // 勝山（えちぜん鉄道）

  // 飛騨高山方面（JR高山本線 名古屋起点）
  'gero-onsen':       '名古屋駅', // 下呂温泉（特急ひだで名古屋から直通）
  'hida-furukawa':    '高山駅',   // 飛騨古川（高山本線）

  // 山形鉄道フラワー長井線
  'nagai': '米沢駅',

  // 三陸鉄道・BRT区間
  'ryoishi': '釜石駅',   // 綾里（三陸鉄道南リアス線）

  // 紀勢本線（名古屋から特急南紀）
  'owase': '名古屋駅',   // 尾鷲（南紀で名古屋から直通）
};

let gatewayAdded = 0;
let gatewayFromHub = 0;
let gatewayNull = 0;
let hubFixed = 0;

for (const dest of dests) {
  const hubSt    = dest.hubStation ?? null;
  const accessSt = dest.accessStation ?? null;

  let gateway = null;

  // ① 手動オーバーライド（支線目的地）
  if (BRANCH_LINE_GATEWAYS[dest.id]) {
    gateway = BRANCH_LINE_GATEWAYS[dest.id];
    // hubStation も修正（accessStation と同じだった場合）
    if (hubSt === accessSt) {
      dest.hubStation = gateway;
      hubFixed++;
    }
    gatewayAdded++;
  }
  // ② hubStation が accessStation と異なる → そのまま gateway に
  else if (hubSt && accessSt && hubSt !== accessSt) {
    gateway = hubSt;
    gatewayFromHub++;
  }
  // ③ 直通アクセス → gateway = null
  else {
    gatewayNull++;
  }

  dest.gateway = gateway;
}

writeFileSync(destsPath, JSON.stringify(dests, null, 2) + '\n', 'utf8');

console.log('gateway フィールド追加完了:');
console.log(`  手動設定 (支線): ${gatewayAdded} 件`);
console.log(`  hubStation より: ${gatewayFromHub} 件`);
console.log(`  null (直通):     ${gatewayNull} 件`);
console.log(`  hubStation 修正: ${hubFixed} 件`);
console.log(`  合計: ${dests.length} 件`);
