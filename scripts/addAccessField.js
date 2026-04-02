/**
 * addAccessField.js (v3 – steps形式)
 *
 * destinations.json 全件に access.steps を追加する。
 *
 * steps = 実際の人間の移動順:
 *   rail   : 出発地 → ハブ駅（JR予約区間）
 *   local  : ハブ駅 → フェリー乗り場 / 最終目的地
 *   flight : 出発地 → 空港
 *   ferry  : 出発港 → 到着港
 *
 * 構造:
 *   access: { steps: [ { type, from, to, provider?, operator?, bookingUrl?, method? } ] }
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

/* ── プロバイダ短縮名（ID → 表示名） ── */
const PROVIDER_LABEL = {
  'e5489':     'e5489',
  'ekinet':    'えきねっと',
  'jrkyushu':  'JR九州',
  'ex':        'EX予約',
  'madoguchi': 'みどりの窓口',
};

const REGION_PROVIDER = {
  '北海道':  'ekinet',
  '東北':    'ekinet',
  '関東':    'ekinet',
  '中部':    'e5489',
  '近畿':    'e5489',
  '中国':    'e5489',
  '四国':    'e5489',
  '九州':    'jrkyushu',
  '沖縄':    null,       // 鉄道なし
  '伊豆諸島': 'ekinet',
};

/**
 * フェリー乗り場 → 最寄 JR 駅情報
 * station  : 最寄 JR 駅名
 * method   : 駅 → 港の移動手段
 * provider : JR 予約プロバイダ ID
 *
 * flight   : 最寄空港（JR のない地域で飛行機経由の場合）
 */
const FERRY_GATEWAY_HUB = {
  '宮島口港':           { station: '宮島口駅',       method: '徒歩', provider: 'e5489'    },
  '高松港':             { station: '高松駅',          method: '徒歩', provider: 'e5489'    },
  '竹芝客船ターミナル': { station: '浜松町駅',        method: '徒歩', provider: 'ekinet'   },
  '竹芝桟橋':           { station: '浜松町駅',        method: '徒歩', provider: 'ekinet'   },
  '鹿児島港':           { station: '鹿児島中央駅',    method: 'バス', provider: 'jrkyushu' },
  '博多港':             { station: '博多駅',          method: 'バス', provider: 'jrkyushu' },
  '詫間港':             { station: '詫間駅',          method: '徒歩', provider: 'e5489'    },
  '七類港':             { station: '松江駅',          method: 'バス', provider: 'e5489'    },
  '三崎港':             { station: '八幡浜駅',        method: 'バス', provider: 'e5489'    },
  '佐世保港':           { station: '佐世保駅',        method: '徒歩', provider: 'jrkyushu' },
  '境港':               { station: '境港駅',          method: '徒歩', provider: 'e5489'    },
  '宝伝港':             { station: '岡山駅',          method: 'バス', provider: 'e5489'    },
  '宿毛港':             { station: '宿毛駅',          method: '徒歩', provider: 'e5489'    },
  '柳井港':             { station: '柳井駅',          method: '徒歩', provider: 'e5489'    },
  '笠岡港':             { station: '笠岡駅',          method: '徒歩', provider: 'e5489'    },
  '稚内港':             { station: '稚内駅',          method: '徒歩', provider: 'ekinet'   },
  '川内港':             { station: '川内駅',          method: 'バス', provider: 'jrkyushu' },
  '新潟港':             { station: '新潟駅',          method: 'バス', provider: 'ekinet'   },
  // 飛行機経由 (JR なし)
  '石垣港':             { flight: '石垣空港',         method: 'バス'                       },
  '泊港':               { flight: '那覇空港',         method: 'バス'                       },
  '那覇港':             { flight: '那覇空港',         method: 'バス'                       },
  '本部港':             { flight: '那覇空港',         method: 'バス'                       },
  // 島内連絡フェリー（上位アクセスは別途）
  '小浜港':             null,
};

/* ── ユーティリティ ── */
function providerLabel(id) {
  return id ? (PROVIDER_LABEL[id] ?? id) : null;
}

function deriveProvider(dest) {
  if (dest.railProvider) return providerLabel(dest.railProvider);
  if (dest.region in REGION_PROVIDER) {
    const pid = REGION_PROVIDER[dest.region];
    return pid ? providerLabel(pid) : null;
  }
  return 'e5489';
}

function deriveLocalMethod(dest, isIsland = false) {
  const t = dest.secondaryTransport;
  if (!isIsland && (dest.needsCar || dest.destType === 'mountain' || dest.destType === 'remote' || t === 'car')) return 'レンタカー';
  if (isIsland  && (dest.destType === 'remote' || dest.destType === 'mountain' || t === 'car')) return 'レンタカー';
  if (t === 'taxi') return 'タクシー';
  if (t === 'walk') return '徒歩';
  if (t === 'bus' || dest.railNote === 'バス' || dest.busGateway) return 'バス';
  return '徒歩';
}

/** null/undefined フィールドを除去して step を作成 */
function step(obj) {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v != null));
}

