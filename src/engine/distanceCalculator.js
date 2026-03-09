/**
 * distanceCalculator.js
 *
 * 出発地と目的地から distanceStars (★1〜★5) を動的計算する。
 *
 * 計算基準: destination.hotelHub（宿拠点都市）
 *
 * ★1: 同一都市圏 (hotelHub が departure と同一都市圏)
 * ★2: 同一地方
 * ★3: 1地方跨ぎ + 新幹線ボーナス
 * ★4: 1地方跨ぎ
 * ★5: 2地方以上跨ぎ、または island
 */

/** 出発都市 → 地方 */
const DEPARTURE_REGION = {
  '東京':   '関東', '横浜':   '関東', '千葉':   '関東',
  '大宮':   '関東', '宇都宮': '関東',
  '仙台':   '東北', '盛岡':   '東北',
  '札幌':   '北海道', '旭川':   '北海道', '函館':   '北海道',
  '名古屋': '中部', '静岡':   '中部', '長野':   '中部',
  '富山':   '中部', '金沢':   '中部',
  '大阪':   '近畿', '京都':   '近畿', '神戸':   '近畿', '奈良':   '近畿',
  '広島':   '中国', '岡山':   '中国', '松江':   '中国',
  '高松':   '四国', '松山':   '四国', '高知':   '四国', '徳島':   '四国',
  '福岡':   '九州', '熊本':   '九州', '鹿児島': '九州',
  '長崎':   '九州', '宮崎':   '九州',
};

/**
 * hotelHub名 → 地方マップ
 * destinationと異なる地方になり得るケースをカバー
 */
const HOTEL_HUB_REGION = {
  // 北海道
  '旭川': '北海道', '小樽': '北海道', '釧路': '北海道', '函館': '北海道',
  '知床': '北海道', '定山渓': '北海道', '富良野': '北海道', '美瑛': '北海道',
  '洞爺湖': '北海道', '登別': '北海道',
  // 東北
  '仙台': '東北', '盛岡': '東北', '山形': '東北', '秋田': '東北',
  '平泉': '東北', '宮古': '東北', '酒田': '東北', '会津若松': '東北',
  '銀山温泉': '東北', '奥入瀬': '東北', '乳頭温泉': '東北',
  '角館': '東北', '弘前': '東北', '蔵王': '東北', '松島': '東北',
  '鳴子温泉': '東北', '大内宿': '東北',
  // 関東
  '東京': '関東', '横浜': '関東', '千葉': '関東', '大宮': '関東',
  '鎌倉': '関東', '高尾山': '関東', '日光': '関東', '箱根': '関東',
  '草津温泉': '関東', '四万温泉': '関東', '水上温泉': '関東',
  '水戸': '関東', '甲府': '関東', '益子': '関東', '館山': '関東',
  // 中部
  '名古屋': '中部', '静岡': '中部', '長野': '中部', '富山': '中部',
  '金沢': '中部', '新潟': '中部', '松本': '中部', '軽井沢': '中部',
  '高山': '中部', '白川郷': '中部', '五箇山': '中部', '岐阜': '中部',
  '富士河口湖': '中部', '熱海': '中部', '下田': '中部', '修善寺': '中部',
  '上高地': '中部', '白馬': '中部', '野沢温泉': '中部', '別所温泉': '中部',
  '小布施': '中部', '立山黒部': '中部', '輪島': '中部', '加賀温泉郷': '中部',
  '和倉温泉': '中部', '氷見': '中部', '下呂温泉': '中部', '伊勢': '中部',
  '鳥羽': '中部', '木曽': '中部', '妻籠': '中部', '馬籠': '中部',
  '飯田': '中部',
  // 近畿
  '大阪': '近畿', '京都': '近畿', '神戸': '近畿', '奈良': '近畿',
  '有馬温泉': '近畿', '姫路': '近畿', '城崎温泉': '近畿',
  '天橋立': '近畿', '伊根': '近畿', '白浜': '近畿', '和歌山': '近畿',
  '高野山': '近畿', '龍神温泉': '近畿', '美山': '近畿',
  '彦根': '近畿', '長浜': '近畿', '出石': '近畿', '淡路島': '近畿',
  // 中国
  '広島': '中国', '岡山': '中国', '松江': '中国', '鳥取': '中国',
  '倉敷': '中国', '米子': '中国', '萩': '中国', '下関': '中国',
  '尾道': '中国', '竹原': '中国', '三朝温泉': '中国', '奥出雲': '中国',
  '津和野': '中国', '湯田温泉': '中国',
  // 四国
  '高松': '四国', '松山': '四国', '高知': '四国', '徳島': '四国',
  '大歩危': '四国', '琴平': '四国', '宇和島': '四国', '内子': '四国',
  '足摺岬': '四国', '室戸': '四国', '祖谷': '四国',
  // 九州
  '福岡': '九州', '熊本': '九州', '鹿児島': '九州', '長崎': '九州',
  '宮崎': '九州', '佐賀': '九州', '博多': '九州',
  '湯布院': '九州', '別府': '九州', '黒川温泉': '九州', '阿蘇': '九州',
  '南阿蘇': '九州', '高千穂': '九州', '雲仙': '九州', '天草': '九州',
  '指宿': '九州', '嬉野温泉': '九州', '佐世保': '九州', '平戸': '九州',
  '人吉': '九州', '飫肥': '九州', '奄美大島': '九州',
  // 沖縄
  '那覇': '沖縄', '石垣島': '沖縄', '宮古島': '沖縄', '久米島': '沖縄',
  '渡嘉敷島': '沖縄',
};

