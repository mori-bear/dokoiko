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
 *   じゃらん keyword: hotelAreas.json の Shift-JIS 済み jalanUrl を優先使用
 *   楽天リンク先URL: encodeURIComponent 1回のみ
 *
 * 3段フォールバック（楽天・じゃらん共通）:
 *   Tier1: dest自身の hotelAreas エントリ（area-specific）
 *   Tier2: dest.fallbackCity → hotelAreas エントリ（weak時またはTier1失敗時）
 *   Tier3: dest.prefecture のキーワード検索（最終手段）
 *
 * weak判定: requiresCar=true かつ destType=mountain/remote のとき
 */

import { loadJson } from '../lib/loadJson.js';

/* hotelAreas.json / affiliateProviders.json を起動時に1回ロード */
const HOTEL_AREAS  = await loadJson('../data/hotelAreas.json',        import.meta.url);
const AFFILIATE    = await loadJson('../data/affiliateProviders.json', import.meta.url);
const AREAS_BY_ID  = new Map(HOTEL_AREAS.map(a => [a.id, a]));
const AREAS_BY_NAME = new Map(HOTEL_AREAS.map(a => [a.name, a]));

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

/**
 * weak判定: 宿が非常に少ない（山奥・極地）系の目的地
 * Tier2（fallbackCity）を優先使用する
 */
function isWeak(dest) {
  return !!(dest.requiresCar && (dest.destType === 'mountain' || dest.destType === 'remote'));
}

function lookupAreaById(destId) {
  const areaId = DEST_TO_AREA_ID[destId] ?? destId;
  return AREAS_BY_ID.get(areaId) ?? null;
}

function lookupAreaByName(name) {
  return AREAS_BY_NAME.get(name) ?? null;
}

/**
 * 楽天エリアページ URL
 * 優先: area.rakutenPath → area.rakutenFallback → dest.hotelArea パス
 */
function getRakutenPath(area, dest) {
  return area?.rakutenPath
    || area?.rakutenFallback
    || (dest?.hotelArea ? `/yado/${dest.hotelArea}/` : null);
}

function buildRakutenDestUrl(path) {
  return `https://travel.rakuten.co.jp${path ?? '/'}`;
}

function buildRakutenAffilUrl(destUrl) {
  return `https://hb.afl.rakuten.co.jp/hgc/${RAKUTEN_AFID}/?pc=${encodeURIComponent(destUrl)}`;
}

/**
 * じゃらん VC アフィリエイトリンク
 * rawJalanUrl は Shift-JIS 済み URL を使う（hotelAreas.json の jalanUrl）
 */
function buildJalanAffilUrl(rawJalanUrl) {
  return `https://ck.jp.ap.valuecommerce.com/servlet/referral?sid=${JALAN_VC_SID}&pid=${JALAN_VC_PID}&vc_url=${encodeURIComponent(rawJalanUrl)}`;
}

/**
 * 3段フォールバックで楽天URLを解決
 */
function resolveRakutenUrl(dest) {
  // Tier1: dest自身のエリア（weak でなければ優先）
  if (!isWeak(dest)) {
    const area = lookupAreaById(dest.id);
    const path = getRakutenPath(area, dest);
    if (path) return buildRakutenAffilUrl(buildRakutenDestUrl(path));
  }

  // Tier2: fallbackCity
  if (dest.fallbackCity) {
    const fbArea = lookupAreaByName(dest.fallbackCity);
    const path = getRakutenPath(fbArea, null);
    if (path) return buildRakutenAffilUrl(buildRakutenDestUrl(path));
  }

  // Tier3: dest 自身のエリア（weak でも強制使用）
  const area = lookupAreaById(dest.id);
  const path = getRakutenPath(area, dest);
  return buildRakutenAffilUrl(buildRakutenDestUrl(path));
}

/**
 * 3段フォールバックでじゃらんURLを解決
 */
function resolveJalanUrl(dest) {
  // Tier1: dest自身のエリア（weak でなければ優先）
  if (!isWeak(dest)) {
    const area = lookupAreaById(dest.id);
    if (area?.jalanUrl) return buildJalanAffilUrl(area.jalanUrl);
  }

  // Tier2: fallbackCity
  if (dest.fallbackCity) {
    const fbArea = lookupAreaByName(dest.fallbackCity);
    if (fbArea?.jalanUrl) return buildJalanAffilUrl(fbArea.jalanUrl);
  }

  // Tier3: dest 自身のエリア（weak でも使用 — 都道府県レベルでも0より良い）
  const area = lookupAreaById(dest.id);
  if (area?.jalanUrl) return buildJalanAffilUrl(area.jalanUrl);

  // 最終安全網: 見つからない場合は生じない想定だが念のため
  return null;
}

/**
 * @param {object} dest — destination エントリ
 * @returns {{ heading: string, links: Array, hubLinks?: {heading, links} }}
 */
export function buildHotelLinks(dest) {
  /* ── 現地宿（必須） ── */
  const rakutenUrl = resolveRakutenUrl(dest);
  const jalanUrl   = resolveJalanUrl(dest);

  const result = {
    heading: `現地で泊まる`,
    links: [
      ...(rakutenUrl ? [{ type: 'rakuten', label: '楽天で宿を見る',   url: rakutenUrl }] : []),
      ...(jalanUrl   ? [{ type: 'jalan',   label: 'じゃらんで宿を見る', url: jalanUrl }] : []),
    ],
  };

  /* ── ハブ宿（条件付き）── */
  /* 車必須 / remote / mountain で gatewayHub が設定されている場合のみ */
  const needsHub = dest.needsCar || dest.destType === 'remote' || dest.destType === 'mountain';
  if (needsHub && dest.gatewayHub && dest.gatewayHub !== dest.name) {
    const hub = dest.gatewayHub;
    const hubArea = lookupAreaByName(hub);
    const hubRakutenPath = getRakutenPath(hubArea, null);
    const hubRakutenUrl  = hubRakutenPath
      ? buildRakutenAffilUrl(buildRakutenDestUrl(hubRakutenPath))
      : null;
    const hubJalanUrl = hubArea?.jalanUrl ? buildJalanAffilUrl(hubArea.jalanUrl) : null;

    if (hubRakutenUrl || hubJalanUrl) {
      result.hubLinks = {
        heading: `アクセスの良い場所で泊まる（${hub}）`,
        links: [
          ...(hubRakutenUrl ? [{ type: 'rakuten', label: '楽天で宿を見る',   url: hubRakutenUrl }] : []),
          ...(hubJalanUrl   ? [{ type: 'jalan',   label: 'じゃらんで宿を見る', url: hubJalanUrl }] : []),
        ],
      };
    }
  }

  return result;
}
