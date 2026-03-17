/**
 * 宿泊リンク制御モジュール
 *
 * city.hotelHub を使用して宿泊検索キーワードを決定する。
 * hotelHub が未設定の場合は city.name にフォールバック。
 *
 * spot 型は自身に宿がないため hotelHub に近隣ハブ都市が設定される。
 */

export function buildHotelLinks(city) {
  const hotelHub = city.hotelHub ?? city.name;
  return { hotelHub };
}
