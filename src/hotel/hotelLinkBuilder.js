/**
 * 宿泊リンクビルダー
 *
 * 楽天: travel.rakuten.co.jp/yado/{hotelArea}/ — 都道府県エリアページ直リンク
 * じゃらん: jalan.net/uw/uwp2011/uww2011init.do?keyword= — 直リンク
 *
 * アフィリエイトパラメータは affiliateProviders.json から読み込む。
 */

import AFFILIATE_DB from '../data/affiliateProviders.json' with { type: 'json' };

function buildRakutenUrl(area) {
  const targetUrl = area
    ? AFFILIATE_DB.rakuten.hotelBaseUrl.replace('{area}', area)
    : 'https://travel.rakuten.co.jp/';
  const { affiliateBaseUrl, affiliateId } = AFFILIATE_DB.rakuten;
  return `${affiliateBaseUrl}${affiliateId}/?pc=${encodeURIComponent(targetUrl)}&link_type=text`;
}

function buildJalanUrl(keyword) {
  const targetUrl = `${AFFILIATE_DB.jalan.hotelBaseUrl}?${AFFILIATE_DB.jalan.hotelParamKey}=${encodeURIComponent(keyword)}`;
  const { vcSid, vcPid } = AFFILIATE_DB.jalan;
  return `https://ck.jp.ap.valuecommerce.com/servlet/referral?sid=${vcSid}&pid=${vcPid}&vc_url=${encodeURIComponent(targetUrl)}`;
}

/**
 * @param {object} dest — destination エントリ
 * @returns {{ heading: string, links: Array, hubLinks?: {heading, links} }}
 */
export function buildHotelLinks(dest) {
  const result = {
    heading: 'この近くで泊まる',
    links: [
      { type: 'rakuten', label: '楽天トラベルで探す', url: buildRakutenUrl(dest.hotelArea) },
      { type: 'jalan',   label: 'じゃらんで探す',     url: buildJalanUrl(dest.name) },
    ],
  };

  // ハブ宿: 車必須 or remote/mountain + gatewayHub が設定されている場合
  const needsHub = dest.needsCar || dest.destType === 'remote' || dest.destType === 'mountain';
  if (needsHub && dest.gatewayHub && dest.gatewayHub !== dest.name) {
    result.hubLinks = {
      heading: `${dest.gatewayHub}の宿（拠点として）`,
      links: [
        { type: 'rakuten', label: '楽天トラベルで探す', url: buildRakutenUrl(null) },
        { type: 'jalan',   label: 'じゃらんで探す',     url: buildJalanUrl(dest.gatewayHub) },
      ],
    };
  }

  return result;
}
