/**
 * 宿泊リンクビルダー
 *
 * city.hotelHub をキーワードにじゃらん・楽天トラベルの検索URLを生成する。
 */
export function buildHotelLinks(city) {
  const hub = city.hotelHub ?? city.name;

  const rakutenSearch =
    'https://travel.rakuten.co.jp/search/?keyword=' +
    encodeURIComponent(hub);

  const rakuten =
    'https://hb.afl.rakuten.co.jp/hgc/5113ee4b.8662cfc5.5113ee4c.119de89a/?pc=' +
    encodeURIComponent(rakutenSearch);

  const jalanSearch =
    'https://www.jalan.net/keyword/?keyword=' +
    encodeURIComponent(hub);

  const jalan =
    'https://ck.jp.ap.valuecommerce.com/servlet/referral' +
    '?sid=3764408' +
    '&pid=892559858' +
    '&vc_url=' +
    encodeURIComponent(jalanSearch);

  return [
    { type: 'jalan',   label: '周辺の宿を見る（じゃらん）',     url: jalan   },
    { type: 'rakuten', label: '周辺の宿を見る（楽天トラベル）', url: rakuten },
  ];
}
