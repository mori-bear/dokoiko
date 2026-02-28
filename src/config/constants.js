export const DEPARTURES = ['東京', '大阪', '名古屋', '福岡', '札幌', '仙台', '広島', '高松'];

export const DISTANCE_LABELS = {
  1: '～1時間',
  2: '～2時間',
  3: '～4時間',
  4: '～6時間',
  5: '6時間以上',
};

/**
 * 各出発地の交通属性
 * rail    : Google Maps 経路起点（駅名）
 * airport : Google Maps 航空起点（空港正式名称）
 * iata    : Skyscanner 用 都市コード
 */
export const DEPARTURE_CITY_INFO = {
  '東京':  { rail: '東京駅',  airport: '羽田空港 国内線ターミナル',     iata: 'TYO' },
  '大阪':  { rail: '大阪駅',  airport: '大阪国際空港 国内線ターミナル', iata: 'OSA' },
  '名古屋': { rail: '名古屋駅', airport: '中部国際空港 セントレア',      iata: 'NGO' },
  '福岡':  { rail: '博多駅',  airport: '福岡空港 国内線ターミナル',     iata: 'FUK' },
  '札幌':  { rail: '札幌駅',  airport: '新千歳空港 国内線ターミナル',   iata: 'CTS' },
  '仙台':  { rail: '仙台駅',  airport: '仙台空港',                      iata: 'SDJ' },
  '広島':  { rail: '広島駅',  airport: '広島空港',                      iata: 'HIJ' },
  '高松':  { rail: '高松駅',  airport: '高松空港',                      iata: 'TAK' },
};

export const RAKUTEN_AFF_ID = '511c83ed.aa0fc172.511c83ee.51331b19';
