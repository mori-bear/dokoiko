/**
 * distanceCalculator.js
 *
 * 出発地と目的地から distanceStars (★1〜★5) を動的計算する。
 *
 * 計算ルール:
 *   - 同一都市圏 (METRO1) → ★1
 *   - island → ★5（METRO1例外除く）
 *   - 同地方内 → urban/hub=★2, local=★3
 *   - 1地方跨ぎ → ★4
 *   - 2地方以上跨ぎ → ★5
 *   - 新幹線ボーナス: shinkansenAccess=true かつ出発地が新幹線圏 → -1★ (最小★2)
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
 * 主要な新幹線駅がある出発都市
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
 * ★1 同一都市圏ペア
 * island も含む（METRO1の場合 island ★5ルールより優先）
 */
const METRO1 = {
  '東京':   ['横浜', '鎌倉'],
  '横浜':   ['東京', '鎌倉'],
  '大阪':   ['神戸', '京都', '奈良'],
  '京都':   ['大阪', '奈良'],
  '神戸':   ['大阪', '奈良'],
  '奈良':   ['大阪', '京都', '神戸'],
  '広島':   ['宮島'],
  '高松':   ['直島', '小豆島'],
  '岡山':   ['直島', '小豆島'],
  '福岡':   ['博多'],
};

function isSameMetro(departure, destName) {
  return (METRO1[departure] ?? []).includes(destName);
}

/**
 * 出発地と目的地から distanceStars (★1〜★5) を計算する。
 *
 * @param {string} departure - 出発都市名
 * @param {{ name:string, region:string, type:string, shinkansenAccess:boolean }} destination
 * @returns {number} 1〜5
 */
export function calculateDistanceStars(departure, destination) {
  // ★1: 同一都市圏（island も含む）
  if (isSameMetro(departure, destination.name)) return 1;

  // island は常に★5（METRO1例外を除く）
  if (destination.type === 'island') return 5;

  const depReg = DEPARTURE_REGION[departure];
  if (!depReg) return 3;

  // 伊豆諸島は地方計算上「関東」扱い
  const destReg = destination.region === '伊豆諸島' ? '関東' : destination.region;
  const dist = regionDist(depReg, destReg);

  let stars;
  if (dist === 0) {
    // 同地方内: hub/urban → ★2、local → ★3
    stars = (destination.type === 'hub' || destination.type === 'urban') ? 2 : 3;
  } else if (dist === 1) {
    stars = 4;
  } else {
    stars = 5;
  }

  // 新幹線ボーナス: -1★（最小★2）
  if (destination.shinkansenAccess && SHINKANSEN_DEPARTURES.has(departure)) {
    stars = Math.max(2, stars - 1);
  }

  return stars;
}
