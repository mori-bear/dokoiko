/**
 * 宿泊リンクビルダー
 *
 * city.hotelHub をキーワードにじゃらん・楽天トラベルの検索URLを生成する。
 */
export function buildHotelLinks(city) {
  const hub = city.hotelHub ?? city.name;

  const jalan =
    'https://www.jalan.net/uw/uwp2011/uww2011init.do?keyword=' +
    encodeURIComponent(hub);

  const rakuten =
    'https://travel.rakuten.co.jp/keyword/Search.do?f_query=' +
    encodeURIComponent(hub);

  return [
    { type: 'jalan',   label: '周辺の宿を見る（じゃらん）',     url: jalan   },
    { type: 'rakuten', label: '周辺の宿を見る（楽天トラベル）', url: rakuten },
  ];
}
