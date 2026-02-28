import { RAKUTEN_AFF_ID } from '../config/constants.js';

/**
 * 宿泊リンクを組み立てる。
 *
 * stayType === '1night' かつ affiliate.hotelArea が存在する場合のみ返す。
 * 返り値: { destination: Link[], hub: Link[] }
 */
export function buildHotelLinks(city, date, stayType) {
  if (stayType !== '1night') {
    return { destination: [], hub: [] };
  }
  if (!city.affiliate?.hotelArea) {
    return { destination: [], hub: [] };
  }

  const area     = city.affiliate.hotelArea;
  const checkIn  = resolveCheckIn(date);
  const checkOut = addDays(checkIn, 1);

  return {
    destination: [
      buildRakutenLink(area, checkIn, checkOut),
      buildJalanLink(area),
    ],
    hub: [],
  };
}

function buildRakutenLink(area, checkIn, checkOut) {
  const searchUrl =
    'https://travel.rakuten.co.jp/yado/search/' +
    `?f_nen1=${checkIn.y}&f_tuki1=${checkIn.m}&f_hi1=${checkIn.d}` +
    `&f_nen2=${checkOut.y}&f_tuki2=${checkOut.m}&f_hi2=${checkOut.d}` +
    `&f_heya_su=1&f_otona_su=2&f_keyword=${encodeURIComponent(area)}`;

  return {
    type: 'rakuten',
    label: '宿を探す（楽天）',
    url: `https://hb.afl.rakuten.co.jp/hgc/${RAKUTEN_AFF_ID}/?pc=${encodeURIComponent(searchUrl)}`,
  };
}

function buildJalanLink(area) {
  return {
    type: 'jalan',
    label: '宿を探す（じゃらん）',
    url: `https://www.jalan.net/uw/uwp2011/uww2011init.do?keyword=${encodeURIComponent(area)}`,
  };
}

function resolveCheckIn(dateStr) {
  if (dateStr) {
    const [y, m, d] = dateStr.split('-');
    return { y: parseInt(y, 10), m: parseInt(m, 10), d: parseInt(d, 10) };
  }
  const now = new Date();
  return { y: now.getFullYear(), m: now.getMonth() + 1, d: now.getDate() };
}

function addDays({ y, m, d }, n) {
  const dt = new Date(y, m - 1, d + n);
  return { y: dt.getFullYear(), m: dt.getMonth() + 1, d: dt.getDate() };
}
