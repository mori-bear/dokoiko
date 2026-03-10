/**
 * 宿泊リンクビルダー
 *
 * 楽天トラベル: 都道府県エリアページ → 楽天アフィリエイト経由
 *   https://travel.rakuten.co.jp/yado/{prefecture}/
 *   prefecture が不明な場合はキーワード検索にフォールバック
 *
 * じゃらん: キーワード検索 → ValueCommerce 経由
 *   https://www.jalan.net/yad320000/?screenId=UWW3001&keyword={keyword}
 *
 * フォールバック順: hotelSearch → hotelHub → name
 */

const RAKUTEN_AFF = 'https://hb.afl.rakuten.co.jp/hgc/5113ee4b.8662cfc5.5113ee4c.119de89a/?pc=';
const VC_BASE     = 'https://ck.jp.ap.valuecommerce.com/servlet/referral?sid=3764408&pid=892559858&vc_url=';

/* ── ホテル拠点名 → 楽天都道府県コードマップ ── */

const HUB_PREFECTURE = {
  // 北海道
  '札幌': 'hokkaido', '函館': 'hokkaido', '旭川': 'hokkaido',
  '小樽': 'hokkaido', '富良野': 'hokkaido', '美瑛': 'hokkaido',
  '知床': 'hokkaido', '洞爺湖': 'hokkaido', '登別': 'hokkaido',
  '釧路': 'hokkaido', '定山渓': 'hokkaido',
  // 青森
  '弘前': 'aomori', '奥入瀬': 'aomori',
  // 岩手
  '盛岡': 'iwate', '平泉': 'iwate',
  // 宮城
  '仙台': 'miyagi', '松島': 'miyagi',
  // 秋田
  '秋田': 'akita', '角館': 'akita', '乳頭温泉': 'akita',
  // 山形
  '山形': 'yamagata', '銀山温泉': 'yamagata', '酒田': 'yamagata', '蔵王': 'yamagata',
  // 福島
  '会津若松': 'fukushima', '大内宿': 'fukushima',
  // 茨城
  '水戸': 'ibaraki',
  // 栃木
  '日光': 'tochigi', '益子': 'tochigi',
  // 群馬
  '草津温泉': 'gunma', '四万温泉': 'gunma', '水上温泉': 'gunma',
  // 千葉
  '館山': 'chiba',
  // 東京
  '東京': 'tokyo', '伊豆大島': 'tokyo', '高尾山': 'tokyo', '神津島': 'tokyo',
  // 神奈川
  '横浜': 'kanagawa', '鎌倉': 'kanagawa', '箱根': 'kanagawa',
  // 新潟
  '新潟': 'niigata',
  // 富山
  '氷見': 'toyama', '立山黒部': 'toyama',
  // 石川
  '金沢': 'ishikawa', '輪島': 'ishikawa', '和倉温泉': 'ishikawa', '加賀温泉郷': 'ishikawa',
  // 山梨
  '甲府': 'yamanashi', '富士河口湖': 'yamanashi',
  // 長野
  '松本': 'nagano', '上高地': 'nagano', '白馬': 'nagano', '軽井沢': 'nagano',
  '別所温泉': 'nagano', '野沢温泉': 'nagano', '小布施': 'nagano',
  '木曽': 'nagano', '妻籠': 'nagano', '飯田': 'nagano',
  // 岐阜
  '高山': 'gifu', '下呂温泉': 'gifu', '岐阜': 'gifu', '馬籠': 'gifu',
  // 静岡
  '熱海': 'shizuoka', '静岡': 'shizuoka', '下田': 'shizuoka', '修善寺': 'shizuoka',
  // 愛知
  '名古屋': 'aichi', '犬山': 'aichi',
  // 三重
  '伊勢': 'mie', '鳥羽': 'mie',
  // 滋賀
  '彦根': 'shiga', '長浜': 'shiga',
  // 京都
  '京都': 'kyoto', '天橋立': 'kyoto', '伊根': 'kyoto', '美山': 'kyoto',
  // 大阪
  '大阪': 'osaka',
  // 兵庫
  '神戸': 'hyogo', '城崎温泉': 'hyogo', '有馬温泉': 'hyogo',
  '姫路': 'hyogo', '出石': 'hyogo', '淡路島': 'hyogo',
  // 奈良
  '奈良': 'nara',
  // 和歌山
  '白浜': 'wakayama', '高野山': 'wakayama', '和歌山': 'wakayama',
  // 鳥取
  '鳥取': 'tottori', '三朝温泉': 'tottori', '米子': 'tottori',
  // 島根
  '松江': 'shimane', '津和野': 'shimane', '奥出雲': 'shimane',
  // 岡山
  '倉敷': 'okayama', '岡山': 'okayama',
  // 広島
  '広島': 'hiroshima', '尾道': 'hiroshima', '宮島': 'hiroshima', '竹原': 'hiroshima',
  // 山口
  '下関': 'yamaguchi', '萩': 'yamaguchi', '湯田温泉': 'yamaguchi',
  // 徳島
  '徳島': 'tokushima', '祖谷': 'tokushima', '大歩危': 'tokushima',
  // 香川
  '高松': 'kagawa', '琴平': 'kagawa', '小豆島': 'kagawa', '直島': 'kagawa',
  // 愛媛
  '松山': 'ehime', '内子': 'ehime', '宇和島': 'ehime',
  // 高知
  '高知': 'kochi', '足摺岬': 'kochi', '室戸': 'kochi',
  // 福岡
  '博多': 'fukuoka', '福岡': 'fukuoka',
  // 佐賀
  '佐賀': 'saga', '嬉野温泉': 'saga',
  // 長崎
  '長崎': 'nagasaki', '五島列島': 'nagasaki', '佐世保': 'nagasaki',
  '平戸': 'nagasaki', '雲仙': 'nagasaki',
  // 熊本
  '熊本': 'kumamoto', '人吉': 'kumamoto', '阿蘇': 'kumamoto',
  '南阿蘇': 'kumamoto', '天草': 'kumamoto', '黒川温泉': 'kumamoto',
  // 大分
  '湯布院': 'oita', '別府': 'oita',
  // 宮崎
  '宮崎': 'miyazaki', '高千穂': 'miyazaki', '飫肥': 'miyazaki',
  // 鹿児島
  '鹿児島': 'kagoshima', '指宿': 'kagoshima', '屋久島': 'kagoshima', '奄美大島': 'kagoshima',
  // 沖縄
  '那覇': 'okinawa', '石垣島': 'okinawa', '宮古島': 'okinawa',
  '久米島': 'okinawa', '渡嘉敷島': 'okinawa', '宮古': 'okinawa',
};

