/**
 * プラン生成エンジン v3
 *
 * データ構造:
 *   destination.transitPatterns[] — 最大3パターン
 *     { rank, rankLabel, mode, desc, duration, links[] }
 *     links[]: "yahoo"|"jr-east"|"jr-west"|"jr-kyushu"|"highwaybus"|"flight"|"ferry"
 *
 * フィルタ:
 *   filterDestinations(destinations, departure, level, region, budget)
 *   region: "全国" or "北海道"|"東北"|"関東"|"中部"|"近畿"|"中国"|"四国"|"九州"
 *   budget: ""|"~2"|"2-5"|"5+"
 */
import { buildYahooUrl } from '../links/yahoo.js';
import { buildRakutenUrl } from '../links/rakuten.js';
import { generateJalanLink } from '../links/jalan.js';

/** データ region → UI フィルタ地方 */
const REGION_FILTER_MAP = {
  '北海道': '北海道',
  '東北':   '東北',
  '関東':   '関東',
  '甲信':   '中部',
  '甲信越': '中部',
  '信越':   '中部',
  '東海':   '中部',
  '北陸':   '中部',
  '中部':   '中部',
  '近畿':   '近畿',
  '中国':   '中国',
  '四国':   '四国',
  '九州':   '九州',
  '沖縄':   '九州',
};

/** 出発地 + 距離 + 地方 + 予算でフィルタリング */
export function filterDestinations(destinations, departure, level, region = '全国', budget = '') {
  return destinations.filter((d) => {
    if (!d.from.includes(departure)) return false;
    if (d.distanceLevel !== level) return false;
    if (region !== '全国') {
      const filterRegion = REGION_FILTER_MAP[d.region] || d.region;
      if (filterRegion !== region) return false;
    }
    if (budget && d.budget !== budget) return false;
    return true;
  });
}

/** 抽選: 候補からランダムに1件 */
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
    transitPatterns: buildTransitPatterns(destination, date, time, departure),
    accommodationLinks: hasStay ? buildAccommodationLinks(destination, date, stayType) : [],
  };
}

function buildTransitPatterns(destination, date, time, departure) {
  const patterns = destination.transitPatterns || [];
  return patterns.map((p) => ({
    rank: p.rank,
    rankLabel: p.rankLabel,
    mode: p.mode,
    desc: p.desc,
    duration: p.duration,
    links: buildPatternLinks(p.links || [], destination, date, time, departure),
  }));
}

function buildPatternLinks(linkTypes, destination, date, time, departure) {
  return linkTypes.map((linkType) => {
    switch (linkType) {
      case 'yahoo':
        return {
          type: 'yahoo',
          label: '乗換案内（Yahoo!路線情報）',
          url: buildYahooUrl(destination, date, time, departure),
        };
      case 'jr-east':
        return {
          type: 'jr-east',
          label: '新幹線予約（えきねっと）',
          url: 'https://www.eki-net.com/',
        };
      case 'jr-west':
        return {
          type: 'jr-west',
          label: '新幹線予約（e5489）',
          url: 'https://www.jr-odekake.net/goyoyaku/',
        };
      case 'jr-kyushu':
        return {
          type: 'jr-kyushu',
          label: '新幹線予約（JR九州）',
          url: 'https://train.yoyaku.jrkyushu.co.jp/',
        };
      case 'highwaybus':
        return {
          type: 'highwaybus',
          label: '高速バスで比較する',
          url: 'https://www.bushikaku.net/',
        };
      case 'flight':
        return {
          type: 'flight',
          label: '航空券を探す',
          url: null,
        };
      case 'ferry':
        return {
          type: 'ferry',
          label: 'フェリーで渡る',
          url: destination.ferryUrl || null,
        };
      default:
        return null;
    }
  }).filter(Boolean);
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
