/**
 * BFS 交通ルート探索エンジン
 *
 * transportGraph.json を参照して出発都市から目的地までのルートを探索する。
 * AI推測なし — グラフに存在するエッジのみ使用する。
 *
 * 探索結果: RouteSegment[] の配列
 *   RouteSegment = { from, to, type, provider?, service?, minutes?, local? }
 *
 * 使い方:
 *   import { findRoutes } from './bfsEngine.js';
 *   const routes = findRoutes('東京', 'kamikochi', graph);
 *   // → [{ from:'city:東京', to:'city:松本', type:'rail', provider:'ekinet' }, ...]
 */

const TRANSPORT_GRAPH_URL = './src/data/transportGraph.json';

/* ── グラフキャッシュ（ES module スコープで1回だけロード）── */
let _graph = null;

export async function loadGraph() {
  if (_graph) return _graph;
  const res = await fetch(TRANSPORT_GRAPH_URL);
  _graph = await res.json();
  return _graph;
}

/* ── 隣接リスト構築（内部キャッシュ）── */
let _adj = null;

function buildAdj(graph) {
  if (_adj) return _adj;
  _adj = {};
  for (const edge of graph.edges) {
    if (!_adj[edge.from]) _adj[edge.from] = [];
    _adj[edge.from].push(edge);
  }
  return _adj;
}

/* ─────────────────────────────────────────────────
   メイン BFS 関数

   @param departureCity  出発都市名 (例: '東京')
   @param destinationId  destination の id (例: 'kamikochi')
   @param graph          transportGraph オブジェクト
   @returns              RouteSegment[][] (最大3ルート)
───────────────────────────────────────────────── */
export function findRoutes(departureCity, destinationId, graph) {
  const adj      = buildAdj(graph);
  const startId  = `city:${departureCity}`;
  const goalId   = `destination:${destinationId}`;

  if (!graph.nodes[startId] || !graph.nodes[goalId]) return [];

  // BFS: 最短経路を最大3本探す
  const found    = [];
  const visited  = new Set();

  // queue エントリ: { nodeId, path: RouteSegment[] }
  const queue = [{ nodeId: startId, path: [] }];

  while (queue.length > 0 && found.length < 3) {
    const { nodeId: cur, path } = queue.shift();

    if (cur === goalId) {
      found.push(path);
      continue;
    }

    // ループ防止（同一ノードへの再訪をパス単位で許可しない）
    const visitKey = `${path.length}:${cur}`;
    if (visited.has(visitKey)) continue;
    visited.add(visitKey);

    // 深さ制限: 6ホップ以内
    if (path.length >= 6) continue;

    const neighbors = adj[cur] || [];
    for (const edge of neighbors) {
      queue.push({
        nodeId: edge.to,
        path: [...path, edge],
      });
    }
  }

  return found;
}

/* ─────────────────────────────────────────────────
   ルートからリンク情報に変換

   BFS結果を transportRenderer が使える形式に変換する。
   戻り値は既存の link オブジェクト形式:
   { type, label, url }

   @param routes    findRoutes の戻り値
   @param city      destination オブジェクト (destinations.json)
   @param departure 出発都市名
   @param graph     transportGraph オブジェクト
   @param linkBuilderFns  { buildJrLink, buildSkyscannerLink, buildGoogleMapsLink,
                             buildFerryLink, buildRentalLink, AIRPORT_IATA,
                             CITY_AIRPORT, resolveRailProvider }
   @returns         link[] (最大3リンク)
───────────────────────────────────────────────── */
export function routesToLinks(routes, city, departure, graph, fns) {
  const {
    buildJrLink, buildSkyscannerLink, buildGoogleMapsLink,
    buildFerryLink, buildRentalLink, AIRPORT_IATA, CITY_AIRPORT,
    resolveRailProvider,
  } = fns;

  if (!routes.length) return [];

  const links = [];
  const seenTypes = new Set();

  for (const path of routes) {
    if (links.length >= 3) break;
    const pathLinks = segmentsToLinks(
      path, city, departure, graph, fns
    );
    // 重複タイプを避けてマージ
    for (const l of pathLinks) {
      const key = l.type + (l.url || '');
      if (!seenTypes.has(key)) {
        seenTypes.add(key);
        links.push(l);
      }
    }
  }

  // レンタカー追加
  const isIsland = !!(city.isIsland || city.destType === 'island');
  if (city.needsCar || isIsland) {
    links.push(buildRentalLink());
  }

  return links.slice(0, 4);
}