/** 地方隣接グラフ */
const REGION_ADJ = {
  '北海道':   ['東北'],
  '東北':     ['北海道', '関東', '中部'],
  '関東':     ['東北', '中部'],
  '中部':     ['関東', '東北', '近畿'],
  '近畿':     ['中部', '中国', '四国'],
  '中国':     ['近畿', '四国', '九州'],
  '四国':     ['近畿', '中国', '九州'],
  '九州':     ['中国', '四国', '沖縄'],
  '沖縄':     ['九州'],
  '伊豆諸島': ['関東'],
};

/** BFS で地方間の最短距離を返す */
function regionDist(from, to) {
  if (!from || !to) return 99;
  if (from === to) return 0;
  const visited = new Set([from]);
  const queue = [[from, 0]];
  while (queue.length > 0) {
    const [cur, d] = queue.shift();
    for (const next of (REGION_ADJ[cur] ?? [])) {
      if (next === to) return d + 1;
      if (!visited.has(next)) {
        visited.add(next);
        queue.push([next, d + 1]);
      }
    }
  }
  return 99;
}

/**
 * 新幹線ボーナスが適用される出発地セット
 */
const SHINKANSEN_DEPARTURES = new Set([
  '東京', '横浜', '大宮', '宇都宮', '長野',
  '仙台', '盛岡',
  '名古屋', '静岡',
  '大阪', '京都', '神戸',
  '岡山', '広島',
  '金沢', '富山',
  '福岡', '熊本', '鹿児島', '長崎',
]);

/**
 * 新幹線でアクセスできる hotelHub 名セット
 */
const SHINKANSEN_HUBS = new Set([
  '函館',
  '仙台', '盛岡', '山形', '秋田', '新潟',
  '長野', '軽井沢', '富山', '金沢',
  '熱海', '静岡', '名古屋',
  '京都', '大阪', '神戸', '姫路', '岡山', '広島', '博多',
  '熊本', '鹿児島', '長崎',
]);

/**
 * ★2 クロスリージョンペア（隣接地方だが同一都市圏並みに近いケース）
 * key: departure、value: Set of hotelHub names
 */
