/**
 * addAccessField.js
 *
 * destinations.json 全件に access フィールドを追加する。
 *
 * 生成ルール:
 *   access.rail.to       = railGateway（ハブ駅） / airportGateway（飛行機）
 *   access.rail.provider = railProvider → 表示名 / region から派生
 *   access.local.from    = rail.to
 *   access.local.to      = accessStation（異なる場合）/ mapPoint
 *   access.local.method  = secondaryTransport / needsCar / destType から判定
 *   access.ferry         = ferries.json DB を参照（island のみ）
 */

import { readFileSync, writeFileSync } from 'fs';
import { join, dirname }               from 'path';
import { fileURLToPath }               from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));
const root  = join(__dir, '..');

const destinations = JSON.parse(readFileSync(join(root, 'src/data/destinations.json'), 'utf8'));
const ferries      = JSON.parse(readFileSync(join(root, 'src/data/ferries.json'),      'utf8'));

/* ── フェリー DB ── */
const DEST_FERRY = {};
const PORT_FERRY = {};
for (const f of ferries) {
  if (f.destId) DEST_FERRY[f.destId] = f;
  if (f.from && !PORT_FERRY[f.from]) PORT_FERRY[f.from] = f;
}

/* ── プロバイダ短縮名 ── */
const PROVIDER_LABEL = {
  'e5489':      'e5489',
  'ekinet':     'えきねっと',
  'jrkyushu':   'JR九州',
  'ex':         'EX予約',
  'madoguchi':  'みどりの窓口',
};

const REGION_PROVIDER = {
  '北海道': 'ekinet',
  '東北':   'ekinet',
  '関東':   'ekinet',
  '中部':   'e5489',
  '近畿':   'e5489',
  '中国':   'e5489',
  '四国':   'e5489',
  '九州':   'jrkyushu',
  '沖縄':   null,        // 沖縄は鉄道なし（モノレール除く）
  '伊豆諸島': 'ekinet',
};

function deriveProvider(dest) {
  if (dest.railProvider) return PROVIDER_LABEL[dest.railProvider] ?? dest.railProvider;
  // REGION_PROVIDER の明示的なエントリを使用（null = 鉄道なし）
  if (dest.region in REGION_PROVIDER) {
    const pid = REGION_PROVIDER[dest.region];
    return pid ? (PROVIDER_LABEL[pid] ?? pid) : null;
  }
  return 'e5489'; // 不明リージョン → デフォルト
}

function deriveLocalMethod(dest, isIsland = false) {
  const t = dest.secondaryTransport;
  // 島の内部移動: needsCar は大陸側アクセスを指す場合があるので island は別判定
  if (!isIsland && (dest.needsCar || dest.destType === 'mountain' || dest.destType === 'remote' || t === 'car')) return 'レンタカー';
  if (isIsland && (dest.destType === 'remote' || dest.destType === 'mountain' || t === 'car')) return 'レンタカー';
  if (t === 'taxi')   return 'タクシー';
  if (t === 'walk')   return '徒歩';
  if (t === 'bus' || dest.railNote === 'バス' || dest.busGateway) return 'バス';
  return '徒歩';
}

function buildAccess(dest) {
  const isIsland = !!(dest.isIsland || dest.destType === 'island');
  const access   = {};

  /* ── rail ── */
  // 島・飛行機依存: airportGateway を優先
  const railTo = isIsland
    ? (dest.ferryGateway                              // 港経由の島
        ?? dest.airportGateway                        // 空港直行の島
        ?? dest.railGateway ?? dest.accessStation)
    : (dest.railGateway ?? dest.accessStation ?? null);

  const provider = deriveProvider(dest);

  if (railTo) {
    access.rail = {
      to:       railTo,
      provider: provider ?? null,   // null = 鉄道なし（沖縄など）
    };
  }

  /* ── local ── */
  const method = deriveLocalMethod(dest, isIsland);

  if (isIsland && dest.ferryGateway) {
    // 島: ローカルは「フェリー到着後の島内移動」（accessStation → mapPoint or 島名）
    // accessStation が ferryGateway と同じ = 本土側の港を指している → 島内移動なし
    const islandArrival = dest.accessStation !== dest.ferryGateway
      ? dest.accessStation
      : null;
    if (islandArrival) {
      const islandDest   = dest.mapPoint ?? dest.name;
      // 到着港と島名が実質同一なら local 不要
      const sameOnIsland = islandArrival.replace(/港$/, '') === islandDest?.replace(/港$/, '');
      if (!sameOnIsland) {
        access.local = { from: islandArrival, to: islandDest, method };
      }
    }
  } else {
    // 陸路: railTo → 目的地 or mapPoint
    const localTo    = dest.accessStation !== dest.railGateway
      ? (dest.accessStation ?? dest.name)
      : dest.name;
    const isSamePoint = (railTo?.replace(/駅$/, '') === localTo?.replace(/駅$/, ''));
    const forceLocal  = !!dest.mapPoint || method === 'レンタカー' || method === 'バス' || method === 'タクシー';
    if (railTo && (!isSamePoint || forceLocal)) {
      access.local = {
        from:   railTo,
        to:     dest.mapPoint ?? localTo ?? dest.name,
        method,
      };
    }
  }

  /* ── ferry ── */
  if (isIsland && dest.ferryGateway) {
    const ferryInfo = DEST_FERRY[dest.id] ?? PORT_FERRY[dest.ferryGateway] ?? null;
    access.ferry = {
      from:       dest.ferryGateway,
      to:         dest.name,
      operator:   ferryInfo?.operator  ?? null,
      bookingUrl: ferryInfo?.url       ?? null,
    };
  }

  return Object.keys(access).length > 0 ? access : null;
}

/* ── 実行 ── */
let updated = 0;
for (const dest of destinations) {
  const access = buildAccess(dest);
  if (access) {
    dest.access = access;
    updated++;
  }
}

writeFileSync(
  join(root, 'src/data/destinations.json'),
  JSON.stringify(destinations, null, 2) + '\n',
  'utf8'
);

console.log(`✓ access フィールドを追加: ${updated} / ${destinations.length} destinations`);
