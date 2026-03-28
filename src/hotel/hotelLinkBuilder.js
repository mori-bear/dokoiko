/**
 * 宿泊リンクビルダー
 *
 * 楽天: travel.rakuten.co.jp/yado/list/?keyword={name} — 地名検索
 * じゃらん: jalan.net/search/?keyword={name} — 地名検索
 *
 * エンコードルール:
 *   targetUrl = `${baseUrl}?keyword=${rawName}`  // keyword は生文字列で埋め込む
 *   outer param = encodeURIComponent(targetUrl)   // 外側で1回だけ encode
 *   二重 encode（%25xx）禁止
 *
 * アフィリエイトパラメータは affiliateProviders.json から読み込む。
 */

import { loadJson } from '../lib/loadJson.js';

const AFFILIATE_DB = await loadJson('../data/affiliateProviders.json', import.meta.url);

/**
 * 楽天トラベル アフィリエイトURL
 * pc= パラメータ: encodeURIComponent(travel.rakuten.co.jp/yado/list/?keyword={name})
 */
function buildRakutenUrl(keyword) {
  const { affiliateBaseUrl, affiliateId, hotelSearchUrl } = AFFILIATE_DB.rakuten;
  const targetUrl = `${hotelSearchUrl}?keyword=${keyword}`;
  return `${affiliateBaseUrl}${affiliateId}/?pc=${encodeURIComponent(targetUrl)}&link_type=text`;
}

/**
 * じゃらん ValueCommerce アフィリエイトURL
 * vc_url パラメータ: encodeURIComponent(jalan.net/search/?keyword={name})
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
  const result = {
    heading: `${dest.name}の宿を探す`,
    links: [
      { type: 'rakuten', label: '楽天トラベルで探す', url: buildRakutenUrl(dest.name) },
      { type: 'jalan',   label: 'じゃらんで探す',     url: buildJalanUrl(dest.name) },
    ],
  };

  // ハブ宿: 車必須 or remote/mountain + gatewayHub が設定されている場合
  const needsHub = dest.needsCar || dest.destType === 'remote' || dest.destType === 'mountain';
  if (needsHub && dest.gatewayHub && dest.gatewayHub !== dest.name) {
    result.hubLinks = {
      heading: `${dest.gatewayHub}の宿（拠点として）`,
      links: [
        { type: 'rakuten', label: '楽天トラベルで探す', url: buildRakutenUrl(dest.gatewayHub) },
        { type: 'jalan',   label: 'じゃらんで探す',     url: buildJalanUrl(dest.gatewayHub) },
      ],
    };
  }

  return result;
}
