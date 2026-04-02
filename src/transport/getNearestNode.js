/**
 * getNearestNode.js
 *
 * 地理的な距離計算ユーティリティ。
 * 経度を緯度コサインで補正した近似距離（単位: 度）を返す。
 * 1度 ≈ 111km なので、0.015 ≈ 1.7km が徒歩/バス境界の目安。
 */

/**
 * 2点間の近似距離（度）を返す。
 * @param {{ lat: number, lng: number }} a
 * @param {{ lat: number, lng: number }} b
 * @returns {number}
 */
export function approxDistance(a, b) {
  const dlat = a.lat - b.lat;
  const dlng = (a.lng - b.lng) * Math.cos((a.lat * Math.PI) / 180);
  return Math.sqrt(dlat * dlat + dlng * dlng);
}

/**
 * pointに最も近いノード（駅・空港など）を返す。
 * @param {{ lat: number, lng: number }} point
 * @param {Array<{ lat: number, lng: number }>} nodes
 * @param {{ hubOnly?: boolean }} options
 * @returns {{ node: object, dist: number } | null}
 */
export function getNearestNode(point, nodes, { hubOnly = false } = {}) {
  const candidates = hubOnly ? nodes.filter(n => n.isHub) : nodes;
  let best = null;
  let bestDist = Infinity;
  for (const n of candidates) {
    if (n.lat == null || n.lng == null) continue;
    const d = approxDistance(point, n);
    if (d < bestDist) {
      bestDist = d;
      best = n;
    }
  }
  return best ? { node: best, dist: bestDist } : null;
}

/**
 * 距離（度）から移動手段を判定する。
 * 0.015度（≈1.7km）以下なら徒歩、それ以上はバス。
 * @param {number} dist
 * @returns {'徒歩' | 'バス'}
 */
export function distanceToMethod(dist) {
  return dist < 0.015 ? '徒歩' : 'バス';
}
