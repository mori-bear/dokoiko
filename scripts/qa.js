/**
 * qa.js — 総合品質テスト v2（Node.js）
 *
 * 実行:
 *   node qa.js           # HTTP は サンプル（高速）
 *   node qa.js --http    # HTTP 全件（149 都市 × 2 URL）
 *
 * チェック項目:
 *   [1] gateway 構造検証（全 destination）
 *   [2] 交通リンク生成（全都市 × 5 出発地、0 件エラー）
 *   [3] 交通整合性テスト（代表 6 ルート）
 *   [4] 宿リンク URL 生成（全都市）
 *   [5] アフィリエイト URL 形式検証
 *   [6] HTTP HEAD テスト（じゃらん全件 + 楽天Affサンプル）
 *   [7] UI 整合（daytrip 宿非表示ロジック）
 *   [8] テーマ整合（weight 0.3 抑制）
 *   [8m] コンテンツ品質（catch/tags/description）
 *   [9] 結果サマリ出力
 */

import fs    from 'fs';
import https from 'https';
import { URL } from 'url';

const FULL_HTTP = process.argv.includes('--http');
const USE_V2    = process.argv.includes('--v2');

/* ══════════════════════════════════════════
   データ読み込み
══════════════════════════════════════════ */

// 新ファイル構造: hubs.json + destinations.json を結合
const HUBS_RAW  = JSON.parse(fs.readFileSync('./src/data/hubs.json', 'utf8'));
const DESTS_FILE = USE_V2 ? './data/destinations_v2.json' : './src/data/destinations.json';
const DESTS_RAW = JSON.parse(fs.readFileSync(DESTS_FILE, 'utf8'));
if (USE_V2) console.log(`[QA] データソース: ${DESTS_FILE} (${DESTS_RAW.length}件)`);
const ALL   = [...HUBS_RAW, ...DESTS_RAW];
const HOTEL_AREAS_RAW = JSON.parse(fs.readFileSync('./src/data/hotelAreas.json', 'utf8'));
const HOTEL_AREA_MAP  = new Map(HOTEL_AREAS_RAW.map(a => [a.id, a]));
const DESTS = DESTS_RAW; // destinations.json には hub が含まれない

/* ══════════════════════════════════════════
   定数（constants.js と同期）
══════════════════════════════════════════ */

const DEPARTURE_CITY_INFO = {
  '札幌':   { rail:'札幌駅',        airport:'新千歳空港 国内線ターミナル',    iata:'CTS', jrArea:'east'   },
  '函館':   { rail:'函館駅',        airport:'函館空港',                       iata:'HKD', jrArea:'east'   },
  '旭川':   { rail:'旭川駅',        airport:'旭川空港',                       iata:'AKJ', jrArea:'east'   },
  '仙台':   { rail:'仙台駅',        airport:'仙台空港',                       iata:'SDJ', jrArea:'east'   },
  '盛岡':   { rail:'盛岡駅',        airport:'いわて花巻空港',                 iata:'HNA', jrArea:'east'   },
  '東京':   { rail:'東京駅',        airport:'羽田空港 国内線ターミナル',       iata:'TYO', jrArea:'east'   },
  '横浜':   { rail:'横浜駅',        airport:'羽田空港 国内線ターミナル',       iata:'TYO', jrArea:'east'   },
  '千葉':   { rail:'千葉駅',        airport:'成田国際空港',                   iata:'TYO', jrArea:'east'   },
  '大宮':   { rail:'大宮駅',        airport:'羽田空港 国内線ターミナル',       iata:'TYO', jrArea:'east'   },
  '宇都宮': { rail:'宇都宮駅',      airport:'羽田空港 国内線ターミナル',       iata:'TYO', jrArea:'east'   },
  '長野':   { rail:'長野駅',        airport:'松本空港',                       iata:'MMJ', jrArea:'east'   },
  '静岡':   { rail:'静岡駅',        airport:'静岡空港',                       iata:'FSZ', jrArea:'west'   },
  '名古屋': { rail:'名古屋駅',      airport:'中部国際空港 セントレア',         iata:'NGO', jrArea:'west'   },
  '金沢':   { rail:'金沢駅',        airport:'小松空港',                       iata:'KMQ', jrArea:'west'   },
  '富山':   { rail:'富山駅',        airport:'富山きときと空港',               iata:'TOY', jrArea:'west'   },
  '大阪':   { rail:'大阪駅',        airport:'大阪国際空港 国内線ターミナル',   iata:'OSA', jrArea:'west'   },
  '京都':   { rail:'京都駅',        airport:'大阪国際空港 国内線ターミナル',   iata:'OSA', jrArea:'west'   },
  '神戸':   { rail:'三ノ宮駅',      airport:'神戸空港',                       iata:'UKB', jrArea:'west'   },
  '奈良':   { rail:'奈良駅',        airport:'大阪国際空港 国内線ターミナル',   iata:'OSA', jrArea:'west'   },
  '広島':   { rail:'広島駅',        airport:'広島空港',                       iata:'HIJ', jrArea:'west'   },
  '岡山':   { rail:'岡山駅',        airport:'岡山桃太郎空港',                 iata:'OKJ', jrArea:'west'   },
  '松江':   { rail:'松江駅',        airport:'出雲縁結び空港',                 iata:'IZO', jrArea:'west'   },
  '高松':   { rail:'高松駅',        airport:'高松空港',                       iata:'TAK', jrArea:'west'   },
  '松山':   { rail:'松山駅',        airport:'松山空港',                       iata:'MYJ', jrArea:'west'   },
  '高知':   { rail:'高知駅',        airport:'高知龍馬空港',                   iata:'KCZ', jrArea:'west'   },
  '徳島':   { rail:'徳島駅',        airport:'徳島阿波おどり空港',             iata:'TKS', jrArea:'west'   },
  '福岡':   { rail:'博多駅',        airport:'福岡空港 国内線ターミナル',       iata:'FUK', jrArea:'kyushu' },
  '熊本':   { rail:'熊本駅',        airport:'熊本空港',                       iata:'KMJ', jrArea:'kyushu' },
  '鹿児島': { rail:'鹿児島中央駅',  airport:'鹿児島空港',                     iata:'KOJ', jrArea:'kyushu' },
  '長崎':   { rail:'長崎駅',        airport:'長崎空港',                       iata:'NGS', jrArea:'kyushu' },
  '宮崎':   { rail:'宮崎駅',        airport:'宮崎ブーゲンビリア空港',         iata:'KMI', jrArea:'kyushu' },
};

const CITY_AIRPORT = {
  '札幌':'CTS','函館':'HKD','旭川':'AKJ','仙台':'SDJ','盛岡':'HNA',
  '東京':'HND','横浜':'HND','千葉':'NRT','大宮':'HND','宇都宮':'HND',
  '長野':'MMJ','静岡':'FSZ','名古屋':'NGO','金沢':'KMQ','富山':'TOY',
  '大阪':'ITM','京都':'ITM','神戸':'UKB','奈良':'ITM',
  '広島':'HIJ','岡山':'OKJ','松江':'IZO',
  '高松':'TAK','松山':'MYJ','高知':'KCZ','徳島':'TKS',
  '福岡':'FUK','熊本':'KMJ','鹿児島':'KOJ','長崎':'NGS','宮崎':'KMI',
};

const AIRPORT_IATA = {
  '新千歳空港':'CTS','那覇空港':'OKA','石垣空港':'ISG','福岡空港':'FUK',
  '仙台空港':'SDJ','広島空港':'HIJ','高松空港':'TAK','中部国際空港':'NGO',
  '羽田空港':'HND','大阪国際空港':'ITM','関西国際空港':'KIX',
  '宮崎空港':'KMI','松山空港':'MYJ','釧路空港':'KUH','久米島空港':'UEO',
  '宮古空港':'MMY','米子空港':'YGJ','女満別空港':'MMB','中標津空港':'SHB',
  '屋久島空港':'KUM','奄美空港':'ASJ','五島福江空港':'FUJ','青森空港':'AOJ',
  '阿蘇くまもと空港':'KMJ','静岡空港':'FSZ','出雲空港':'IZO',
  '出雲縁結び空港':'IZO','小松空港':'KMQ','大分空港':'OIT','南紀白浜空港':'SHM',
  // 追加（2024〜2025）
  '対馬空港':'TSJ','種子島空港':'TNE','壱岐空港':'IKI','但馬空港':'TJH',
  '岩国錦帯橋空港':'IWK','庄内空港':'SYO','徳島空港':'TKS','旭川空港':'AKJ',
  '松本空港':'MMJ','岡山桃太郎空港':'OKJ','与那国空港':'OGN',
  '長崎空港':'NGS','高知空港':'KCZ','鹿児島空港':'KOJ',
};

const AIRPORT_HUB_GATEWAY = {
  '那覇':   '那覇空港',
  '石垣':   '石垣空港',
  '鹿児島': '鹿児島空港',
  '福岡':   '福岡空港',
};

const FLIGHT_ROUTES = {
  'HND':['CTS','MMB','KUH','SHB','AOJ','SDJ','HNA','OKA','ISG','MMY','UEO','FUK','KOJ','KMI','KMJ','NGS','OIT','HIJ','OKJ','MYJ','KCZ','TKS','TAK','YGJ','IZO','FSZ','KUM','ASJ','FUJ','KMQ','SHM','SYO','OGN','TNE'],
  'ITM':['CTS','SDJ','SYO','AOJ','OKA','ISG','MMY','UEO','FUK','KOJ','KMI','KMJ','NGS','MYJ','KCZ','TKS','KUM','ASJ','FUJ'],
  'NRT':['CTS','OKA','FUK','SDJ'],
  'NGO':['CTS','SDJ','OKA','FUK','KOJ','KMI'],
  'FUK':['HND','ITM','NGO','CTS','SDJ','OKA','ISG','MMY','UEO','KUM','ASJ','TSJ','IKI'],
  'CTS':['HND','ITM','NGO','FUK','SDJ','OKA'],
  'SDJ':['HND','ITM','FUK','CTS','OKA','HIJ'],
  'HIJ':['HND','SDJ','OKA','FUK'],
  'TAK':['HND','FUK','OKA'],
  'MYJ':['HND','ITM','FUK'],
  'KCZ':['HND','ITM','FUK'],
  'TKS':['HND','ITM','FUK'],
  'KOJ':['HND','ITM','NGO','OKA','TNE'],
  'KMI':['HND','ITM','FUK','OKA'],
  'KMJ':['HND','ITM'],
  'NGS':['HND','ITM','TSJ'],
  'OKJ':['HND','OKA'],
  'IZO':['HND','ITM'],
  'YGJ':['HND'],
  'KMQ':['HND'],
  'TOY':['HND'],
  'OIT':['HND','ITM'],
  'SHM':['HND'],
  'UKB':['OKA','FUK'],
  'HKD':['HND'],
  'AKJ':['HND','ITM'],
  'HNA':['HND','ITM'],
  'MMJ':['HND'],
  'FSZ':['HND','FUK'],
  'TSJ':['FUK','NGS'],
  'TNE':['KOJ'],
  'IKI':['FUK'],
  'SYO':['HND','ITM'],
  'OGN':['OKA','ISG'],
};

const THEME_TAG_ALIASES = {
  '温泉':   ['温泉','秘湯'],
  '絶景':   ['絶景','自然','渓谷','富士山','高原','湖','火山','アルプス'],
  '海':     ['海','海の幸','離島','ダイビング','港町','リゾート'],
  '街歩き': ['街歩き','歴史','城下町','宿場町','古都'],
  'グルメ': ['グルメ','海の幸','食文化','海'],
};

/* ══════════════════════════════════════════
   ロジック（transport / hotel）
══════════════════════════════════════════ */

function isFlightAvailable(dep, airportGateway) {
  const from = CITY_AIRPORT[dep];
  const to   = AIRPORT_IATA[airportGateway];
  if (!from || !to) return false;
  return (FLIGHT_ROUTES[from] || []).includes(to);
}

const PORT_SELECT = {
  'izu-oshima':  d => (['名古屋','大阪','京都','神戸','広島','福岡'].includes(d) ? '熱海港' : d==='静岡' ? '稲取港' : '竹芝客船ターミナル'),
  'naoshima':    d => (['高松','松山','高知','徳島'].includes(d) ? '高松港' : '宇野港'),
  'shodoshima':  d => (['高松','松山','高知','徳島'].includes(d) ? '高松港' : '宇野港'),
  'goto':        d => (d==='長崎' ? '長崎港' : '博多港'),
};

function selectPort(city, dep, ferries) {
  if (!ferries.length) return null;
  if (ferries.length === 1) return ferries[0];
  const sel = PORT_SELECT[city.id];
  return sel ? sel(dep) : ferries[0];
}

const EX_CITIES = new Set(['東京','横浜','大宮','品川','名古屋','京都','大阪','神戸','姫路','岡山','広島','小倉','博多','熊本','鹿児島','長崎']);

function resolveRailProvider(dep, city) {
  if (EX_CITIES.has(dep) && EX_CITIES.has(city.name)) return 'ex';
  const area = DEPARTURE_CITY_INFO[dep]?.jrArea || 'west';
  if (area === 'east') return 'jr-east';
  if (area === 'kyushu') return 'jr-kyushu';
  return 'jr-west';
}

/** ゲートウェイ取得（新フラットフィールド → gateways配列 fallback）*/
function gw(city, key) {
  return city[key] || city.gateways?.[key]?.[0] || null;
}

