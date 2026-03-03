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
  // TODO: アフィリエイトID確定後に &af_id={ID} を末尾に追加する
  const url = `https://travel.rakuten.co.jp/search/?f_keyword=${encoded}`;
  return {
    type: 'rakuten',
    label: `楽天トラベルで${cityName}の宿を見る`,
    url,
  };
}

export function buildJalanLink(cityName) {
  const encoded = encodeURIComponent(cityName);
  return {
    type: 'jalan',
    label: `じゃらんで${cityName}の宿を見る`,
    // /yad/ はじゃらん宿泊検索の公式エンドポイント。KW= のみで検索CD不要。
    url: `https://www.jalan.net/yad/?KW=${encoded}`,
  };
}
