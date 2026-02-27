import { RAKUTEN_AFF_ID } from '../config/constants.js';

export function buildHotelLinks(city, date) {
  const area = city.affiliate.hotelArea;
  const checkIn = resolveCheckIn(date);
  const checkOut = addDays(checkIn, 1);

  return [
    {
      type: 'rakuten',
      label: '楽天トラベルで宿を探す',
      url: buildRakutenUrl(area, checkIn, checkOut),
    },
    {
      type: 'jalan',
      label: 'じゃらんで宿を探す',
      url: `https://www.jalan.net/uw/uwp2011/uww2011init.do?keyword=${encodeURIComponent(area)}`,
    },
  ];
}

function buildRakutenUrl(area, checkIn, checkOut) {
  const searchUrl =
    'https://travel.rakuten.co.jp/yado/search/' +
    `?f_nen1=${checkIn.y}&f_tuki1=${checkIn.m}&f_hi1=${checkIn.d}` +
    `&f_nen2=${checkOut.y}&f_tuki2=${checkOut.m}&f_hi2=${checkOut.d}` +
    `&f_heya_su=1&f_otona_su=2&f_keyword=${encodeURIComponent(area)}`;

  return (
    `https://hb.afl.rakuten.co.jp/hgc/${RAKUTEN_AFF_ID}/` +
    `?pc=${encodeURIComponent(searchUrl)}`
  );
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
