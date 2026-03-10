import { DEPARTURE_CITY_INFO } from '../config/constants.js';
import {
  buildGoogleMapsLink,
  buildSkyscannerLink,
  buildJrLink,
  buildFerryLink,
  buildRentalLink,
} from './linkBuilder.js';

/**
 * 交通リンクを組み立てる（2段階ルーティング）。
 *
 * Stage1: 出発地 → accessHub / airportGateway / portHub
 *   鉄道 / 飛行機 / フェリー
 *
 * Stage2: accessHub → 目的地（二次交通ノート）
 *   バス / 私鉄 / ローカル
 *
 * 表示順: 鉄道 → 飛行機 → フェリー → GoogleMaps → レンタカー
 *
 * 特例:
 *   ★1（近場）     → GoogleMaps のみ
 *   portHubs（島） → フェリー + GoogleMaps（港まで）+ レンタカー（early return）
 */
export function resolveTransportLinks(city, departure) {
  const fromCity = DEPARTURE_CITY_INFO[departure];
  if (!fromCity) return [];

  const dest   = city.name;
  const stars  = city.distanceStars ?? 0;
  const access = city.access ?? {};

  const railGateway    = access.railGateway    ?? null;
  const accessHub      = access.accessHub      ?? null;
  const airportGateway = access.airportGateway ?? null;
  const ferryGateway   = access.ferryGateway   ?? null;
  const railNote       = access.railNote        ?? null;
  const portHubs       = access.portHubs        ?? [];

  // 島・portHubs（フェリーが主要手段 — 早期リターン）★1より先に判定
  if (portHubs.length > 0) {
    const port = selectNearestPort(city, departure, portHubs);
    const ls = [];
    if (port) {
      const fl = buildFerryLink(port);
      if (fl) ls.push(fl);
      ls.push(buildGoogleMapsLink(fromCity.rail, port, 'transit'));
    }
    if (city.isIsland || city.needsCar) ls.push(buildRentalLink());
    return ls.filter(l => l?.url);
  }

  // ★1: 近場 → GoogleMaps のみ
  if (stars === 1) {
    const ls = [buildGoogleMapsLink(fromCity.rail, dest, 'transit')];
    if (city.needsCar) ls.push(buildRentalLink());
    return ls.filter(l => l?.url);
  }

  // 全ルート収集（マルチルート方式）
  const links = [];

  // ── JR / 鉄道ルート（Stage 1: 出発地 → railGateway）──
  if (railGateway) {
    const jrLink = buildJrLink(resolveRailProvider(departure, city));
    if (jrLink) links.push(jrLink);

    // Stage2ノート: accessHub → 目的地（バス等）
    if (accessHub && railNote) {
      links.push({ type: 'note', label: `${accessHub} → ${dest}（${railNote}）`, url: null });
    }

    // GoogleMaps: airportがない場合のみ出発地→目的地
    if (!airportGateway) {
      links.push(buildGoogleMapsLink(fromCity.rail, dest, 'transit'));
    }
  }

  // ── 飛行機ルート（Stage 1: 出発地 → airportGateway）──
  if (airportGateway) {
    const sc = buildSkyscannerLink(fromCity.iata, airportGateway);
    if (sc) links.push(sc);
    // Stage2: 空港 → 目的地市内
    links.push(buildGoogleMapsLink(airportGateway, dest, 'transit', '空港から市内へ（Googleマップ）'));
  }

  // ── フェリールート（portHubsなし）──
  if (ferryGateway) {
    const fl = buildFerryLink(ferryGateway);
    if (fl) links.push(fl);
    // フェリーのみ（他手段なし）→ 出発地→港 GoogleMaps
    if (!railGateway && !airportGateway) {
      links.push(buildGoogleMapsLink(fromCity.rail, ferryGateway, 'transit'));
    }
  }

  // どの手段もない → GoogleMaps のみ
  if (!railGateway && !airportGateway && !ferryGateway) {
    links.push(buildGoogleMapsLink(fromCity.rail, dest, 'transit'));
  }

  // レンタカー（needsCar=true または isIsland）
  if (city.needsCar || city.isIsland) links.push(buildRentalLink());

  return links.filter(l => l && (l.url || l.type === 'note'));
}

/**
 * portHubs から出発地に最も近い港を選択する。
 */
const PORT_SELECT = {
  'izu-oshima': (dep) => {
    if (dep === '静岡') return '稲取港';
    if (['名古屋', '大阪', '京都', '神戸', '広島', '福岡'].includes(dep)) return '熱海港';
    return '竹芝客船ターミナル';
  },
  'naoshima': (dep) => {
    if (['高松', '松山', '高知', '徳島'].includes(dep)) return '高松港';
    return '宇野港';
  },
  'shodoshima': (dep) => {
    if (['高松', '松山', '高知', '徳島'].includes(dep)) return '高松港';
    return '宇野港';
  },
  'goto': (dep) => {
    if (dep === '長崎') return '長崎港';
    return '博多港';
  },
};

function selectNearestPort(city, departure, portHubs) {
  if (!portHubs || portHubs.length === 0) return null;
  if (portHubs.length === 1) return portHubs[0];
  const selector = PORT_SELECT[city.id];
  if (selector) return selector(departure);
  return portHubs[0];
}

/**
 * スマートEX: 東海道・山陽・九州新幹線
 */
const EX_CITIES = new Set([
  '東京', '横浜', '大宮', '品川',
  '名古屋',
  '京都', '大阪', '神戸', '姫路',
  '岡山', '広島', '小倉', '博多', '熊本', '鹿児島', '長崎',
]);

function resolveRailProviderByName(departure, targetCityName) {
  if (EX_CITIES.has(departure) && EX_CITIES.has(targetCityName)) return 'ex';
  const area = DEPARTURE_CITY_INFO[departure]?.jrArea || 'west';
  if (area === 'east')   return 'ekinet';
  if (area === 'kyushu') return 'jrkyushu';
  return 'e5489';
}

function resolveRailProvider(departure, city) {
  return resolveRailProviderByName(departure, city.name);
}