export function buildHotelLinks(city) {
  return [
    buildRakutenHotelLink(city),
    buildJalanHotelLink(city),
  ].filter(Boolean);
}

function buildRakutenHotelLink(city) {
  const hub        = city.hotelSearch ?? city.hotelHub ?? city.name;
  const prefecture = HUB_PREFECTURE[hub] ?? HUB_PREFECTURE[city.hotelHub] ?? HUB_PREFECTURE[city.name];

  let target;
  if (prefecture) {
    // 都道府県エリアページ（推奨: 404 リスク低）
    target = `https://travel.rakuten.co.jp/yado/${prefecture}/`;
  } else {
    // フォールバック: キーワード検索
    target = `https://travel.rakuten.co.jp/search/?keyword=${encodeURIComponent(hub)}&f_tab=hotel`;
  }

  return {
    type:  'rakuten',
    label: '周辺の宿を見る（楽天トラベル）',
    url:   RAKUTEN_AFF + encodeURIComponent(target),
  };
}

function buildJalanHotelLink(city) {
  const keyword = city.hotelSearch ?? city.hotelHub ?? city.name;
  const target  = `https://www.jalan.net/yad320000/?screenId=UWW3001&keyword=${encodeURIComponent(keyword)}`;
  return {
    type:  'jalan',
    label: '周辺の宿を見る（じゃらん）',
    url:   VC_BASE + encodeURIComponent(target),
  };
}
