/**
 * generateRoutesJson.js
 *
 * destinations.json の各フィールドから mainCTA / subCTA を決定し、
 * src/data/routes.json を生成する。
 *
 * mainCTA 優先順位:
 *   1. flight  — airportGateway あり（飛行機アクセス可）
 *   2. ferry   — ferryGateway あり
 *   3. rail    — railProvider あり / 地域から派生
 *
 * subCTA:
 *   requiresCar = true の場合のみ生成
 *   type: 'rental', from: レンタカー拠点名
 *
 * 生成後は手動で内容を確認・修正してください。
 * このスクリプトは初回生成用です（以降は routes.json を直接編集）。
 */

import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath }               from 'url';
import { dirname, join }               from 'path';

const __dir  = dirname(fileURLToPath(import.meta.url));
const root   = join(__dir, '..');

const destinations = JSON.parse(readFileSync(join(root, 'src/data/destinations.json'), 'utf8'));

/* 地域 → デフォルト鉄道 provider */
const REGION_PROVIDER = {
  '北海道': 'ekinet',
  '東北':   'ekinet',
  '関東':   'ekinet',
  '中部':   'e5489',
  '近畿':   'e5489',
  '中国':   'e5489',
  '四国':   'e5489',
  '九州':   'jrkyushu',
  '沖縄':   null,         // 沖縄は鉄道なし
};

function deriveProvider(city) {
  if (city.railProvider) return city.railProvider;
  return REGION_PROVIDER[city.region] ?? 'e5489';
}

/**
 * requiresCar の都市のレンタカー拠点を決定する。
 *
 * 優先順位:
 *   1. 空港到着 → 空港名（そのまま）
 *   2. バス移動後 → 目的地名（バスで到着してから借りる）
 *   3. 港/駅到着 → accessStation の suffix 除去
 *   4. フォールバック → city.name
 */
function deriveRentalFrom(city) {
  const access = city.accessStation ?? '';
  // バス移動後は目的地名で借りる（空港よりバスを優先）
  if (city.secondaryTransport === 'bus') return city.name;
  // 空港到着 → 空港名（そのまま）
  if (/空港/.test(access)) return access;
  // 港/駅
  if (access) return access.replace(/[駅港]$/, '');
  return city.name;
}

function deriveSubCta(city) {
  return { type: 'rental', from: deriveRentalFrom(city) };
}

const routes = {};

for (const city of destinations) {
  let mainCTA;

  if (city.airportGateway) {
    // 飛行機アクセス
    mainCTA = {
      type: 'flight',
      to:   city.airportGateway,
    };
    // flightHub がある場合（乗り継ぎ）
    if (city.flightHub) {
      mainCTA.hub = city.flightHub;
    }
  } else if (city.ferryGateway) {
    // フェリーアクセス
    mainCTA = {
      type: 'ferry',
      from: city.ferryGateway,
    };
    if (city.ferryOperator)  mainCTA.provider = city.ferryOperator;
    if (city.ferryBookingUrl) mainCTA.url      = city.ferryBookingUrl;
  } else {
    // 鉄道
    const provider = deriveProvider(city);
    mainCTA = {
      type:     'rail',
      provider: provider ?? 'e5489',
    };
  }

  /* subCTA: requiresCar の場合のみ生成 */
  if (city.requiresCar) {
    const subCTA = deriveSubCta(city);
    routes[city.id] = { mainCTA, subCTA };
  } else {
    routes[city.id] = { mainCTA };
  }
}

const out = JSON.stringify(routes, null, 2);
writeFileSync(join(root, 'src/data/routes.json'), out, 'utf8');
console.log(`✓ src/data/routes.json 生成完了 (${destinations.length} 件)`);
