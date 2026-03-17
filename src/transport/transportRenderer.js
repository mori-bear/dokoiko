/**
 * 交通リンクアセンブラ
 *
 * 交通生成構造:
 *   出発地 → transportGraph BFS → gatewayHub → 二次交通 → destination
 *
 * 優先順位:
 *   1. transportGraph が初期化済み → BFS ルート探索（AI推測なし）
 *   2. 未初期化 → フィールドベースフォールバック（旧ロジック）
 *
 * 初期化:
 *   app.js の init() で initTransportGraph(graph) を呼び出すこと。
 *
 * 表示順: JR → 飛行機 → フェリー → バス → レンタカー
 * 最大3ルート（limitRoutes()）
 */

import { DEPARTURE_CITY_INFO } from '../config/constants.js';
import { calculateDistanceStars } from '../engine/distanceCalculator.js';
import { CITY_AIRPORT }        from './airportMap.js';
import { FLIGHT_ROUTES }       from './flightRoutes.js';
import {
  AIRPORT_IATA,
  AIRPORT_HUB_GATEWAY,
  buildGoogleMapsLink,
  buildSkyscannerLink,
  buildJrLink,
  buildFerryLink,
  buildRentalLink,
} from './linkBuilder.js';

/* ── モジュールレベル グラフキャッシュ ── */
let _graph = null;
let _adj   = null;

/**
 * app.js の init() から呼び出す。
 * 以降の resolveTransportLinks() が BFS を使用する。
 */
export function initTransportGraph(graph) {
  _graph = graph;
  _adj   = buildAdj(graph);
}

function buildAdj(graph) {
  const adj = {};
  for (const edge of graph.edges) {
    if (!adj[edge.from]) adj[edge.from] = [];
    adj[edge.from].push(edge);
  }
  return adj;
}

/* ── 座標ヘルパー ── */
function coords(city) {
  return (city.lat && city.lng) ? { lat: city.lat, lng: city.lng } : null;
}

/* ─────────────────────────────────────────────────
   港 → トランジットハブ空港 マッピング
   「この港に乗るには、どの空港から向かうか」
   island で airportGateway が島自身の空港である場合でも
   正しい Maps 起点（港に近いハブ空港）を決定する。
───────────────────────────────────────────────── */
const PORT_TRANSIT_AIRPORT = {
  '那覇港':               '那覇空港',
  '泊港':                 '那覇空港',  // 慶良間・粟国方面
  '本部港':               '那覇空港',  // 伊江島
  '博多港':               '福岡空港',  // 対馬・壱岐・五島
  '長崎港':               '長崎空港',
  '鹿児島港':             '鹿児島空港', // 屋久島・奄美・種子島
  '石垣港':               '石垣空港',  // 竹富島・西表島・与那国
  '小浜港':               '石垣空港',  // 小浜島
  '宿毛港':               '高知空港',  // 柏島
  '柳井港':               '岩国錦帯橋空港', // 周防大島
  '境港':                 '米子空港',  // 隠岐
  '竹芝客船ターミナル':   '羽田空港',  // 伊豆諸島
  '竹芝桟橋':             '羽田空港',  // 伊豆諸島（別名）
};

/* ─────────────────────────────────────────────────
   メインエントリ
───────────────────────────────────────────────── */
export function resolveTransportLinks(city, departure) {
  const raw = _graph && _adj
    ? resolveByBFS(city, departure)
    : resolveByFields(city, departure);

  // Google Maps は 1 本のみ
  const nonMaps = raw.filter(l => l.type !== 'google-maps');
  const fromCity  = DEPARTURE_CITY_INFO[departure];
  const originStation = fromCity?.rail || departure;
  const isIsland = !!(city.isIsland || city.destType === 'island');

  // 島で ferry port がある場合 → 港に最も近いトランジット空港を起点にした Maps
  // PORT_TRANSIT_AIRPORT で正しいハブ空港を決定（island 自身の空港が airportGateway の場合も対処）
  const ferryPort = city.ferryGateway || city.gateways?.ferry?.[0] || city.port || null;
  const transitAirport = PORT_TRANSIT_AIRPORT[ferryPort]
    || (ferryPort ? city.airportGateway : null)
    || null;

  let mapsOrigin, mapsDest, mapsLabel;
  if (isIsland && transitAirport && ferryPort) {
    // 空港 → フェリー港 ルート（例: 那覇空港 → 泊港）
    mapsOrigin = transitAirport;
    mapsDest   = ferryPort;
    mapsLabel  = `${transitAirport} → ${ferryPort}（Googleマップ）`;
  } else {
    // 通常: 出発駅 → 港/空港/駅
    const islandGateway = isIsland
      ? (ferryPort || city.airportGateway || null)
      : null;
    mapsOrigin = originStation;
    mapsDest   = islandGateway || city.accessStation || `${city.name} ${city.prefecture}`;
    mapsLabel  = islandGateway ? `${islandGateway}へのルート（Googleマップ）` : null;
  }
  const mapsLink = buildGoogleMapsLink(mapsOrigin, mapsDest, 'transit', mapsLabel);
  return limitRoutes([...nonMaps, mapsLink], 3);
}

