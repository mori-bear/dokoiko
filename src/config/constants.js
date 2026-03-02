export const DEPARTURES = [
  '札幌', '函館', '旭川',
  '仙台', '盛岡',
  '東京', '横浜', '千葉', '大宮', '宇都宮',
  '長野', '静岡', '名古屋', '金沢', '富山',
  '大阪', '京都', '神戸', '奈良',
  '広島', '岡山', '松江',
  '高松', '松山', '高知', '徳島',
  '福岡', '熊本', '鹿児島', '長崎', '宮崎',
];

export const DISTANCE_LABELS = {
  1: '～1時間',
  2: '～2時間',
  3: '～4時間',
  4: '～6時間',
  5: '6時間以上',
};

/**
 * 各出発地の交通属性
 * rail       : Google Maps 経路起点（駅名）
 * airport    : Google Maps 航空起点（空港正式名称）
 * iata       : Skyscanner 用 都市コード
 * jrArea     : east（えきねっと）/ west（e5489）/ kyushu（JR九州）
 * nearestHub : 目的地データが少ない場合のフォールバック出発地（null = 主要都市）
 */
export const DEPARTURE_CITY_INFO = {
  // ── 北海道 ──
  '札幌':   { rail: '札幌駅',       airport: '新千歳空港 国内線ターミナル',    iata: 'CTS', jrArea: 'east',    nearestHub: null   },
  '函館':   { rail: '函館駅',       airport: '函館空港',                       iata: 'HKD', jrArea: 'east',    nearestHub: '札幌' },
  '旭川':   { rail: '旭川駅',       airport: '旭川空港',                       iata: 'AKJ', jrArea: 'east',    nearestHub: '札幌' },
  // ── 東北 ──
  '仙台':   { rail: '仙台駅',       airport: '仙台空港',                       iata: 'SDJ', jrArea: 'east',    nearestHub: null   },
  '盛岡':   { rail: '盛岡駅',       airport: 'いわて花巻空港',                 iata: 'HNA', jrArea: 'east',    nearestHub: '仙台' },
  // ── 関東 ──
  '東京':   { rail: '東京駅',       airport: '羽田空港 国内線ターミナル',       iata: 'TYO', jrArea: 'east',    nearestHub: null   },
  '横浜':   { rail: '横浜駅',       airport: '羽田空港 国内線ターミナル',       iata: 'TYO', jrArea: 'east',    nearestHub: '東京' },
  '千葉':   { rail: '千葉駅',       airport: '成田国際空港',                   iata: 'TYO', jrArea: 'east',    nearestHub: '東京' },
  '大宮':   { rail: '大宮駅',       airport: '羽田空港 国内線ターミナル',       iata: 'TYO', jrArea: 'east',    nearestHub: '東京' },
  '宇都宮': { rail: '宇都宮駅',     airport: '羽田空港 国内線ターミナル',       iata: 'TYO', jrArea: 'east',    nearestHub: '東京' },
  // ── 中部 ──
  '長野':   { rail: '長野駅',       airport: '松本空港',                       iata: 'MMJ', jrArea: 'east',    nearestHub: '東京' },
  '静岡':   { rail: '静岡駅',       airport: '静岡空港',                       iata: 'FSZ', jrArea: 'west',    nearestHub: '東京' },
  '名古屋': { rail: '名古屋駅',     airport: '中部国際空港 セントレア',         iata: 'NGO', jrArea: 'west',    nearestHub: null   },
  '金沢':   { rail: '金沢駅',       airport: '小松空港',                       iata: 'KMQ', jrArea: 'west',    nearestHub: '大阪' },
  '富山':   { rail: '富山駅',       airport: '富山きときと空港',               iata: 'TOY', jrArea: 'west',    nearestHub: '大阪' },
  // ── 近畿 ──
  '大阪':   { rail: '大阪駅',       airport: '大阪国際空港 国内線ターミナル',   iata: 'OSA', jrArea: 'west',    nearestHub: null   },
  '京都':   { rail: '京都駅',       airport: '大阪国際空港 国内線ターミナル',   iata: 'OSA', jrArea: 'west',    nearestHub: '大阪' },
  '神戸':   { rail: '三ノ宮駅',     airport: '神戸空港',                       iata: 'UKB', jrArea: 'west',    nearestHub: '大阪' },
  '奈良':   { rail: '奈良駅',       airport: '大阪国際空港 国内線ターミナル',   iata: 'OSA', jrArea: 'west',    nearestHub: '大阪' },
  // ── 中国 ──
  '広島':   { rail: '広島駅',       airport: '広島空港',                       iata: 'HIJ', jrArea: 'west',    nearestHub: null   },
  '岡山':   { rail: '岡山駅',       airport: '岡山桃太郎空港',                 iata: 'OKJ', jrArea: 'west',    nearestHub: '広島' },
  '松江':   { rail: '松江駅',       airport: '出雲縁結び空港',                 iata: 'IZO', jrArea: 'west',    nearestHub: '広島' },
  // ── 四国 ──
  '高松':   { rail: '高松駅',       airport: '高松空港',                       iata: 'TAK', jrArea: 'west',    nearestHub: null   },
  '松山':   { rail: '松山駅',       airport: '松山空港',                       iata: 'MYJ', jrArea: 'west',    nearestHub: '高松' },
  '高知':   { rail: '高知駅',       airport: '高知龍馬空港',                   iata: 'KCZ', jrArea: 'west',    nearestHub: '高松' },
  '徳島':   { rail: '徳島駅',       airport: '徳島阿波おどり空港',             iata: 'TKS', jrArea: 'west',    nearestHub: '高松' },
  // ── 九州 ──
  '福岡':   { rail: '博多駅',       airport: '福岡空港 国内線ターミナル',       iata: 'FUK', jrArea: 'kyushu', nearestHub: null   },
  '熊本':   { rail: '熊本駅',       airport: '熊本空港',                       iata: 'KMJ', jrArea: 'kyushu', nearestHub: '福岡' },
  '鹿児島': { rail: '鹿児島中央駅', airport: '鹿児島空港',                     iata: 'KOJ', jrArea: 'kyushu', nearestHub: '福岡' },
  '長崎':   { rail: '長崎駅',       airport: '長崎空港',                       iata: 'NGS', jrArea: 'kyushu', nearestHub: '福岡' },
  '宮崎':   { rail: '宮崎駅',       airport: '宮崎ブーゲンビリア空港',         iata: 'KMI', jrArea: 'kyushu', nearestHub: '福岡' },
};

export const RAKUTEN_AFF_ID = '511c83ed.aa0fc172.511c83ee.51331b19';
