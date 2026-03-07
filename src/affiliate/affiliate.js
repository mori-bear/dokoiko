// ===== AFFILIATE CONFIG =====
const RAKUTEN_AFF     = 'https://hb.afl.rakuten.co.jp/hgc/511c83ed.aa0fc172.511c83ee.51331b19/';
const VC_BASE         = 'https://ck.jp.ap.valuecommerce.com/servlet/referral';
const JALAN_SID       = '3764408';
const JALAN_PID_HOTEL = '892559852';
const JALAN_PID_RENT  = '892559858';

// ===== 都市ID → 都道府県名 =====
const CITY_PREF = {
  // 北海道
  'sapporo': '北海道', 'otaru': '北海道', 'furano': '北海道', 'toyako': '北海道',
  'noboribetsu': '北海道', 'shiretoko': '北海道', 'jozankei': '北海道',
  'biei': '北海道', 'asahikawa': '北海道', 'kushiro': '北海道', 'hakodate': '北海道',
  // 青森
  'hirosaki': '青森', 'oirase': '青森', 'osorezan': '青森',
  // 岩手
  'hiraizumi': '岩手', 'morioka': '岩手', 'miyako-iwate': '岩手',
  // 宮城
  'sendai': '宮城', 'matsushima': '宮城', 'naruko-onsen': '宮城',
  // 秋田
  'kakunodate': '秋田', 'nyuto-onsen': '秋田', 'akita': '秋田',
  // 山形
  'sakata': '山形', 'yamagata': '山形', 'ginzan-onsen': '山形', 'zaosan': '山形',
  // 福島
  'aizu': '福島', 'ouchi-juku': '福島',
  // 栃木
  'nikko': '栃木', 'mashiko': '栃木',
  // 群馬
  'kusatsu-onsen': '群馬', 'shima-onsen': '群馬', 'minakami-onsen': '群馬',
  // 千葉
  'tateyama-chiba': '千葉',
  // 東京
  'tokyo': '東京', 'kouzushima': '東京', 'izu-oshima': '東京', 'takao': '東京',
  // 神奈川
  'yokohama': '神奈川', 'kamakura': '神奈川', 'hakone': '神奈川',
  // 新潟
  'niigata': '新潟',
  // 富山
  'tateyama-kurobe': '富山', 'gokayama': '富山', 'himi': '富山',
  // 石川
  'kanazawa': '石川', 'wajima': '石川', 'kaga-onsen': '石川', 'wakura-onsen': '石川',
  // 山梨
  'fujikawaguchiko': '山梨',
  // 長野
  'kamikochi': '長野', 'senjojiki': '長野', 'matsumoto': '長野', 'karuizawa': '長野',
  'obuse': '長野', 'nozawa-onsen': '長野', 'bessho-onsen': '長野', 'hakuba': '長野',
  'kiso': '長野', 'tsumago': '長野',
  // 岐阜
  'shirakawago': '岐阜', 'takayama': '岐阜', 'gero-onsen': '岐阜', 'gifu': '岐阜', 'magome': '岐阜',
  // 静岡
  'atami': '静岡', 'shuzenji': '静岡', 'shimoda': '静岡',
  // 愛知
  'nagoya': '愛知', 'inuyama': '愛知',
  // 三重
  'ise': '三重', 'toba': '三重',
  // 滋賀
  'nagahama': '滋賀', 'hikone': '滋賀',
  // 京都
  'kyoto': '京都', 'amanohashidate': '京都', 'ine': '京都', 'miyama': '京都',
  // 大阪
  'osaka': '大阪',
  // 兵庫
  'arima-onsen': '兵庫', 'kinosaki-onsen': '兵庫', 'awaji': '兵庫',
  'izushi': '兵庫', 'kobe': '兵庫', 'himeji': '兵庫',
  // 奈良
  'nara': '奈良',
  // 和歌山
  'ryujin-onsen': '和歌山', 'koyasan': '和歌山', 'shirahama-o': '和歌山', 'wakayama': '和歌山',
  // 鳥取
  'tottori': '鳥取', 'misasa-onsen': '鳥取',
  // 島根
  'mihonoseki': '島根', 'oku-izumo': '島根', 'tsuwano': '島根',
  // 岡山
  'kurashiki': '岡山', 'okayama': '岡山',
  // 広島
  'hiroshima': '広島', 'miyajima': '広島', 'onomichi': '広島', 'takehara': '広島',
  // 山口
  'hagi': '山口', 'shimonoseki': '山口', 'yuda-onsen': '山口', 'tsunoshima-bridge': '山口',
  // 徳島
  'tokushima': '徳島', 'kazurabashi': '徳島', 'iya': '徳島', 'oboke': '徳島',
  // 香川
  'shodoshima': '香川', 'naoshima': '香川', 'kotohira': '香川',
  // 愛媛
  'matsuyama': '愛媛', 'uwajima': '愛媛', 'uchiko': '愛媛',
  'shimonada-eki': '愛媛', 'chichibugahama': '愛媛',
  // 高知
  'kochi': '高知', 'ashizuri': '高知', 'muroto': '高知',
  // 福岡
  'fukuoka': '福岡',
  // 佐賀
  'saga': '佐賀', 'ureshino-onsen': '佐賀',
  // 長崎
  'nagasaki': '長崎', 'sasebo': '長崎', 'hirado': '長崎', 'goto': '長崎', 'unzen': '長崎',
  // 熊本
  'kumamoto': '熊本', 'kurokawa': '熊本', 'aso': '熊本',
  'minami-aso': '熊本', 'amakusa': '熊本', 'hitoyoshi': '熊本',
  // 大分
  'yufuin': '大分', 'beppu': '大分',
  // 宮崎
  'takachiho': '宮崎', 'obi': '宮崎', 'miyazaki': '宮崎',
  // 鹿児島
  'kagoshima': '鹿児島', 'yakushima': '鹿児島', 'ibusuki': '鹿児島', 'amami': '鹿児島',
  // 沖縄
  'naha': '沖縄', 'ishigaki': '沖縄', 'tokashiki-jima': '沖縄', 'kumejima': '沖縄', 'miyakojima': '沖縄',
};

