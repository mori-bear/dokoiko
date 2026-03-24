/**
 * bfsEngine.js — 汎用 BFS 経路探索
 * 純関数・DOM 非依存
 * ─────────────────────────────────────────────────────────
 * [dokoiiko / lifetrace 共通ロジック]
 * アルゴリズム部分はプロジェクト間で完全一致を維持する。
 * モジュール形式（export）のみ dokoiiko 版が追加される。
 * ─────────────────────────────────────────────────────────
 */

/**
 * 有向グラフ上の BFS 最短経路探索。
 * @param {{ edges: Array<{from:string, to:string}> }} graph
 * @param {string} from - 出発ノード名
 * @param {string} to   - 目標ノード名
 * @returns {string[]|null} ノード名の配列（出発含む）または null
 */
export function bfsPath(graph, from, to) {
  const queue   = [[from]];
  const visited = new Set();
  while (queue.length) {
    const path = queue.shift();
    const node = path[path.length - 1];
    if (node === to) return path;
    if (!visited.has(node)) {
      visited.add(node);
      const next = graph.edges.filter(e => e.from === node).map(e => e.to);
      for (const n of next) queue.push([...path, n]);
    }
  }
  return null;
}

/**
 * path 配列 → ステップ配列に変換する。
 * @param {{ edges: Array }} graph
 * @param {string[]} path
 * @returns {Array<{from,to,type,operator,label,ferryUrl}>}
 */
export function pathToSteps(graph, path) {
  const steps = [];
  for (let i = 0; i < path.length - 1; i++) {
    const from = path[i];
    const to   = path[i + 1];
    const edge = graph.edges.find(e => e.from === from && e.to === to);
    steps.push({
      from,
      to,
      type:     edge.type,
      operator: edge.operator  ?? null,
      label:    edge.label     ?? null,
      ferryUrl: edge.ferryUrl  ?? null,
    });
  }
  return steps;
}

/**
 * BFS 失敗時のフォールバックステップを生成する。
 * @param {string} from
 * @param {string} to
 * @returns {Array}
 */
export function fallbackStep(from, to) {
  return [{
    type:  'google-maps',
    label: `\uD83D\uDCCD ${from} \u2192 ${to}\uff08Google\u30DE\u30C3\u30D7\uff09`,
    url:   'https://www.google.com/maps/dir/?api=1'
           + '&origin='      + encodeURIComponent(from)
           + '&destination=' + encodeURIComponent(to)
           + '&travelmode=transit',
  }];
}