/* ─────────────────────────────────────────────────
   BFS ルート探索
───────────────────────────────────────────────── */
function resolveByBFS(city, departure) {
  const fromCity = DEPARTURE_CITY_INFO[departure];
  if (!fromCity) return [];

  const startId = `city:${departure}`;
  const goalId  = `destination:${city.id}`;

  if (!_graph.nodes[startId] || !_graph.nodes[goalId]) {
    // グラフにノードなし → フォールバック
    return resolveByFields(city, departure);
  }

  const routes = bfsFindPaths(startId, goalId);
  if (!routes.length) {
    return resolveByFields(city, departure);
  }

  const links    = [];
  const seenKeys = new Set();

  for (const path of routes) {
    if (links.length >= 3) break;
    const pathLinks = pathToLinks(path, city, departure, fromCity);
    for (const l of pathLinks) {
      const key = l.type + ':' + (l.url || '');
      if (l && l.url && !seenKeys.has(key)) {
        seenKeys.add(key);
        links.push(l);
      }
    }
  }

  // レンタカー
  const isIsland = !!(city.isIsland || city.destType === 'island');
  if (city.needsCar || isIsland) links.push(buildRentalLink());

  return limitRoutes(links, 3);
}

/* BFS: 最大3経路を探す（深さ7ホップ上限）*/
function bfsFindPaths(startId, goalId) {
  const found   = [];
  const queue   = [{ nodeId: startId, path: [], visited: new Set([startId]) }];

  while (queue.length && found.length < 3) {
    const { nodeId: cur, path, visited } = queue.shift();

    if (cur === goalId) {
      found.push(path);
      continue;
    }
    if (path.length >= 10) continue;

    for (const edge of (_adj[cur] || [])) {
      if (!visited.has(edge.to)) {
        const newVisited = new Set(visited);
        newVisited.add(edge.to);
        queue.push({ nodeId: edge.to, path: [...path, edge], visited: newVisited });
      }
    }
  }
  return found;
}

