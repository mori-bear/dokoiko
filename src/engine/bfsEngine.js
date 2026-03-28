/**
 * bfsEngine.js — transportGraph.json ベースの BFS ルートエンジン
 *
 * グラフ構造:
 *   ノード種別: hub / station / airport / port / city / destination
 *   エッジ種別: rail / bus / ferry / flight / road / local
 *
 * 探索:
 *   hub:{departure} → destination:{city.id} の最短経路（ホップ数）
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

/* ── BFS（ホップ最小経路） ── */
function findPath(fromId, toId) {
  const queue   = [[fromId]];
  const visited = new Set();

  while (queue.length) {
    const path = queue.shift();
    const node = path[path.length - 1];

    if (node === toId) return path;

    if (!visited.has(node)) {
      visited.add(node);
      for (const edge of (ADJ[node] ?? [])) {
        if (!visited.has(edge.to)) {
          queue.push([...path, edge.to]);
        }
      }
    }
  }
  return null;
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