function segmentsToLinks(path, city, departure, graph, fns) {
  const {
    buildJrLink, buildSkyscannerLink, buildGoogleMapsLink,
    buildFerryLink, AIRPORT_IATA, CITY_AIRPORT, resolveRailProvider,
  } = fns;

  const links = [];
  const coords = (city.lat && city.lng) ? { lat: city.lat, lng: city.lng } : null;

  // 最初の rail セグメントを見つける
  const railSeg = path.find(s => s.type === 'rail');
  // 最初の flight セグメントを見つける
  const flightSeg = path.find(s => s.type === 'flight');
  // ローカルアクセスセグメント（目的地に直接繋がるもの）
  const localSeg = path.find(s => s.to.startsWith('destination:'));
  // ferry セグメント（ポート→目的地）
  const ferrySeg = path.find(s => s.type === 'ferry');

  // ── 飛行機ルート ──
  if (flightSeg) {
    const fromIata = getIataFromNodeId(flightSeg.from, CITY_AIRPORT, AIRPORT_IATA);
    const toAirNode = graph.nodes[flightSeg.to];
    const toIata    = toAirNode?.iata;
    const toAirName = iataToAirportName(toIata, AIRPORT_IATA);
    if (fromIata && toIata) {
      links.push(buildSkyscannerLink(fromIata, toAirName));
    }
    // 空港→目的地 ローカル
    if (localSeg && localSeg.type === 'bus') {
      links.push(buildGoogleMapsLink(
        toAirName || graph.nodes[flightSeg.to]?.name || '空港',
        city.name, 'transit', `空港から${city.name}へ（Googleマップ）`, coords
      ));
    }
    return links.filter(Boolean);
  }

  // ── フェリールート（島向け）──
  if (ferrySeg && ferrySeg.local) {
    const portNode = graph.nodes[ferrySeg.from];
    const portName = portNode?.name || '';
    const fl = buildFerryLink(portName);
    if (fl) links.push(fl);
    // 出発地→港 へのアクセス
    const portAccessSeg = path.find(s => s.to === ferrySeg.from);
    if (portAccessSeg) {
      const fromName = graph.nodes[portAccessSeg.from]?.name || departure;
      links.push(buildGoogleMapsLink(fromName, portName, 'transit'));
    }
    return links.filter(l => l?.url);
  }

  // ── 鉄道ルート ──
  if (railSeg) {
    const provider = railSeg.provider || resolveRailProvider(departure, city);
    const jrLink = buildJrLink(provider);
    if (jrLink) links.push(jrLink);

    // 出発駅 → gateway駅 (Google Maps transit)
    const fromCity  = graph.nodes[railSeg.from]?.name || departure;
    const toStation = graph.nodes[railSeg.to]?.name;
    if (fromCity && toStation) {
      links.push(buildGoogleMapsLink(
        fromCity + '駅', toStation + '駅', 'transit'
      ));
    }

    // ローカル二次交通（駅→目的地）
    if (localSeg) {
      const gatewayName = graph.nodes[localSeg.from]?.name || toStation;
      links.push(buildGoogleMapsLink(
        gatewayName, city.name, 'transit',
        `${gatewayName}から${city.name}へ（Googleマップ）`, coords
      ));
    }
    return links.filter(Boolean);
  }

  // ── バス直結ルート ──
  if (localSeg && localSeg.type === 'bus') {
    const fromName = graph.nodes[localSeg.from]?.name || departure;
    links.push(buildGoogleMapsLink(
      fromName, city.name, 'transit', null, coords
    ));
    return links.filter(Boolean);
  }

  // ── フォールバック: Google Maps ──
  links.push(buildGoogleMapsLink(departure + '駅', city.name, 'transit', null, coords));
  return links.filter(Boolean);
}

/* ── ヘルパー ── */

function getIataFromNodeId(nodeId, CITY_AIRPORT, AIRPORT_IATA) {
  if (nodeId.startsWith('airport:')) {
    return nodeId.replace('airport:', '');
  }
  if (nodeId.startsWith('city:')) {
    const city = nodeId.replace('city:', '');
    return CITY_AIRPORT[city] || null;
  }
  return null;
}

function iataToAirportName(iata, AIRPORT_IATA) {
  return Object.keys(AIRPORT_IATA).find(k => AIRPORT_IATA[k] === iata) || null;
}
