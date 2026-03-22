/**
 * distanceCalculator.js
 *
 * 出発地と目的地から travelTimeMinutes（移動時間・分）を動的計算する。
 *
 * 近距離（同一都市圏・同一市）:  60 分未満
 * 中距離（同一地方）:            180 分（3時間）
 * 遠距離（異なる地方・島）:      360 分（6時間）
 *
 * stayType との対応:
 *   < 120min → daytrip
 *   120〜300min → 1night
 *   300min+ → 1night または 2night
 *
 * ※ 旧 distanceStars は travelTimeMinutes に統合。
 *    後方互換のため calculateDistanceStars もエクスポートする（stars に変換）。
 */

// Haversine 公式（インライン実装）
function calcDistance(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

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
 */
const HOTEL_HUB_REGION = {
  // 北海道
  '旭川': '北海道', '小樽': '北海道', '釧路': '北海道', '函館': '北海道',
  '知床': '北海道', '定山渓': '北海道', '富良野': '北海道', '美瑛': '北海道',
  '洞爺湖': '北海道', '登別': '北海道', '積丹': '北海道',
  // 東北
  '仙台': '東北', '盛岡': '東北', '山形': '東北', '秋田': '東北',
  '平泉': '東北', '宮古': '東北', '酒田': '東北', '会津若松': '東北',
  '銀山温泉': '東北', '奥入瀬': '東北', '乳頭温泉': '東北',
  '角館': '東北', '弘前': '東北', '蔵王': '東北', '松島': '東北',
  '鳴子温泉': '東北', '大内宿': '東北', '三陸': '東北',
  // 関東
  '東京': '関東', '横浜': '関東', '千葉': '関東', '大宮': '関東',
  '鎌倉': '関東', '高尾山': '関東', '日光': '関東', '箱根': '関東',
  '草津温泉': '関東', '四万温泉': '関東', '水上温泉': '関東',
  '水戸': '関東', '甲府': '関東', '益子': '関東', '館山': '関東',
  '熱海': '関東', '修善寺': '関東', '下田': '関東', '伊豆高原': '関東',
  // 中部
  '名古屋': '中部', '静岡': '中部', '長野': '中部', '富山': '中部',
  '金沢': '中部', '新潟': '中部', '松本': '中部', '軽井沢': '中部',
  '高山': '中部', '白川郷': '中部', '五箇山': '中部', '岐阜': '中部',
  '富士河口湖': '中部', '下田': '中部',
  '上高地': '中部', '白馬': '中部', '野沢温泉': '中部', '別所温泉': '中部',
  '小布施': '中部', '立山黒部': '中部', '輪島': '中部', '加賀温泉郷': '中部',
  '和倉温泉': '中部', '氷見': '中部', '下呂温泉': '中部', '伊勢': '中部',
  '鳥羽': '中部', '木曽': '中部', '妻籠': '中部', '馬籠': '中部',
  '飯田': '中部', '飛騨古川': '中部', '能登': '中部',
  // 近畿
  '大阪': '近畿', '京都': '近畿', '神戸': '近畿', '奈良': '近畿',
  '有馬温泉': '近畿', '姫路': '近畿', '城崎温泉': '近畿',
  '天橋立': '近畿', '伊根': '近畿', '白浜': '近畿', '和歌山': '近畿',
  '高野山': '近畿', '龍神温泉': '近畿', '美山': '近畿',
  '彦根': '近畿', '長浜': '近畿', '出石': '近畿', '淡路島': '近畿',
  '田辺': '近畿', '熊野': '近畿', '吉野': '近畿', '出石': '近畿',
  // 中国
  '広島': '中国', '岡山': '中国', '松江': '中国', '鳥取': '中国',
  '倉敷': '中国', '米子': '中国', '萩': '中国', '下関': '中国',
  '尾道': '中国', '竹原': '中国', '三朝温泉': '中国', '奥出雲': '中国',
  '津和野': '中国', '湯田温泉': '中国', '宮島': '中国', '高梁': '中国',
  // 四国
  '高松': '四国', '松山': '四国', '高知': '四国', '徳島': '四国',
  '大歩危': '四国', '琴平': '四国', '宇和島': '四国', '内子': '四国',
  '足摺岬': '四国', '室戸': '四国', '祖谷': '四国', '土佐清水': '四国',
  // 九州
  '福岡': '九州', '熊本': '九州', '鹿児島': '九州', '長崎': '九州',
  '宮崎': '九州', '佐賀': '九州', '博多': '九州',
  '湯布院': '九州', '別府': '九州', '黒川温泉': '九州', '阿蘇': '九州',
  '南阿蘇': '九州', '高千穂': '九州', '雲仙': '九州', '天草': '九州',
  '指宿': '九州', '嬉野温泉': '九州', '佐世保': '九州', '平戸': '九州',
  '人吉': '九州', '飫肥': '九州', '奄美大島': '九州', '糸島': '九州',
  '島原': '九州',
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
 * ★1 同一都市圏ペア（近距離・日帰り圏）
 */
const METRO1 = {
  '札幌':   new Set(['定山渓', '小樽']),
  '東京':   new Set(['横浜', '鎌倉', '高尾山']),
  '横浜':   new Set(['東京', '鎌倉']),
  '大阪':   new Set(['神戸', '有馬温泉']),
  '神戸':   new Set(['大阪', '有馬温泉']),
  '京都':   new Set(['有馬温泉']),
  '広島':   new Set(['宮島']),
  '高松':   new Set(['直島', '小豆島']),
  '岡山':   new Set(['直島', '小豆島', '倉敷']),
  '福岡':   new Set(['博多']),
};

/**
 * ★2 クロスリージョンだが近接
 */
const NEAR_CROSS_REGION = {
  '高松': new Set(['岡山', '倉敷']),
};

function isSameMetro(departure, hotelHub) {
  return (METRO1[departure]?.has(hotelHub)) ?? false;
}

function getHubRegion(hotelHub, fallbackRegion) {
  return HOTEL_HUB_REGION[hotelHub] ?? fallbackRegion ?? null;
}

/**
 * 出発地 → 事前計算 travelTime のキー
 * (Dijkstra 計算済みの参照都市に対応)
 */
const DEPARTURE_REF_KEY = {
  '東京':   'tokyo',   '横浜':  'tokyo',  '千葉':   'tokyo',
  '大宮':   'tokyo',   '宇都宮':'tokyo',  '仙台':   'tokyo',
  '盛岡':   'tokyo',   '青森':  'tokyo',
  '名古屋': 'nagoya',  '静岡':  'nagoya', '長野':   'nagoya',
  '富山':   'nagoya',  '金沢':  'nagoya',
  '大阪':   'osaka',   '京都':  'osaka',  '神戸':   'osaka',  '奈良':  'osaka',
  '広島':   'osaka',   '岡山':  'osaka',  '松江':   'osaka',
  '高松':   'takamatsu','松山': 'takamatsu','高知':  'takamatsu','徳島': 'takamatsu',
  '福岡':   'fukuoka', '熊本':  'fukuoka','鹿児島': 'fukuoka',
  '長崎':   'fukuoka', '宮崎':  'fukuoka',
};

/**
 * 出発地と目的地から travelTimeMinutes（推定移動時間・分）を計算する。
 * 事前計算済み travelTime フィールドがあればそれを優先し、
 * なければ地域ベースの推定にフォールバック。
 *
 * @param {string} departure - 出発都市名
 * @param {{ hotelHub?:string, name:string, region:string, isIsland?:boolean, destType?:string, travelTime?:object }} destination
 * @returns {number} 推定移動時間（分）
 */
export function calculateTravelTimeMinutes(departure, destination) {
  // 事前計算済み Dijkstra 移動時間を優先使用
  if (destination.travelTime) {
    const refKey = DEPARTURE_REF_KEY[departure];
    if (refKey !== undefined) {
      const stored = destination.travelTime[refKey];
      if (stored !== null && stored !== undefined) return stored;
    }
  }

  const hotelHub = destination.hotelHub ?? destination.name;
  const isIsland = destination.isIsland || destination.destType === 'island';

  // 近距離: 出発地と同一都市または同一都市圏 → 60分
  if (hotelHub === departure) return 60;
  if (isSameMetro(departure, hotelHub)) return 60;

  // 中距離: 近接クロスリージョン（高松↔岡山等）→ 180分
  if (NEAR_CROSS_REGION[departure]?.has(hotelHub)) return 180;

  // 島: 都市圏以外は遠方扱い → 360分
  if (isIsland) return 360;

  const depReg = DEPARTURE_REGION[departure];
  if (!depReg) return 180;

  const rawHubReg = getHubRegion(hotelHub, destination.region);
  const hubReg = rawHubReg ?? depReg;

  const dist = regionDist(depReg, hubReg);

  // 同一地方 → 180分、異なる地方 → 360分
  return dist === 0 ? 180 : 360;
}

/**
 * 後方互換: travelTimeMinutes → distanceStars (1〜3) に変換して返す。
 * @param {string} departure
 * @param {object} destination
 * @returns {1|2|3}
 */
export function calculateDistanceStars(departure, destination) {
  const minutes = calculateTravelTimeMinutes(departure, destination);
  if (minutes < 120) return 1;
  if (minutes < 300) return 2;
  return 3;
}

/* ── 出発都市の近似座標 ── */
const DEP_COORDS = {
  '札幌':   [43.0642, 141.3469], '函館':   [41.7688, 140.7291], '旭川':   [43.7705, 142.3648],
  '仙台':   [38.2688, 140.8721], '盛岡':   [39.7036, 141.1527],
  '東京':   [35.6812, 139.7671], '横浜':   [35.4437, 139.6380], '千葉':   [35.6074, 140.1065],
  '大宮':   [35.9062, 139.6236], '宇都宮': [36.5551, 139.8827],
  '長野':   [36.6485, 138.1948], '静岡':   [34.9769, 138.3831], '名古屋': [35.1706, 136.8816],
  '金沢':   [36.5944, 136.6256], '富山':   [36.6953, 137.2113],
  '大阪':   [34.6937, 135.5022], '京都':   [35.0116, 135.7681], '神戸':   [34.6901, 135.1956],
  '奈良':   [34.6851, 135.8049],
  '広島':   [34.3853, 132.4553], '岡山':   [34.6551, 133.9195], '松江':   [35.4723, 133.0505],
  '高松':   [34.3401, 134.0434], '松山':   [33.8416, 132.7657], '高知':   [33.5597, 133.5311],
  '徳島':   [34.0658, 134.5593],
  '福岡':   [33.5904, 130.4017], '熊本':   [32.7898, 130.7417], '鹿児島': [31.5602, 130.5581],
  '長崎':   [32.7448, 129.8738], '宮崎':   [31.9077, 131.4202],
};

/**
 * Haversine 公式で2点間の直線距離（km）を計算する。
 * 実装は core/transport/distanceCalculator.js の calcDistance に委譲。
 */
export function haversineKm(lat1, lng1, lat2, lng2) {
  return calcDistance(lat1, lng1, lat2, lng2);
}

/**
 * 出発地 → 目的地の直線距離（km）を返す。
 * 座標が取得できない場合は null を返す。
 */
export function getDepartureDist(departure, destLat, destLng) {
  const c = DEP_COORDS[departure];
  if (!c || destLat == null || destLng == null) return null;
  return haversineKm(c[0], c[1], destLat, destLng);
}
