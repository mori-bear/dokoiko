/**
 * BFS ルートエンジン — 最小構成
 *
 * routes.js に依存しない。グラフノード間の最短経路を BFS で探索し、
 * ステップ配列を返す。destination に gateway が設定されている場合に使用。
 *
 * 成功: toSteps(path) → [{ from, to, type, operator, label, ferryUrl }]
 * 失敗: fallback(from, to) → [{ type:'google-maps', label, url }]
 */

/* ─────────────────────────────────────────────────
   最小グラフ定義
───────────────────────────────────────────────── */
export const GRAPH = {
  edges: [
    // 瀬戸大橋・山陽
    { from: '高松',     to: '岡山',       type: 'rail',       operator: 'JR四国',   label: 'マリンライナー' },
    { from: '岡山',     to: '新大阪',     type: 'shinkansen', operator: 'JR西日本',  label: '山陽新幹線' },
    { from: '岡山',     to: '博多',       type: 'shinkansen', operator: 'JR西日本',  label: '山陽・九州新幹線' },
    // 大阪 → 近鉄
    { from: '新大阪',   to: '鶴橋',       type: 'rail',       operator: 'JR西日本',  label: '大阪環状線' },
    { from: '鶴橋',     to: '橿原神宮前', type: 'rail',       operator: '近鉄',      label: '近鉄大阪線' },
    // 沖縄
    { from: '高松',     to: '那覇空港',   type: 'flight',                            label: '飛行機' },
    { from: '那覇空港', to: '泊港',       type: 'local',                             label: 'Googleマップ' },
    { from: '泊港',     to: '座間味',     type: 'ferry',      ferryUrl: 'https://vill.zamami.okinawa.jp/', label: 'フェリー' },
    // 壱岐
    { from: '博多',     to: '博多港',     type: 'local',                             label: 'Googleマップ' },
    { from: '博多港',   to: '壱岐',       type: 'ferry',      ferryUrl: 'https://www.kyu-you.co.jp/', label: 'フェリー' },
  ],
};

/* ─────────────────────────────────────────────────
   BFS（最短経路）
───────────────────────────────────────────────── */
function findRoute(from, goal) {
  const queue   = [[from]];
  const visited = new Set();

  while (queue.length) {
    const path = queue.shift();
    const node = path[path.length - 1];

    if (node === goal) return path;

    if (!visited.has(node)) {
      visited.add(node);
      const next = GRAPH.edges
        .filter(e => e.from === node)
        .map(e => e.to);
      for (const n of next) {
        queue.push([...path, n]);
      }
    }
  }

  return null;
}

/* ─────────────────────────────────────────────────
   path → ステップ配列
───────────────────────────────────────────────── */
function toSteps(path) {
  const steps = [];
  for (let i = 0; i < path.length - 1; i++) {
    const from = path[i];
    const to   = path[i + 1];
    const edge = GRAPH.edges.find(e => e.from === from && e.to === to);
    steps.push({
      from,
      to,
      type:     edge.type,
      operator: edge.operator ?? null,
      label:    edge.label   ?? null,
      ferryUrl: edge.ferryUrl ?? null,
    });
  }
  return steps;
}

/* ─────────────────────────────────────────────────
   フォールバック（BFS失敗時）
───────────────────────────────────────────────── */
function fallback(from, to) {
  return [{
    type:  'google-maps',
    label: `📍 ${from} → ${to}（Googleマップ）`,
    url:   `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(from)}&destination=${encodeURIComponent(to)}&travelmode=transit`,
  }];
}

/* ─────────────────────────────────────────────────
   メインエントリ
───────────────────────────────────────────────── */
/**
 * @param {string} from — グラフノード名（出発地）
 * @param {{ name:string, displayName?:string, gateway?:string }} destination
 * @returns {Array} — ステップ配列 or fallback リンク配列
 */
export function buildRoute(from, destination) {
  const goal = destination.gateway ?? destination.name;
  const path = findRoute(from, goal);
  if (!path) return fallback(from, destination.displayName ?? destination.name);
  return toSteps(path);
}