/* ── メイン: steps 配列を組み立てる ── */
function buildSteps(dest) {
  const isIsland = !!(dest.isIsland || dest.destType === 'island');
  const steps    = [];

  /* ────────────────────────────────
   * A. 島 + フェリー
   * ──────────────────────────────── */
  if (isIsland && dest.ferryGateway) {
    // A-1. ハブ情報を決定（dest.railGateway 優先 → FERRY_GATEWAY_HUB）
    const hubInfo = dest.railGateway
      ? {
          station:  dest.railGateway,
          method:   dest.ferryGateway.includes(dest.railGateway.replace(/駅$/, '')) ? '徒歩' : 'バス',
          provider: deriveProvider(dest),
        }
      : (FERRY_GATEWAY_HUB[dest.ferryGateway] ?? null);

    if (hubInfo?.flight) {
      // A-2a. 飛行機経由（沖縄・八重山など）
      steps.push(step({ type: 'flight', from: null, to: hubInfo.flight }));
      if (hubInfo.flight !== dest.ferryGateway) {
        steps.push(step({ type: 'local', from: hubInfo.flight, to: dest.ferryGateway, method: hubInfo.method }));
      }
    } else if (hubInfo?.station) {
      // A-2b. JR 経由
      const provider = hubInfo.provider
        ? (PROVIDER_LABEL[hubInfo.provider] ?? hubInfo.provider)
        : deriveProvider(dest);
      steps.push(step({ type: 'rail', from: null, to: hubInfo.station, provider }));
      // ハブ駅 → 乗り場（異なる場合）
      if (hubInfo.station !== dest.ferryGateway) {
        steps.push(step({ type: 'local', from: hubInfo.station, to: dest.ferryGateway, method: hubInfo.method }));
      }
    }
    // hubInfo === null = 島内連絡フェリー（前段アクセスなし）

    // A-3. フェリー本体
    const ferryInfo   = DEST_FERRY[dest.id] ?? PORT_FERRY[dest.ferryGateway] ?? null;
    // 到着港: accessStation が「島側の港」なら使用。それ以外は島名
    const islandPort  = dest.accessStation?.endsWith('港') && dest.accessStation !== dest.ferryGateway
      ? dest.accessStation
      : dest.name;
    steps.push(step({
      type:       'ferry',
      from:       dest.ferryGateway,
      to:         islandPort,
      operator:   ferryInfo?.operator  ?? null,
      bookingUrl: ferryInfo?.url       ?? null,
    }));

    // A-4. 島内ローカル（到着港 → 最終地点）
    if (islandPort !== dest.name) {
      const islandDest   = dest.mapPoint ?? dest.name;
      const sameOnIsland = islandPort.replace(/港$/, '') === islandDest?.replace(/港$/, '');
      if (!sameOnIsland) {
        steps.push(step({
          type:   'local',
          from:   islandPort,
          to:     islandDest,
          method: deriveLocalMethod(dest, true),
        }));
      }
    }

  /* ────────────────────────────────
   * B. 飛行機のみ（本土 or 空港直行島）
   * ──────────────────────────────── */
  } else if (dest.airportGateway) {
    steps.push(step({ type: 'flight', from: null, to: dest.airportGateway }));
    const localTo = dest.accessStation && dest.accessStation !== dest.airportGateway
      ? (dest.mapPoint ?? dest.accessStation)
      : null;
    if (localTo) {
      steps.push(step({
        type:   'local',
        from:   dest.airportGateway,
        to:     localTo,
        method: deriveLocalMethod(dest, isIsland),
      }));
    }

  /* ────────────────────────────────
   * C. 陸路（鉄道）
   * ──────────────────────────────── */
  } else {
    const railTo   = dest.railGateway ?? dest.accessStation ?? null;
    const provider = deriveProvider(dest);
    if (!railTo) return null;

    steps.push(step({ type: 'rail', from: null, to: railTo, provider }));

    const localTo     = dest.accessStation !== dest.railGateway
      ? (dest.accessStation ?? dest.name)
      : dest.name;
    const isSamePoint = railTo.replace(/駅$/, '') === localTo?.replace(/駅$/, '');
    const method      = deriveLocalMethod(dest, false);
    const forceLocal  = !!dest.mapPoint || method === 'レンタカー' || method === 'バス' || method === 'タクシー';

    if (!isSamePoint || forceLocal) {
      steps.push(step({
        type:   'local',
        from:   railTo,
        to:     dest.mapPoint ?? localTo ?? dest.name,
        method,
      }));
    }
  }

  return steps.length > 0 ? steps : null;
}

/* ── 実行 ── */
let updated = 0;
for (const dest of destinations) {
  const steps = buildSteps(dest);
  if (steps) {
    dest.access = { steps };
    updated++;
  } else {
    delete dest.access;
  }
}

writeFileSync(
  join(root, 'src/data/destinations.json'),
  JSON.stringify(destinations, null, 2) + '\n',
  'utf8'
);

console.log(`✓ access.steps を追加: ${updated} / ${destinations.length} destinations`);