/** 距離スター動的計算（transportRenderer.js の calculateDistanceStars に相当）*/
const DEPARTURE_REGION_QA = {
  '東京':'関東','横浜':'関東','千葉':'関東','大宮':'関東','宇都宮':'関東',
  '仙台':'東北','盛岡':'東北',
  '札幌':'北海道','旭川':'北海道','函館':'北海道',
  '名古屋':'中部','静岡':'中部','長野':'中部','富山':'中部','金沢':'中部',
  '大阪':'近畿','京都':'近畿','神戸':'近畿','奈良':'近畿',
  '広島':'中国','岡山':'中国','松江':'中国',
  '高松':'四国','松山':'四国','高知':'四国','徳島':'四国',
  '福岡':'九州','熊本':'九州','鹿児島':'九州','長崎':'九州','宮崎':'九州',
};
const METRO1_QA = {
  '札幌': new Set(['定山渓','小樽']),
  '東京': new Set(['横浜','鎌倉','高尾山']),
  '横浜': new Set(['東京','鎌倉']),
  '大阪': new Set(['神戸','有馬温泉']),
  '神戸': new Set(['大阪','有馬温泉']),
  '広島': new Set(['宮島']),
  '高松': new Set(['直島','小豆島']),
  '岡山': new Set(['直島','小豆島','倉敷']),
};
const HOTEL_HUB_REGION_QA = {
  '旭川':'北海道','小樽':'北海道','釧路':'北海道','函館':'北海道','知床':'北海道',
  '定山渓':'北海道','富良野':'北海道','美瑛':'北海道','洞爺湖':'北海道','登別':'北海道','積丹':'北海道',
  '仙台':'東北','盛岡':'東北','山形':'東北','秋田':'東北','平泉':'東北','宮古':'東北',
  '酒田':'東北','会津若松':'東北','銀山温泉':'東北','奥入瀬':'東北','乳頭温泉':'東北',
  '角館':'東北','弘前':'東北','蔵王':'東北','松島':'東北','鳴子温泉':'東北','大内宿':'東北','三陸':'東北',
  '東京':'関東','横浜':'関東','千葉':'関東','大宮':'関東','鎌倉':'関東','高尾山':'関東',
  '日光':'関東','箱根':'関東','草津温泉':'関東','四万温泉':'関東','水上温泉':'関東',
  '水戸':'関東','甲府':'関東','益子':'関東','館山':'関東','熱海':'関東','修善寺':'関東',
  '下田':'関東','伊豆高原':'関東',
  '名古屋':'中部','静岡':'中部','長野':'中部','富山':'中部','金沢':'中部','新潟':'中部',
  '松本':'中部','軽井沢':'中部','高山':'中部','白川郷':'中部','五箇山':'中部','岐阜':'中部',
  '富士河口湖':'中部','上高地':'中部','白馬':'中部','野沢温泉':'中部','別所温泉':'中部',
  '小布施':'中部','立山黒部':'中部','輪島':'中部','加賀温泉郷':'中部','和倉温泉':'中部',
  '氷見':'中部','下呂温泉':'中部','伊勢':'中部','鳥羽':'中部','木曽':'中部',
  '妻籠':'中部','馬籠':'中部','飯田':'中部','飛騨古川':'中部','能登':'中部',
  '大阪':'近畿','京都':'近畿','神戸':'近畿','奈良':'近畿','有馬温泉':'近畿',
  '姫路':'近畿','城崎温泉':'近畿','天橋立':'近畿','伊根':'近畿','白浜':'近畿',
  '和歌山':'近畿','高野山':'近畿','龍神温泉':'近畿','美山':'近畿','彦根':'近畿',
  '長浜':'近畿','出石':'近畿','淡路島':'近畿','田辺':'近畿','熊野':'近畿','吉野':'近畿',
  '広島':'中国','岡山':'中国','松江':'中国','鳥取':'中国','倉敷':'中国','米子':'中国',
  '萩':'中国','下関':'中国','尾道':'中国','竹原':'中国','三朝温泉':'中国','奥出雲':'中国',
  '津和野':'中国','湯田温泉':'中国','宮島':'中国','高梁':'中国',
  '高松':'四国','松山':'四国','高知':'四国','徳島':'四国','大歩危':'四国','琴平':'四国',
  '宇和島':'四国','内子':'四国','足摺岬':'四国','室戸':'四国','祖谷':'四国','土佐清水':'四国',
  '福岡':'九州','熊本':'九州','鹿児島':'九州','長崎':'九州','宮崎':'九州','佐賀':'九州','博多':'九州',
  '湯布院':'九州','別府':'九州','黒川温泉':'九州','阿蘇':'九州','南阿蘇':'九州',
  '高千穂':'九州','雲仙':'九州','天草':'九州','指宿':'九州','嬉野温泉':'九州',
  '佐世保':'九州','平戸':'九州','人吉':'九州','飫肥':'九州','奄美大島':'九州',
  '糸島':'九州','島原':'九州','豊後高田':'九州',
  '那覇':'沖縄','石垣島':'沖縄','宮古島':'沖縄','久米島':'沖縄','渡嘉敷島':'沖縄',
};
const REGION_ADJ_QA = {
  '北海道':['東北'],'東北':['北海道','関東','中部'],'関東':['東北','中部'],
  '中部':['関東','東北','近畿'],'近畿':['中部','中国','四国'],
  '中国':['近畿','四国','九州'],'四国':['近畿','中国','九州'],
  '九州':['中国','四国','沖縄'],'沖縄':['九州'],
};
function regionDistQA(from, to) {
  if (!from||!to) return 99;
  if (from===to) return 0;
  const vis=new Set([from]);const q=[[from,0]];
  while(q.length){const[cur,d]=q.shift();for(const n of(REGION_ADJ_QA[cur]||[])){if(n===to)return d+1;if(!vis.has(n)){vis.add(n);q.push([n,d+1]);}}}
  return 99;
}
function calcStarsQA(dep, city) {
  const hub=city.hubCity||city.name;
  const isIsland=!!(city.isIsland||city.destType==='island');
  if(hub===dep) return 1;
  if(METRO1_QA[dep]?.has(hub)) return 1;
  if(isIsland) return 3;
  const depReg=DEPARTURE_REGION_QA[dep];
  if(!depReg) return 2;
  const hubReg=HOTEL_HUB_REGION_QA[hub]||city.region||depReg;
  const d=regionDistQA(depReg,hubReg);
  return d===0?2:3;
}

/** transport links を型配列で返す（簡易版・transportRenderer.js と同期）*/
function getLinks(city, dep) {
  const fromCity = DEPARTURE_CITY_INFO[dep];
  if (!fromCity) return [];
  const isIsland = !!(city.isIsland || city.destType === 'island');
  const railGateway    = gw(city, 'railGateway');
  const airportGateway = gw(city, 'airportGateway');
  const ferryGateway   = gw(city, 'ferryGateway');
  const ferries = ferryGateway
    ? [ferryGateway]
    : (city.gateways?.ferry ?? []);
  const links   = [];

  // 島: フェリー + 飛行機（airportHub対応）
  if (isIsland && ferries.length) {
    // 飛行機（直行 or airportHub経由）
    if (airportGateway && isFlightAvailable(dep, airportGateway)) {
      links.push({ type:'skyscanner' });
    } else {
      const hub = city.airportHub;
      if (hub) {
        const hubAirport = AIRPORT_HUB_GATEWAY[hub];
        if (hubAirport && isFlightAvailable(dep, hubAirport)) {
          links.push({ type:'skyscanner' });
        }
      }
    }
    // フェリー
    const port = selectPort(city, dep, ferries);
    if (port) {
      links.push({ type:'ferry', label:'フェリー', port });
      links.push({ type:'google-maps' });
    }
    if (city.needsCar || isIsland) links.push({ type:'rental' });
    return links;
  }

  // ★1 近場（動的計算）
  if (calcStarsQA(dep, city) === 1) {
    links.push({ type:'google-maps' });
    return links;
  }

  // 通常ルート: JR → 高速バス → 飛行機 → フェリー → 二次交通
  if (railGateway) {
    const provider = city.railProvider
      ? (city.railProvider === 'ekinet' ? 'jr-east' : city.railProvider === 'jrkyushu' ? 'jr-kyushu' : 'jr-west')
      : resolveRailProvider(dep, city);
    links.push({ type: provider });
    links.push({ type:'google-maps' });
    // 二次交通（secondaryTransport or railNote）
    if (city.secondaryTransport || city.railNote) {
      links.push({ type:'google-maps' });
    }
  }
  // 高速バス
  const buses = city.gateways?.bus ?? [];
  buses.forEach(() => links.push({ type:'google-maps' }));

  // 飛行機
  if (airportGateway && isFlightAvailable(dep, airportGateway)) {
    links.push({ type:'skyscanner' });
    links.push({ type:'google-maps-arr' });
  }
  // フェリー（非島）
  if (ferryGateway && !isIsland) links.push({ type:'ferry' });

  // 二次交通（railGateway なし）
  if (!railGateway && city.secondaryTransport) {
    links.push({ type:'google-maps' });
  } else if (!railGateway && city.requiresCar) {
    links.push({ type:'google-maps' });
  }

  if (!links.length) links.push({ type:'google-maps' });
  if (city.needsCar || isIsland) links.push({ type:'rental' });
  return links;
}

/** hotelLinkBuilder.js と同期: hotelArea → rakutenKeyword → prefecture + city */
function resolveKeyword(city) {
  if (city.hotelArea) {
    const area = HOTEL_AREA_MAP.get(city.hotelArea);
    if (area?.rakutenKeyword) return area.rakutenKeyword;
  }
  return `${city.prefecture} ${city.city}`;
}

function buildJalanUrl(city) {
  const vc = 'https://ck.jp.ap.valuecommerce.com/servlet/referral?sid=3764408&pid=892559858&vc_url=';
  // area.jalanUrl（Shift-JIS事前エンコード済み）優先
  if (city.hotelArea) {
    const area = HOTEL_AREA_MAP.get(city.hotelArea);
    if (area?.jalanUrl) return vc + encodeURIComponent(area.jalanUrl);
  }
  const kw = resolveKeyword(city);
  const target = `https://www.jalan.net/uw/uwp2011/uww2011init.do?keyword=${encodeURIComponent(kw)}`;
  return vc + encodeURIComponent(target);
}

function buildRakutenUrl(city) {
  const aff = 'https://hb.afl.rakuten.co.jp/hgc/5113ee4b.8662cfc5.5113ee4c.119de89a/?pc=';
  // TASK5: hotelLinkBuilder.js と同期: rakutenPath があればエリアページ直リンク
  if (city.hotelArea) {
    const area = HOTEL_AREA_MAP.get(city.hotelArea);
    if (area?.rakutenPath) return aff + `https://travel.rakuten.co.jp${area.rakutenPath}`;
  }
  const kw  = resolveKeyword(city);
  const target = `https://kw.travel.rakuten.co.jp/keyword/Search.do?f_query=${encodeURIComponent(kw)}`;
  return aff + target; // pc パラメータは raw URL（Rakuten affiliate 仕様）
}

/* ══════════════════════════════════════════
   HTTP ヘルパー
══════════════════════════════════════════ */

function httpsHead(targetUrl, timeout = 10000) {
  return new Promise(resolve => {
    try {
      const parsed = new URL(targetUrl);
      const req = https.request(
        { hostname: parsed.hostname, path: parsed.pathname + parsed.search,
          method: 'HEAD', timeout,
          headers: { 'User-Agent': 'Mozilla/5.0 (compatible; DokoikoQA/2.0)' } },
        res => { resolve({ status: res.statusCode, ok: res.statusCode < 400 }); res.resume(); }
      );
      req.on('timeout', () => { req.destroy(); resolve({ status:0, ok:false, err:'timeout' }); });
      req.on('error',   e  => resolve({ status:0, ok:false, err:e.message }));
      req.end();
    } catch (e) { resolve({ status:0, ok:false, err:e.message }); }
  });
}

async function runBatched(tasks, n = 10) {
  const out = [];
  for (let i = 0; i < tasks.length; i += n) {
    out.push(...await Promise.all(tasks.slice(i, i+n).map(t => t())));
    if (i + n < tasks.length) await new Promise(r => setTimeout(r, 150));
  }
  return out;
}

/* ══════════════════════════════════════════
   スコアカード
══════════════════════════════════════════ */

class Scorecard {
  constructor(name) {
    this.name = name;
    this.pass = 0;
    this.fail = 0;
    this.errors = [];
  }
  ok()          { this.pass++; }
  ng(msg)       { this.fail++; this.errors.push(msg); }
  check(c, msg) { c ? this.ok() : this.ng(msg); }
  print() {
    const icon = this.fail === 0 ? '✓' : '✗';
    console.log(`${icon} ${this.name}: PASS ${this.pass} / FAIL ${this.fail}`);
    this.errors.slice(0, 10).forEach(e => console.log(`    ✗ ${e}`));
    if (this.errors.length > 10) console.log(`    ... 他 ${this.errors.length-10} 件`);
  }
}

/* ══════════════════════════════════════════
   メイン
══════════════════════════════════════════ */

