/**
 * gatewayResolver が返したアイテムを { type, label, url } に変換する。
 *
 * 表示文言（絵文字なし）:
 *   鉄道で調べる / 航空券を探す / バスで調べる / フェリーで調べる / レンタカーを探す
 *
 * Yahoo: date/time パラメータは付与しない（"今すぐ" 検索で十分）。
 */
export function buildLink(item) {
  switch (item.type) {
    case 'rail':
      return {
        type: 'rail',
        label: '鉄道で調べる',
        url:
          'https://transit.yahoo.co.jp/search/result' +
          `?from=${encodeURIComponent(item.from)}` +
          `&to=${encodeURIComponent(item.to)}` +
          '&type=1&exp=1',
      };

    case 'air':
      return {
        type: 'air',
        label: '航空券を探す',
        url: `https://www.skyscanner.jp/transport/flights/${item.fromCode}/${item.toCode}/`,
      };

    case 'bus':
      return {
        type: 'bus',
        label: 'バスで調べる',
        url:
          'https://transit.yahoo.co.jp/search/result' +
          `?from=${encodeURIComponent(item.from)}` +
          `&to=${encodeURIComponent(item.to)}` +
          '&type=4',
      };

    case 'ferry':
      return {
        type: 'ferry',
        label: 'フェリーで調べる',
        url: item.url,
      };

    case 'rental':
      return {
        type: 'rental',
        label: 'レンタカーを探す',
        url: 'https://www.jalan.net/rentacar/',
      };

    default:
      return null;
  }
}