// ===== 都道府県 → 楽天トラベル都道府県コード（2桁） =====
const PREF_RAKUTEN = {
  '北海道': '01', '青森': '02', '岩手': '03', '宮城': '04', '秋田': '05', '山形': '06', '福島': '07',
  '茨城': '08', '栃木': '09', '群馬': '10', '埼玉': '11', '千葉': '12', '東京': '13', '神奈川': '14',
  '新潟': '15', '富山': '16', '石川': '17', '福井': '18', '山梨': '19', '長野': '20',
  '岐阜': '21', '静岡': '22', '愛知': '23', '三重': '24',
  '滋賀': '25', '京都': '26', '大阪': '27', '兵庫': '28', '奈良': '29', '和歌山': '30',
  '鳥取': '31', '島根': '32', '岡山': '33', '広島': '34', '山口': '35',
  '徳島': '36', '香川': '37', '愛媛': '38', '高知': '39',
  '福岡': '40', '佐賀': '41', '長崎': '42', '熊本': '43', '大分': '44', '宮崎': '45', '鹿児島': '46', '沖縄': '47',
};

// ===== 都道府県 → じゃらん都道府県コード（6桁） =====
const PREF_JALAN = {
  '北海道': '010000', '青森': '020000', '岩手': '030000', '宮城': '040000', '秋田': '050000', '山形': '060000', '福島': '070000',
  '茨城': '080000', '栃木': '090000', '群馬': '100000', '埼玉': '110000', '千葉': '120000', '東京': '130000', '神奈川': '140000',
  '新潟': '150000', '富山': '160000', '石川': '170000', '福井': '180000', '山梨': '190000', '長野': '200000',
  '岐阜': '210000', '静岡': '220000', '愛知': '230000', '三重': '240000',
  '滋賀': '250000', '京都': '260000', '大阪': '270000', '兵庫': '280000', '奈良': '290000', '和歌山': '300000',
  '鳥取': '310000', '島根': '320000', '岡山': '330000', '広島': '340000', '山口': '350000',
  '徳島': '360000', '香川': '370000', '愛媛': '380000', '高知': '390000',
  '福岡': '400000', '佐賀': '410000', '長崎': '420000', '熊本': '430000', '大分': '440000', '宮崎': '450000', '鹿児島': '460000', '沖縄': '470000',
};

// ===== 都道府県取得（hotelBase・distanceMap展開suffix対応） =====
function getPrefecture(city) {
  // hotelBase が指定されているときはそのIDで都道府県を引く
  const key = city.hotelBase ?? city.id.replace(/_\d+$/, '');
  return CITY_PREF[key] ?? CITY_PREF[city.id.replace(/_\d+$/, '')] ?? null;
}

// ===== 楽天トラベル URL（アフィリエイトラッパー付き） =====
function buildRakutenUrl(city) {
  const pref = getPrefecture(city);
  const code = pref ? PREF_RAKUTEN[pref] : null;
  const target = code
    ? `https://travel.rakuten.co.jp/yado/${code}/`
    : `https://travel.rakuten.co.jp/search/?keyword=${encodeURIComponent(city.hotelBase || city.name)}`;
  return `${RAKUTEN_AFF}?pc=${encodeURIComponent(target)}`;
}

// ===== じゃらん宿泊 URL（ValueCommerce ラッパー付き） =====
function getJalanHotelUrl(city) {
  const pref = getPrefecture(city);
  const code = pref ? PREF_JALAN[pref] : null;
  const target = code
    ? `https://www.jalan.net/${code}/`
    : `https://www.jalan.net/keyword/?keyword=${encodeURIComponent(city.hotelBase || city.name)}`;
  return `${VC_BASE}?sid=${JALAN_SID}&pid=${JALAN_PID_HOTEL}&vc_url=${encodeURIComponent(target)}`;
}

// ===== じゃらんレンタカー URL（ValueCommerce ラッパー付き） =====
export function getJalanRentUrl() {
  const target = 'https://www.jalan.net/rentacar/';
  return `${VC_BASE}?sid=${JALAN_SID}&pid=${JALAN_PID_RENT}&vc_url=${encodeURIComponent(target)}`;
}

// ===== DOM 適用 =====

/** renderResult からDOM構築直後に呼び出す */
export function applyAffiliateLinks(city, hubCity = null) {
  applyHotelSection(city, 'jalanHotelBtn', 'rakutenHotelBtn');
  if (hubCity) {
    applyHotelSection(hubCity, 'jalanHubHotelBtn', 'rakutenHubHotelBtn');
  }

  // ── レンタカー（needsCar=true のときのみ存在する） ──
  const rentBtn = document.getElementById('jalanRentBtn');
  if (rentBtn) {
    rentBtn.href = getJalanRentUrl();
  }
}

function applyHotelSection(city, jalanId, rakutenId) {
  const jalanBtn = document.getElementById(jalanId);
  if (jalanBtn) jalanBtn.href = getJalanHotelUrl(city);

  const rakutenBtn = document.getElementById(rakutenId);
  if (rakutenBtn) rakutenBtn.href = buildRakutenUrl(city);
}
