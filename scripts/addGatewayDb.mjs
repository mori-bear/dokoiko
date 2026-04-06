/**
 * addGatewayDb.mjs
 *
 * Gateway Database 構造を destinations.json に追加する。
 *
 * 追加フィールド:
 *   gatewayStations  [{name, type, priority}]  — JR主要駅・空港の入口リスト
 *   localAccess      {type, description, to}    — gateway → 目的地のローカルアクセス
 *   situations       ["solo","couple","friends"] — 対象旅行スタイル
 *
 * Usage: node scripts/addGatewayDb.mjs
 */

import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const destsPath = join(ROOT, 'src/data/destinations.json');

const dests = JSON.parse(readFileSync(destsPath, 'utf8'));

/* ─── 新幹線停車駅セット（type判定用） ─── */
const SHINKANSEN_STATIONS = new Set([
  '東京駅','品川駅','新横浜駅','小田原駅','熱海駅','三島駅','新富士駅',
  '静岡駅','掛川駅','浜松駅','豊橋駅','三河安城駅','名古屋駅','岐阜羽島駅',
  '米原駅','京都駅','新大阪駅','新神戸駅','西明石駅','姫路駅','相生駅',
  '岡山駅','新倉敷駅','福山駅','新尾道駅','三原駅','東広島駅','広島駅',
  '新岩国駅','徳山駅','新山口駅','厚狭駅','新下関駅','小倉駅','博多駅',
  '上野駅','大宮駅','小山駅','宇都宮駅','那須塩原駅','新白河駅',
  '郡山駅','福島駅','白石蔵王駅','仙台駅','古川駅','くりこま高原駅',
  '一ノ関駅','水沢江刺駅','北上駅','新花巻駅','盛岡駅','二戸駅',
  '八戸駅','七戸十和田駅','新青森駅',
  '大曲駅','秋田駅','山形駅','天童駅','さくらんぼ東根駅','村山駅','大石田駅','新庄駅',
  '長野駅','飯山駅','上越妙高駅','糸魚川駅','黒部宇奈月温泉駅',
  '富山駅','新高岡駅','金沢駅','小松駅','加賀温泉駅','芦原温泉駅',
  '福井駅','越前たけふ駅','敦賀駅',
  '新鳥栖駅','久留米駅','筑後船小屋駅','新大牟田駅','新玉名駅',
  '熊本駅','新八代駅','新水俣駅','出水駅','川内駅','鹿児島中央駅',
  '長崎駅','諫早駅','嬉野温泉駅','武雄温泉駅',
  '新函館北斗駅',
]);

function gatewayType(stationName) {
  if (!stationName) return 'major';
  if (stationName.endsWith('空港') || stationName.includes('空港')) return 'airport';
  if (SHINKANSEN_STATIONS.has(stationName)) return 'shinkansen';
  return 'major';
}

/**
 * localAccess を構築する
 *  - gateway → accessStation の区間
 *  - destType / access.steps / requiresCar から判定
 */
function buildLocalAccess(dest) {
  const to = dest.accessStation ?? dest.name;
  const gw = dest.gateway;

  // gateway未設定 → localAccess不要（直通アクセス）
  if (!gw) return null;

  // gateway === accessStation → 直通（localAccess不要）
  if (gw === to) return null;

  // アクセス方法を判定
  let type = 'rail';
  let description = null;

  if (dest.requiresCar || dest.destType === 'mountain' || dest.destType === 'remote') {
    type = 'rental';
  } else if (dest.ferryGateway || dest.isIsland) {
    type = 'ferry';
    description = dest.ferryOperator ?? null;
  } else if (dest.busGateway || dest.secondaryTransport === 'bus' || dest.railNote === 'バス') {
    type = 'bus';
  } else if (dest.access?.steps) {
    // access.steps からローカル区間を推定
    const localStep = dest.access.steps.find(s => s.type === 'local');
    if (localStep?.method === 'バス') type = 'bus';
    else if (localStep?.method === 'フェリー') type = 'ferry';
    else if (localStep?.method === 'レンタカー') type = 'rental';
  }

  // description: gateway → to の説明
  if (!description && gw && to) {
    const gwBase = gw.replace(/駅$/, '');
    description = `${gwBase}から${to}へ`;
  }

  return { type, description, to };
}

let added = 0;
let updated = 0;

for (const dest of dests) {
  let changed = false;

  /* ── gatewayStations ── */
  if (!dest.gatewayStations) {
    const stations = [];

    // primary gateway
    if (dest.gateway) {
      stations.push({
        name:     dest.gateway,
        type:     gatewayType(dest.gateway),
        priority: 1,
      });
    }

    // airport gateway（副次的）
    if (dest.airportGateway && dest.airportGateway !== dest.gateway) {
      stations.push({
        name:     dest.airportGateway,
        type:     'airport',
        priority: 2,
      });
    }

    if (stations.length > 0) {
      dest.gatewayStations = stations;
      changed = true;
    }
  }

  /* ── localAccess ── */
  if (!dest.localAccess) {
    const la = buildLocalAccess(dest);
    if (la) {
      dest.localAccess = la;
      changed = true;
    }
  }

  /* ── situations ── */
  if (!dest.situations) {
    // デフォルト全スタイル対応
    // onsen/island は couple 向け強い; mountain は solo/friends 向け強い
    // 将来的には個別調整可能
    dest.situations = ['solo', 'couple', 'friends'];
    changed = true;
  }

  if (changed) {
    updated++;
  } else {
    added++;
  }
}

writeFileSync(destsPath, JSON.stringify(dests, null, 2) + '\n', 'utf8');

console.log('Gateway DB フィールド追加完了:');
console.log(`  更新: ${updated} 件`);
console.log(`  既存: ${added} 件（変更なし）`);

// 統計
const withGwStations = dests.filter(d => d.gatewayStations?.length > 0);
const withLocalAccess = dests.filter(d => d.localAccess);
const withSituations  = dests.filter(d => d.situations);
const withFinalPoint  = dests.filter(d => d.finalPoint);

console.log('\nフィールドカバレッジ:');
console.log(`  gatewayStations: ${withGwStations.length} / ${dests.length}`);
console.log(`  localAccess:     ${withLocalAccess.length} / ${dests.length}`);
console.log(`  situations:      ${withSituations.length} / ${dests.length}`);
console.log(`  finalPoint:      ${withFinalPoint.length} / ${dests.length}`);