const NEAR_CROSS_REGION = {
  '高松': new Set(['岡山', '倉敷']),   // マリンライナーで30分圏
};

/**
 * ★1 同一都市圏ペア
 * key: departure、value: Set of hotelHub names in same metro area
 *
 * ★2 に降格したペア（旧METRO1から除去）:
 *   大阪↔京都, 大阪↔奈良, 京都↔奈良, 神戸↔奈良
 */
const METRO1 = {
  // 北海道
  '札幌':   new Set(['定山渓', '小樽']),
  // 関東
  '東京':   new Set(['横浜', '鎌倉', '高尾山']),
  '横浜':   new Set(['東京', '鎌倉']),
  // 近畿（有馬温泉追加、京都・奈良は★2へ）
  '大阪':   new Set(['神戸', '有馬温泉']),
  '神戸':   new Set(['大阪', '有馬温泉']),
  '京都':   new Set(['有馬温泉']),
  // 中国
  '広島':   new Set(['宮島']),
  // 四国
  '高松':   new Set(['直島', '小豆島']),
  '岡山':   new Set(['直島', '小豆島', '倉敷']),
  // 九州
  '福岡':   new Set(['博多']),
};

function isSameMetro(departure, hotelHub) {
  return (METRO1[departure]?.has(hotelHub)) ?? false;
}

/**
 * hotelHub名から地方を返す。
 * 未登録の場合は fallbackRegion を返す。
 */
function getHubRegion(hotelHub, fallbackRegion) {
  return HOTEL_HUB_REGION[hotelHub] ?? fallbackRegion ?? null;
}

/**
 * 出発地と目的地から distanceStars (★1〜★5) を計算する。
 * 宿拠点 (hotelHub) 基準で距離を測定する。
 * type:"spot" は呼び出し元で除外済みのため、hub / destination のみを想定。
 *
 * @param {string} departure - 出発都市名
 * @param {{ name:string, region:string, hotelHub:string, isIsland?:boolean }} destination
 * @returns {number} 1〜5
 */
export function calculateDistanceStars(departure, destination) {
  const hotelHub = destination.hotelHub ?? destination.name;

  // ★1: hotelHub === departure（宿が出発地と同じ ＝ 近場）
  if (hotelHub === departure) return 1;

  // ★1: hotelHub が departure の同一都市圏内
  if (isSameMetro(departure, hotelHub)) return 1;

  // ★2: クロスリージョンだが近接（例: 高松↔岡山）
  if (NEAR_CROSS_REGION[departure]?.has(hotelHub)) return 2;

  // island は常に ★5（同一都市圏例外を除く）
  if (destination.isIsland) return 5;

  const depReg = DEPARTURE_REGION[departure];
  if (!depReg) return 3;

  // hotelHubの地方を取得（fallbackは destination.region）
  const rawHubReg = getHubRegion(hotelHub, destination.region);
  // 伊豆諸島は関東扱い
  const hubReg = rawHubReg === '伊豆諸島' ? '関東' : rawHubReg;

  const dist = regionDist(depReg, hubReg);

  let stars;
  if (dist === 0) {
    // 同一地方 → ★2（旧: type依存で2か3 → 統一して2）
    stars = 2;
  } else if (dist === 1) {
    stars = 4;
  } else {
    stars = 5;
  }

  // 新幹線ボーナス: 1地方跨ぎで ★4→★3
  if (dist === 1 && SHINKANSEN_DEPARTURES.has(departure) && SHINKANSEN_HUBS.has(hotelHub)) {
    stars = 3;
  }

  // 新幹線長距離ボーナス: 2地方以上跨ぎでも新幹線直通なら ★4 に補正
  // 例: 東京→広島（★5 相当だが Tokaido/Sanyo 新幹線で直通）
  if (dist > 1 && stars === 5 && SHINKANSEN_DEPARTURES.has(departure) && SHINKANSEN_HUBS.has(hotelHub)) {
    stars = 4;
  }

  return stars;
}