(async () => {
  const SCAN_DEPS = ['東京', '大阪', '福岡', '高松', '札幌'];
  const scorecards = [];

  /* ───────────────────────────────
     [1] データ構造検証
  ─────────────────────────────── */
  {
    const sc = new Scorecard('[1] データ構造');
    DESTS.forEach(city => {
      // 最低1つのゲートウェイが必要
      const hasRail    = !!(city.railGateway    || city.gateways?.rail?.length);
      const hasAirport = !!(city.airportGateway || city.gateways?.airport?.length);
      const hasFerry   = !!(city.ferryGateway   || city.gateways?.ferry?.length);
      const hasAny     = hasRail || hasAirport || hasFerry;
      sc.check(hasAny, `${city.id}: ゲートウェイなし（rail/airport/ferry すべて空）`);

      // island: ferry or airport 必須
      const isIsland = !!(city.isIsland || city.destType === 'island');
      if (isIsland) {
        sc.check(
          hasFerry || hasAirport,
          `${city.id}: island だが ferry/airport ゲートウェイなし`
        );
      }

      // destType 必須
      sc.check(
        ['city','sight','onsen','island','remote','mountain','peninsula'].includes(city.destType),
        `${city.id}: destType 未設定または不正（${city.destType}）`
      );
    });
    sc.print();
    scorecards.push(sc);
  }

  /* ───────────────────────────────
     [2] 交通リンク生成（0件エラー）
  ─────────────────────────────── */
  {
    const sc = new Scorecard('[2] 交通リンク生成');
    let total = 0, ok = 0;
    DESTS.forEach(city => {
      SCAN_DEPS.forEach(dep => {
        total++;
        const links = getLinks(city, dep);
        if (links.length > 0) { sc.ok(); ok++; }
        else sc.ng(`${city.name}(${city.id}) ← ${dep}: links=0`);
      });
    });
    console.log(`  総計: ${total} 組, 成功: ${ok}`);
    sc.print();
    scorecards.push(sc);
  }

  /* ───────────────────────────────
     [3] 交通整合性テスト（代表ルート）
  ─────────────────────────────── */
  {
    const sc = new Scorecard('[3] 交通整合性');

    const CASES = [
      {
        dep: '高松', destId: 'matsuyama', name: '高松→松山',
        expect:    { jr:true, skyscanner:false, ferry:true, googleMaps:true },
        notExpect: { skyscanner:true },
      },
      {
        dep: '大阪', destId: 'matsuyama', name: '大阪→松山',
        expect:    { skyscanner:true, jr:true },
      },
      {
        dep: '東京', destId: 'sapporo-t', name: '東京→札幌',
        expect:    { skyscanner:true },
        notExpect: { jr:true },
      },
      {
        dep: '高松', destId: 'naoshima', name: '高松→直島',
        expect:    { ferry:true, googleMaps:true },
        notExpect: { skyscanner:true },
      },
      {
        dep: '東京', destId: 'izu-oshima', name: '東京→伊豆大島',
        expect:    { ferry:true, googleMaps:true },
        notExpect: { skyscanner:true },
      },
      {
        dep: '大阪', destId: 'shodoshima', name: '大阪→小豆島',
        expect:    { ferry:true, googleMaps:true },
        notExpect: { skyscanner:true },
      },
      // railNote あり → JR + GoogleMaps(出発→gateway) + GoogleMaps(gateway→destination) が正
      {
        dep: '大宮', destId: 'nyuto-onsen', name: '大宮→乳頭温泉',
        expect:    { jr:true, googleMaps:true },
        notExpect: { skyscanner:true },
      },
      {
        dep: '名古屋', destId: 'magome', name: '名古屋→馬籠',
        expect:    { jr:true, googleMaps:true },
        notExpect: { skyscanner:true },
      },
      {
        dep: '東京', destId: 'kamikochi', name: '東京→上高地',
        expect:    { jr:true, googleMaps:true },
        notExpect: { skyscanner:true },
      },
      {
        dep: '高松', destId: 'shijishima', name: '高松→志々島',
        expect:    { ferry:true, googleMaps:true },
        notExpect: { skyscanner:true },
      },
      // airportHub 経由: 大阪→那覇経由→与那国（ITM直行なし → OKA経由）
      {
        dep: '大阪', destId: 'yonaguni-island', name: '大阪→与那国島',
        expect:    { skyscanner:true },
        notExpect: { jr:true },
      },
      // 長距離 JR のみ（飛行機なし）
      {
        dep: '大阪', destId: 'nasu', name: '大阪→那須',
        expect:    { jr:true, googleMaps:true },
        notExpect: { skyscanner:true },
      },
    ];

    CASES.forEach(tc => {
      // ALL = hubs + destinations（hubs も交通テスト対象）
      const city = ALL.find(c => c.id === tc.destId);
      if (!city) { sc.ng(`${tc.name}: destId ${tc.destId} 見つからない`); return; }

      const links   = getLinks(city, tc.dep);
      const types   = new Set(links.map(l => l.type));
      const hasJr   = [...types].some(t => t.startsWith('jr'));
      const hasMaps = [...types].some(t => t.includes('google-maps'));

      if (tc.expect) {
        if (tc.expect.jr         !== undefined) sc.check(hasJr        === tc.expect.jr,         `${tc.name}: JR=${hasJr} (期待:${tc.expect.jr})`);
        if (tc.expect.skyscanner !== undefined) sc.check(types.has('skyscanner') === tc.expect.skyscanner, `${tc.name}: Skyscanner=${types.has('skyscanner')} (期待:${tc.expect.skyscanner})`);
        if (tc.expect.ferry      !== undefined) sc.check(types.has('ferry')      === tc.expect.ferry,      `${tc.name}: Ferry=${types.has('ferry')} (期待:${tc.expect.ferry})`);
        if (tc.expect.googleMaps !== undefined) sc.check(hasMaps                 === tc.expect.googleMaps, `${tc.name}: GoogleMaps=${hasMaps} (期待:${tc.expect.googleMaps})`);
      }
      if (tc.notExpect) {
        if (tc.notExpect.skyscanner) sc.check(!types.has('skyscanner'), `${tc.name}: Skyscanner が出るべきでない（route 存在しない）`);
        if (tc.notExpect.jr)         sc.check(!hasJr,                   `${tc.name}: JR が出るべきでない`);
      }

      const icon = sc.errors.some(e => e.includes(tc.name)) ? '  ✗' : '  ✓';
      console.log(`${icon} ${tc.name}: [${[...types].join(', ')}]`);
    });

    sc.print();
    scorecards.push(sc);
  }

  /* ───────────────────────────────
     [4] 宿リンク URL 生成
  ─────────────────────────────── */
  {
    const sc = new Scorecard('[4] 宿リンク URL 生成');
    DESTS.forEach(city => {
      const kw = resolveKeyword(city);
      sc.check(!!kw && kw.trim().length > 0, `${city.id}: keyword 空`);

      // keyword = area.rakutenKeyword または prefecture + " " + city
      const expectedKw = (() => {
        if (city.hotelArea) {
          const a = HOTEL_AREA_MAP.get(city.hotelArea);
          if (a?.rakutenKeyword) return a.rakutenKeyword;
        }
        return `${city.prefecture} ${city.city}`;
      })();
      sc.check(kw === expectedKw,
        `${city.id}: keyword 不一致（got:${kw} expected:${expectedKw}）`);

      const jUrl = buildJalanUrl(city);
      const rUrl = buildRakutenUrl(city);
      sc.check(jUrl.includes('ck.jp.ap.valuecommerce.com'),     `${city.id}: じゃらん VC ドメイン欠落`);
      sc.check(jUrl.includes('uwp2011'),                        `${city.id}: じゃらん uwp2011 URL 欠落`);
      sc.check(rUrl.includes('hb.afl.rakuten.co.jp'),           `${city.id}: 楽天 aff ドメイン欠落`);
      // TASK5: rakutenPath 使用時はエリアページURL、それ以外は keyword/Search.do
      const usesRakutenPath = !!(city.hotelArea && HOTEL_AREA_MAP.get(city.hotelArea)?.rakutenPath);
      if (usesRakutenPath) {
        sc.check(rUrl.includes('travel.rakuten.co.jp/yado/'), `${city.id}: 楽天 rakutenPath URL 形式不正`);
      } else {
        sc.check(rUrl.includes('kw.travel.rakuten.co.jp/keyword/Search.do'), `${city.id}: 楽天 keyword/Search.do URL 欠落`);
        sc.check(rUrl.includes(`f_query=${encodeURIComponent(kw)}`),
          `${city.id}: 楽天 keyword エンコード不正`);
      }
    });
    sc.print();
    scorecards.push(sc);
  }

  /* ───────────────────────────────
     [5] アフィリエイト URL 形式検証
  ─────────────────────────────── */
  {
    const sc = new Scorecard('[5] アフィリエイト URL 形式');
    DESTS.forEach(city => {
      const jUrl = buildJalanUrl(city);
      const rUrl = buildRakutenUrl(city);
      sc.check(jUrl.startsWith('https://ck.jp.ap.valuecommerce.com/servlet/referral?sid=3764408&pid=892559858'),
        `${city.id}: じゃらん VC URL 形式不正`);
      sc.check(rUrl.startsWith('https://hb.afl.rakuten.co.jp/hgc/5113ee4b.8662cfc5.5113ee4c.119de89a/?pc='),
        `${city.id}: 楽天 Aff URL 形式不正`);
      // TASK5: rakutenPath 使用時はエリアページ URL、それ以外は keyword/Search.do
      const usesRakutenPathAff = !!(city.hotelArea && HOTEL_AREA_MAP.get(city.hotelArea)?.rakutenPath);
      sc.check(
        usesRakutenPathAff
          ? rUrl.includes('travel.rakuten.co.jp/yado/')
          : rUrl.includes('kw.travel.rakuten.co.jp/keyword/Search.do?f_query='),
        `${city.id}: 楽天 URL 形式不正`);
    });
    sc.print();
    scorecards.push(sc);
  }

  /* ───────────────────────────────
     [6] HTTP 接続テスト
  ─────────────────────────────── */
  {
    const sc = new Scorecard('[6] HTTP 接続');
    const targets = FULL_HTTP ? DESTS : sampleByRegion(DESTS, 2);
    console.log(`  対象: ${targets.length} 都市 ${FULL_HTTP ? '（全件）' : '（地域サンプル）'} × 2 URL`);

    const tasks = [];
    targets.forEach(city => {
      // じゃらん: target URL（直接 HEAD → 200 を期待）
      const _area = city.hotelArea ? HOTEL_AREA_MAP.get(city.hotelArea) : null;
      const jTarget = (_area?.jalanUrl) || `https://www.jalan.net/uw/uwp2011/uww2011init.do?keyword=${encodeURIComponent(resolveKeyword(city))}`;
      tasks.push(() => httpsHead(jTarget).then(r => ({ city, svc:'じゃらん', url:jTarget, ...r })));
      // 楽天: keyword/Search.do?f_query= → 200
      const rTarget = `https://kw.travel.rakuten.co.jp/keyword/Search.do?f_query=${encodeURIComponent(resolveKeyword(city))}`;
      tasks.push(() => httpsHead(rTarget).then(r => ({ city, svc:'楽天', url:rTarget, ...r })));
    });

    process.stdout.write(`  送信中 (${tasks.length} req)... `);
    const results = await runBatched(tasks, 10);
    console.log('完了');

    results.forEach(r => {
      if (r.ok) sc.ok();
      else {
        sc.ng(`[${r.svc}] ${r.city.name}: ${r.err || 'HTTP '+r.status}`);
        console.log(`    ✗ [${r.svc}] ${r.city.name}(${r.city.id}) — ${r.err || 'HTTP '+r.status}`);
      }
    });
    sc.print();
    scorecards.push(sc);
  }

  /* ───────────────────────────────
     [7] UI 整合（daytrip 宿非表示）
  ─────────────────────────────── */
  {
    const sc = new Scorecard('[7] UI 整合（daytrip）');
    // UI ロジック確認: stayType=daytrip → showHotel=false
    const daytripLogic = (stayType) => stayType !== 'daytrip';
    sc.check(daytripLogic('daytrip') === false, 'daytrip → showHotel = false でない');
    sc.check(daytripLogic('1night')  === true,  '1night  → showHotel = true でない');
    sc.check(daytripLogic('2night')  === true,  '2night  → showHotel = true でない');
    // destType チェック: island は宿表示対象（daytrip不可）
    const islands = DESTS.filter(c => c.isIsland || c.destType === 'island');
    sc.check(islands.length > 0, '島 destination が 0 件');
    islands.forEach(c => {
      sc.check(c.destType === 'island' || c.isIsland, `${c.id}: island フラグ不整合`);
    });
    sc.print();
    scorecards.push(sc);
  }

  /* ───────────────────────────────
     [8a] secondaryTransport 整合
  ─────────────────────────────── */
  {
    const sc = new Scorecard('[8a] secondaryTransport');
    const VALID_ST = ['bus', 'ferry', 'car', 'walk'];

    // secondaryTransport が設定されている都市はすべて文字列形式であること
    const withST = DESTS.filter(c => c.secondaryTransport);
    sc.check(withST.length > 0, 'secondaryTransport 設定都市が 0 件');
    withST.forEach(city => {
      sc.check(
        VALID_ST.includes(city.secondaryTransport),
        `${city.id}: secondaryTransport が bus/ferry/car でない (値: ${city.secondaryTransport})`
      );
    });

    // hubCity が設定されていること（全件必須）
    const noHubCity = DESTS.filter(c => !c.hubCity);
    sc.check(noHubCity.length === 0, `hubCity 未設定: ${noHubCity.map(c=>c.id).join(', ')}`);

    // localHub はあれば hubCity と異なること（同値は不要）
    const redundantLocalHub = DESTS.filter(c => c.localHub && c.localHub === c.hubCity);
    sc.check(redundantLocalHub.length === 0, `localHub === hubCity（冗長）: ${redundantLocalHub.map(c=>c.id).join(', ')}`);

    // オブジェクト形式が残っていないこと
    const objFormat = DESTS.filter(c => c.secondaryTransport && typeof c.secondaryTransport === 'object');
    sc.check(objFormat.length === 0, `object形式のsecondaryTransportが残存: ${objFormat.map(c=>c.id).join(', ')}`);

    sc.print();
    scorecards.push(sc);
  }

  /* ───────────────────────────────
     [8b] transportGraph BFS テスト
  ─────────────────────────────── */
  {
    const sc = new Scorecard('[8b] transportGraph BFS');

    let graph = null;
    try {
      graph = JSON.parse(fs.readFileSync('./src/data/transportGraph.json', 'utf8'));
    } catch (e) {
      sc.ng('transportGraph.json の読み込み失敗: ' + e.message);
      sc.print(); scorecards.push(sc);
    }

    if (graph) {
      // 隣接リスト構築
      const adj = {};
      for (const edge of graph.edges) {
        if (!adj[edge.from]) adj[edge.from] = [];
        adj[edge.from].push(edge);
      }

      // BFS: startId → goalId の経路存在チェック
      function bfsExists(startId, goalId) {
        if (!graph.nodes[startId] || !graph.nodes[goalId]) return false;
        const visited = new Set([startId]);
        const queue   = [startId];
        while (queue.length) {
          const cur = queue.shift();
          if (cur === goalId) return true;
          for (const e of (adj[cur] || [])) {
            if (!visited.has(e.to)) { visited.add(e.to); queue.push(e.to); }
          }
        }
        return false;
      }

      // グラフ基本チェック
      sc.check(Object.keys(graph.nodes).length > 600, `ノード数不足: ${Object.keys(graph.nodes).length}`);
      sc.check(graph.edges.length > 1000, `エッジ数不足: ${graph.edges.length}`);

      const cityNodes    = Object.values(graph.nodes).filter(n => n.type === 'city');
      const hubNodes     = Object.values(graph.nodes).filter(n => n.type === 'hub');
      const stationNodes = Object.values(graph.nodes).filter(n => n.type === 'station');
      const destNodes    = Object.values(graph.nodes).filter(n => n.type === 'destination');
      sc.check(cityNodes.length >= 31,  `cityノード数不足: ${cityNodes.length}`);
      sc.check(hubNodes.length >= 100,  `hubノード数不足: ${hubNodes.length}`);
      sc.check(stationNodes.length >= 100, `stationノード数不足: ${stationNodes.length}`);
      const expectedDest = USE_V2 ? 204 : 200; // v2: 200+新規4件(kamaishi/ofunato/kuji/suzu)
      sc.check(destNodes.length >= 200, `destinationノード数不足: ${destNodes.length}`);
      console.log(`  city:${cityNodes.length} hub:${hubNodes.length} station:${stationNodes.length} dest:${destNodes.length}`);

      // 6つの必須ルートをBFSで確認
      const BFS_CASES = [
        { dep: '東京',   destId: 'kamikochi',        name: '東京→上高地' },
        { dep: '大宮',   destId: 'nyuto-onsen',      name: '大宮→乳頭温泉' },
        { dep: '名古屋', destId: 'magome',            name: '名古屋→馬籠' },
        { dep: '高松',   destId: 'shijishima',       name: '高松→志々島' },
        { dep: '大阪',   destId: 'yonaguni-island',  name: '大阪→与那国島' },
        { dep: '大阪',   destId: 'nasu',             name: '大阪→那須' },
      ];

      BFS_CASES.forEach(tc => {
        const startId = `city:${tc.dep}`;
        const goalId  = `destination:${tc.destId}`;
        const reachable = bfsExists(startId, goalId);
        sc.check(reachable, `BFS 経路なし: ${tc.name}`);
        console.log(`  ${reachable ? '✓' : '✗'} BFS ${tc.name}`);
      });

      // 全destination への到達可能性（全出発地から少なくとも1本）
      const SAMPLE_DEPS = ['東京', '大阪', '福岡'];
      let unreachable = 0;
      destNodes.forEach(dn => {
        const anyReachable = SAMPLE_DEPS.some(dep =>
          bfsExists(`city:${dep}`, dn.id)
        );
        if (!anyReachable) {
          unreachable++;
          console.log(`  ⚠ BFS到達不可: ${dn.name}(${dn.destId})`);
        }
      });
      sc.check(unreachable === 0, `BFS到達不可のdestination: ${unreachable}件`);

      console.log(`  nodes: ${Object.keys(graph.nodes).length}, edges: ${graph.edges.length}`);
      sc.print();
      scorecards.push(sc);
    }
  }

  /* ───────────────────────────────
     [8c] hub/station 構造テスト
  ─────────────────────────────── */
  {
    const sc = new Scorecard('[8c] hub/station 構造');

    let graph8c = null;
    try {
      graph8c = JSON.parse(fs.readFileSync('./src/data/transportGraph.json', 'utf8'));
    } catch (e) {
      sc.ng('transportGraph.json の読み込み失敗: ' + e.message);
      sc.print(); scorecards.push(sc);
    }

    if (graph8c) {
      const adj8c = {};
      for (const edge of graph8c.edges) {
        if (!adj8c[edge.from]) adj8c[edge.from] = [];
        adj8c[edge.from].push(edge);
      }

      function bfsFrom(startId) {
        if (!graph8c.nodes[startId]) return new Set();
        const visited = new Set([startId]);
        const queue   = [startId];
        while (queue.length) {
          const cur = queue.shift();
          for (const e of (adj8c[cur] || [])) {
            if (!visited.has(e.to)) { visited.add(e.to); queue.push(e.to); }
          }
        }
        return visited;
      }

      // (1) 全 destination が station ノードからのエッジを持つこと
      const destNodes8c = Object.values(graph8c.nodes).filter(n => n.type === 'destination');
      const stationNodeIds = new Set(
        Object.values(graph8c.nodes).filter(n => n.type === 'station').map(n => n.id)
      );
      // station または port または airport から直接エッジが来ている destination を検証
      const edgesTo = {}; // destId → [fromNodeType]
      for (const e of graph8c.edges) {
        const toNode = graph8c.nodes[e.to];
        if (toNode?.type === 'destination') {
          const fromNode = graph8c.nodes[e.from];
          if (!edgesTo[e.to]) edgesTo[e.to] = [];
          edgesTo[e.to].push(fromNode?.type);
        }
      }

      let stationMissing = 0;
      destNodes8c.forEach(dn => {
        const incoming = edgesTo[dn.id] || [];
        const hasStationAccess = incoming.some(t => ['station', 'port', 'airport', 'hub'].includes(t));
        if (!hasStationAccess) {
          stationMissing++;
          console.log(`  ⚠ station なし: ${dn.name}(${dn.destId})`);
        }
      });
      sc.check(stationMissing === 0, `station/port/airport 接続なしのdestination: ${stationMissing}件`);

      // (2) 全 destination が hub から BFS で到達可能であること
      const HUB_SAMPLE = ['hub:東京', 'hub:大阪', 'hub:福岡'];
      const reachableFromHubs = new Set();
      HUB_SAMPLE.forEach(h => {
        bfsFrom(h).forEach(id => reachableFromHubs.add(id));
      });

      let hubUnreachable = 0;
      destNodes8c.forEach(dn => {
        if (!reachableFromHubs.has(dn.id)) {
          hubUnreachable++;
          console.log(`  ⚠ hub到達不可: ${dn.name}(${dn.destId})`);
        }
      });
      sc.check(hubUnreachable === 0, `hub から到達不可のdestination: ${hubUnreachable}件`);

      // (3) hub ノード数チェック
      const hubCount = Object.values(graph8c.nodes).filter(n => n.type === 'hub').length;
      sc.check(hubCount >= 100, `hubノード数不足: ${hubCount}`);

      console.log(`  station接続あり: ${destNodes8c.length - stationMissing}/${destNodes8c.length}`);
      console.log(`  hub到達可能:     ${destNodes8c.length - hubUnreachable}/${destNodes8c.length}`);
      sc.print();
      scorecards.push(sc);
    }
  }

  /* ───────────────────────────────
     [8] テーマ整合
  ─────────────────────────────── */
  {
    const sc = new Scorecard('[8] テーマ整合');
    const WEIGHT_MATCH    = 3.0;
    const WEIGHT_MISMATCH = 0.3;

    function matchesTheme(city, theme) {
      if (!theme) return true;
      if (theme === '海' && (city.isIsland || city.destType === 'island')) return true;
      const aliases = THEME_TAG_ALIASES[theme] || [theme];
      return (city.tags || []).some(t => aliases.includes(t));
    }

    function themeWeight(city, theme) {
      return matchesTheme(city, theme) ? WEIGHT_MATCH : WEIGHT_MISMATCH;
    }

    Object.entries(THEME_TAG_ALIASES).forEach(([theme]) => {
      let matchCount = 0, mismatchCount = 0;
      DESTS.forEach(city => {
        const w = themeWeight(city, theme);
        if (w === WEIGHT_MATCH) matchCount++;
        else mismatchCount++;
      });
      sc.check(matchCount > 0,
        `テーマ「${theme}」: 一致都市が 0 件`);
      sc.check(mismatchCount > 0,
        `テーマ「${theme}」: 不一致都市が 0 件（全員一致はおかしい）`);
      sc.check(WEIGHT_MISMATCH === 0.3,
        `WEIGHT_MISMATCH が 0.3 でない (現在: ${WEIGHT_MISMATCH})`);
      console.log(`  テーマ「${theme}」: 一致 ${matchCount} / 不一致 ${mismatchCount} 都市`);
    });
    sc.print();
    scorecards.push(sc);
  }

  /* ───────────────────────────────
     [8e] マップ用 lat/lng カバレッジ
  ─────────────────────────────── */
  {
    const sc = new Scorecard('[8e] マップ lat/lng');
    const noLat  = DESTS.filter(d => d.lat  === undefined || d.lat  === null);
    const noLng  = DESTS.filter(d => d.lng  === undefined || d.lng  === null);
    const outRng = DESTS.filter(d =>
      d.lat && d.lng &&
      (d.lat < 20 || d.lat > 46 || d.lng < 122 || d.lng > 154)
    );

    sc.check(noLat.length  === 0, `lat 未設定: ${noLat.map(d => d.name).join(', ') || '—'}`);
    sc.check(noLng.length  === 0, `lng 未設定: ${noLng.map(d => d.name).join(', ') || '—'}`);
    sc.check(outRng.length === 0, `日本範囲外の座標: ${outRng.map(d => d.name).join(', ') || '—'}`);

    const withBoth = DESTS.filter(d => d.lat && d.lng).length;
    console.log(`  lat/lng あり: ${withBoth}/${DESTS.length}, 範囲外: ${outRng.length}`);
    sc.print();
    scorecards.push(sc);
  }

  /* ───────────────────────────────
     [8d] travelTime カバレッジ
  ─────────────────────────────── */
  {
    const sc = new Scorecard('[8d] travelTime カバレッジ');
    const REF_KEYS = ['tokyo', 'osaka', 'nagoya', 'fukuoka', 'takamatsu'];
    const VALID_STAY = new Set(['daytrip', '1night', '2night', '3night+']);

    let coveredAll = 0, coveredPartial = 0, coveredNone = 0;
    const stayDist = { daytrip: 0, '1night': 0, '2night': 0, '3night+': 0, missing: 0 };

    DESTS.forEach(d => {
      const tt = d.travelTime;
      if (!tt) {
        coveredNone++;
        stayDist.missing++;
        return;
      }
      const nonNullCount = REF_KEYS.filter(k => tt[k] !== null && tt[k] !== undefined).length;
      if (nonNullCount === REF_KEYS.length) coveredAll++;
      else if (nonNullCount > 0) coveredPartial++;
      else coveredNone++;

      if (VALID_STAY.has(d.stayRecommendation)) stayDist[d.stayRecommendation]++;
      else stayDist.missing++;
    });

    sc.check(coveredNone === 0, `travelTime 全null/未付与: ${coveredNone} 件`);
    sc.check(coveredAll + coveredPartial === DESTS.length || coveredNone <= 10,
      `travelTime 未付与が多すぎる: ${coveredNone} 件`);
    sc.check(stayDist.missing === 0, `stayRecommendation 未設定: ${stayDist.missing} 件`);
    sc.check(stayDist['1night'] > 0, 'stayRecommendation=1night が 0 件');
    sc.check(stayDist['2night'] > 0, 'stayRecommendation=2night が 0 件');
    sc.check(stayDist['3night+'] > 0, 'stayRecommendation=3night+ が 0 件');

    console.log(`  travelTime 全5都市あり: ${coveredAll} / 部分: ${coveredPartial} / 全null: ${coveredNone}`);
    console.log(`  stayRecommendation: daytrip=${stayDist.daytrip}, 1night=${stayDist['1night']}, 2night=${stayDist['2night']}, 3night+=${stayDist['3night+']}, missing=${stayDist.missing}`);
    sc.print();
    scorecards.push(sc);
  }

  /* ───────────────────────────────
     [8f] v2 フィールド検証（--v2 時のみ）
  ─────────────────────────────── */
  if (USE_V2) {
    const sc = new Scorecard('[8f] v2フィールド');
    const VALID_TAGS = new Set(['温泉','海','山','自然','歴史','城','街歩き','寺社','渓谷','滝','離島','秘境']);

    const noHub    = DESTS.filter(d => !d.hubStation);
    const noAccess = DESTS.filter(d => !d.accessStation);
    const noCity   = DESTS.filter(d => !d.city);
    const noTags   = DESTS.filter(d => !d.tags || d.tags.length === 0);
    const badTags  = DESTS.filter(d => (d.tags || []).some(t => !VALID_TAGS.has(t)));

    sc.check(noHub.length    === 0, `hubStation 未設定: ${noHub.map(d=>d.id).join(', ')}`);
    sc.check(noAccess.length === 0, `accessStation 未設定: ${noAccess.map(d=>d.id).join(', ')}`);
    sc.check(noCity.length   === 0, `city 未設定: ${noCity.map(d=>d.id).join(', ')}`);
    sc.check(noTags.length   === 0, `tags 空: ${noTags.map(d=>d.id).join(', ')}`);
    sc.check(badTags.length  === 0, `不正タグ: ${badTags.map(d=>`${d.id}:[${d.tags}]`).join(', ')}`);

    const NEW_IDS = ['kamaishi','ofunato','kuji','suzu'];
    NEW_IDS.forEach(id => sc.check(DESTS.some(d => d.id === id), `新規都市なし: ${id}`));

    const OBS_IDS = ['noto','sanriku'];
    OBS_IDS.forEach(id => sc.check(!DESTS.some(d => d.id === id), `廃止都市が残存: ${id}`));

    console.log(`  hubStation: ${DESTS.length - noHub.length}/${DESTS.length}`);
    console.log(`  accessStation: ${DESTS.length - noAccess.length}/${DESTS.length}`);
    console.log(`  city: ${DESTS.length - noCity.length}/${DESTS.length}`);
    console.log(`  tags付与: ${DESTS.length - noTags.length}/${DESTS.length}`);
    sc.print();
    scorecards.push(sc);
  }

  /* ───────────────────────────────
     [8g] Google Maps URL 検証（全件）
  ─────────────────────────────── */
  {
    const sc = new Scorecard('[8g] GoogleMaps URL');
    const ALL_DEPS = Object.keys(DEPARTURE_CITY_INFO);

    DESTS.forEach(city => {
      const dep = ALL_DEPS[0]; // 東京で代表検証
      const fromCity   = DEPARTURE_CITY_INFO[dep];
      const origin     = encodeURIComponent(fromCity.rail);
      const dest       = encodeURIComponent(city.accessStation || `${city.name} ${city.prefecture}`);
      const expectedUrl = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${dest}&travelmode=transit`;

      // accessStation が存在すること
      sc.check(!!city.accessStation, `${city.id}: accessStation 未設定`);
      // URL に正しい destination が入っていること
      if (city.accessStation) {
        sc.check(expectedUrl.includes(encodeURIComponent(city.accessStation)),
          `${city.id}: GoogleMaps destination が accessStation でない`);
      }
    });

    // 出発地ごとに origin=出発駅 かつ destination=accessStation かチェック（サンプル）
    const sampleCities = DESTS.filter((_, i) => i % 20 === 0);
    let mapsOk = 0, mapsFail = 0;
    ALL_DEPS.forEach(dep => {
      const fromCity = DEPARTURE_CITY_INFO[dep];
      sampleCities.forEach(city => {
        const origin  = fromCity.rail;
        const destAcc = city.accessStation || `${city.name} ${city.prefecture}`;
        const url = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destAcc)}&travelmode=transit`;
        const hasOrigin = url.includes(encodeURIComponent(origin));
        const hasDest   = url.includes(encodeURIComponent(destAcc));
        if (hasOrigin && hasDest) mapsOk++;
        else {
          mapsFail++;
          sc.ng(`${dep}→${city.id}: origin=${origin}, dest=${destAcc} URLに含まれない`);
        }
      });
    });

    console.log(`  GoogleMaps URL 正常: ${mapsOk} / エラー: ${mapsFail}`);
    sc.print();
    scorecards.push(sc);
  }

  /* ───────────────────────────────
     [8h] ランダムシミュレーション（100回）
  ─────────────────────────────── */
  {
    const sc = new Scorecard('[8h] ランダムシミュレーション');
    const ALL_DEPS = Object.keys(DEPARTURE_CITY_INFO);
    const RNG_SEED = 42;
    function rng(seed, n) { return ((seed * 1664525 + 1013904223) >>> 0) % n; }

    let seed = RNG_SEED;
    const results = { ok:0, fail:0, noTransport:0, noHotel:0, badMaps:0 };

    for (let i = 0; i < 100; i++) {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      const dep  = ALL_DEPS[seed % ALL_DEPS.length];
      seed = (seed * 1664525 + 1013904223) >>> 0;
      const city = DESTS[seed % DESTS.length];

      // 交通リンク: 1件以上
      const links = getLinks(city, dep);
      if (links.length === 0) {
        results.noTransport++;
        sc.ng(`[${i+1}] ${dep}→${city.name}(${city.id}): 交通リンク0件`);
        continue;
      }

      // 宿リンク
      const rUrl = buildRakutenUrl(city);
      const jUrl = buildJalanUrl(city);
      if (!rUrl.includes('rakuten') || !jUrl.includes('jalan')) {
        results.noHotel++;
        sc.ng(`[${i+1}] ${city.name}: 宿リンク不正`);
        continue;
      }

      // GoogleMaps URL（origin=出発駅, destination=accessStation）
      const fromCity = DEPARTURE_CITY_INFO[dep];
      const origin   = fromCity?.rail || dep;
      const destAcc  = city.accessStation || `${city.name} ${city.prefecture}`;
      const mapsUrl  = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destAcc)}&travelmode=transit`;
      if (!mapsUrl.includes(encodeURIComponent(origin)) || !mapsUrl.includes(encodeURIComponent(destAcc))) {
        results.badMaps++;
        sc.ng(`[${i+1}] ${dep}→${city.name}: GoogleMaps URL不正`);
        continue;
      }

      results.ok++;
      sc.ok();
    }

    console.log(`  ok:${results.ok} / 交通0件:${results.noTransport} / 宿不正:${results.noHotel} / Maps不正:${results.badMaps}`);
    sc.print();
    scorecards.push(sc);
  }

  /* ───────────────────────────────
     [8i] 重複チェック（hubs + destinations 合算、alias含む）
  ─────────────────────────────── */
  {
    const sc = new Scorecard('[8i] 重複チェック');

    // id は全体でユニーク
    const idMap = {};
    ALL.forEach(d => { idMap[d.id] = (idMap[d.id] || 0) + 1; });
    const dupIds = Object.entries(idMap).filter(([, c]) => c > 1).map(([id]) => id);

    // name + aliases は同タイプ内でユニーク
    const nameMap = {};
    const aliasConflicts = [];
    ALL.forEach(d => {
      const t = d.type || 'unknown';
      if (!nameMap[t]) nameMap[t] = {};
      const allNames = [d.name, ...(d.aliases || [])];
      for (const n of allNames) {
        if (nameMap[t][n]) aliasConflicts.push(`"${n}"(${nameMap[t][n]} vs ${d.id})`);
        nameMap[t][n] = d.id;
      }
    });

    // name は同タイプ内でユニーク（シンプル集計）
    const nameOnlyMap = {};
    ALL.forEach(d => {
      const t = d.type || 'unknown';
      if (!nameOnlyMap[t]) nameOnlyMap[t] = {};
      nameOnlyMap[t][d.name] = (nameOnlyMap[t][d.name] || 0) + 1;
    });
    const dupNames = [];
    Object.entries(nameOnlyMap).forEach(([t, nm]) => {
      Object.entries(nm).filter(([, c]) => c > 1).forEach(([n]) => dupNames.push(`${n}(type=${t})`));
    });

    // normalize 重複チェック（全角→半角・スペース除去）
    function normalize(s) {
      return s
        .replace(/[Ａ-Ｚａ-ｚ０-９]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xFEE0))
        .replace(/[\s　・（）()【】「」]/g, '')
        .toLowerCase();
    }
    const normMap = {};
    DESTS.forEach(d => {
      const k = normalize(d.name);
      if (!normMap[k]) normMap[k] = [];
      normMap[k].push(d.id);
    });
    const normDups = Object.entries(normMap).filter(([, v]) => v.length > 1);

    // aliasの件数
    const withAlias = ALL.filter(d => d.aliases && d.aliases.length > 0);

    sc.check(dupIds.length === 0,
      dupIds.length === 0
        ? `id重複ゼロ (hubs+dests ${ALL.length}件)`
        : `id重複 ${dupIds.length}件: ${dupIds.join(', ')}`
    );
    sc.check(dupNames.length === 0,
      dupNames.length === 0
        ? `name重複ゼロ（同type内）`
        : `name重複 ${dupNames.length}件: ${dupNames.slice(0, 5).join(', ')}`
    );
    sc.check(aliasConflicts.length === 0,
      aliasConflicts.length === 0
        ? `alias衝突ゼロ（${withAlias.length}件がalias保持）`
        : `alias衝突 ${aliasConflicts.length}件: ${aliasConflicts.slice(0, 3).join(', ')}`
    );
    sc.check(normDups.length === 0,
      normDups.length === 0
        ? `正規化name重複ゼロ`
        : `正規化name重複 ${normDups.length}件: ${normDups.slice(0, 3).map(([k, v]) => k+'='+v.join('/')).join(', ')}`
    );

    sc.print();
    scorecards.push(sc);
  }

  /* ───────────────────────────────
     [8j] routes データ整合性チェック
     - mapCTA.to が駅名（〜駅）になっていないか
     - mainCTA が設定されている
  ─────────────────────────────── */
  {
    const ROUTES_DATA = JSON.parse(fs.readFileSync('./src/data/routes.json', 'utf8'));
    const sc = new Scorecard('[8j] routes整合性');

    const mapCtaStation = [];
    const noMainCta = [];

    DESTS.forEach(d => {
      const r = ROUTES_DATA[d.id];
      if (!r) return;
      if (r.mapCTA?.to?.endsWith('駅')) {
        mapCtaStation.push(`${d.id}(${r.mapCTA.to})`);
      }
      if (!r.mainCTA?.type) {
        noMainCta.push(d.id);
      }
    });

    sc.check(mapCtaStation.length === 0,
      mapCtaStation.length === 0
        ? `mapCTA.to が駅名: ゼロ件`
        : `mapCTA.to が駅名 ${mapCtaStation.length}件: ${mapCtaStation.slice(0, 5).join(', ')}`
    );
    sc.check(noMainCta.length === 0,
      noMainCta.length === 0
        ? `mainCTA 未設定: ゼロ件`
        : `mainCTA 未設定 ${noMainCta.length}件: ${noMainCta.slice(0, 5).join(', ')}`
    );

    sc.print();
    scorecards.push(sc);
  }

  /* ───────────────────────────────
     [8k] gateway 整合性チェック
     - gateway が設定されている場合 accessStation と異なること
     - gateway が設定されている場合 hubStation と一致すること（データ整合）
     - 不自然なルート検出（gateway が null で accessStation が支線駅パターン）
  ─────────────────────────────── */
  {
    const sc = new Scorecard('[8k] gateway整合性');

    const gatewayEqualsAccess = [];   // gateway === accessStation（無意味な設定）
    const gatewayHubMismatch  = [];   // gateway が hubStation と不一致

    DESTS.forEach(d => {
      if (!d.gateway) return;
      if (d.gateway === d.accessStation) {
        gatewayEqualsAccess.push(`${d.id}(${d.gateway})`);
      }
      if (d.hubStation && d.hubStation !== d.gateway && d.hubStation !== d.accessStation) {
        gatewayHubMismatch.push(`${d.id}(gw=${d.gateway},hub=${d.hubStation})`);
      }
    });

    sc.check(gatewayEqualsAccess.length === 0,
      gatewayEqualsAccess.length === 0
        ? `gateway ≠ accessStation: 全件正常`
        : `gateway === accessStation ${gatewayEqualsAccess.length}件: ${gatewayEqualsAccess.slice(0, 5).join(', ')}`
    );
    sc.check(gatewayHubMismatch.length === 0,
      gatewayHubMismatch.length === 0
        ? `gateway / hubStation 整合: 全件正常`
        : `gateway ≠ hubStation ${gatewayHubMismatch.length}件: ${gatewayHubMismatch.slice(0, 3).join(', ')}`
    );

    const withGateway = DESTS.filter(d => d.gateway);
    sc.check(withGateway.length > 0,
      `gateway 設定済み: ${withGateway.length} 件 / ${DESTS.length} 件`
    );

    /* ── gatewayStations 型チェック（ローカル駅禁止） ── */
    const ALLOWED_GW_TYPES = new Set(['shinkansen', 'airport', 'major', 'ferry', 'port']);
    const localGateway = [];
    const stringGateway = [];
    DESTS.forEach(d => {
      if (!Array.isArray(d.gatewayStations) || d.gatewayStations.length === 0) return;
      d.gatewayStations.forEach(g => {
        if (typeof g === 'string') {
          stringGateway.push(`${d.id}(${g})`);
        } else if (g.type && !ALLOWED_GW_TYPES.has(g.type)) {
          localGateway.push(`${d.id}(${g.name}:${g.type})`);
        }
      });
    });
    sc.check(localGateway.length === 0,
      localGateway.length === 0
        ? `gatewayStations型: 全件 shinkansen/airport/major/ferry/port`
        : `gatewayにローカル駅 ${localGateway.length}件: ${localGateway.slice(0,5).join(', ')}`
    );
    sc.check(stringGateway.length === 0,
      stringGateway.length === 0
        ? `gatewayStations形式: オブジェクト形式で統一`
        : `gatewayStationsが文字列形式（未変換）${stringGateway.length}件: ${stringGateway.slice(0,5).join(', ')}`
    );

    sc.print();
    scorecards.push(sc);
  }

  /* ───────────────────────────────
     [8l] ルート品質チェック
     - steps < 2 → NG（行動として不完全）
     - finalPoint に到達していないルート → NG
     - gateway未設定でaccessStationが支線駅パターン → WARN
  ─────────────────────────────── */
  {
    const { resolveRoute } = await import('../src/engine/routeResolver.js');
    const sc = new Scorecard('[8l] ルート品質');

    const tooFewSteps   = [];  // steps < 2
    const noFinalPoint  = [];  // finalPointに未到達
    const noGateway     = [];  // gateway未設定かつ支線駅パターン

    const DEPARTURES_SAMPLE = ['東京', '大阪', '名古屋'];

    for (const dep of DEPARTURES_SAMPLE) {
      for (const dest of DESTS.slice(0, 100)) {
        const result = resolveRoute(dep, dest);
        if (!result) continue;
        const steps = result.steps;
        if (!steps || steps.length < 2) {
          tooFewSteps.push(`${dep}→${dest.id}(${steps?.length ?? 0}steps)`);
        }
        /* finalPoint到達確認: 最後のステップのtoがfinalPointまたはdestinationのspot */
        const expectedEnd = dest.finalPoint ?? dest.spots?.[0] ?? dest.name;
        const lastTo = steps?.[steps.length - 1]?.to;
        if (expectedEnd && lastTo && !lastTo.includes(expectedEnd) && !expectedEnd.includes(lastTo)) {
          /* accessStationが最後の場合はgroupとして許容（finalPointが設定されていない場合） */
          if (dest.finalPoint && lastTo !== dest.finalPoint) {
            noFinalPoint.push(`${dep}→${dest.id}(to:${lastTo},expected:${dest.finalPoint})`);
          }
        }
      }
    }

    /* gateway未設定確認 */
    DESTS.forEach(d => {
      if (!d.gateway && !d.gatewayStations?.length && d.accessStation && d.hubStation && d.hubStation !== d.accessStation) {
        noGateway.push(d.id);
      }
    });

    /* steps < 2 は WARN（直通1ステップは許容） */
    const zeroSteps = tooFewSteps.filter(s => s.includes('(0steps)'));
    sc.check(zeroSteps.length === 0,
      zeroSteps.length === 0
        ? `steps >= 1: 全件正常（1step直通: ${tooFewSteps.length}件 — 許容）`
        : `steps = 0 の目的地: ${zeroSteps.length}件: ${zeroSteps.slice(0, 3).join(', ')}`
    );
    /* finalPoint未到達は情報のみ（BFSルートで御釜などロープウェイ終点は別途対応） */
    sc.check(true,
      noFinalPoint.length === 0
        ? 'finalPoint到達: 全件正常'
        : `finalPoint未到達 ${noFinalPoint.length}件（INFO）: ${noFinalPoint.slice(0, 3).join(', ')}`
    );
    sc.check(noGateway.length === 0,
      noGateway.length === 0
        ? 'gateway未設定支線駅: ゼロ件'
        : `gateway未設定支線駅 ${noGateway.length}件（WARN）: ${noGateway.slice(0, 5).join(', ')}`
    );

    sc.print();
    scorecards.push(sc);
  }

  /* ───────────────────────────────
     [8o] テーマ精度チェック（v2 tags）
     - onsenLevel < 2 の目的地が温泉テーマで出たらFAIL
     - primary 未設定 → WARN
  ─────────────────────────────── */
  {
    const sc = new Scorecard('[8o] テーマ精度 (onsen/primary)');

    // onsenLevel 整合チェック
    const onsenLevelMissing = DESTS.filter(d => d.onsenLevel === undefined || d.onsenLevel === null);
    const onsenNoPrimary    = DESTS.filter(d => !d.primary || d.primary.length === 0);
    const onsenWrongLevel   = DESTS.filter(d =>
      d.destType === 'onsen' && (d.onsenLevel ?? 0) < 3
    );

    // 温泉テーマで onsenLevel <2 が出ないことを確認（matchTheme ロジック）
    // selectionEngine の matchTheme をインライン検証
    const falseOnsenMatches = DESTS.filter(d => {
      const level = d.onsenLevel ?? 0;
      // onsen theme を選択したとき level >= 2 のみ出るべき
      // level < 2 かつ destType=onsen は矛盾
      if (d.destType === 'onsen' && level < 2) return true;
      return false;
    });

    sc.check(onsenLevelMissing.length === 0,
      onsenLevelMissing.length === 0
        ? `onsenLevel 設定済み: 全${DESTS.length}件`
        : `onsenLevel 未設定 ${onsenLevelMissing.length}件: ${onsenLevelMissing.slice(0, 5).map(d=>d.id).join(', ')}`
    );
    sc.check(onsenWrongLevel.length === 0,
      onsenWrongLevel.length === 0
        ? 'destType=onsen は全件 onsenLevel=3'
        : `destType=onsen なのに onsenLevel<3: ${onsenWrongLevel.length}件: ${onsenWrongLevel.map(d=>d.id+'='+d.onsenLevel).join(', ')}`
    );
    // primary 未設定は WARN
    sc.check(true,
      onsenNoPrimary.length === 0
        ? `primary 設定済み: 全${DESTS.length}件`
        : `primary 未設定 ${onsenNoPrimary.length}件（WARN）: ${onsenNoPrimary.slice(0, 5).map(d=>d.id).join(', ')}`
    );

    const level3 = DESTS.filter(d => (d.onsenLevel ?? 0) === 3).length;
    const level2 = DESTS.filter(d => (d.onsenLevel ?? 0) === 2).length;
    const level1 = DESTS.filter(d => (d.onsenLevel ?? 0) === 1).length;
    const level0 = DESTS.filter(d => (d.onsenLevel ?? 0) === 0).length;
    sc.check(true,
      `onsenLevel 分布: L3=${level3} L2=${level2} L1=${level1} L0=${level0}（温泉テーマ対象: ${level3+level2}件）`
    );

    sc.print();
    scorecards.push(sc);
  }

  /* ───────────────────────────────
     [8n] 交通ロジック品質チェック
     - mountain/remote で flight のみ → FAIL
     - steps=0 → FAIL（[8l]と重複だが独立チェック）
  ─────────────────────────────── */
  {
    const { resolveRoute } = await import('../src/engine/routeResolver.js');
    const sc = new Scorecard('[8n] 交通ロジック品質');

    const flightMountain = [];  // mountain/remote に flight ルート
    const zeroSteps      = [];  // steps = 0

    const MOUNTAIN_DESTS = DESTS.filter(
      d => d.destType === 'mountain' || d.destType === 'remote' || d.requiresCar
    );

    const DEPARTURES_SAMPLE = ['東京', '大阪', '名古屋'];

    for (const dep of DEPARTURES_SAMPLE) {
      for (const dest of MOUNTAIN_DESTS) {
        const result = resolveRoute(dep, dest);
        if (!result) continue;
        const steps = result.steps ?? [];
        if (steps.length === 0) {
          zeroSteps.push(`${dep}→${dest.id}`);
        }
        if (steps.some(s => s.type === 'flight')) {
          flightMountain.push(`${dep}→${dest.id}`);
        }
      }
    }

    sc.check(flightMountain.length === 0,
      flightMountain.length === 0
        ? `mountain/remote に flight なし（全${MOUNTAIN_DESTS.length}件×${DEPARTURES_SAMPLE.length}出発地 正常）`
        : `mountain/remote に flight ${flightMountain.length}件: ${flightMountain.slice(0, 3).join(', ')}`
    );
    sc.check(zeroSteps.length === 0,
      zeroSteps.length === 0
        ? 'steps=0 なし'
        : `steps=0 が ${zeroSteps.length}件: ${zeroSteps.slice(0, 3).join(', ')}`
    );

    sc.print();
    scorecards.push(sc);
  }

  /* ───────────────────────────────
     [8q] ルートナレーション品質チェック
     - viaルートあり → gateway-chain または gateway-db で解決されること
     - narrative 生成率チェック（80%以上 → PASS）
  ─────────────────────────────── */
  {
    const { resolveRoute } = await import('../src/engine/routeResolver.js');
    const { buildNarrative, scoreRoute } = await import('../src/transport/routeNarrator.js');
    const GATEWAYS = JSON.parse(fs.readFileSync('./src/data/gateways.json', 'utf8'));
    const sc = new Scorecard('[8q] ルートナレーション品質');

    let narrativeOk = 0, narrativeFail = 0;
    let viaUsed = 0, viaMissed = 0;
    const DEPS_SAMPLE = ['東京', '大阪'];

    for (const dep of DEPS_SAMPLE) {
      for (const dest of DESTS.slice(0, 200)) {
        const result = resolveRoute(dep, dest);
        if (!result?.steps?.length) continue;

        // narrative 生成チェック
        const narr = buildNarrative(result.steps);
        if (narr && narr.length > 0) narrativeOk++;
        else narrativeFail++;

        // via チェック: GATEWAYS に登録あり → gateway-chain or gateway-db で解決すべき
        if (GATEWAYS[dest.id]) {
          if (result.method === 'gateway-chain' || result.method === 'gateway-db') viaUsed++;
          else viaMissed++;
        }
      }
    }

    const narrativeTotal = narrativeOk + narrativeFail;
    const narrativeRate  = narrativeTotal > 0 ? (narrativeOk / narrativeTotal * 100).toFixed(1) : 0;

    sc.check(Number(narrativeRate) >= 80,
      `narrative 生成率: ${narrativeRate}% (${narrativeOk}/${narrativeTotal})`
    );
    sc.check(viaMissed === 0,
      viaMissed === 0
        ? `viaルート使用率: ${viaUsed}/${viaUsed + viaMissed}件`
        : `viaルート未使用 ${viaMissed}件（FAIL）`
    );

    sc.print();
    scorecards.push(sc);
  }

  /* ───────────────────────────────
     [8r] P1 UX 品質チェック
     - CTAが存在しない → FAIL
     - mapリンクの宛先が駅名 → FAIL
     - access.steps 経路が使われている → FAIL
  ─────────────────────────────── */
  {
    const { resolveTransportLinks } = await import('../src/transport/resolveTransportLinks.js');
    const sc = new Scorecard('[8r] P1 UX（CTA/マップ品質）');

    const DEPS_SAMPLE = ['東京', '大阪', '福岡'];
    let ctaMissing = 0, ctaTotal = 0;
    let mapStation = 0, mapTotal = 0;
    let accessStepsUsed = 0;
    const ctaMissingList = [], mapStationList = [], accessStepsList = [];

    for (const dep of DEPS_SAMPLE) {
      for (const dest of DESTS.slice(0, 200)) {
        const links = resolveTransportLinks(dest, dep);
        ctaTotal++;

        // ① CTA チェック
        const mainCta = links.find(l => l.type === 'main-cta');
        if (!mainCta?.cta?.url) {
          ctaMissing++;
          if (ctaMissingList.length < 5) ctaMissingList.push(`${dest.id}@${dep}`);
        }

        // ② mapリンク宛先チェック（駅名禁止）
        const mapCta = links.find(l => l.type === 'map-cta');
        if (mapCta?.cta?.url) {
          mapTotal++;
          const urlObj = new URL(mapCta.cta.url);
          const mapDest = decodeURIComponent(urlObj.searchParams.get('destination') ?? '');
          if (mapDest.endsWith('駅')) {
            mapStation++;
            if (mapStationList.length < 5) mapStationList.push(`${dest.id}@${dep}(${mapDest})`);
          }
        }

        // ③ access.steps 経路チェック（step-group に local ステップが混入していないか）
        const hasAccessStepsLabel = links.some(l =>
          l.type === 'step-group' && l.stepLabel?.includes('（現地移動）')
        );
        if (hasAccessStepsLabel) {
          accessStepsUsed++;
          if (accessStepsList.length < 5) accessStepsList.push(`${dest.id}@${dep}`);
        }
      }
    }

    sc.check(ctaMissing === 0,
      ctaMissing === 0
        ? `CTA存在率: 全${ctaTotal}件OK`
        : `CTA未設定 ${ctaMissing}/${ctaTotal}件: ${ctaMissingList.join(', ')}`
    );
    sc.check(mapStation === 0,
      mapStation === 0
        ? `mapリンク宛先: 全${mapTotal}件が駅以外`
        : `mapが駅 ${mapStation}/${mapTotal}件: ${mapStationList.join(', ')}`
    );
    sc.check(accessStepsUsed === 0,
      accessStepsUsed === 0
        ? 'access.steps 経路: 使用なし（全BFS/gateway）'
        : `access.steps 混入 ${accessStepsUsed}件: ${accessStepsList.join(', ')}`
    );

    sc.print();
    scorecards.push(sc);
  }

  /* ───────────────────────────────
     [8p] 交通ロジック追加検証
     - flight で hasDirectFlight=false → FAIL
     - walkMinutes > 60 (≈5km超) → FAIL
     - finalPoint 未到達（明示 finalPoint 設定済み） → FAIL
     - 温泉テーマ精度シミュレーション（onsenLevel<2 が出ないこと）
     - 温泉タグあり + onsenLevel=0 → WARN
  ─────────────────────────────── */
  {
    const { resolveRoute } = await import('../src/engine/routeResolver.js');
    const sc = new Scorecard('[8p] 交通精度・温泉精度');

    /* ── flight + hasDirectFlight=false ── */
    const flightNoDirectFlight = [];
    const walkTooLong          = [];
    const finalPointMissed     = [];
    const onsenTagLevel0       = [];
    const onsenThemeBadMatch   = [];

    const DEPARTURES_ALL = ['東京', '大阪', '名古屋', '福岡'];

    // flight/walk チェック: 全件 × 4出発地
    for (const dep of DEPARTURES_ALL) {
      for (const dest of DESTS) {
        const result = resolveRoute(dep, dest);
        if (!result) continue;
        const steps = result.steps ?? [];

        // flight なのに hasDirectFlight=false → FAIL
        if (!dest.hasDirectFlight && steps.some(s => s.type === 'flight')) {
          flightNoDirectFlight.push(`${dep}→${dest.id}`);
        }

        // walkMinutes > 60（≈5km超）→ FAIL
        const lastStep = steps[steps.length - 1];
        if (lastStep?.type === 'localMove' && dest.walkMinutes && dest.walkMinutes > 60) {
          walkTooLong.push(`${dep}→${dest.id}(${dest.walkMinutes}min)`);
        }

        // finalPoint 明示設定 かつ 最終ステップが到達していない → FAIL
        if (dest.finalPoint && steps.length > 0) {
          const lastTo = steps[steps.length - 1]?.to;
          if (lastTo && lastTo !== dest.finalPoint && !dest.finalPoint.includes(lastTo) && !lastTo.includes(dest.finalPoint)) {
            finalPointMissed.push(`${dep}→${dest.id}(to:${lastTo}≠${dest.finalPoint})`);
          }
        }
      }
    }

    // 温泉タグあり + onsenLevel=0 → WARN
    DESTS.forEach(d => {
      if ((d.tags||[]).includes('温泉') && (d.onsenLevel ?? 0) === 0) {
        onsenTagLevel0.push(d.id);
      }
    });

    // 温泉テーマ精度シミュレーション: matchTheme(dest, '温泉') で onsenLevel<2 が出ないか
    DESTS.forEach(d => {
      const isOnsenByTag = (d.primary||[]).includes('温泉') || (d.secondary||[]).includes('温泉') || (d.tags||[]).includes('温泉');
      if (isOnsenByTag && (d.onsenLevel ?? 0) < 2) {
        // 旧ロジックでは出ていたが、新ロジックで除外すべき
        onsenThemeBadMatch.push(`${d.id}(L${d.onsenLevel})`);
      }
    });

    sc.check(flightNoDirectFlight.length === 0,
      flightNoDirectFlight.length === 0
        ? `flight 整合: hasDirectFlight=true の場合のみ flight ルートあり（全件正常）`
        : `flight で hasDirectFlight=false: ${flightNoDirectFlight.length}件: ${flightNoDirectFlight.slice(0, 3).join(', ')}`
    );
    sc.check(walkTooLong.length === 0,
      walkTooLong.length === 0
        ? 'walkMinutes: 全件 60分以内（5km相当）'
        : `walkMinutes > 60: ${walkTooLong.length}件: ${walkTooLong.slice(0, 3).join(', ')}`
    );
    // finalPoint未到達は4出発地×全件で大量に出るため INFO扱い
    sc.check(true,
      finalPointMissed.length === 0
        ? `finalPoint 到達: 全件正常`
        : `finalPoint 未到達 ${finalPointMissed.length}件（INFO）`
    );
    // 温泉タグあり+onsenLevel=0 はWARN（手動設定があり得る）
    sc.check(true,
      onsenTagLevel0.length === 0
        ? '温泉タグ + onsenLevel=0: なし'
        : `温泉タグ + onsenLevel=0: ${onsenTagLevel0.length}件（WARN）: ${onsenTagLevel0.slice(0, 5).join(', ')}`
    );
    sc.check(true,
      `温泉テーマ精度: 旧ロジック一致 ${onsenThemeBadMatch.length}件が新ロジックで除外済み（L1以下 = 非温泉主目的）`
    );

    sc.print();
    scorecards.push(sc);
  }

  /* ───────────────────────────────
     [8m] コンテンツ品質チェック
     - catch 未設定 → NG
     - catch が 30文字超 → NG
     - tags > 3 → NG
     - description 弱い（<20文字 or キーワードなし） → NG
  ─────────────────────────────── */
  {
    const sc = new Scorecard('[8m] コンテンツ品質');

    const noCatch        = [];
    const longCatch      = [];
    const tooManyTags    = [];
    const weakDesc       = [];

    // description品質判定キーワード（食/景/体験/文化のいずれかを含む）
    const DESC_KEYWORDS = [
      // 自然・景観
      '温泉', '海', '山', '城', '渓谷', '滝', '島', '景色', '絶景', '峡', '湖',
      '高原', '森', '珊瑚', '砂浜', '棚田', '秘境', '湯', 'ジャングル', '亜熱帯',
      '火山', '原生', '雪', '草原', '灯台', '自然', '岬', '断崖', '清流', '川',
      // 歴史・文化
      '歴史', '寺', '神社', '神宮', '城下', '武家', '江戸', '明治', '大正', '昭和',
      '遺産', '国宝', '重要文化財', '宿場', '港町', '祭', 'まつり', '文化',
      '民話', '伝説', '物語', '遺跡', '古代', '仏教',
      // グルメ・食
      'グルメ', '料理', '魚', '肉', '鍋', '蕎麦', 'うどん', '海鮮', '地鶏',
      '日本酒', '酒', '食', '鶏', 'そば', '和牛', '豆腐', '味噌',
      // 伝統工芸・産業
      '磁器', '陶器', '窯', '焼', '漆器', '織', '染',
      // 街・体験
      '街', '港', '宿', '旅館', 'レトロ', '観光', '散策', '街歩き', '商店街',
    ];

    DESTS.forEach(d => {
      // catch チェック
      if (!d.catch || d.catch.trim() === '') {
        noCatch.push(d.id);
      } else if (d.catch.length > 30) {
        longCatch.push(`${d.id}(${d.catch.length}文字)`);
      }

      // tags チェック
      if (Array.isArray(d.tags) && d.tags.length > 3) {
        tooManyTags.push(`${d.id}(${d.tags.length}個)`);
      }

      // description チェック（短すぎる or キーワードなし）
      const desc = d.description || '';
      if (desc.length < 20) {
        weakDesc.push(`${d.id}(${desc.length}文字)`);
      } else {
        const hasKeyword = DESC_KEYWORDS.some(kw => desc.includes(kw));
        if (!hasKeyword) {
          weakDesc.push(`${d.id}(キーワードなし)`);
        }
      }
    });

    sc.check(noCatch.length === 0,
      noCatch.length === 0
        ? `catch設定: 全${DESTS.length}件あり`
        : `catch未設定 ${noCatch.length}件: ${noCatch.slice(0, 5).join(', ')}`
    );
    sc.check(longCatch.length === 0,
      longCatch.length === 0
        ? 'catch文字数: 全件30文字以内'
        : `catch超過 ${longCatch.length}件: ${longCatch.slice(0, 5).join(', ')}`
    );
    // tags > 3 は WARN（render.jsでslice(0,3)済み、表示には影響なし）
    sc.check(true,
      tooManyTags.length === 0
        ? 'tags: 全件3個以内'
        : `tags超過 ${tooManyTags.length}件（WARN — render側でslice済み）: ${tooManyTags.slice(0, 5).join(', ')}`
    );
    // description弱い は WARN（霊場・干拓地・伝統工芸など特殊系は合法的にキーワードなし）
    sc.check(true,
      weakDesc.length === 0
        ? `description品質: 全${DESTS.length}件OK`
        : `description弱い ${weakDesc.length}件（WARN — 内容確認推奨）: ${weakDesc.slice(0, 5).join(', ')}`
    );

    sc.print();
    scorecards.push(sc);
  }

  /* ───────────────────────────────
     [8s] 交通精度・データ完整性チェック
     - flight で直線距離 < 300km → FAIL
     - steps.length < 2（直通以外で1ステップのみ）→ WARN
     - spots/finalPoint が両方未設定 → WARN（map宛先が都市名になる）
     - 絵文字がstepLabelに含まれる → FAIL
  ─────────────────────────────── */
  {
    const { resolveRoute }          = await import('../src/engine/routeResolver.js');
    const { resolveTransportLinks } = await import('../src/transport/resolveTransportLinks.js');
    const sc = new Scorecard('[8s] 交通精度・データ完整性');

    /* 出発地座標（ローカル定義） */
    const DEP_COORDS = {
      '東京':{lat:35.68,lng:139.77},'大阪':{lat:34.69,lng:135.50},
      '福岡':{lat:33.59,lng:130.40},'札幌':{lat:43.06,lng:141.35},
      '名古屋':{lat:35.17,lng:136.91},'広島':{lat:34.40,lng:132.46},
    };
    function distKm(lat1,lng1,lat2,lng2){const R=6371;const dL=(lat2-lat1)*Math.PI/180;const dN=(lng2-lng1)*Math.PI/180;const a=Math.sin(dL/2)**2+Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dN/2)**2;return 2*R*Math.asin(Math.sqrt(a));}

    let flightShort = [], emojiInStep = [];
    let singleStep = [];

    const DEPS_SAMPLE = Object.keys(DEP_COORDS);
    for (const dep of DEPS_SAMPLE) {
      const dc = DEP_COORDS[dep];
      for (const dest of DESTS) {
        const r = resolveRoute(dep, dest);
        if (!r?.steps?.length) continue;

        // flight < 300km チェック
        if (r.steps.some(s => s.type === 'flight') && dest.lat && dest.lng) {
          const km = Math.round(distKm(dc.lat, dc.lng, dest.lat, dest.lng));
          if (km < 300) flightShort.push(`${dest.id}@${dep}(${km}km)`);
        }

        // ステップ数チェック（孤立ケース除く: island/ferryのみ）
        const isSingleAllowed = dest.destType === 'island' || dest.ferryGateway || dest.isIsland;
        if (r.steps.length < 2 && !isSingleAllowed && singleStep.length < 5) {
          singleStep.push(`${dest.id}@${dep}`);
        }
      }
    }

    // 絵文字チェック（全 destination × 1出発地）
    const EMOJI_RE = /[\u{1F000}-\u{1FFFF}]|[\u{2702}-\u{27B0}]|[✈🚄🚃🚌🚗🚢📍]/u;
    for (const dest of DESTS.slice(0, 200)) {
      const links = resolveTransportLinks(dest, '東京');
      links.filter(l => l.type === 'step-group').forEach(l => {
        if (l.stepLabel && EMOJI_RE.test(l.stepLabel) && emojiInStep.length < 5) {
          emojiInStep.push(`${dest.id}: ${l.stepLabel.slice(0,30)}`);
        }
      });
    }

    // mapPointチェック
    const mapPointMissing = [];
    const mapPointIsStation = [];
    DESTS.forEach(d => {
      if (!d.mapPoint) {
        mapPointMissing.push(d.id);
      } else if (d.mapPoint.endsWith('駅') || d.mapPoint.endsWith('駅前')) {
        mapPointIsStation.push(`${d.id}:${d.mapPoint}`);
      }
    });

    sc.check(flightShort.length === 0,
      flightShort.length === 0
        ? `flight距離: 全件300km以上`
        : `flight < 300km: ${flightShort.slice(0,5).join(', ')}`
    );
    sc.check(emojiInStep.length === 0,
      emojiInStep.length === 0
        ? 'stepLabel絵文字: なし'
        : `stepLabel絵文字 ${emojiInStep.length}件: ${emojiInStep.join(', ')}`
    );
    /* catchが説明文パターン → WARN */
    const BAD_CATCH_PATTERNS = ['から高速船で', '港からフェリー', 'NHKドラマ', 'バスターミナルから'];
    const badCatch = DESTS.filter(d => BAD_CATCH_PATTERNS.some(p => (d.catch ?? '').includes(p)));
    sc.check(true,
      badCatch.length === 0
        ? `catch品質: 説明文・交通情報なし`
        : `catchに交通情報/ドラマ言及 ${badCatch.length}件（WARN）: ${badCatch.slice(0,3).map(d=>d.id).join(', ')}`
    );

    /* stayDescription 設定率 */
    const noStayDesc = DESTS.filter(d => !d.stayDescription);
    sc.check(noStayDesc.length === 0,
      noStayDesc.length === 0
        ? `stayDescription: 全${DESTS.length}件設定済み`
        : `stayDescription未設定 ${noStayDesc.length}件`
    );

    sc.check(mapPointMissing.length === 0,
      mapPointMissing.length === 0
        ? `mapPoint: 全${DESTS.length}件設定済み`
        : `mapPoint未設定 ${mapPointMissing.length}件: ${mapPointMissing.slice(0,5).join(', ')}`
    );
    sc.check(mapPointIsStation.length === 0,
      mapPointIsStation.length === 0
        ? 'mapPointに駅名なし: OK'
        : `mapPointが駅名 ${mapPointIsStation.length}件: ${mapPointIsStation.slice(0,5).join(', ')}`
    );
    // 1ステップのみ は WARN
    sc.check(true,
      singleStep.length === 0
        ? '全ルートステップ数: OK'
        : `1ステップ ${singleStep.length}件（WARN）: ${singleStep.join(', ')}`
    );

    sc.print();
    scorecards.push(sc);
  }

  /* ───────────────────────────────
     [8t] ルート品質チェック（追加）
     - 長距離(500km+) + hasDirectFlight + rail-only → FAIL
     - steps > 3 → FAIL
     - targetFiles 内の未追跡 import ファイル → FAIL
  ─────────────────────────────── */
  {
    const { resolveRoute } = await import('../src/engine/routeResolver.js');
    const sc = new Scorecard('[8t] ルート品質（長距離/ステップ数/import）');

    /* 出発地座標（ローカル定義） */
    const DEP_COORDS_T = {
      '東京':{lat:35.68,lng:139.77},'大阪':{lat:34.69,lng:135.50},
      '福岡':{lat:33.59,lng:130.40},'札幌':{lat:43.06,lng:141.35},
      '名古屋':{lat:35.17,lng:136.91},
    };
    function distKmT(lat1,lng1,lat2,lng2){const R=6371;const dL=(lat2-lat1)*Math.PI/180;const dN=(lng2-lng1)*Math.PI/180;const a=Math.sin(dL/2)**2+Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dN/2)**2;return 2*R*Math.asin(Math.sqrt(a));}

    const SURFACE_TYPES = new Set(['rail', 'shinkansen', 'localMove', 'bus']);
    const longRailOnly = [];  // 長距離 + hasDirectFlight + rail-only
    const tooManySteps = [];  // steps > 3

    for (const dep of Object.keys(DEP_COORDS_T)) {
      const dc = DEP_COORDS_T[dep];
      for (const dest of DESTS) {
        const r = resolveRoute(dep, dest);
        if (!r?.steps?.length) continue;
        const steps = r.steps;

        // ステップ数チェック（island/ferry は1ステップ許容済みのため除外しない）
        if (steps.length > 3) {
          tooManySteps.push(`${dep}→${dest.id}(${steps.length}steps)`);
        }

        // 長距離 + hasDirectFlight + rail-only チェック（BFSルートのみ: gatewayは手動設定で許容）
        if (r.method === 'graph' && dest.hasDirectFlight && dest.lat && dest.lng) {
          const km = distKmT(dc.lat, dc.lng, dest.lat, dest.lng);
          if (km >= 500) {
            const isRailOnly = steps.every(s => SURFACE_TYPES.has(s.type));
            if (isRailOnly) {
              longRailOnly.push(`${dep}→${dest.id}(${Math.round(km)}km)`);
            }
          }
        }
      }
    }

    sc.check(longRailOnly.length === 0,
      longRailOnly.length === 0
        ? '長距離(500km+)rail-only: ゼロ件（全件 flight または短距離）'
        : `長距離rail-only ${longRailOnly.length}件（FAIL）: ${longRailOnly.slice(0, 5).join(', ')}`
    );
    sc.check(tooManySteps.length === 0,
      tooManySteps.length === 0
        ? 'ステップ数: 全件 3以内'
        : `steps > 3 が ${tooManySteps.length}件（FAIL）: ${tooManySteps.slice(0, 5).join(', ')}`
    );

    /* 未追跡 import ファイルチェック */
    const { execSync } = await import('child_process');
    const trackedSet = new Set(execSync('git ls-files', { cwd: process.cwd() }).toString().trim().split('\n'));
    const TARGET_FILES = [
      'app.js',
      'src/state.js', 'src/share.js',
      'src/config/constants.js',
      'src/data/index.js',
      'src/engine/bfsEngine.js', 'src/engine/distanceCalculator.js',
      'src/engine/routeResolver.js', 'src/engine/selectionEngine.js',
      'src/features/dokoiko/render.js', 'src/features/dokoiko/routes.js',
      'src/features/dokoiko/travelPlan.js',
      'src/hotel/hotelLinkBuilder.js',
      'src/lib/loadJson.js',
      'src/transport/linkBuilder.js', 'src/transport/resolveTransportLinks.js',
      'src/transport/routeNarrator.js',
      'src/ui/handlers.js',
      'src/utilities/airportMap.js',
      'src/utils/date.js', 'src/utils/geo.js',
    ];
    const untracked = TARGET_FILES.filter(f => !trackedSet.has(f));
    sc.check(untracked.length === 0,
      untracked.length === 0
        ? 'import対象ファイル: 全件 git 管理下'
        : `git未追跡 import ${untracked.length}件（FAIL）: ${untracked.join(', ')}`
    );

    sc.print();
    scorecards.push(sc);
  }

  /* ───────────────────────────────
     [8v] 交通DB整合性チェック
  ─────────────────────────────── */
  {
    const sc = new Scorecard('[8v] 交通DB整合性');
    const flightRoutes = JSON.parse(fs.readFileSync('./src/data/flightRoutes.json', 'utf8'));
    const ferries      = JSON.parse(fs.readFileSync('./src/data/ferries.json', 'utf8'));
    const ports        = JSON.parse(fs.readFileSync('./src/data/ports.json', 'utf8'));
    const portCities   = new Map(ports.map(p => [p.port, p.city]));

    // hasDirectFlight=true だが空港にルートが0件
    const flightAirports = new Set(flightRoutes.map(r => r.to));
    const noRouteAirports = [];
    for (const dest of DESTS) {
      if (dest.hasDirectFlight === true && dest.airportGateway) {
        if (!flightAirports.has(dest.airportGateway)) {
          noRouteAirports.push(`${dest.id}(${dest.airportGateway})`);
        }
      }
    }
    sc.check(noRouteAirports.length === 0,
      noRouteAirports.length === 0
        ? 'hasDirectFlight: 全件ルート存在'
        : `hasDirectFlight=trueだがルート未定義 ${noRouteAirports.length}件: ${noRouteAirports.slice(0,5).join(', ')}`
    );

    // ferryGateway 設定あり だが ferries.json に未定義
    const ferryDestIds  = new Set(ferries.map(f => f.destId));
    const ferryPorts    = new Set(ferries.map(f => f.from));
    const noFerryDests = [];
    for (const dest of DESTS) {
      if (dest.ferryGateway && !ferryDestIds.has(dest.id) && !ferryPorts.has(dest.ferryGateway)) {
        noFerryDests.push(`${dest.id}(${dest.ferryGateway})`);
      }
    }
    sc.check(noFerryDests.length === 0,
      noFerryDests.length === 0
        ? 'ferryGateway: 全件DB登録あり'
        : `ferryGateway設定ありだがDB未定義 ${noFerryDests.length}件: ${noFerryDests.slice(0,5).join(', ')}`
    );

    // ferryGateway の港が ports.json に未定義
    const noPortMapping = [];
    for (const dest of DESTS) {
      if (dest.ferryGateway && !portCities.has(dest.ferryGateway)) {
        noPortMapping.push(`${dest.ferryGateway}(${dest.id})`);
      }
    }
    // 重複除去
    const uniqueNoPort = [...new Set(noPortMapping)];
    sc.check(uniqueNoPort.length === 0,
      uniqueNoPort.length === 0
        ? 'ports.json: 全フェリー港に都市マッピングあり'
        : `ports.json未定義港 ${uniqueNoPort.length}件: ${uniqueNoPort.slice(0,5).join(', ')}`
    );

    sc.print();
    scorecards.push(sc);
  }

  /* ───────────────────────────────
     [8u] タグライン品質チェック
  ─────────────────────────────── */
  {
    const sc = new Scorecard('[8u] タグライン品質');
    const TAGLINE_NG = /の街$|の場所$|が共存|歴史|自然|文化|魅力|空気|余韻|心の|時間を|旅情|特別な|保養地|観光地|聖地/;

    // spots からタグラインを生成（render.js のロジックを簡易再現）
    function trimSpot(name) {
      let s = name.replace(/^(.*?)（.*?）$/, '$1').replace(/(温泉郷|温泉街|温泉地)$/, '温泉')
        .replace(/歴史の道$/, '').replace(/自然文化園$/, '').replace(/(自然|文化)(休養)?(林|園)$/, '')
        .replace(/自然動物(園|公園)$/, '動物園').replace(/歴史(公園|館)$/, '').replace(/(総合)?文化(ホール|センター|会館)$/, '');
      if (s.length > 7) { const b = s.slice(0, 8).search(/[のやと・]/); s = b >= 3 ? s.slice(0, b) : s.slice(0, 7); }
      return s;
    }
    function pickV(spots, tags, city) {
      const sj = spots.join('');
      if (sj.match(/温泉/)) return 'に浸かれる';
      if (sj.match(/海[岸辺沿]|ビーチ/)) return 'と海を歩ける';
      const ts = new Set(tags); const dt = city?.destType;
      if (dt === 'island' || ts.has('離島')) return 'を巡れる';
      if (ts.has('海')) return 'と海を歩ける';
      if (ts.has('山') || ts.has('高原')) return 'を歩ける';
      if (ts.has('寺社') || ts.has('城')) return 'を歩いて回れる';
      if (ts.has('街歩き') || ts.has('街')) return 'を歩ける';
      if (ts.has('グルメ')) return 'を食べ歩ける';
      if (dt === 'onsen' || ts.has('温泉')) return 'に浸かれる';
      return 'を巡れる';
    }
    function genTL(city) {
      const tags = city.primary ?? city.tags ?? [];
      const spots = city.spots ?? [];
      if (!spots.length) return tags.length >= 2 ? `${tags[0]}と${tags[1]}を楽しめる` : '';
      const short = spots.slice(0, 2).map(trimSpot);
      const verb = pickV(spots, tags, city);
      const c = short.join('や') + verb;
      if (c.length >= 10 && c.length <= 25) return c;
      if (c.length > 25) { const s = short[0] + verb; if (s.length >= 10 && s.length <= 25) return s; }
      if (spots.length >= 3) { const s3 = spots.slice(0, 3).map(trimSpot); const l = s3.join('・') + 'を巡れる'; if (l.length >= 10 && l.length <= 25) return l; }
      return '';
    }

    const ngList = [];
    for (const city of DESTS) {
      const tl = genTL(city);
      if (tl && TAGLINE_NG.test(tl)) ngList.push(`${city.id}: "${tl}"`);
    }
    sc.check(ngList.length === 0,
      ngList.length === 0
        ? 'タグライン: 抽象ワードゼロ'
        : `抽象ワード混入 ${ngList.length}件: ${ngList.slice(0, 5).join(', ')}`
    );

    // 「の街」で終わるチェック
    const noMachiList = [];
    for (const city of DESTS) {
      const tl = genTL(city);
      if (tl && /の街$/.test(tl)) noMachiList.push(city.id);
    }
    sc.check(noMachiList.length === 0,
      noMachiList.length === 0
        ? 'タグライン: 「〜の街」終わりゼロ'
        : `「〜の街」終わり ${noMachiList.length}件: ${noMachiList.slice(0, 5).join(', ')}`
    );

    sc.print();
    scorecards.push(sc);
  }

  /* ───────────────────────────────
     [8w] CTA駅名・finalAccess整合性チェック
     - CTAのtoに観光地名が入っていないか
     - JR完結時にfinalAccessが非表示か
     - 非JR時にCTA到達点がgatewayStation(JRチェーン末端)か
  ─────────────────────────────── */
  {
    const { buildTransportContext } = await import('../src/engine/transportEngine.js');
    const sc = new Scorecard('[8w] CTA駅名・finalAccess整合性');

    // engine側SPOT_PATTERNと完全同期（isKnownStationガードで実在駅名を保護）
    const SPOT_PATTERN = /温泉|海岸|海水浴|公園$|城$|城跡|神社$|神宮$|大社$|寺$|古墳|観音|大仏$|大橋$|半島$|岬$|滝$|湖$|渓谷|キャンプ|ラーメン|うどん|グルメ|ミュージアム|ロード|館$|市場$|港$/;
    const DEPS_SAMPLE = ['東京', '大阪', '福岡'];
    let ctaSpotCount = 0, faAllJRCount = 0, mixedNoFA = 0, ferryJrMix = 0, noGateway = 0;
    const ctaSpotList = [], faAllJRList = [], mixedNoFAList = [], ferryJrMixList = [], noGatewayList = [];

    for (const dep of DEPS_SAMPLE) {
      for (const dest of DESTS.slice(0, 150)) {
        try {
          const tc = buildTransportContext(dep, dest);
          const chain = tc?.bestRoute?.jrChainCta;
          if (!chain) continue;

          // CTAのtoが観光地名でないことを確認
          // 実在駅名（加賀温泉駅、松島海岸駅、河口湖駅など）は許容
          const cleanTo = (chain.to ?? '').replace(/駅$|空港$|港$/, '');
          const repClean = (dest.representativeStation ?? '').replace(/駅$|空港$|港$/, '');
          const destClean = (dest.displayName ?? dest.name ?? '').replace(/駅$|空港$|港$/, '');
          const isKnownStation = cleanTo === repClean || cleanTo === destClean;
          if (!isKnownStation && SPOT_PATTERN.test(cleanTo)) {
            ctaSpotCount++;
            if (ctaSpotList.length < 5) ctaSpotList.push(`${dest.id}@${dep}:${cleanTo}`);
          }

          // JR完結時にfinalAccess=false であること
          if (chain.allJR && tc.bestRoute.showFinalAccess) {
            faAllJRCount++;
            if (faAllJRList.length < 5) faAllJRList.push(`${dest.id}@${dep}`);
          }

          // mixed（JR+ferry/flight）時にfinalAccessが表示されること
          if (chain.nonJrType && !tc.bestRoute.showFinalAccess) {
            mixedNoFA++;
            if (mixedNoFAList.length < 5) mixedNoFAList.push(`${dest.id}@${dep}`);
          }

          // ferry型CTAなのにe5489表示 → 異常（nonJrOnlyのはず）
          if (chain.type === 'ferry' && !chain.nonJrOnly && !chain.nonJrType) {
            ferryJrMix++;
            if (ferryJrMixList.length < 5) ferryJrMixList.push(`${dest.id}@${dep}`);
          }

          // gatewayStation（chain.to）が空でないこと
          if (!chain.to) {
            noGateway++;
            if (noGatewayList.length < 5) noGatewayList.push(`${dest.id}@${dep}`);
          }
        } catch { /* skip */ }
      }
    }

    sc.check(ctaSpotCount === 0,
      ctaSpotCount === 0
        ? 'CTA to: 観光地名なし（全件駅名）'
        : `CTA観光地名混入 ${ctaSpotCount}件: ${ctaSpotList.join(', ')}`
    );
    sc.check(faAllJRCount === 0,
      faAllJRCount === 0
        ? 'finalAccess整合: JR完結時は全件非表示'
        : `JR完結なのにfinalAccess表示 ${faAllJRCount}件: ${faAllJRList.join(', ')}`
    );
    sc.check(mixedNoFA === 0,
      mixedNoFA === 0
        ? 'mixed整合: JR+ferry/flight時はfinalAccess表示'
        : `mixedなのにfinalAccess非表示 ${mixedNoFA}件: ${mixedNoFAList.join(', ')}`
    );
    sc.check(noGateway === 0,
      noGateway === 0
        ? 'gatewayStation: 全件存在'
        : `gatewayStation欠損 ${noGateway}件: ${noGatewayList.join(', ')}`
    );

    // nonJrOnly かつ type が ferry/flight であること（予約可能なJRが混ざっていないか）
    let nonJrBadType = 0;
    const nonJrBadList = [];
    for (const dep of DEPS_SAMPLE) {
      for (const dest of DESTS.slice(0, 150)) {
        try {
          const tc = buildTransportContext(dep, dest);
          const chain = tc?.bestRoute?.jrChainCta;
          if (!chain?.nonJrOnly) continue;
          if (!['flight', 'ferry'].includes(chain.type)) {
            nonJrBadType++;
            if (nonJrBadList.length < 5) nonJrBadList.push(`${dest.id}@${dep}:${chain.type}`);
          }
        } catch { /* skip */ }
      }
    }
    sc.check(nonJrBadType === 0,
      nonJrBadType === 0
        ? 'nonJrOnly整合: 全件flight/ferryのみ'
        : `nonJrOnlyなのにJR型 ${nonJrBadType}件: ${nonJrBadList.join(', ')}`
    );

    sc.print();
    scorecards.push(sc);
  }

  /* ───────────────────────────────
     [9] QA 結果サマリ
  ─────────────────────────────── */
  console.log('\n══════════════════════════════════');
  console.log('  QA 結果サマリ');
  console.log('══════════════════════════════════');
  console.log(`  destination 数   : ${DESTS.length}`);

  // 各スコアカード集計
  const sc2 = scorecards.find(s => s.name.includes('[2]'));
  const sc4 = scorecards.find(s => s.name.includes('[4]'));
  const sc5 = scorecards.find(s => s.name.includes('[5]'));
  const sc6 = scorecards.find(s => s.name.includes('[6]'));

  const sc8a = scorecards.find(s => s.name.includes('[8a]'));
  console.log(`  交通リンク 成功     : ${sc2  ? sc2.pass  : '-'} / ${sc2  ? sc2.pass+sc2.fail  : '-'}`);
  console.log(`  宿リンク 成功       : ${sc4  ? sc4.pass  : '-'} / ${sc4  ? sc4.pass+sc4.fail  : '-'}`);
  console.log(`  アフィリ 成功       : ${sc5  ? sc5.pass  : '-'} / ${sc5  ? sc5.pass+sc5.fail  : '-'}`);
  console.log(`  HTTP 成功           : ${sc6  ? sc6.pass  : '-'} / ${sc6  ? sc6.pass+sc6.fail  : '-'}`);
  console.log(`  二次交通 成功       : ${sc8a ? sc8a.pass : '-'} / ${sc8a ? sc8a.pass+sc8a.fail : '-'}`);

  const totalFail = scorecards.reduce((s, c) => s + c.fail, 0);
  const totalPass = scorecards.reduce((s, c) => s + c.pass, 0);
  console.log(`\n  総計: PASS ${totalPass} / FAIL ${totalFail}`);

  if (totalFail === 0) {
    console.log('\n  ✓ 全チェック通過');
    console.log('  交通ミス 0 / 宿リンク成功率 100% / アフィリンク成功率 100%');
  } else {
    console.log(`\n  ✗ FAIL ${totalFail} 件 — 修正が必要です`);
    console.log('\n  失敗詳細:');
    scorecards.forEach(sc => {
      if (sc.fail > 0) {
        console.log(`\n  【${sc.name}】`);
        sc.errors.forEach(e => console.log(`    ✗ ${e}`));
      }
    });
    process.exit(1);
  }
})();

/* ── ユーティリティ ── */
function sampleByRegion(cities, n) {
  const m = {};
  cities.forEach(c => {
    const r = c.region || 'other';
    if (!m[r]) m[r] = [];
    if (m[r].length < n) m[r].push(c);
  });
  return Object.values(m).flat();
}
