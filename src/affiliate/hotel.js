/**
 * 宿泊リンクを組み立てる。
 *
 * parentHub を持つ離島などでは destination（島の宿）と hub（那覇など）
 * の両方を返す。
 */
export function buildHotelLinks(city, stayType, destinations) {
  if (stayType !== '1night') {
    return { destination: [], hub: [] };
  }

  const destination = [
    buildRakutenLink(city.name),
    buildJalanLink(city.name),
  ];

  let hub = [];
  if (city.hotelBase) {
    const hubCity = destinations.find(d => d.id === city.hotelBase);
    if (hubCity) {
      hub = [
        buildRakutenLink(hubCity.name),
        buildJalanLink(hubCity.name),
      ];
    }
  }

  return { destination, hub };
}

export function buildRakutenLink(cityName) {
  const encoded = encodeURIComponent(cityName);
  return {
    type: 'rakuten',
    label: `楽天トラベルで${cityName}の宿を見る`,
    url: `https://travel.rakuten.co.jp/search/?f_keyword=${encoded}`,
  };
}

export function buildJalanLink(cityName) {
  const encoded = encodeURIComponent(cityName);
  return {
    type: 'jalan',
    label: `じゃらんで${cityName}の宿を見る`,
    url: `https://www.jalan.net/uw/uwp1700/uww1701.do?screenId=UWW1402&keyword=${encoded}`,
  };
}
