/**
 * 宿泊リンクビルダー
 *
 * 楽天: travel.rakuten.co.jp/yado/list/?keyword={keyword} — 地名+宿/ホテル検索
 * じゃらん: jalan.net/search/?keyword={keyword} — 地名+宿/ホテル検索
 *
 * keywordルール:
 *   onsen → "{name} 宿"（旅館・宿系）
 *   その他 → "{name} ホテル"（観光地・都市系）
 *
 * エンコードルール:
 *   targetUrl = `${baseUrl}?keyword=${rawKeyword}`  // keyword は生文字列で埋め込む
 *   outer param = encodeURIComponent(targetUrl)      // 外側で1回だけ encode
 *   二重 encode（%25xx）禁止
 *
 * アフィリエイトパラメータは affiliateProviders.json から読み込む。
 */

import { loadJson } from '../lib/loadJson.js';

const AFFILIATE_DB = await loadJson('../data/affiliateProviders.json', import.meta.url);

/**
 * 地名を検索用に正規化する。
 * 「温泉郷」は宿検索で結果が少ないため「温泉」に置換する。
 */
function normalizeKeyword(name) {
  return name.replace(/温泉郷$/, '温泉');
}

/**
 * destType に応じた検索キーワードを生成する。
 * onsen → "{name} 宿"、それ以外 → "{name} ホテル"
 * 「温泉郷」は「温泉」に正規化して検索精度を上げる。
 */
function getKeyword(name, destType) {
  const normalized = normalizeKeyword(name);
  const suffix = (destType === 'onsen') ? '宿' : 'ホテル';
  return `${normalized} ${suffix}`;
}

/**
 * 楽天トラベル アフィリエイトURL
 * pc= パラメータ: encodeURIComponent(travel.rakuten.co.jp/yado/list/?keyword={keyword})
 */
function buildRakutenUrl(keyword) {
  const { affiliateBaseUrl, affiliateId, hotelSearchUrl } = AFFILIATE_DB.rakuten;
  const targetUrl = `${hotelSearchUrl}?keyword=${keyword}`;
  return `${affiliateBaseUrl}${affiliateId}/?pc=${encodeURIComponent(targetUrl)}&link_type=text`;
}

/**
 * じゃらん ValueCommerce アフィリエイトURL
 * vc_url パラメータ: encodeURIComponent(jalan.net/search/?keyword={keyword})
 */
function buildJalanUrl(keyword) {
  const { hotelSearchUrl, vcSid, vcPid } = AFFILIATE_DB.jalan;
  const targetUrl = `${hotelSearchUrl}?keyword=${keyword}`;
  return `https://ck.jp.ap.valuecommerce.com/servlet/referral?sid=${vcSid}&pid=${vcPid}&vc_url=${encodeURIComponent(targetUrl)}`;
}

/**
 * @param {object} dest — destination エントリ
 * @returns {{ heading: string, links: Array, hubLinks?: {heading, links} }}
 */
export function buildHotelLinks(dest) {
  // UI表示はdisplayName優先（例: 加賀温泉郷→加賀温泉）、検索はname正規化
  const uiName  = dest.displayName || dest.name;
  const keyword = getKeyword(dest.name, dest.destType);
  const result = {
    heading: `${uiName}で泊まる`,
    links: [
      { type: 'rakuten', label: `${uiName}の宿を探す（楽天）`, url: buildRakutenUrl(keyword) },
      { type: 'jalan',   label: `${uiName}の宿を見る（じゃらん）`, url: buildJalanUrl(keyword) },
    ],
  };

  // ハブ宿: 車必須 or remote/mountain + gatewayHub が設定されている場合
  const needsHub = dest.needsCar || dest.destType === 'remote' || dest.destType === 'mountain';
  if (needsHub && dest.gatewayHub && dest.gatewayHub !== dest.name) {
    const hubKeyword = getKeyword(dest.gatewayHub, 'city');
    result.hubLinks = {
      heading: `${dest.gatewayHub}で泊まる（拠点）`,
      links: [
        { type: 'rakuten', label: `${dest.gatewayHub}の宿を探す（楽天）`, url: buildRakutenUrl(hubKeyword) },
        { type: 'jalan',   label: `${dest.gatewayHub}の宿を見る（じゃらん）`, url: buildJalanUrl(hubKeyword) },
      ],
    };
  }

  return result;
}
