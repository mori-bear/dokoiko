/**
 * プラン生成エンジン
 *
 * 表示ルール:
 *   railType "jr"      → Yahoo乗換 + JR予約（jrAreaで分岐）
 *   railType "private" → Yahoo乗換のみ
 *   railType "none"    → 鉄道導線なし
 *   jrArea "east"      → えきねっと
 *   jrArea "west"      → e5489（JR西日本）
 *   jrArea "kyushu"    → 九州ネット予約
 *   transportType "flight" → 飛行機テキスト（現地移動ブロック）
 *   transportType "bus"    → バステキスト（現地移動ブロック）
 *   transportType "ferry"  → フェリーテキスト（現地移動ブロック）
 *   transportType "car"    → レンタカーリンク（現地移動ブロック）
 *   intercityAlternatives "highwaybus" → 高速バス比較ブロック
 *   stayType 1night/2night → 楽天 + じゃらんリンク
 *
 * 表示順: rail → highwaybus → flight → ferry → car → stay
 */
import { buildYahooUrl } from '../links/yahoo.js';
import { buildRakutenUrl } from '../links/rakuten.js';
import { generateJalanLink } from '../links/jalan.js';

export function filterByDistance(destinations, level) {
  return destinations.filter((d) => d.distanceLevel === level);
}

/** 抽選: 候補からランダムに1件選ぶ */
export function drawDestination(destinations) {
  if (destinations.length === 0) return null;
  return destinations[Math.floor(Math.random() * destinations.length)];
}

export function generatePlan(destination, options = {}) {
  const { date = null, time = null, stayType = 'daytrip', departure = '東京' } = options;
  const hasStay = stayType === '1night' || stayType === '2night';

  return {
    destination,
    stayType,
    transitLinks: buildTransitLinks(destination, date, time, departure),
    localItems: buildLocalItems(destination),
    alternativeLinks: buildAlternativeLinks(destination),
    accommodationLinks: hasStay ? buildAccommodationLinks(destination, date, stayType) : [],
  };
}

function buildTransitLinks(destination, date, time, departure) {
  const { transportType, railType, jrArea } = destination;
  const links = [];

  // 鉄道のみ（flight はローカルブロックへ移動）
  if (transportType.includes('rail') && railType !== 'none') {
    links.push({
      type: 'yahoo',
      label: '乗換案内を見る（Yahoo!路線情報）',
      url: buildYahooUrl(destination, date, time, departure),
    });

    if (railType === 'jr') {
      const jrLink = buildJrLink(jrArea);
      if (jrLink) links.push(jrLink);
    }
  }

  return links;
}

function buildJrLink(jrArea) {
  if (jrArea === 'east') {
    return {
      type: 'jr',
      label: '新幹線を予約する（えきねっと）',
      url: 'https://www.eki-net.com/',
    };
  }
  if (jrArea === 'west') {
    return {
      type: 'jr',
      label: '新幹線を予約する（e5489）',
      url: 'https://www.jr-odekake.net/goyoyaku/',
    };
  }
  if (jrArea === 'kyushu') {
    return {
      type: 'jr',
      label: '新幹線を予約する（JR九州）',
      url: 'https://train.yoyaku.jrkyushu.co.jp/',
    };
  }
  return null;
}

function buildLocalItems(destination) {
  const { transportType } = destination;
  const items = [];

  // 飛行機（交通比較の後・現地移動の前に表示）
  if (transportType.includes('flight')) {
    items.push({
      type: 'flight',
      label: '飛行機でアクセスできます',
      url: null,
    });
  }

  // バス
  if (transportType.includes('bus')) {
    items.push({
      type: 'bus',
      label: 'バスでアクセスできます',
      url: null,
    });
  }

  // 4. フェリー
  if (transportType.includes('ferry')) {
    items.push({
      type: 'ferry',
      label: 'フェリーでアクセスできます',
      url: null,
    });
  }

  // 5. レンタカー
  if (transportType.includes('car')) {
    const fromAir = transportType.includes('flight');
    items.push({
      type: 'car',
      label: fromAir
        ? '空港からレンタカーで移動できます'
        : 'レンタカーで移動できます',
      url: 'https://www.jalan.net/drive/',
    });
  }

  return items;
}

function buildAlternativeLinks(destination) {
  const items = [];
  const { intercityAlternatives = [] } = destination;

  if (intercityAlternatives.includes('highwaybus')) {
    items.push({
      type: 'highwaybus',
      label: '高速バスで比較する',
      url: 'https://www.bushikaku.net/',
    });
  }

  return items;
}

function buildAccommodationLinks(destination, date, stayType) {
  return [
    {
      type: 'rakuten',
      label: '楽天トラベル',
      url: buildRakutenUrl(destination, date, stayType),
    },
    {
      type: 'jalan',
      label: 'じゃらん',
      url: generateJalanLink(destination),
    },
  ];
}