/* BFS パス → リンク配列 */
function pathToLinks(path, city, departure, fromCity) {
  const co = coords(city);

  const railSeg   = path.find(s => s.type === 'rail');
  const flightSeg = path.find(s => s.type === 'flight');
  const ferrySeg  = path.find(s => s.type === 'ferry' && !s.local);
  const localSeg  = path.find(s => s.to.startsWith('destination:'));

  // ── 飛行機ルート ──
  if (flightSeg) {
    const fromIata  = extractIata(flightSeg.from) || fromCity.iata;  // BFS 空港ノード優先
    // 迂回ルート排除: 出発地の実際の空港と一致しない場合はスキップ
    const depIata = CITY_AIRPORT[departure];
    if (depIata && fromIata !== depIata) return [];
    const toAirNode = _graph.nodes[flightSeg.to];
    const toIata    = toAirNode?.iata || extractIata(flightSeg.to);
    const toAirName = iataToName(toIata);
    const links = [];
    // 出発地→目的地の路線が実際に存在する場合のみ表示
    if (fromIata && toIata && (FLIGHT_ROUTES[fromIata] ?? []).includes(toIata)) {
      links.push(buildSkyscannerLink(fromIata, toAirName));
    }
    if (localSeg) {
      const gateName = toAirName || '空港';
      links.push(buildGoogleMapsLink(
        gateName, city.name, 'transit',
        `空港から${city.name}へ（Googleマップ）`, co
      ));
    }
    return links.filter(Boolean);
  }

  // ── フェリールート（港→島）──
  if (ferrySeg) {
    const portName = _graph.nodes[ferrySeg.from]?.name || '';
    // TASK3: ferryBookingUrl があればそちらを優先
    const fl = buildFerryLink(portName, city.ferryBookingUrl || null, city.ferryOperator || null);
    const links = fl ? [fl] : [];
    // 出発地→港 Google Maps
    const portAccessSeg = path.find(s => s.to === ferrySeg.from);
    if (portAccessSeg) {
      const fromName = _graph.nodes[portAccessSeg.from]?.name || departure;
      links.push(buildGoogleMapsLink(fromName, portName, 'transit'));
    }
    return links.filter(l => l?.url);
  }

  // ── 鉄道ルート ──
  if (railSeg) {
    const provider  = resolveRailProvider(departure, city);
    // 表示は 出発駅 → destination.accessStation（hub経由地は非表示）
    const fromName  = fromCity.rail.replace(/駅$/, '');
    const toName    = (city.accessStation || _graph.nodes[railSeg.to]?.name || '').replace(/駅$/, '');
    const route     = fromName && toName ? { from: fromName, to: toName } : null;
    const jrLink    = buildJrLink(provider, route);
    const links     = jrLink ? [jrLink] : [];
    // スマートEX: 出発地が EX 対象かつ主要予約先が EX でない場合に追加
    if (provider !== 'ex' && EX_CITIES.has(departure)) {
      const exLink = buildJrLink('ex', route);
      if (exLink) links.push(exLink);
    }
    return links.filter(Boolean);
  }

  // ── バス直結 / フォールバック ──
  if (localSeg) {
    const fromName = _graph.nodes[localSeg.from]?.name || departure;
    return [buildGoogleMapsLink(fromName, city.name, 'transit', null, co)].filter(Boolean);
  }

  return [buildGoogleMapsLink(fromCity.rail, city.name, 'transit', null, co)];
}

/* ─────────────────────────────────────────────────
   フィールドベース フォールバック（旧ロジック）
   ※ graph 未初期化時のみ使用
───────────────────────────────────────────────── */
function resolveByFields(city, departure) {
  const fromCity = DEPARTURE_CITY_INFO[departure];
  if (!fromCity) return [];

  const stars    = calculateDistanceStars(departure, city);
  const isIsland = !!(city.isIsland || city.destType === 'island');
  const hasFerry = !!(gw(city, 'ferryGateway') || (city.gateways?.ferry?.length > 0));

  if (isIsland && hasFerry) {
    const links = [
      ...getFlightForIsland(city, departure, fromCity),
      ...getIslandJR(city, departure, fromCity),
      ...getFerry(city, departure, fromCity, true),
      ...getCar(city),
    ].filter(l => l && (l.url || l.type === 'note'));
    return limitRoutes(links, 3);
  }

  if (stars === 1) {
    const rail = gw(city, 'railGateway') ?? city.name;
    const useCoords = !gw(city, 'railGateway') ? coords(city) : null;
    return [
      buildGoogleMapsLink(fromCity.rail, rail, 'transit', null, useCoords),
      ...getCar(city),
    ].filter(l => l?.url);
  }

  const links = [
    ...getRail(city, departure, fromCity),
    ...getHighwayBus(city, fromCity),
    ...getFlight(city, departure, fromCity),
    ...getFerry(city, departure, fromCity, false),
    ...getSecondary(city),
  ];

  if (!links.length) {
    links.push(buildGoogleMapsLink(fromCity.rail, city.name, 'transit', null, coords(city)));
  }
  links.push(...getCar(city));
  return limitRoutes(links.filter(l => l && (l.url || l.type === 'note')), 3);
}

/* ─────────────────────────────────────────────────
   フォールバック用サブ関数（旧ロジック）
───────────────────────────────────────────────── */
function isFlightAvailable(departure, airportGateway) {
  const fromIata = CITY_AIRPORT[departure];
  const toIata   = AIRPORT_IATA[airportGateway];
  if (!fromIata || !toIata) return false;
  return (FLIGHT_ROUTES[fromIata] ?? []).includes(toIata);
}

