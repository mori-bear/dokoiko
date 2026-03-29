/**
 * 宿泊リンクビルダー
 *
 * 楽天: hotelAreas.json の rakutenPath → travel.rakuten.co.jp エリアページ
 *   (/yado/{pref}/{area}.html または /yado/{pref}/)
 *
 * じゃらん: uww2011init.do?keyword={hotelKeyword}&screenId=UWW1402
 *
 * エンコードルール:
 *   じゃらん keyword: encodeURIComponent 1回のみ（UTF-8）
 *   楽天: パスを直接使用（URLエンコード不要）
 */

import { loadJson } from '../lib/loadJson.js';

/* hotelAreas.json を起動時に1回ロード */
const HOTEL_AREAS = await loadJson('../data/hotelAreas.json', import.meta.url);
const AREAS_BY_ID = new Map(HOTEL_AREAS.map(a => [a.id, a]));

/**
 * destinations.json の ID と hotelAreas.json の ID が異なるケースの対応
 * （destinations で同名地が複数ある場合 -t / -o / -k 等のサフィックスが付く）
 */
const DEST_TO_AREA_ID = {
  'shirakawago-t':   'shirakawago',
  'kurashiki-o':     'kurashiki',
  'takayama-o':      'takayama',
  'kurokawa-k':      'kurokawa',
  'esashi-hokkaido': 'esashi',
};

function lookupArea(destId) {
  const areaId = DEST_TO_AREA_ID[destId] ?? destId;
  return AREAS_BY_ID.get(areaId) ?? null;
}

/**
 * 楽天トラベル: hotelAreas.json の rakutenPath または rakutenFallback を使用
 */
function buildRakutenUrl(dest) {
  const area = lookupArea(dest.id);
  const path = area?.rakutenPath || area?.rakutenFallback || null;
  return `https://travel.rakuten.co.jp${path ?? '/'}`;
}

/**
 * 楽天トラベル: 拠点都市名からエリアを検索（name 一致）
 * 見つかった場合のみ URL を返す（見つからない場合 null）
 */
function buildRakutenUrlByName(cityName) {
  const area = HOTEL_AREAS.find(a => a.name === cityName);
  const path = area?.rakutenPath || area?.rakutenFallback || null;
  return path ? `https://travel.rakuten.co.jp${path}` : null;
}

/**
 * じゃらん: uww2011init.do キーワード検索（UTF-8）
 */
function buildJalanUrl(keyword) {
  return `https://www.jalan.net/uw/uwp2011/uww2011init.do?keyword=${encodeURIComponent(keyword)}&screenId=UWW1402`;
}

/**
 * @param {object} dest — destination エントリ
 * @returns {{ heading: string, links: Array, hubLinks?: {heading, links} }}
 */
export function buildHotelLinks(dest) {
  const keyword = dest.hotelKeyword ?? dest.name;
  const uiName  = dest.displayName || dest.name;

  const result = {
    heading: `${uiName}で泊まる`,
    links: [
      { type: 'rakuten', label: `${uiName}の宿を探す（楽天）`, url: buildRakutenUrl(dest) },
      { type: 'jalan',   label: `${uiName}の宿を見る（じゃらん）`, url: buildJalanUrl(keyword) },
    ],
  };

  // ハブ宿: 車必須 or remote/mountain + gatewayHub が設定されている場合
  const needsHub = dest.needsCar || dest.destType === 'remote' || dest.destType === 'mountain';
  if (needsHub && dest.gatewayHub && dest.gatewayHub !== dest.name) {
    const hubRakutenUrl = buildRakutenUrlByName(dest.gatewayHub);
    result.hubLinks = {
      heading: `${dest.gatewayHub}で泊まる（拠点）`,
      links: [
        ...(hubRakutenUrl
          ? [{ type: 'rakuten', label: `${dest.gatewayHub}の宿を探す（楽天）`, url: hubRakutenUrl }]
          : []),
        { type: 'jalan', label: `${dest.gatewayHub}の宿を見る（じゃらん）`, url: buildJalanUrl(dest.gatewayHub) },
      ],
    };
  }

  return result;
}
