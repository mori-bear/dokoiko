/**
 * dijkstraEngine.js — transportGraph.json ベースのダイクストラ法ルートエンジン
 *
 * グラフ構造:
 *   ノード種別: hub / station / airport / port / city / destination
 *   エッジ種別: rail / bus / ferry / flight / road / local
 *
 * 探索:
 *   hub:{departure} → destination:{city.id} の最短時間経路（ダイクストラ法）
 *   同時間ならホップ数が少ない方を優先
 *
 * ステップ変換ルール:
 *   local       → スキップ（0分の名前エイリアス）
 *   road→airport → スキップ（空港アクセスは飛行機CTA内包）
 *   road→port   → localMove（Google Maps 案内）
 *   rail + '新幹線' in service → shinkansen
 *   rail それ以外 → rail（IC乗車 or JR在来線特急）
 *   flight      → flight（fromIata / toIata 付き）
 *   bus + local=true → localMove
 *   bus そのほか   → bus
 *   ferry       → ferry（destId 付き）
 *
 * 成功: step 配列（resolveTransportLinks.js 互換）
 * 失敗: [] → 呼び出し側でルート生成 fallback
 */

import { loadJson } from '../lib/loadJson.js';

/* `with { type: 'json' }` は Safari 17.2+ 限定のため loadJson() に切り替え（Safari 15+ 対応） */
const GRAPH_DATA = await loadJson('../data/transportGraph.json', import.meta.url);
import { iataToAirportName } from '../transport/linkBuilder.js';

/* ── 隣接マップ（起動時1回構築） ── */
const ADJ = {};
for (const edge of GRAPH_DATA.edges) {
  if (!ADJ[edge.from]) ADJ[edge.from] = [];
  ADJ[edge.from].push(edge);
}

/* ── ノード表示名ヘルパー ── */
function getDisplayName(nodeId) {
  const node = GRAPH_DATA.nodes[nodeId];
  if (!node) return nodeId.replace(/^[^:]+:/, '');

  // 空港ノードは IATA → 日本語空港名に変換（例: 'ISG' → '石垣空港'）
  if (node.type === 'airport' && node.iata) {
    return iataToAirportName(node.iata) ?? node.name ?? node.iata;
  }
  return node.name ?? nodeId.replace(/^[^:]+:/, '');
}

/* ── edge.type → step.type マッピング ── */
function toStepType(edge) {
  const t = edge.type;
  if (t === 'flight') return 'flight';
  if (t === 'ferry')  return 'ferry';
  if (t === 'bus')    return edge.local ? 'localMove' : 'bus';
  if (t === 'rail') {
    return (edge.service ?? '').includes('新幹線') ? 'shinkansen' : 'rail';
  }
  // road, local は呼び出し元でスキップ済み
  return 'localMove';
}

/**
 * 交通種別ペナルティ（分）
 * 同程度の距離なら鉄道を優先するため、飛行機・バスに下駄を履かせる。
 * 飛行機しか選択肢がない区間（離島・遠距離）では依然として飛行機が選ばれる。
 */
const EDGE_TYPE_PENALTY = {
  flight: 45, // 飛行機: 鉄道より45分不利に（空港アクセス・保安検査等の体感時間を反映）
  bus:    10, // バス: わずかに不利（鉄道が同程度なら鉄道を優先）
};

/* ── ダイクストラ法（所要時間最短経路 / 同値ならホップ最小） ── */
function findPath(fromId, toId) {
  // dist: nodeId → { minutes: number, hops: number }
  const dist = new Map();
  // prev: nodeId → nodeId（経路復元用）
  const prev = new Map();

  dist.set(fromId, { minutes: 0, hops: 0 });

  // 優先度付きキュー（小さいグラフ ~1000ノードなので線形探索で十分）
  const pq = [{ node: fromId, minutes: 0, hops: 0 }];

  while (pq.length > 0) {
    // 最小コスト要素を取り出す（一次: minutes 昇順、二次: hops 昇順）
    let minIdx = 0;
    for (let i = 1; i < pq.length; i++) {
      const a = pq[i], b = pq[minIdx];
      if (a.minutes < b.minutes || (a.minutes === b.minutes && a.hops < b.hops)) {
        minIdx = i;
      }
    }
    const { node, minutes, hops } = pq.splice(minIdx, 1)[0];

    if (node === toId) break;

    // すでにより良い経路が見つかっていたらスキップ
    const d = dist.get(node);
    if (!d || minutes > d.minutes || (minutes === d.minutes && hops > d.hops)) continue;

    for (const edge of (ADJ[node] ?? [])) {
      const edgeMin  = (edge.minutes ?? 0) + (EDGE_TYPE_PENALTY[edge.type] ?? 0);
      const newMin   = minutes + edgeMin;
      const newHops  = hops + 1;
      const existing = dist.get(edge.to);

      if (!existing ||
          newMin < existing.minutes ||
          (newMin === existing.minutes && newHops < existing.hops)) {
        dist.set(edge.to, { minutes: newMin, hops: newHops });
        prev.set(edge.to, node);
        pq.push({ node: edge.to, minutes: newMin, hops: newHops });
      }
    }
  }

  if (!dist.has(toId)) return null;

  // 経路を復元（終点から逆順に辿る）
  const path = [];
  let node = toId;
  while (node !== undefined) {
    path.unshift(node);
    node = prev.get(node);
  }

  return path[0] === fromId ? path : null;
}