function getFlightForIsland(city, departure, fromCity) {
  // CITY_AIRPORT 優先（OSA→ITM 等、具体的な空港名を表示）
  const fromIata = CITY_AIRPORT[departure] || fromCity.iata;
  const airport = gw(city, 'airportGateway');
  if (airport && isFlightAvailable(departure, airport)) {
    return [buildSkyscannerLink(fromIata, airport)].filter(Boolean);
  }
  const hub = city.airportHub;
  if (!hub) return [];
  const hubAirport = AIRPORT_HUB_GATEWAY[hub];
  if (!hubAirport || !isFlightAvailable(departure, hubAirport)) return [];
  return [buildSkyscannerLink(fromIata, hubAirport)].filter(Boolean);
}

/** island の鉄道ゲートウェイ（港付近の駅）への JR リンク */
function getIslandJR(city, departure, fromCity) {
  const hubSt = city.hubStation;
  if (!hubSt) return [];
  const fromSt = fromCity.rail.replace(/駅$/, '');
  const toSt   = hubSt.replace(/駅$/, '');
  if (!fromSt || !toSt || fromSt === toSt) return [];
  const jr = buildJrLink(resolveRailProvider(departure, city), { from: fromSt, to: toSt });
  const links = jr ? [jr] : [];
  // EX 出発地なら追加
  if (jr && jr.type !== 'jr-ex' && EX_CITIES.has(departure)) {
    const exLink = buildJrLink('ex', { from: fromSt, to: toSt });
    if (exLink) links.push(exLink);
  }
  return links;
}

function getRail(city, departure, fromCity) {
  const railGateway = gw(city, 'railGateway');
  if (!railGateway) return [];
  const fromStation = fromCity.rail.replace(/駅$/, '');
  const toStation   = railGateway.replace(/駅$/, '');
  const route = { from: fromStation, to: toStation };
  const provider = resolveRailProvider(departure, city);
  const jr = buildJrLink(provider, route);
  const links = jr ? [jr] : [];
  // スマートEX 追加
  if (jr && jr.type !== 'jr-ex' && EX_CITIES.has(departure)) {
    const exLink = buildJrLink('ex', route);
    if (exLink) links.push(exLink);
  }
  return links;
}

function getFlight(city, departure, fromCity) {
  const airport = gw(city, 'airportGateway');
  if (!airport || !isFlightAvailable(departure, airport)) return [];
  // 400km 以下・海越えなし（island 以外かつ近距離）は飛行機非表示
  const isIsland = !!(city.isIsland || city.destType === 'island');
  if (!isIsland) {
    const stars = calculateDistanceStars(departure, city);
    if (stars < 3) return [];
  }
  // TASK5: CITY_AIRPORT 優先（OSA→ITM 等、具体的な空港名を表示）
  const fromIata = CITY_AIRPORT[departure] || fromCity.iata;
  return [
    buildSkyscannerLink(fromIata, airport),
    buildGoogleFlightsLink(fromIata, airport),
    buildGoogleMapsLink(airport, city.name, 'transit', '空港から市内へ（Googleマップ）', coords(city)),
  ].filter(Boolean);
}

function getFerry(city, departure, fromCity, isIsland) {
  const ferryGateway = gw(city, 'ferryGateway');
  const ferries = ferryGateway ? [ferryGateway] : (city.gateways?.ferry ?? []);
  if (!ferries.length) return [];
  if (isIsland) {
    const port = selectNearestPort(city, departure, ferries);
    if (!port) return [];
    const fl = buildFerryLink(port, city.ferryBookingUrl || null, city.ferryOperator || null);
    // 港への Google Maps: hubStation（港付近の駅）があればそこから、なければ出発駅から
    const mapOrigin = city.hubStation || fromCity.rail;
    return [fl, buildGoogleMapsLink(mapOrigin, port, 'transit', `${port}へのルート（Googleマップ）`)].filter(l => l?.url);
  }
  const fl = buildFerryLink(ferries[0], city.ferryBookingUrl || null, city.ferryOperator || null);
  return fl ? [fl] : [];
}

function getHighwayBus(city, fromCity) {
  const buses = city.gateways?.bus ?? [];
  return buses.map(terminal =>
    buildGoogleMapsLink(fromCity.rail, terminal, 'transit', `高速バスで${terminal}へ（Googleマップ）`)
  );
}

