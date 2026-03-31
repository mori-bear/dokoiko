/**
 * 宿泊リンクビルダー
 *
 * 楽天: hb.afl.rakuten.co.jp アフィリエイト経由
 *   → travel.rakuten.co.jp/yado/{pref}/{area}.html に飛ぶ
 *   エリアは hotelAreas.json の rakutenPath / rakutenFallback を使用
 *
 * じゃらん: ValueCommerce 経由
 *   → jalan.net/uw/uwp2011/uww2011init.do?keyword={keyword} に飛ぶ
 *
 * エンコードルール:
 *   じゃらん keyword: encodeURIComponent 1回のみ（UTF-8）
 *   楽天リンク先URL: encodeURIComponent 1回のみ
 */

import { loadJson } from '../lib/loadJson.js';

/* hotelAreas.json / affiliateProviders.json を起動時に1回ロード */
const HOTEL_AREAS  = await loadJson('../data/hotelAreas.json',        import.meta.url);
const AFFILIATE    = await loadJson('../data/affiliateProviders.json', import.meta.url);
const AREAS_BY_ID  = new Map(HOTEL_AREAS.map(a => [a.id, a]));

/* アフィリエイト設定 */
const RAKUTEN_AFID = AFFILIATE.rakuten.affiliateId;   // 5113ee4b.8662cfc5.5113ee4c.119de89a
const JALAN_VC_SID = AFFILIATE.jalan.vcSid;           // 3764408
const JALAN_VC_PID = AFFILIATE.jalan.vcPid;           // 892559858

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
 * 楽天エリアページ URL（アフィリエイトなし）
 * hotelAreas.json の rakutenPath → rakutenFallback → /（トップ）の優先順
 */
function buildRakutenDestUrl(dest) {
  const area = lookupArea(dest.id);
  const path = area?.rakutenPath || area?.rakutenFallback || null;
  return `https://travel.rakuten.co.jp${path ?? '/'}`;
}

/**
 * 楽天トラベル: 拠点都市名からエリアURLを取得（name 一致）
 */
function buildRakutenDestUrlByName(cityName) {
  const area = HOTEL_AREAS.find(a => a.name === cityName);
  const path = area?.rakutenPath || area?.rakutenFallback || null;
  return path ? `https://travel.rakuten.co.jp${path}` : null;
}

/**
 * 楽天アフィリエイトリンク
 * https://hb.afl.rakuten.co.jp/hgc/{affiliateId}/?pc={encodedDestUrl}
 */
function buildRakutenUrl(dest) {
  const destUrl = buildRakutenDestUrl(dest);
  return `https://hb.afl.rakuten.co.jp/hgc/${RAKUTEN_AFID}/?pc=${encodeURIComponent(destUrl)}`;
}

function buildRakutenUrlByName(cityName) {
  const destUrl = buildRakutenDestUrlByName(cityName);
  if (!destUrl) return null;
  return `https://hb.afl.rakuten.co.jp/hgc/${RAKUTEN_AFID}/?pc=${encodeURIComponent(destUrl)}`;
}

/**
 * じゃらん ValueCommerce アフィリエイトリンク
 * https://ck.jp.ap.valuecommerce.com/servlet/referral?sid={sid}&pid={pid}&vc_url={encodedJalanUrl}
 *
 * リンク先: uww2011init.do?keyword={keyword}&screenId=UWW1402
 * エンコード: keyword は encodeURIComponent 1回のみ
 */
function buildJalanUrl(keyword) {
  const jalanUrl = `https://www.jalan.net/uw/uwp2011/uww2011init.do?keyword=${encodeURIComponent(keyword)}&screenId=UWW1402`;
  return `https://ck.jp.ap.valuecommerce.com/servlet/referral?sid=${JALAN_VC_SID}&pid=${JALAN_VC_PID}&vc_url=${encodeURIComponent(jalanUrl)}`;
}

/**
 * @param {object} dest — destination エントリ
 * @returns {{ heading: string, links: Array, hubLinks?: {heading, links} }}
 */
export function buildHotelLinks(dest) {
  const keyword = dest.hotelKeyword ?? dest.name;
  const uiName  = dest.displayName || dest.name;

  /* ── 現地宿（必須） ── */
  const result = {
    heading: `現地で泊まる`,
    links: [
      { type: 'rakuten', label: `このまま${uiName}で泊まる（楽天）`,  url: buildRakutenUrl(dest) },
      { type: 'jalan',   label: `空室を確認する（じゃらん）`,          url: buildJalanUrl(keyword) },
    ],
  };

  /* ── ハブ宿（条件付き）── */
  /* 車必須 / remote / mountain で gatewayHub が設定されている場合のみ */
  const needsHub = dest.needsCar || dest.destType === 'remote' || dest.destType === 'mountain';
  if (needsHub && dest.gatewayHub && dest.gatewayHub !== dest.name) {
    const hub = dest.gatewayHub;
    const hubRakutenUrl = buildRakutenUrlByName(hub);
    result.hubLinks = {
      heading: `アクセスの良い場所で泊まる（${hub}）`,
      links: [
        ...(hubRakutenUrl
          ? [{ type: 'rakuten', label: `${hub}で泊まる（楽天）`,          url: hubRakutenUrl }]
          : []),
        { type: 'jalan',   label: `アクセス重視で宿を見る（じゃらん）`, url: buildJalanUrl(hub) },
      ],
    };
  }

  return result;
}
