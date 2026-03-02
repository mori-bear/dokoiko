/**
 * 宿泊リンクを組み立てる。
 *
 * searchName: city.hotelBase がある場合は呼び出し元でハブ名に解決して渡す。
 *             未指定の場合は city.name を使用。
 */
export function buildHotelLinks(city, stayType, searchName) {
  if (stayType !== '1night') {
    return { destination: [], hub: [] };
  }

  const name = searchName || city.name;

  return {
    destination: [
      buildRakutenLink(name),
      buildJalanLink(name),
    ],
    hub: [],
  };
}

export function buildRakutenLink(cityName) {
  const encoded = encodeURIComponent(cityName);
  return {
    type: 'rakuten',
    label: '楽天でこの街の宿を見る',
    url: `https://www.google.com/search?q=${encoded}+楽天トラベル`,
  };
}

export function buildJalanLink(cityName) {
  const encoded = encodeURIComponent(cityName);
  return {
    type: 'jalan',
    label: 'じゃらんでこの街の宿を見る',
    url: `https://www.google.com/search?q=${encoded}+じゃらん`,
  };
}