function getSecondary(city) {
  if (gw(city, 'railGateway')) return [];
  const st    = city.secondaryTransport;
  const gwHub = city.gatewayHub;
  if (st && typeof st === 'object' && st.from) {
    return [buildGoogleMapsLink(st.from, st.to, 'transit', `${st.from}からバス（Googleマップ）`, coords(city))];
  }
  if (!st || !gwHub) return [];
  const stType = st;
  const label = stType === 'ferry' ? `フェリーで${city.name}へ（Googleマップ）`
              : stType === 'car'   ? `車で${city.name}へ（Googleマップ）`
              : `バスで${city.name}へ（Googleマップ）`;
  return [buildGoogleMapsLink(gwHub, city.name, 'transit', label, coords(city))];
}

function getCar(city) {
  const isIsland = !!(city.isIsland || city.destType === 'island');
  if (!city.needsCar && !isIsland) return [];
  return [buildRentalLink()];
}

function limitRoutes(links, max) {
  // google-maps:    最大1本（補助扱い、上限カウント外）
  // skyscanner:     最大1本（航空券比較、上限カウント外）
  // google-flights: 最大1本（航空券比較、上限カウント外）
  // other:          最大 max 本（JR/ferry/bus 等のメイン交通手段）
  const maps   = links.filter(l => l.type === 'google-maps').slice(0, 1);
  const sky    = links.filter(l => l.type === 'skyscanner').slice(0, 1);
  const gfl    = links.filter(l => l.type === 'google-flights').slice(0, 1);
  const FLIGHT_TYPES = new Set(['note', 'rental', 'google-maps', 'skyscanner', 'google-flights']);
  const other  = links.filter(l => !FLIGHT_TYPES.has(l.type)).slice(0, max);
  const notes  = links.filter(l => l.type === 'note');
  const rental = links.filter(l => l.type === 'rental');
  return [...sky, ...gfl, ...other].concat(maps, notes, rental);
}

function gw(city, key) {
  return city[key] || city.gateways?.[key]?.[0] || null;
}

/* ─────────────────────────────────────────────────
   ヘルパー
───────────────────────────────────────────────── */
function extractIata(nodeId) {
  if (nodeId?.startsWith('airport:')) return nodeId.replace('airport:', '');
  return null;
}

function iataToName(iata) {
  if (!iata) return null;
  return Object.keys(AIRPORT_IATA).find(k => AIRPORT_IATA[k] === iata) || null;
}

/* ─────────────────────────────────────────────────
   港選択
───────────────────────────────────────────────── */
const PORT_SELECT = {
  'izu-oshima': (dep) => {
    if (dep === '静岡') return '稲取港';
    if (['名古屋','大阪','京都','神戸','広島','福岡'].includes(dep)) return '熱海港';
    return '竹芝客船ターミナル';
  },
  'naoshima': (dep) => (['高松','松山','高知','徳島'].includes(dep) ? '高松港' : '宇野港'),
  'shodoshima': (dep) => (['高松','松山','高知','徳島'].includes(dep) ? '高松港' : '宇野港'),
  'goto': (dep) => (dep === '長崎' ? '長崎港' : '博多港'),
};

function selectNearestPort(city, departure, portHubs) {
  if (!portHubs || portHubs.length === 0) return null;
  if (portHubs.length === 1) return portHubs[0];
  const selector = PORT_SELECT[city.id];
  if (selector) return selector(departure);
  return portHubs[0];
}

/* ─────────────────────────────────────────────────
   JR 予約先選択
───────────────────────────────────────────────── */
const EX_CITIES = new Set([
  '東京','横浜','大宮','品川','名古屋',
  '京都','大阪','神戸','姫路',
  '岡山','広島','小倉','博多','熊本','鹿児島','長崎',
]);

export function resolveRailProvider(departure, city) {
  if (city.railProvider) return city.railProvider;
  if (EX_CITIES.has(departure) && EX_CITIES.has(city.name)) return 'ex';
  const area = DEPARTURE_CITY_INFO[departure]?.jrArea || 'west';
  if (area === 'east')   return 'ekinet';
  if (area === 'kyushu') return 'jrkyushu';
  return 'e5489';
}
