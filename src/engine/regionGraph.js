/**
 * regionGraph.js — 日本地方隣接グラフ + BFS 経路探索
 *
 * destinations.json の region フィールド（日本語）に対応。
 * 地理的に隣接する地方間を BFS で最短経路（地方数）で返す。
 *
 * 沖縄・伊豆諸島は陸続きの接続なし（飛行機・フェリー専用）。
 *
 * 使用例:
 *   findRegionPath('関東', '九州')
 *   → ['関東', '中部', '近畿', '中国', '九州']
 *
 *   getTransportHint('関東', '沖縄')
 *   → { type: 'flight', reachable: true }
 */

/* ── 地方隣接マップ（無向グラフ） ── */
const REGION_ADJACENCY = {
  '北海道':   ['東北'],
  '東北':     ['北海道', '関東'],
  '関東':     ['東北', '中部', '伊豆諸島'],
  '中部':     ['関東', '近畿', '中国'],
  '近畿':     ['中部', '中国', '四国'],
  '中国':     ['近畿', '四国', '九州', '中部'],
  '四国':     ['近畿', '中国', '九州'],
  '九州':     ['中国', '四国'],
  '沖縄':     [],      // 飛行機のみ（陸路接続なし）
  '伊豆諸島': ['関東'], // 東京からフェリー
};

/* 飛行機のみで到達できる地方 */
const FLIGHT_ONLY_REGIONS = new Set(['沖縄']);

/* フェリーが主な到達手段の地方 */
const FERRY_PRIMARY_REGIONS = new Set(['伊豆諸島']);

/**
 * BFS で地方間の最短経路を返す。
 *
 * @param {string} fromRegion — 出発地の地方名
 * @param {string} toRegion   — 目的地の地方名
 * @returns {string[]|null}   — 経路（両端含む）、到達不能なら null
 *
 * @example
 *   findRegionPath('関東', '九州')
 *   // → ['関東', '中部', '近畿', '中国', '九州']
 */
export function findRegionPath(fromRegion, toRegion) {
  if (!fromRegion || !toRegion) return null;
  if (fromRegion === toRegion) return [fromRegion];

  const visited = new Set([fromRegion]);
  const queue   = [[fromRegion]];

  while (queue.length > 0) {
    const path = queue.shift();
    const current = path[path.length - 1];

    for (const neighbor of (REGION_ADJACENCY[current] ?? [])) {
      if (neighbor === toRegion) return [...path, neighbor];
      if (!visited.has(neighbor)) {
        visited.add(neighbor);
        queue.push([...path, neighbor]);
      }
    }
  }

  return null; // 到達不能（沖縄など）
}

/**
 * 地方ペアから交通手段ヒントを返す。
 * transportEngine が交通種別を決定する際の補助情報として使用。
 *
 * @param {string} fromRegion
 * @param {string} toRegion
 * @returns {{ type: 'rail'|'flight'|'ferry', direct: boolean, hops: number }}
 */
export function getRegionTransportHint(fromRegion, toRegion) {
  if (FLIGHT_ONLY_REGIONS.has(toRegion)) {
    return { type: 'flight', direct: false, hops: Infinity };
  }
  if (FERRY_PRIMARY_REGIONS.has(toRegion)) {
    return { type: 'ferry', direct: false, hops: Infinity };
  }

  const path = findRegionPath(fromRegion, toRegion);
  if (!path) {
    return { type: 'flight', direct: false, hops: Infinity };
  }

  const hops = path.length - 1;
  return { type: 'rail', direct: hops <= 1, hops };
}

/**
 * 出発地名から地方名を返す（定数マップ）。
 * DEPARTURE_REGION は distanceCalculator.js にも存在するが、
 * engine 内で完結するよう独立して定義する。
 */
export const DEPARTURE_REGION_MAP = {
  '札幌': '北海道', '函館': '北海道', '旭川': '北海道',
  '仙台': '東北',   '盛岡': '東北',
  '東京': '関東',   '横浜': '関東', '千葉': '関東', '大宮': '関東', '宇都宮': '関東',
  '長野': '中部',   '静岡': '中部', '名古屋': '中部', '金沢': '中部', '富山': '中部',
  '大阪': '近畿',   '京都': '近畿', '神戸': '近畿', '奈良': '近畿',
  '広島': '中国',   '岡山': '中国', '松江': '中国',
  '高松': '四国',   '松山': '四国', '高知': '四国', '徳島': '四国',
  '福岡': '九州',   '熊本': '九州', '鹿児島': '九州', '長崎': '九州', '宮崎': '九州',
};