/* ── path → step 配列 ── */
function pathToSteps(path, departureName) {
  const steps   = [];
  let   hubName = departureName; // 飛行機 from 表示用のハブ名を追跡

  for (let i = 0; i < path.length - 1; i++) {
    const fromId = path[i];
    const toId   = path[i + 1];
    const edge   = (ADJ[fromId] ?? []).find(e => e.to === toId);
    if (!edge) continue;

    /* ── local: スキップ（ハブ名追跡のみ） ── */
    if (edge.type === 'local') {
      if (GRAPH_DATA.nodes[fromId]?.type === 'hub') {
        hubName = GRAPH_DATA.nodes[fromId].name ?? hubName;
      }
      continue;
    }

    /* ── road: 空港へは skip、港へは localMove ── */
    if (edge.type === 'road') {
      if (fromId.startsWith('hub:')) hubName = GRAPH_DATA.nodes[fromId]?.name ?? hubName;
      if (toId.startsWith('airport:')) continue; // 空港アクセスは flight で内包
      if (toId.startsWith('port:')) {
        const fromName = GRAPH_DATA.nodes[fromId]?.name ?? fromId.replace(/^[^:]+:/, '');
        const toName   = getDisplayName(toId);
        steps.push({
          from: fromName, to: toName,
          type: 'localMove',
          label: null, provider: null, operator: null,
          minutes: edge.minutes ?? 0,
        });
      }
      continue;
    }

    /* ── flight: hubName を from にして IATA 情報を付与 ── */
    if (edge.type === 'flight') {
      const fromIata = GRAPH_DATA.nodes[fromId]?.iata ?? null;
      const toIata   = GRAPH_DATA.nodes[toId]?.iata   ?? null;
      const toName   = toIata ? (iataToAirportName(toIata) ?? toIata) : getDisplayName(toId);
      steps.push({
        from: hubName, to: toName,
        type: 'flight',
        fromIata, toIata,
        label:    null,
        provider: null, operator: null,
        minutes:  edge.minutes ?? 0,
      });
      hubName = toName; // 以降の from はこの空港名
      continue;
    }

    /* ── ferry ── */
    if (edge.type === 'ferry') {
      const fromName = getDisplayName(fromId);
      const toName   = getDisplayName(toId);
      // destination:ID ノードなら destId を付与（buildFerryLinkForDest 用）
      const destId   = toId.startsWith('destination:')
        ? (GRAPH_DATA.nodes[toId]?.destId ?? toId.replace('destination:', ''))
        : null;
      steps.push({
        from: fromName, to: toName,
        type: 'ferry',
        destId,
        ferryUrl:      edge.ferryUrl  ?? null,
        ferryOperator: edge.operator  ?? null,
        label:    null, provider: null, operator: null,
        minutes:  edge.minutes ?? 0,
      });
      hubName = toName;
      continue;
    }

    /* ── rail / bus（+ localMove） ── */
    const fromName = getDisplayName(fromId);
    const toName   = getDisplayName(toId);
    const stepType = toStepType(edge);

    // 同一名 localMove（station:X → destination:X が同名の場合）はスキップ
    if (stepType === 'localMove' && fromName === toName) continue;

    steps.push({
      from: fromName, to: toName,
      type: stepType,
      label:    edge.service  ?? null,
      provider: edge.provider ?? null,
      operator: edge.operator ?? null,
      minutes:  edge.minutes  ?? 0,
    });
    if (fromId.startsWith('hub:')) hubName = fromName;
  }

  return steps;
}

/* ── 公開 API ── */
/**
 * transportGraph.json BFS でルートを生成する。
 *
 * @param {string} departure — 出発都市名（例: '東京'）
 * @param {{ id: string, name: string, displayName?: string }} destination
 * @returns {Array} — step 配列。経路なし・グラフ外の場合は空配列を返す（呼び出し側で fallback）
 */
export function buildRoute(departure, destination) {
  const fromId = `hub:${departure}`;
  const toId   = `destination:${destination.id}`;

  // 出発地または目的地が graph に存在しない → fallback
  if (!GRAPH_DATA.nodes[fromId] || !GRAPH_DATA.nodes[toId]) return [];

  const path = findPath(fromId, toId);
  if (!path) return [];

  const steps = pathToSteps(path, departure);
  if (steps.length === 0) return []; // 空ルート → fallback

  return steps;
}

/**
 * 幹線区間のみ BFS でルートを生成する（hub:departure → hub:gateway）。
 * Gateway DB と組み合わせて使用。
 * ローカル区間・最終地点は呼び出し側（routeResolver.js）が追加する。
 *
 * @param {string} departure       — 出発都市名（例: '東京'）
 * @param {string} gatewayStation  — ゲートウェイ駅名（例: '福山駅'）
 * @returns {Array} — step 配列。経路なし・グラフ外の場合は空配列を返す
 */
export function buildTrunkRoute(departure, gatewayStation) {
  const fromId = `hub:${departure}`;
  // "福山駅" → "hub:福山", "新大阪駅" → "hub:新大阪" など
  const gwBase = gatewayStation.replace(/駅$/, '');
  const toId   = `hub:${gwBase}`;

  if (!GRAPH_DATA.nodes[fromId] || !GRAPH_DATA.nodes[toId]) return [];
  if (fromId === toId) return []; // 出発地 = gateway → 幹線ステップ不要

  const path = findPath(fromId, toId);
  if (!path) return [];

  const steps = pathToSteps(path, departure);
  return steps;
}
