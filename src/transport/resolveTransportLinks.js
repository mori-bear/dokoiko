/**
 * resolveTransportLinks.js — 交通ロジック唯一の実装
 *
 * 責務:
 *   - ルート生成（routes.js 手動定義 / BFS エンジン / metadata 自動生成）
 *   - provider 判定（e5489 / ekinet / EX / jrkyushu）
 *   - 交通モード判定（deriveMainCta で1つに統一）
 *   - step-group 配列への変換（UI はこれを受け取るだけ）
 *
 * 出力フォーマット（step-group 方式）:
 *   [
 *     { type: 'summary',    transfers: N },
 *     { type: 'main-cta',  cta: {...} },        // 最重要 CTA（shinkansen > flight > ferry > rail）
 *     { type: 'step-group', stepLabel, cta, caution },  // 区間ごと
 *     ...
 *     { type: 'rental', ... },                   // car ステップがある場合のみ
 *   ]
 *
 * URL 生成は linkBuilder.js のみ。このファイルは URL 文字列を直接組み立てない。
 */

import { ROUTES, CITY_TO_SHINKANSEN }  from '../features/dokoiko/routes.js';
import { DEPARTURE_CITY_INFO, DEPARTURE_COORDS } from '../config/constants.js';
import { calcDistanceKm }               from '../utils/geo.js';
import { CITY_AIRPORT }                 from '../utilities/airportMap.js';
import {
  buildGoogleMapsLink,
  buildSkyscannerLink,
  buildGoogleFlightsLink,
  buildJrLink,
  buildFerryLink,
  buildFerryLinkForDest,
  buildRentalLink,
  buildHighwayBusLink,
  AIRPORT_HUB_GATEWAY,
  resolveMapMode,
} from './linkBuilder.js';
import { buildRoute }     from '../engine/bfsEngine.js';
import { resolveRoute }   from '../engine/routeResolver.js';
import { loadJson }       from '../lib/loadJson.js';

/* `with { type: 'json' }` は Safari 17.2+ 限定のため loadJson() に切り替え（Safari 15+ 対応） */
const [PORTS_DATA, SPOT_ACCESS_DATA, ROUTES_DATA] = await Promise.all([
  loadJson('../data/ports.json',       import.meta.url),
  loadJson('../data/spotAccess.json', import.meta.url),
  loadJson('../data/routes.json',     import.meta.url),
]);

/* ── 港名 → ハブ都市マップ（step補完用） ── */
const PORT_CITY_MAP = {};
for (const p of PORTS_DATA) {
  PORT_CITY_MAP[p.port] = p.city;
}

/* ── Phase 2: 出発地 → 新幹線乗車駅マップ ──
 * hub city 名はグラフでは '大阪' だが、新幹線乗車は '新大阪' など
 * ここに登録した都市は shinkansen step の from に補正される。
 */
const SHINKANSEN_HUB_STATION = {
  '大阪': '新大阪駅',
  '神戸': '新神戸駅',
  // 東京・名古屋・京都・広島・博多 等は hub 名=新幹線駅名なので不要
};

/* ── Phase 2: hub → バス起点（路線バス・高速バス）── */
const BUS_HUB_STATION = {
  '大阪': '大阪駅（梅田）',
  '神戸': '三ノ宮バスターミナル',
  '京都': '京都駅',
  '名古屋': '名古屋駅',
  '東京': '新宿バスタ',
  '横浜': '横浜駅',
  '福岡': '博多駅',
  '那覇': '那覇バスターミナル',
};

/* ── Phase 3: 空港の表示名正規化 ── */
const AIRPORT_LABEL_MAP = {
  '大阪国際空港': '伊丹空港',
  '関西国際空港': '関西空港',
  '新千歳空港':   '新千歳空港',
};

function formatAirportLabel(airport) {
  if (!airport) return null;
  const base = airport.replace(/\s*(国内線|国際線)?ターミナル.*$/, '').trim();
  return AIRPORT_LABEL_MAP[base] ?? base;
}

/* ── Phase 3: 移動時間 → 日帰り/宿泊推奨 ── */
function getStayRecommend(city) {
  const t = city.travelTimeMinutes ?? 999;
  if (t < 180) return 'daytrip-ok';
  return 'overnight';
}

/* ── Phase 2: 交通モードアイコン（絵文字なし） ── */
function stepTypeIcon(_type) {
  return '';
}

/**
 * Phase 2: 出発地ハブ名 → 表示用乗車点名
 * - 新幹線: 新大阪 / 新神戸 など
 * - バス: 梅田バスターミナル など
 * - その他: DEPARTURE_CITY_INFO の rail 駅名
 */
function getDepartureLabel(departure, stepType) {
  if (stepType === 'flight') {
    return formatAirportLabel(DEPARTURE_CITY_INFO[departure]?.airport) ?? departure;
  }
  if (stepType === 'shinkansen') {
    return SHINKANSEN_HUB_STATION[departure] ?? departure;
  }
  if (stepType === 'bus') {
    return BUS_HUB_STATION[departure] ?? (DEPARTURE_CITY_INFO[departure]?.rail?.replace(/駅$/, '') + '駅') ?? departure;
  }
  // rail / ferry / localMove / car — 「駅」を保持して Maps URL の精度を上げる
  const station = DEPARTURE_CITY_INFO[departure]?.rail;
  return station ?? departure;
}

/* ── Phase 2: ルートのウェイポイント配列を構築（BFS steps 用）── */
function buildWaypoints(steps, departure, city) {
  const label = cityLabel(city);
  const pts   = [getDepartureLabel(departure, steps[0]?.type ?? 'rail')];
  for (const s of steps) {
    if (s.type === 'localMove') continue;
    const to = s.to;
    if (to && to !== label && to !== pts[pts.length - 1]) pts.push(to);
  }
  if (pts[pts.length - 1] !== label) pts.push(label);
  return pts.filter((v, i) => i === 0 || v !== pts[i - 1]);
}

/* ── Phase 3: ルートのウェイポイント配列を構築（routes.js steps 用）── */
function buildWaypointsFromRouteSteps(routes, departure, city) {
  const label = cityLabel(city);
  const firstMeaningful = routes.find(s => s.type !== 'localMove');
  const pts = [getDepartureLabel(departure, firstMeaningful?.type ?? 'rail')];
  for (const step of routes) {
    if (step.type === 'localMove') continue;
    const to = step.to ?? label;
    if (to && to !== pts[pts.length - 1]) pts.push(to);
  }
  if (pts[pts.length - 1] !== label) pts.push(label);
  return pts.filter((v, i) => i === 0 || v !== pts[i - 1]);
}

/* ── 就航路線 DB（Node.js / ブラウザ 両対応） ── */
let FLIGHT_ROUTES = [];
if (typeof process !== 'undefined' && process.versions?.node) {
  const { readFileSync }  = await import('fs');
  const { fileURLToPath } = await import('url');
  const { dirname, join } = await import('path');
  const _root = join(dirname(fileURLToPath(import.meta.url)), '../../');
  FLIGHT_ROUTES = JSON.parse(readFileSync(join(_root, 'src/data/flightRoutes.json'), 'utf8'));
} else {
  const _url = new URL('../../src/data/flightRoutes.json', import.meta.url);
  FLIGHT_ROUTES = await fetch(_url).then(r => r.json());
}

/** 出発地 → 到着空港名 の就航路線が存在するか */
function hasFlightRoute(departure, airportName) {
  return FLIGHT_ROUTES.some(r => r.from === departure && r.to === airportName);
}

/* ══════════════════════════════════════════════════════
   provider 判定
══════════════════════════════════════════════════════ */

/* JR 会社名 → 予約システム ID */
const OPERATOR_PROVIDER = {
  'JR東日本': 'ekinet',
  'JR北海道': 'ekinet',
  'JR東海':   'e5489',
  'JR西日本': 'e5489',
  'JR四国':   'e5489',
  'JR九州':   'jrkyushu',
};

function operatorToProvider(operator) {
  return OPERATOR_PROVIDER[operator] || 'e5489';
}

/* 路線名 → 予約システム ID */
const SHINKANSEN_LINE_PROVIDER = {
  '東海道新幹線': 'ex',
  '山陽新幹線':   'ex',
  '東北新幹線':   'ekinet',
  '北陸新幹線':   'ekinet',
  '山形新幹線':   'ekinet',
  '秋田新幹線':   'ekinet',
  '上越新幹線':   'ekinet',
  '北海道新幹線': 'ekinet',
  '九州新幹線':   'jrkyushu',
};

/* エリアマップ（provider 判定・スコアリング共用） */
const AREA_REGION = {
  '札幌':'北海道','函館':'北海道','旭川':'北海道','小樽':'北海道','新千歳空港':'北海道',
  '仙台':'東北',  '盛岡':'東北',  '八戸':'東北',  '青森':'東北',  '秋田':'東北',  '山形':'東北',  '福島':'東北',
  '東京':'関東',  '横浜':'関東',  '大宮':'関東',  '千葉':'関東',  '宇都宮':'関東','水戸':'関東',
  '長野':'中部',  '静岡':'中部',  '名古屋':'中部','金沢':'中部',  '富山':'中部',  '新潟':'中部',
  '岐阜':'中部',  '浜松':'中部',  '松本':'中部',  '甲府':'中部',  '敦賀':'中部',
  '大阪':'近畿',  '京都':'近畿',  '神戸':'近畿',  '奈良':'近畿',  '和歌山':'近畿','津':'近畿',
  '新大阪':'近畿','三ノ宮':'近畿',
  '広島':'中国',  '岡山':'中国',  '松江':'中国',  '鳥取':'中国',  '山口':'中国',  '新山口':'中国',
  '高松':'四国',  '松山':'四国',  '高知':'四国',  '徳島':'四国',
  '福岡':'九州',  '博多':'九州',  '熊本':'九州',  '鹿児島':'九州','長崎':'九州',  '宮崎':'九州',
  '大分':'九州',  '佐賀':'九州',  '小倉':'九州',
};

function getArea(nameOrStation) {
  return AREA_REGION[nameOrStation?.replace(/駅$/, '')] ?? null;
}

/**
 * 新幹線ステップの予約 provider を判定する。
 * ① 西日本圏出発（四国/関西/中国/九州）→ e5489（EX 誤爆防止・最優先）
 * ② JR 東日本系路線（東北/上越/北海道/山形/秋田）→ ekinet
 * ③ 東海道・山陽（非西日本出発）→ EX
 * ④ 路線名マップ → operator フォールバック
 */
function detectShinkansenProvider(step, departure) {
  const label   = step.label ?? '';
  const depArea = departure ? getArea(departure) : null;

  if (departure === '高松') return 'e5489'; // 四国代表・強制ロック

  if (['四国', '関西', '中国', '九州'].includes(depArea)) return 'e5489';

  const JR_EAST_ONLY = ['東北新幹線', '上越新幹線', '北海道新幹線', '山形新幹線', '秋田新幹線'];
  if (JR_EAST_ONLY.some(l => label.includes(l))) return 'ekinet';

  if ((label.includes('東海道') || label.includes('山陽')) && !label.includes('九州')) return 'ex';

  if (SHINKANSEN_LINE_PROVIDER[label]) return SHINKANSEN_LINE_PROVIDER[label];
  for (const [line, provider] of Object.entries(SHINKANSEN_LINE_PROVIDER)) {
    if (label.includes(line)) return provider;
  }
  return operatorToProvider(step.operator ?? '');
}

/**
 * IC 乗車可能な在来線かどうか判定する。
 * 特急・急行・ライナー系は予約必要。マリンライナーは IC 可。
 */
function isIcRail(step) {
  const label = step.label ?? '';
  if (label.includes('マリンライナー')) return true;
  return !label.match(/特急|急行|エクスプレス|ライナー/);
}

/* ══════════════════════════════════════════════════════
   ユーティリティ
══════════════════════════════════════════════════════ */

function stepTypeLabel(type) {
  const MAP = {
    shinkansen: '新幹線', rail: '電車',  flight: '飛行機',
    car: 'レンタカー',    ferry: 'フェリー', bus: 'バス', localMove: '徒歩',
  };
  return MAP[type] ?? '';
}

/**
 * 交通種別を表示用に正規化する。
 * BFS step の label（graph の service 名）や routes.json の label を優先し、
 * 抽象的な「鉄道」「移動」等の表記を避ける。
 */
function normalizeStepLabel(label, stepType, operator = '') {
  if (stepType === 'shinkansen') {
    /* 新幹線: 実際の路線名・列車名を表示（北陸新幹線、サンダーバード+新幹線 等） */
    if (label && label !== '新幹線' && label !== '鉄道') return label;
    return '新幹線';
  }
  if (stepType === 'rail') {
    /* 在来線: 路線名・列車名を表示（越美北線、えちぜん鉄道、高山本線（特急ひだ） 等） */
    if (label && label !== '電車' && label !== '鉄道') return label;
    if (operator && !operator.startsWith('JR')) return operator;
    return '電車';
  }
  if (stepType === 'localMove') {
    /* ラストマイル: 徒歩・レンタカー等を表示 */
    if (label && label !== 'ローカル移動' && label !== '現地移動') return label;
    return '徒歩';
  }
  return label ?? stepTypeLabel(stepType);
}

function coords(city) {
  return (city.lat && city.lng) ? { lat: city.lat, lng: city.lng } : null;
}

function cityLabel(city) {
  return city.displayName || city.name;
}

/** Google Maps 宛先: mapPoint優先（温泉郷など抽象地名は駅名・具体地点に置換） */
function mapTarget(city) {
  return city.mapPoint ?? cityLabel(city);
}

const STEP_IDX = ['①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧'];
function stepIdx(i) {
  return STEP_IDX[i] ?? `${i + 1}.`;
}

/** 分数を「2時間30分」「45分」等の人間向け文字列に変換 */
function formatMinutes(mins) {
  if (!mins || mins <= 0) return '';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h > 0 && m > 0) return `${h}時間${m}分`;
  if (h > 0) return `${h}時間`;
  return `${m}分`;
}

const IC_CAUTION = 'ICカードでそのまま改札通れます（予約不要）';

/* ── 新幹線停車駅セット（gateway step1 ラベル判定用） ── */
const SHINKANSEN_STATIONS = new Set([
  // 東海道・山陽新幹線
  '東京駅','品川駅','新横浜駅','小田原駅','熱海駅','三島駅','新富士駅',
  '静岡駅','掛川駅','浜松駅','豊橋駅','三河安城駅','名古屋駅','岐阜羽島駅',
  '米原駅','京都駅','新大阪駅','新神戸駅','西明石駅','姫路駅','相生駅',
  '岡山駅','新倉敷駅','福山駅','新尾道駅','三原駅','東広島駅','広島駅',
  '新岩国駅','徳山駅','新山口駅','厚狭駅','新下関駅','小倉駅','博多駅',
  // 東北・秋田・山形新幹線
  '上野駅','大宮駅','小山駅','宇都宮駅','那須塩原駅','新白河駅',
  '郡山駅','福島駅','白石蔵王駅','仙台駅','古川駅','くりこま高原駅',
  '一ノ関駅','水沢江刺駅','北上駅','新花巻駅','盛岡駅','二戸駅',
  '八戸駅','七戸十和田駅','新青森駅',
  '大曲駅','秋田駅',                          // 秋田新幹線
  '山形駅','天童駅','さくらんぼ東根駅','村山駅','大石田駅','新庄駅', // 山形新幹線
  // 北陸新幹線
  '長野駅','飯山駅','上越妙高駅','糸魚川駅','黒部宇奈月温泉駅',
  '富山駅','新高岡駅','金沢駅','小松駅','加賀温泉駅','芦原温泉駅',
  '福井駅','越前たけふ駅','敦賀駅',
  // 九州新幹線
  '新鳥栖駅','久留米駅','筑後船小屋駅','新大牟田駅','新玉名駅',
  '熊本駅','新八代駅','新水俣駅','出水駅','川内駅','鹿児島中央駅',
  '長崎駅','諫早駅','嬉野温泉駅','武雄温泉駅',
  // 北海道新幹線
  '新函館北斗駅',
]);

/**
 * gateway → accessStation 間のローカル交通ラベルを導出。
 *   city.busGateway や access.steps[1] の method から判定。
 */
function _localSegmentMode(city) {
  if (city.busGateway || city.secondaryTransport === 'bus') return 'バス';
  // access.steps に local step がある場合
  const steps = city.access?.steps;
  if (steps && steps.length >= 2) {
    const local = steps.find(s => s.type === 'local' || s.type === 'bus' || s.type === 'ferry');
    if (local) {
      if (local.method === 'バス')      return 'バス';
      if (local.method === 'フェリー')  return 'フェリー';
    }
  }
  return 'ローカル線';
}

/* ── Phase 4: spotAccess アイコン / ラベル ── */
const SPOT_TYPE_ICON  = { walk: '', bus: '', taxi: '' };
const SPOT_TYPE_LABEL = { walk: '徒歩', bus: 'バス', taxi: 'タクシー' };

/**
 * Phase 4: spotAccess.json のエントリを step-group として links に追加する。
 * 既存 step-group のカウントを継続してインデックスを振る。
 */
function appendSpotAccessSteps(links, city) {
  const entries = SPOT_ACCESS_DATA[city.id];
  if (!entries?.length) return links;
  const baseIdx = links.filter(l => l.type === 'step-group').length;
  for (let i = 0; i < entries.length; i++) {
    const sa    = entries[i];
    const icon  = SPOT_TYPE_ICON[sa.type]  ?? '';
    const label = SPOT_TYPE_LABEL[sa.type] ?? sa.type;
    links.push({
      type: 'step-group',
      stepLabel: `${stepIdx(baseIdx + i)} ${icon} ${sa.from} → ${sa.to}（${label}）`,
      cta: null,
      caution: null,
      duration: sa.minutes ?? null,
    });
  }
  return links;
}

/* ── Phase 5: ルート特性ラベル ── */
function getRouteLabel(transfers, city) {
  const t = city.travelTimeMinutes ?? 999;
  const isShortest     = t < 120;       // 片道2時間未満
  const isFewTransfers = transfers <= 1; // 直通 or 乗換1回
  if (isShortest && isFewTransfers) return '最短・乗換少';
  if (isShortest)      return '最短';
  if (isFewTransfers)  return '乗換少';
  return null;
}

/* ══════════════════════════════════════════════════════
   CTA URL 構築
   mainCTA は routes.json のデータ。ここでは URL を組み立てるだけ。
══════════════════════════════════════════════════════ */

/**
 * routes.json の mainCTA データから URL オブジェクトを返す。
 * 「何の CTA か」はデータが持つ。ここでは URL 文字列の組み立てのみ行う。
 *
 * @param {object} mainCTA   — routes.json の mainCTA フィールド
 * @param {string} departure — 出発都市名（飛行機 URL に必要）
 * @returns {object|null}    — { type, url, label } または null
 */
function buildCtaUrl(mainCTA, departure) {
  if (!mainCTA) return null;

  switch (mainCTA.type) {
    case 'flight': {
      const fromIata = CITY_AIRPORT[departure] ?? null;
      if (!fromIata || !mainCTA.to) return null;
      // Fix ④: 就航路線が存在する場合のみ flight CTA を出す
      const checkTarget = mainCTA.hub ? (AIRPORT_HUB_GATEWAY[mainCTA.hub] ?? mainCTA.to) : mainCTA.to;
      if (!hasFlightRoute(departure, checkTarget)) return null;
      return buildSkyscannerLink(fromIata, checkTarget) ?? null;
    }
    case 'ferry':
      return buildFerryLink(mainCTA.from ?? '', mainCTA.url ?? null, mainCTA.provider ?? null);
    case 'rail':
    case 'shinkansen': {
      let provider = mainCTA.provider ?? 'e5489';
      /* 四国出発はえきねっと（JR東日本）利用不可 → e5489（JR四国）に変換 */
      if (SHIKOKU_DEPARTURES_SET.has(departure) && provider === 'ekinet') {
        provider = 'e5489';
      }
      return buildJrLink(provider);
    }
    case 'bus':
      return buildHighwayBusLink(mainCTA.from ?? departure, mainCTA.to ?? '');
    default:
      return null;
  }
}

/**
 * routes.json の subCTA データから URL オブジェクトを返す。
 * 現在は rental のみ対応。
 *
 * @param {object} subCTA — routes.json の subCTA フィールド
 * @returns {object|null}
 */
function buildSubCtaUrl(subCTA) {
  if (!subCTA) return null;
  if (subCTA.type === 'rental') {
    return buildRentalLink(subCTA.from ?? '');
  }
  return null;
}

/**
 * routes.json の mapCTA データから Google Maps URL オブジェクトを返す。
 *
 * @param {object} mapCTA   — routes.json の mapCTA フィールド（{ to: "名護市街" }）
 * @param {string} departure — 出発地名（"東京" など）
 * @param {object} fromCity  — DEPARTURE_CITY_INFO エントリ（省略可）
 * @returns {object|null}
 */
function buildMapCtaLink(mapCTA, departure, fromCity) {
  if (!mapCTA?.to) return null;
  // Fix ⑤: mapCTA.from が指定されている場合（飛行機到着空港など）はそちらを優先
  const origin = mapCTA.from
    ?? fromCity?.rail
    ?? DEPARTURE_CITY_INFO[departure]?.rail
    ?? `${departure}駅`;
  const dest   = mapCTA.to;
  const mode   = resolveMapMode(origin, dest);
  return buildGoogleMapsLink(origin, dest, mode, `地図で確認（${dest}）`);
}


/* ══════════════════════════════════════════════════════
   CTA 自動導出（routes.json 非依存）
   BFS steps または step-group labels から CTA を生成する。
   accessStation は使用しない。
══════════════════════════════════════════════════════ */

/**
 * 交通手段を距離・島判定・railCompany から導出する。
 * step-based の検出が失敗した場合のメタデータフォールバックに使用。
 *
 * @returns {'flight' | 'ferry' | 'rail' | null}
 */
function _resolveTransportType(departure, city) {
  // railCompany が null = 鉄道なし（沖縄など）→ 飛行機前提
  if (city?.railCompany === null) return 'flight';

  // 島 → フェリー
  if (city?.isIsland || city?.destType === 'island') return 'ferry';

  // 500km超 + 出発地に空港あり + 直行便あり → 飛行機
  const depCoords  = DEPARTURE_COORDS[departure];
  const distKm     = depCoords && (city?.lat || city?.lng)
    ? calcDistanceKm(depCoords, city)
    : 0;
  const hasAirport = !!(CITY_AIRPORT[departure]);
  if (distKm > 500 && hasAirport && city?.hasDirectFlight) return 'flight';

  return 'rail';
}

/**
 * 航空便 CTA を生成する（Skyscanner → Google Flights の順で試みる）。
 * どちらも生成できない場合は null を返す（JR にフォールバックしない）。
 */
function _buildFlightCta(fromIata, toAirport) {
  if (!fromIata || !toAirport) return null;
  return buildSkyscannerLink(fromIata, toAirport)
      ?? buildGoogleFlightsLink(fromIata, toAirport)
      ?? null;
}

/**
 * BFS step から JR予約プロバイダを導出する。
 * step.operator → 新幹線ライン名 → 出発地 jrArea の順に判定。
 */
function _deriveJrProviderFromStep(step, departure) {
  if (step?.operator && OPERATOR_PROVIDER[step.operator]) {
    return OPERATOR_PROVIDER[step.operator];
  }
  const label = step?.label ?? '';
  if (SHINKANSEN_LINE_PROVIDER[label]) return SHINKANSEN_LINE_PROVIDER[label];
  const jrArea = DEPARTURE_CITY_INFO[departure]?.jrArea;
  if (jrArea === 'east')   return 'ekinet';
  if (jrArea === 'kyushu') return 'jrkyushu';
  return 'e5489';
}

/**
 * BFS / routes.js 形式の steps[] から main-cta を導出する。
 * 最初の非 localMove ステップの type を優先する。
 */
function _deriveMainCtaFromSteps(steps, departure, city) {
  const primaryStep = steps.find(s => s.type !== 'localMove');

  // railCompany === null の場合は鉄道予約CTAを生成しない
  const canUseRail  = city?.railCompany !== null;
  const fallbackRail = () => canUseRail
    ? buildJrLink(_deriveJrProviderFromStep(null, departure))
    : null;

  if (!primaryStep) {
    // ステップ不明でも transport type で最終判定
    const tType = _resolveTransportType(departure, city);
    if (tType === 'flight') {
      const fromIata = CITY_AIRPORT[departure] ?? null;
      return _buildFlightCta(fromIata, city?.airportGateway ?? '');
    }
    return fallbackRail();
  }

  switch (primaryStep.type) {
    case 'flight': {
      const fromIata  = CITY_AIRPORT[departure] ?? null;
      const toAirport = primaryStep.to ?? '';
      // JR にフォールバックしない — flight ステップが明示されているので null を返す
      return _buildFlightCta(fromIata, toAirport);
    }
    case 'shinkansen':
    case 'rail':
      return canUseRail
        ? buildJrLink(_deriveJrProviderFromStep(primaryStep, departure))
        : null;
    case 'ferry': {
      const gw        = primaryStep.from ?? departure;
      const bookUrl   = primaryStep.ferryUrl ?? null;
      const op        = primaryStep.ferryOperator ?? null;
      const dId       = primaryStep.destId ?? city?.id ?? '';
      return buildFerryLinkForDest(dId, gw, bookUrl, op)
          ?? buildFerryLink(gw, bookUrl, op);
    }
    case 'bus':
      return buildHighwayBusLink(departure, cityLabel(city));
    default:
      return fallbackRail();
  }
}

/**
 * pattern builder の step-group 配列から main-cta を導出する。
 * stepLabel の（モード）テキストから交通手段を判定する。
 */
function _deriveMainCtaFromStepGroups(stepGroups, city, departure) {
  const hasFlight = stepGroups.some(sg => sg.stepLabel?.includes('（飛行機）'));
  const hasFerry  = stepGroups.some(sg => sg.stepLabel?.includes('（フェリー）'));
  const fromIata  = CITY_AIRPORT[departure] ?? null;

  // ステップに飛行機が含まれる、または metadata が flight を示す場合
  const tType = _resolveTransportType(departure, city);
  if (hasFlight || tType === 'flight') {
    const airport = city.airportGateway
        ?? (city.flightHub ? (AIRPORT_HUB_GATEWAY[city.flightHub] ?? null) : null);
    // JR にフォールバックしない — flight と判定されたら flight CTA or null
    return _buildFlightCta(fromIata, airport ?? '');
  }
  if (hasFerry || tType === 'ferry') {
    return buildFerryLinkForDest(city.id, city.ferryGateway ?? '', null, null)
        ?? buildFerryLink(city.ferryGateway ?? '', null, null);
  }
  // railCompany === null の場合は JR CTA を生成しない
  if (city?.railCompany === null) return null;
  return buildJrLink(_deriveJrProviderFromStep(null, departure));
}

/**
 * BFS / routes.js steps[] からレンタカー sub-cta を導出する。
 * レンタカーステップまたは requiresCar フラグがある場合のみ生成する。
 */
function _deriveSubCtaFromSteps(steps, city) {
  const hasRental = steps.some(s =>
    s.type === 'car' ||
    (s.type === 'localMove' && (s.label === 'レンタカー' || (s.label ?? '').includes('レンタカー')))
  );
  if (!hasRental && !city?.requiresCar) return null;
  const lastMain = [...steps].reverse().find(s => s.type !== 'localMove' && s.type !== 'car');
  const gatewayCity = lastMain?.to?.replace(/駅$/, '') ?? null;
  return buildRentalLink(gatewayCity);
}

/**
 * 目的地から map-cta を導出する。
 * mapPoint → finalPoint → spots[0] → 都市名 の順で使用する。
 * accessStation は使用しない（「駅までのマップ」防止）。
 */
function _deriveMapCtaFromCity(city, departure, fromCity) {
  // mapPoint が駅名（駅で終わる）の場合はスキップして次候補へ
  const mapPt = (city.mapPoint && !city.mapPoint.endsWith('駅')) ? city.mapPoint : null;
  const dest = mapPt
    ?? city.finalPoint
    ?? (Array.isArray(city.spots) && city.spots[0])
    ?? cityLabel(city);
  if (!dest) return null;
  const origin = fromCity?.rail ?? DEPARTURE_CITY_INFO[departure]?.rail ?? `${departure}駅`;
  const mode   = resolveMapMode(origin, dest);
  return buildGoogleMapsLink(origin, dest, mode, `地図で確認（${dest}）`);
}

/* ══════════════════════════════════════════════════════
   飛行機可否判定
   短距離 / 同一地方への飛行機ルートを禁止する。
   ただし離島（isIsland / island）・flightHub 経由目的地は常に許可。
══════════════════════════════════════════════════════ */

/**
 * @param {object} city      — 目的地エントリ（travelTimeMinutes 付きが望ましい）
 * @param {string} departure — 出発地名
 * @returns {boolean}        — true = 飛行機ルートを使用可
 */
function isFlightAllowed(city, departure) {
  // 離島・flightHub 経由（屋久島など）は飛行機必須なので常に許可
  if (city.isIsland || city.destType === 'island') return true;
  if (city.flightHub) return true;

  // hasDirectFlight が明示 false なら不許可
  if (city.hasDirectFlight === false) return false;

  // 直線距離 300km 未満は飛行機不要
  const depCoords  = DEPARTURE_COORDS[departure];
  const destCoords = (city.lat && city.lng) ? { lat: city.lat, lng: city.lng } : null;
  if (depCoords && destCoords) {
    const distKm = calcDistanceKm(depCoords, destCoords);
    if (distKm < 300) return false;
  }

  // remote/mountain は常に許可（陸路が遠回りになる場合あり）
  if (city.destType === 'remote' || city.destType === 'mountain') return true;

  // 移動時間 200分未満（目安 〜300km）は飛行機不要
  const travelMin = city.travelTimeMinutes ?? 999;
  if (travelMin > 0 && travelMin < 200) return false;

  // 同一地方は飛行機不要（例: 九州 → 九州, 関東 → 関東）
  const depArea  = getArea(departure);
  const destArea = city.region ?? null;
  if (depArea && destArea && depArea === destArea) return false;

  return true;
}

/* ══════════════════════════════════════════════════════
   ルートタイプ分類（構造生成ベース）

   city     → 鉄道直通（accessStation ≈ 目的地名）
   suburban → 鉄道 + ラストマイル（accessStation ≠ 目的地名）
   rural    → gateway経由（railGateway ≠ accessStation / mountain / remote）
   island   → フェリー・飛行機必須（離島・半島離島）

   BFS・最短経路探索は使用しない。
   目的地メタデータの固定フィールドのみでルート構造を決定する。
══════════════════════════════════════════════════════ */

/**
 * 目的地メタデータからルートタイプを分類する。
 * 探索ではなく、destination の固定フィールドに基づく構造決定。
 *
 * @param {object} city — 目的地エントリ
 * @returns {'city'|'suburban'|'rural'|'island'}
 */
function classifyDestRouteType(city) {
  // island: フェリー必須（小島・半島離島）
  if (city.isIsland || city.destType === 'island' || city.ferryGateway) return 'island';

  // rural: 多段経路（mountain/remote / railGateway ≠ accessStation）
  if (city.destType === 'mountain' || city.destType === 'remote') return 'rural';
  if (city.railGateway && city.accessStation && city.railGateway !== city.accessStation) return 'rural';

  // suburban: accessStation が目的地名と異なる（ラストマイル必要）
  const label = cityLabel(city);
  if (city.accessStation && city.accessStation.replace(/駅$/, '') !== label) return 'suburban';

  // city: 鉄道直通（または飛行機直行）
  return 'city';
}

/**
 * 出発地・目的地地方から JR 予約 provider を派生する。
 * railProvider: null の目的地で railGateway だけ判明している場合に使用。
 * 目的地地方を優先し、不明なら出発地エリアで判定する。
 *
 * @param {string} departure  — 出発都市名
 * @param {string} [destRegion] — 目的地の region フィールド
 */
function _deriveJrProvider(departure, destRegion) {
  if (destRegion === '九州') return 'jrkyushu';
  if (['四国', '中国', '近畿', '中部'].includes(destRegion)) return 'e5489';
  if (['北海道', '東北', '関東'].includes(destRegion)) return 'ekinet';
  const area = getArea(departure);
  if (area === '九州') return 'jrkyushu';
  if (['北海道', '東北', '関東'].includes(area)) return 'ekinet';
  return 'e5489';
}

/* ── Helper: accessStation が目的地と実質同一か判定 ── */
function isAccessSameAsDest(accessStation, label) {
  if (!accessStation || !label) return true;
  const normalized = accessStation
    .replace(/駅$/, '')
    .replace(/バスターミナル$/, '')
    .replace(/バス停$/, '')
    .replace(/港$/, '')
    .trim();
  return normalized === label;
}

/**
 * ゲートウェイ（空港・港・駅）から最終目的地まで 1〜2 ステップを生成する。
 *
 * - secondaryTransport=bus + requiresCar + hubStation → 2ステップ（バス→レンタカー）
 * - requiresCar のみ → 1ステップ（レンタカー）
 * - secondaryTransport のみ → 1ステップ（バス/タクシー）
 * - 空港/港からのデフォルト → バス（徒歩禁止: 常に 2km 超）
 * - 駅からは短距離なら徒歩可
 *
 * @returns {Array<object>} step-group 配列（1 または 2 要素）
 */
function buildLastSteps(gateway, city, startIdx) {
  const label       = cityLabel(city);
  const finalPt     = city.finalPoint ?? mapTarget(city);
  const transport   = city.secondaryTransport ?? null;
  /* secondaryTransport に bus/walk が明示されている場合は mountain/remote でもカー禁止 */
  const requiresCar = (transport === 'bus' || transport === 'walk')
    ? false
    : (!!(city.requiresCar ?? city.needsCar)
        || ['mountain', 'remote'].includes(city.destType)
        || transport === 'car');
  const hasBus      = transport === 'bus' || city.busGateway || city.railNote === 'バス';
  /* 空港・港からは常に 2km 超 → 徒歩禁止 */
  const fromIsGateway = /空港|港$/.test(gateway);
  const hub         = city.hubStation ?? null;

  const steps = [];

  if (hasBus && requiresCar && hub && hub !== gateway) {
    /* 2ステップ: secondaryTransport(バス) → hubStation → requiresCar(レンタカー) → finalPoint */
    steps.push({
      type: 'step-group',
      stepLabel: `${STEP_IDX[startIdx]}  ${gateway} → ${hub}（バス）`,
      cta: buildGoogleMapsLink(gateway, hub, 'transit',
             `${gateway} → ${hub} の行き方を見る`),
      caution: null,
    });
    steps.push({
      type: 'step-group',
      stepLabel: `${STEP_IDX[startIdx + 1]}  ${hub} → ${finalPt}（レンタカー）`,
      cta: buildGoogleMapsLink(hub, finalPt, 'driving',
             `${hub} → ${label} の行き方を見る`, coords(city)),
      caution: null,
    });
  } else if (requiresCar) {
    /* 1ステップ: レンタカー */
    steps.push({
      type: 'step-group',
      stepLabel: `${STEP_IDX[startIdx]}  ${gateway} → ${finalPt}（レンタカー）`,
      cta: buildGoogleMapsLink(gateway, finalPt, 'driving',
             `${gateway} → ${label} の行き方を見る`, coords(city)),
      caution: null,
    });
  } else if (hasBus || (fromIsGateway && transport !== 'walk')) {
    /* バス/Transit（空港・港からのデフォルト） */
    steps.push({
      type: 'step-group',
      stepLabel: `${STEP_IDX[startIdx]}  ${gateway} → ${finalPt}（バス）`,
      cta: buildGoogleMapsLink(gateway, finalPt, 'transit',
             `${gateway} → ${label} の行き方を見る`),
      caution: null,
    });
  } else if (transport === 'taxi') {
    steps.push({
      type: 'step-group',
      stepLabel: `${STEP_IDX[startIdx]}  ${gateway} → ${finalPt}（タクシー）`,
      cta: buildGoogleMapsLink(gateway, finalPt, 'driving',
             `${gateway} → ${label} の行き方を見る`),
      caution: null,
    });
  } else {
    /* 徒歩 / バス / Googleマップ（ラストマイル）
     *
     * ルール:
     *   - gateway === finalPt（実質同一）→ step 不要
     *   - secondaryTransport='walk' → 徒歩（明示的な2km以下）
     *   - finalPoint が明示設定されている → バス（距離不明な場合は安全側）
     *   - finalPoint 未設定（市街地到着）→ Googleマップ（駅近前提）
     */
    // finalPoint 明示がある場合はスキップしない（駅名 = 地名でも別地点）
    if (!city.finalPoint && isAccessSameAsDest(gateway, finalPt)) return steps;

    if (transport === 'walk') {
      steps.push({
        type: 'step-group',
        stepLabel: `${STEP_IDX[startIdx]}  ${gateway} → ${finalPt}（徒歩）`,
        cta: buildGoogleMapsLink(gateway, finalPt, 'walking',
               `${gateway} → ${label} の行き方を見る`, coords(city)),
        caution: null,
      });
    } else if (city.finalPoint) {
      /* finalPoint 明示 = 駅から別の観光地点まで移動 → バス */
      steps.push({
        type: 'step-group',
        stepLabel: `${STEP_IDX[startIdx]}  ${gateway} → ${finalPt}（バス）`,
        cta: buildGoogleMapsLink(gateway, finalPt, 'transit',
               `${gateway} → ${label} の行き方を見る`),
        caution: null,
      });
    } else {
      /* finalPoint 未設定 = 市街地 or 駅近 → Googleマップ */
      const mapMode = resolveMapMode(gateway, finalPt);
      steps.push({
        type: 'step-group',
        stepLabel: `${STEP_IDX[startIdx]}  ${gateway} → ${finalPt}（Googleマップ）`,
        cta: buildGoogleMapsLink(gateway, finalPt, mapMode,
               `${gateway} → ${label} の行き方を見る`, coords(city)),
        caution: null,
      });
    }
  }

  return steps;
}

/* buildLastSteps の 1-step 後方互換ラッパー */
function buildLocalStep(fromStation, city, stepIndex) {
  return buildLastSteps(fromStation, city, stepIndex)[0] ?? null;
}

/* ══════════════════════════════════════════════════════
   スコアリング（不自然なルートを自動生成に差し替え）
   スコア低 = より自然なルート
══════════════════════════════════════════════════════ */

function scoreRouteSteps(steps, departure, city = null) {
  const meaningful = steps.filter(s => s.type !== 'localMove' && s.type !== 'transfer');
  const transfers  = Math.max(0, meaningful.length - 1);
  let score = transfers * 10;

  if (transfers === 0) score -= 20; // 直通ボーナス

  const totalMinutes = steps.reduce((sum, s) => sum + (s.duration ?? 0), 0);
  if (totalMinutes > 0) score += Math.floor(totalMinutes / 30);

  if (departure === '高松' && steps.some(s => s.type === 'shinkansen' && s.to === '岡山')) {
    score += 100; // 高松発で岡山行き新幹線は禁止
  }

  const depArea  = getArea(departure);
  // 目的地エリア（ループ判定の除外に使用）
  const destArea = city ? (city.region ?? getArea(city.name) ?? null) : null;

  const areasVisited = new Set();
  for (const s of meaningful) {
    const toArea = getArea(s.to);
    if (toArea) areasVisited.add(toArea);
  }
  // 出発地エリアを再訪するルートはループの疑い。
  // ただし目的地が出発地と同一エリア（例: 四国→中国→四国内目的地）は自然なルートなのでスキップ。
  if (depArea && areasVisited.size > 1 && areasVisited.has(depArea) && depArea !== destArea) {
    score += 50;
  }

  let prevArea = depArea;
  const visitedInOrder = [];
  for (const s of meaningful) {
    const toArea = getArea(s.to);
    if (toArea && toArea !== prevArea) {
      if (visitedInOrder.includes(toArea)) score += 30;
      visitedInOrder.push(toArea);
      prevArea = toArea;
    }
  }

  /* 乗換3回以上は自然なルートではない → buildAutoLinks に差し替え */
  if (transfers >= 3) score += 100;

  /* Phase 4④: 陸路4区間以上は遠回りの可能性 → ペナルティ（3→4 に緩和: 四国3区間ルートは正常）*/
  const landStepCount = meaningful.filter(s => ['shinkansen', 'rail'].includes(s.type)).length;
  if (landStepCount >= 4) score += 50;

  return score;
}

/* ══════════════════════════════════════════════════════
   四国発マリンライナー自動挿入
══════════════════════════════════════════════════════ */

const SHIKOKU_DEPARTURES_SET = new Set(['高松', '高知', '徳島', '松山']);

function injectMarinerStep(steps, dep) {
  if (!SHIKOKU_DEPARTURES_SET.has(dep)) return steps;
  if (steps.some(s => s.type === 'shinkansen' && s.from === '岡山')) return steps;
  if (!steps.some(s => s.type === 'shinkansen')) return steps;
  const mariner = { step: 0, from: dep, to: '岡山', type: 'rail', operator: 'JR四国', label: 'マリンライナー' };
  return [mariner, ...steps];
}

/* ══════════════════════════════════════════════════════
   BFS ステップ → リンク配列
══════════════════════════════════════════════════════ */

function bfsStepsToLinks(steps, departure, city) {
  const links = [];

  /* ── summary（乗換回数 + ウェイポイント + 日帰り判定 + ルートラベル）── */
  const meaningfulSteps = steps.filter(s => s.type !== 'localMove');
  const transfers       = Math.max(0, meaningfulSteps.length - 1);
  const waypoints       = buildWaypoints(steps, departure, city);
  links.push({
    type: 'summary',
    transfers,
    waypoints,
    stayRecommend: getStayRecommend(city),
    routeLabel:    getRouteLabel(transfers, city),
  });

  /* ── main-cta / sub-cta / map-cta: steps から自動導出 ── */
  {
    const mainCta = _deriveMainCtaFromSteps(steps, departure, city);
    if (mainCta) links.push({ type: 'main-cta', cta: mainCta });
    const subCta = _deriveSubCtaFromSteps(steps, city);
    if (subCta) links.push({ type: 'sub-cta', cta: subCta });
    const mapCta = _deriveMapCtaFromCity(city, departure, null);
    if (mapCta) links.push({ type: 'map-cta', cta: mapCta });
  }

  /* ── step-group 生成（label + 所要時間）── */
  let displayIdx = 0;
  for (let i = 0; i < steps.length; i++) {
    const s    = steps[i];
    const icon = stepTypeIcon(s.type);
    const mode = normalizeStepLabel(s.label ?? stepTypeLabel(s.type), s.type, s.operator ?? '');
    const fromLabel   = i === 0 ? getDepartureLabel(departure, s.type) : s.from ?? '';
    const durationStr = (s.minutes && s.minutes > 0) ? `・約${formatMinutes(s.minutes)}` : '';
    const stepLabel   = `${stepIdx(displayIdx)} ${icon} ${fromLabel} → ${s.to}（${mode}${durationStr}）`;
    const duration    = (s.minutes && s.minutes > 0) ? s.minutes : null;
    links.push({ type: 'step-group', stepLabel, cta: null, caution: null, duration });
    displayIdx++;
  }
  return links.filter(Boolean);
}

/* ══════════════════════════════════════════════════════
   routes.js 手動定義ステップ → リンク配列
══════════════════════════════════════════════════════ */

function buildLinksFromRoutes(routesInput, city, departure, fromCity) {
  const routes = injectMarinerStep(routesInput, departure);
  const label  = cityLabel(city);
  const links  = [];

  function shinkansenFrom() {
    if (SHIKOKU_DEPARTURES_SET.has(departure)) return '岡山駅';
    const railName = fromCity.rail.replace(/駅$/, '');
    const st = CITY_TO_SHINKANSEN[railName] ?? CITY_TO_SHINKANSEN[departure] ?? railName;
    return st.endsWith('駅') ? st : st + '駅';
  }

  const meaningfulSteps   = routes.filter(s => s.type !== 'localMove');
  const routeTransfers    = Math.max(0, meaningfulSteps.length - 1);
  const routeWaypoints    = buildWaypointsFromRouteSteps(routes, departure, city);
  links.push({
    type: 'summary',
    transfers:    routeTransfers,
    waypoints:    routeWaypoints,
    stayRecommend: getStayRecommend(city),
    routeLabel:    getRouteLabel(routeTransfers, city),
  });

  /* ── main-cta / sub-cta / map-cta: steps から自動導出 ── */
  {
    const mainCta = _deriveMainCtaFromSteps(routes, departure, city);
    if (mainCta) links.push({ type: 'main-cta', cta: mainCta });
    const subCta = _deriveSubCtaFromSteps(routes, city);
    if (subCta) links.push({ type: 'sub-cta', cta: subCta });
    const mapCta = _deriveMapCtaFromCity(city, departure, fromCity);
    if (mapCta) links.push({ type: 'map-cta', cta: mapCta });
  }

  let displayIdx = 0;
  let prevStepTo = null;

  for (const step of routes) {
    const mode = normalizeStepLabel(step.label ?? stepTypeLabel(step.type), step.type, step.operator ?? '');

    const from = step.step === 1
      ? (step.type === 'shinkansen'
          ? shinkansenFrom()
          : step.type === 'flight'
            ? (formatAirportLabel(fromCity.airport) ?? departure)
            : fromCity.rail)
      : step.from ?? prevStepTo ?? '';
    const to   = step.to ?? label;

    if ((step.type === 'shinkansen' || step.type === 'rail') && from.replace(/駅$/, '') === to.replace(/駅$/, '')) continue;

    const icon = stepTypeIcon(step.type);
    let stepLabel;
    switch (step.type) {
      case 'shinkansen':
      case 'rail':
        stepLabel = `${stepIdx(displayIdx)} ${icon} ${from} → ${to}（${mode}）`; break;
      case 'flight': {
        const airportFrom = formatAirportLabel(fromCity.airport) ?? departure;
        stepLabel = `${stepIdx(displayIdx)} ${icon} ${airportFrom} → ${to}（飛行機）`; break;
      }
      case 'ferry':
        stepLabel = `${stepIdx(displayIdx)} ${icon} ${from} → ${label}（フェリー）`; break;
      case 'car':
        stepLabel = `${stepIdx(displayIdx)} ${icon} ${from} → ${label}（レンタカー）`; break;
      case 'bus':
        stepLabel = `${stepIdx(displayIdx)} ${icon} ${from} → ${label}（${mode}）`; break;
      case 'localMove':
        stepLabel = `${stepIdx(displayIdx)} ${icon} ${from} → ${step.to ?? label}（Googleマップ）`; break;
      default:
        stepLabel = `${stepIdx(displayIdx)} ${icon} ${from} → ${to}（${mode}）`;
    }

    // step-group: label のみ。booking CTA は main-cta として別途配置する
    links.push({ type: 'step-group', stepLabel, cta: null, caution: null });
    prevStepTo = to;
    displayIdx++;
  }

  return links.filter(Boolean);
}

/* ══════════════════════════════════════════════════════
   metadata 自動生成（ROUTES 未定義 / gateway 未設定）

   step補完ルール:
     flight → ferry  : 空港 → 港 のGoogle Maps step を自動挿入
     ferry のみ      : 港のハブ都市経由step を自動挿入
                       （departure→ハブ Google Maps + ハブ→港 Google Maps）
══════════════════════════════════════════════════════ */

function buildAutoLinks(city, departure, fromCity) {
  const label       = cityLabel(city);
  const origin      = fromCity?.rail ?? departure;
  const baseStation = city.accessStation ?? city.railGateway ?? label;
  const destSt      = city.shinkansenStation ?? baseStation;

  const stepGroups = [];

  /* ── 飛行機 ── */
  const fromIata   = CITY_AIRPORT[departure] ?? null;

  /* Phase 4③: flightHub 経由かどうか（ferry セクションのスキップ判定にも使用）*/
  const _hubAirportName = city.flightHub ? (AIRPORT_HUB_GATEWAY[city.flightHub] ?? null) : null;
  const isViaHub = !!(_hubAirportName && _hubAirportName !== city.airportGateway);

  /* 短距離 / 同一地方への飛行機は禁止 */
  const hasFlight  = isFlightAllowed(city, departure) && !!(fromIata && (
    (city.airportGateway && hasFlightRoute(departure, city.airportGateway)) ||
    (isViaHub && _hubAirportName && hasFlightRoute(departure, _hubAirportName))
  ));
  /* 実際に乗り継ぎ飛行機ルートを表示した場合のみ true（ferry セクションのスキップ判定）*/
  let usedViahubFlight = false;

  if (hasFlight) {
    const flightFrom = formatAirportLabel(fromCity?.airport) ?? departure;

    const hubAirportName = _hubAirportName;

    if (isViaHub) {
      usedViahubFlight = true;
      const hubFlightCta = buildSkyscannerLink(fromIata, hubAirportName);
      stepGroups.push({
        type: 'step-group',
        stepLabel: `${stepIdx(stepGroups.length)} ${flightFrom} → ${hubAirportName}（飛行機）`,
        cta: hubFlightCta, caution: null,
      });

      if (city.ferryGateway) {
        /* hub空港 → フェリー乗り場（Googleマップ）→ ferry は直後に追加 */
        stepGroups.push({
          type: 'step-group',
          stepLabel: `${stepIdx(stepGroups.length)} ${hubAirportName} → ${city.ferryGateway}（Googleマップ）`,
          cta: buildGoogleMapsLink(hubAirportName, city.ferryGateway, resolveMapMode(hubAirportName, city.ferryGateway), `${hubAirportName} → ${city.ferryGateway} の行き方を見る`),
          caution: null,
        });
        const ferryCta = buildFerryLinkForDest(city.id, city.ferryGateway);
        stepGroups.push({
          type: 'step-group',
          stepLabel: `${stepIdx(stepGroups.length)} ${city.ferryGateway} → ${label}（フェリー）`,
          cta: ferryCta, caution: null,
        });
      } else {
        /* hub → 最終空港（乗り継ぎ便・CTA無し）*/
        stepGroups.push({
          type: 'step-group',
          stepLabel: `${stepIdx(stepGroups.length)} ${hubAirportName} → ${city.airportGateway}（乗り継ぎ）`,
          cta: null, caution: '※乗り継ぎ便が必要です（ハブ空港で乗り換え）',
        });
        /* 到着空港 → 目的地（Googleマップ）*/
        const arrivalAirport = city.airportGateway;
        if (arrivalAirport !== label) {
          const mTo = mapTarget(city);
          stepGroups.push({
            type: 'step-group',
            stepLabel: `${stepIdx(stepGroups.length)} ${arrivalAirport} → ${label}（Googleマップ）`,
            cta: buildGoogleMapsLink(arrivalAirport, mTo, resolveMapMode(arrivalAirport, mTo), `${arrivalAirport} → ${label} の行き方を見る`),
            caution: null,
          });
        }
      }
    } else {
      /* ── 直行便ルート（従来通り）── */
      const flightCta = buildSkyscannerLink(fromIata, city.airportGateway);
      if (flightCta) {
        stepGroups.push({
          type: 'step-group',
          stepLabel: `${stepIdx(stepGroups.length)} ${flightFrom} → ${city.airportGateway}（飛行機）`,
          cta: null, caution: null,
        });

        if (city.ferryGateway) {
          stepGroups.push({
            type: 'step-group',
            stepLabel: `${stepIdx(stepGroups.length)} ${city.airportGateway} → ${city.ferryGateway}（Googleマップ）`,
            cta: buildGoogleMapsLink(city.airportGateway, city.ferryGateway, resolveMapMode(city.airportGateway, city.ferryGateway), `${city.airportGateway} → ${city.ferryGateway} の行き方を見る`),
            caution: null,
          });
        } else {
          const mTo = mapTarget(city);
          stepGroups.push({
            type: 'step-group',
            stepLabel: `${stepIdx(stepGroups.length)} ${city.airportGateway} → ${label}（Googleマップ）`,
            cta: buildGoogleMapsLink(city.airportGateway, mTo, resolveMapMode(city.airportGateway, mTo),
                   `${city.airportGateway} → ${label} の行き方を見る`),
            caution: null,
          });
        }
      }
    }
  }

  /* ── JR予約 ── */
  if (city.railProvider) {
    const jrCta = buildJrLink(city.railProvider);
    if (jrCta) {
      stepGroups.push({
        type: 'step-group',
        stepLabel: `${stepIdx(stepGroups.length)} ${origin} → ${destSt}（鉄道）`,
        cta: jrCta, caution: null,
      });
      /* ── step補完: 駅 → 観光地（ferryGateway がない場合のみ）── */
      if (!city.ferryGateway && destSt !== label) {
        const mTo = mapTarget(city);
        stepGroups.push({
          type: 'step-group',
          stepLabel: `${stepIdx(stepGroups.length)} ${destSt} → ${label}（Googleマップ）`,
          cta: buildGoogleMapsLink(destSt, mTo, resolveMapMode(destSt, mTo),
                 `${destSt} → ${label} の行き方を見る`),
          caution: null,
        });
      }
    }
  }

  /* ── フェリー ── */
  /* 乗り継ぎ飛行機ルートを表示済みの場合: 空港到着後ルートで完結 → ferryセクション不要 */
  if (city.ferryGateway && !usedViahubFlight) {
    /* ── step補完: ferry のみ（飛行機なし）→ 港ハブ都市への経路を追加 ── */
    if (!hasFlight) {
      const hubCity = PORT_CITY_MAP[city.ferryGateway] ?? null;
      if (hubCity && hubCity !== departure) {
        /* departure → ハブ都市（Google Maps transit） */
        stepGroups.push({
          type: 'step-group',
          stepLabel: `${stepIdx(stepGroups.length)} ${departure} → ${hubCity}（交通手段で移動）`,
          cta: buildGoogleMapsLink(origin, hubCity, resolveMapMode(origin, hubCity),
                 `${origin} → ${hubCity} の行き方を見る`),
          caution: null,
        });
        /* ハブ都市 → 港（Google Maps） */
        stepGroups.push({
          type: 'step-group',
          stepLabel: `${stepIdx(stepGroups.length)} ${hubCity} → ${city.ferryGateway}（Googleマップ）`,
          cta: buildGoogleMapsLink(hubCity, city.ferryGateway, resolveMapMode(hubCity, city.ferryGateway),
                 `${hubCity} → ${city.ferryGateway} の行き方を見る`),
          caution: null,
        });
      } else if (!hubCity) {
        /* 未登録港 → 目的地まで Google Maps で */
        stepGroups.push({
          type: 'step-group',
          stepLabel: `${stepIdx(stepGroups.length)} ${departure} → ${city.ferryGateway}（Googleマップ）`,
          cta: buildGoogleMapsLink(origin, city.ferryGateway, resolveMapMode(origin, city.ferryGateway),
                 `${origin} → ${city.ferryGateway} の行き方を見る`),
          caution: null,
        });
      }
      /* departure = hubCity の場合は直接フェリーへ（追加ステップ不要） */
    }

    const ferryCta = buildFerryLinkForDest(city.id, city.ferryGateway);
    stepGroups.push({
      type: 'step-group',
      stepLabel: `${stepIdx(stepGroups.length)} ${city.ferryGateway} → ${label}（フェリー）`,
      cta: ferryCta, caution: null,
    });
  }

  /* ── レンタカー（Phase 2: needsCar / mountain / remote のみ）── */
  /* rentalLinks は sub-cta（routes.json）に移行済み。buildAutoLinks では生成しない。 */

  /* ── Google Maps（フォールバック / 何もない場合）── */
  if (stepGroups.length === 0) {
    const _fbFrom = fromCity?.rail ?? departure;
    const gmapCta = buildGoogleMapsLink(
      _fbFrom, destSt, resolveMapMode(_fbFrom, destSt), `${_fbFrom} → ${destSt} の行き方を見る`,
      city.lat && city.lng ? { lat: city.lat, lng: city.lng } : null,
    );
    stepGroups.push({
      type: 'step-group',
      stepLabel: `① ${departure} → ${label}（Googleマップ）`,
      cta: gmapCta, caution: null,
    });
  }

  const links = [];
  /* Phase 3: waypoints を stepGroups から復元 */
  const autoWaypoints = (() => {
    const pts = [];
    for (const sg of stepGroups) {
      const m = sg.stepLabel?.match(/^[①②③④⑤\d\.]+\s*[]*\s*(.+?)\s*→\s*(.+?)（/u);
      if (!m) continue;
      if (pts.length === 0) pts.push(m[1]);
      const to = m[2];
      if (to !== pts[pts.length - 1]) pts.push(to);
    }
    return pts.length >= 2 ? pts : null;
  })();
  const autoTransfers = Math.max(0, stepGroups.length - 1);
  links.push({
    type: 'summary',
    transfers:    autoTransfers,
    waypoints:    autoWaypoints,
    stayRecommend: getStayRecommend(city),
    routeLabel:    getRouteLabel(autoTransfers, city),
  });

  /* ── main-cta / map-cta: step-groups から自動導出 ── */
  const mainCta = _deriveMainCtaFromStepGroups(stepGroups, city, departure);
  if (mainCta) links.push({ type: 'main-cta', cta: mainCta });
  const mapCta = _deriveMapCtaFromCity(city, departure, fromCity);
  if (mapCta) links.push({ type: 'map-cta', cta: mapCta });
  links.push(...stepGroups);
  return links;
}

/* ══════════════════════════════════════════════════════
   内部ルーター（優先順位: BFS > 出発地特例 > 汎用+スコア > 自動生成）
══════════════════════════════════════════════════════ */

/**
 * BFS ルートの妥当性チェック。
 * グラフの構造的欠落（ferry省略・陸路目的地への飛行機ルートなど）を検出し、
 * 不適切なルートを fallback に戻す。
 *
 * @param {Array} steps  — BFS step 配列
 * @param {object} city  — destination エントリ
 * @returns {boolean}    — true = BFS を採用, false = fallback を使う
 */
function isBfsRouteValid(steps, city, departure = '') {
  const hasFlight  = steps.some(s => s.type === 'flight');
  const hasFerry   = steps.some(s => s.type === 'ferry');

  // 飛行機ルートだが airportGateway がない → 陸路目的地への飛行機は不適切
  if (hasFlight && !city.airportGateway) return false;

  // railProvider がある（鉄道でアクセス可能）のに飛行機ルートが選ばれた
  // → ホップ数優先 BFS の誤選択。routes.js / buildAutoLinks の鉄道ルートを使う
  if (hasFlight && city.railProvider) return false;

  // 短距離 or 同一地方への飛行機は禁止
  if (hasFlight && !isFlightAllowed(city, departure)) return false;

  // 飛行機2回以上のルートは不自然（乗り継ぎ便は flightHub ルートで表示）
  const flightCount = steps.filter(s => s.type === 'flight').length;
  if (flightCount >= 2) return false;

  // ferryGateway がある（島や港目的地）のに ferry step がない
  // → グラフが ferry 経路を bus/localMove で省略している → 詳細 fallback を使う
  if (city.ferryGateway && !hasFerry) return false;

  /* Phase 4④: 全陸路4区間以上は遠回りの疑い → fallback を使う */
  const landHops = steps.filter(s => ['shinkansen', 'rail'].includes(s.type));
  if (landHops.length >= 4) return false;

  /* Phase 4③: flightHub 経由が必要なのに BFS が直行扱いの場合 → buildAutoLinks を使う */
  if (hasFlight && city.flightHub) {
    const hubAirportName = AIRPORT_HUB_GATEWAY[city.flightHub];
    if (hubAirportName && hubAirportName !== city.airportGateway) {
      const passesHub = steps.some(s => s.to === hubAirportName || s.from === hubAirportName);
      if (!passesHub) return false;
    }
  }

  return true;
}

/* ══════════════════════════════════════════════════════
   パターン別ルート生成（gateway主導）

   4段階構造を各パターンで強制する：
     ① Googleマップ概要（常に最初）
     ② 長距離移動（新幹線 / 飛行機 / フェリー）
     ③ 到着ハブ → 最寄り駅（必要な場合）
     ④ 最寄り駅 → 目的地（accessStation 経由・Phase 5）

   BFS は local パターンのみ使用。長距離生成には使用しない。
══════════════════════════════════════════════════════ */

/**
 * ルート種別に応じた「最適な理由」ラベル。
 * city メタデータのみで判定（step-group の CTA を参照しない）。
 */
function buildReasonLabel(transfers, city) {
  const hasFerry  = !!(city.ferryGateway);
  const hasFlight = !!(city.airportGateway || city.flightHub);
  if (hasFerry && (city.isIsland || city.destType === 'island' || city.ferryGateway)) return '島へのルート';
  if (hasFerry)   return 'フェリー経由';
  if (hasFlight)  return transfers === 0 ? '飛行機で直行' : '飛行機経由';
  if (transfers === 0) return '直通';
  return `乗換${transfers}回`;
}

/**
 * step-group 配列 → links 配列（summary + main-cta + step-groups）。
 * mainCTA は city メタデータから直接生成する（step-group の CTA フィールドは使用しない）。
 */
function buildLinksFromStepGroups(stepGroups, city, departure = null, fromCity = null) {
  const pts = [];
  for (const sg of stepGroups) {
    if (sg._overview) continue;
    const m = sg.stepLabel?.match(/[①-⑧\d+.]+\s*\S*\s*(.+?)\s*→\s*(.+?)（/u);
    if (!m) continue;
    const from = m[1].trim(), to = m[2].trim();
    if (pts.length === 0) pts.push(from);
    if (to && to !== pts[pts.length - 1]) pts.push(to);
  }
  const waypoints  = pts.length >= 2 ? pts : null;
  const transfers  = Math.max(0, stepGroups.filter(sg => !sg._overview).length - 1);

  const links = [];
  links.push({
    type: 'summary',
    transfers,
    waypoints,
    totalMinutes:  city.travelTimeMinutes ?? null,
    reasonLabel:   buildReasonLabel(transfers, city),
    stayRecommend: getStayRecommend(city),
    routeLabel:    getRouteLabel(transfers, city),
  });

  /* ── main-cta / sub-cta / map-cta: step-groups から自動導出 ── */
  if (departure) {
    const mainCta = _deriveMainCtaFromStepGroups(stepGroups, city, departure);
    if (mainCta) links.push({ type: 'main-cta', cta: mainCta });
    const hasRental = stepGroups.some(sg => sg.stepLabel?.includes('（レンタカー）'));
    if (hasRental || city?.requiresCar) {
      links.push({ type: 'sub-cta', cta: buildRentalLink(null) });
    }
    const mapCta = _deriveMapCtaFromCity(city, departure, fromCity);
    if (mapCta) links.push({ type: 'map-cta', cta: mapCta });
  }

  links.push(...stepGroups);
  return links;
}

/**
 * ルート先頭に配置する Google Maps 概要ステップ（常に①）。
 * "出発駅 → 目的地（Googleマップ）" で全体ルートを一発確認できる。
 */
function buildOverviewStep(departure, city, fromCity) {
  const label  = cityLabel(city);
  const origin = fromCity?.rail ?? departure;
  const mTo    = mapTarget(city);
  return {
    type: 'step-group',
    _overview: true,
    stepLabel: `${STEP_IDX[0]}  ${origin} → ${mTo}（Googleマップ）`,
    cta: buildGoogleMapsLink(origin, mTo, 'transit',
           `${origin} → ${label} の行き方を見る`, coords(city)),
    caution: null,
  };
}

/* ══════════════════════════════════════════════════════
   パターン別ルートビルダー（固定構造生成・BFS不使用）

   Googleマップ使用ルール（Phase5）:
     local のみ使用（徒歩・バス・レンタカー区間）
     railステップ・概要ステップには使用しない

   4タイプの固定ステップ構造:
     city     : ① 鉄道（or 飛行機）[+ ② ラストマイル]
     suburban : ① 鉄道 → ② 現地アクセス（Googleマップ）
     rural    : ① 鉄道(gateway) → ② バス(gateway→access) → ③ ラストマイル
     island   : ① [飛行機] → ② 港アクセス → ③ フェリー
══════════════════════════════════════════════════════ */

/**
 * 飛行機ステップを stepGroups に追加し、到着空港名を返す。
 * ラストマイル（空港→市内）は含まない — 呼び出し側で buildLastSteps を使うこと。
 *
 * @returns {string|false} 到着空港名、または飛行機なしの場合 false
 */
function _appendFlightSteps(stepGroups, city, departure, fromCity) {
  const fromIata = CITY_AIRPORT[departure] ?? null;

  const _hubAirportName = city.flightHub ? (AIRPORT_HUB_GATEWAY[city.flightHub] ?? null) : null;
  const isViaHub  = !!(_hubAirportName && _hubAirportName !== city.airportGateway);
  const hasFlight = isFlightAllowed(city, departure) && !!(fromIata && (
    (city.airportGateway && hasFlightRoute(departure, city.airportGateway)) ||
    (isViaHub && _hubAirportName && hasFlightRoute(departure, _hubAirportName))
  ));

  if (!hasFlight) return false;

  const flightFrom = formatAirportLabel(fromCity?.airport) ?? departure;

  if (isViaHub && _hubAirportName) {
    stepGroups.push({
      type: 'step-group',
      stepLabel: `${stepIdx(stepGroups.length)}  ${flightFrom} → ${_hubAirportName}（飛行機）`,
      cta: null, caution: null,
    });
    const arrivalAirport = city.airportGateway ?? _hubAirportName;
    if (arrivalAirport !== _hubAirportName) {
      stepGroups.push({
        type: 'step-group',
        stepLabel: `${stepIdx(stepGroups.length)}  ${_hubAirportName} → ${arrivalAirport}（乗り継ぎ）`,
        cta: null, caution: '※乗り継ぎ便が必要です（ハブ空港で乗り換え）',
      });
    }
    return arrivalAirport;
  } else if (city.airportGateway) {
    const flightCta = buildSkyscannerLink(fromIata, city.airportGateway);
    if (!flightCta) return false;
    stepGroups.push({
      type: 'step-group',
      stepLabel: `${stepIdx(stepGroups.length)}  ${flightFrom} → ${city.airportGateway}（飛行機）`,
      cta: null, caution: null,
    });
    return city.airportGateway;
  }
  return false;
}

/**
 * city タイプ: 鉄道直通（または飛行機直行）。
 *   ① 鉄道 or 飛行機
 *   ② ラストマイル（accessStation ≠ 目的地の場合のみ）
 */
function buildCityTypeRoute(city, departure, fromCity) {
  const label    = cityLabel(city);
  const mTo      = mapTarget(city);
  const origin   = fromCity?.rail ?? departure;
  const accessSt = city.accessStation ?? city.railGateway ?? label;

  const stepGroups = [];

  // 飛行機ルートを優先チェック
  const flightGateway = _appendFlightSteps(stepGroups, city, departure, fromCity);

  if (flightGateway) {
    /* 空港 → 最終目的地（必ず lastStep を生成） */
    if (!isAccessSameAsDest(flightGateway, label) || !!city.mapPoint || !!city.finalPoint) {
      stepGroups.push(...buildLastSteps(flightGateway, city, stepGroups.length));
    }
  } else {
    const hasLocal = !isAccessSameAsDest(accessSt, label) || !!city.mapPoint || !!city.finalPoint;

    // gateway（または hubStation）が出発地駅・到着駅と異なる場合は 2 ステップに分割
    const gatewaySt = city.gateway ?? city.hubStation ?? null;
    const useGatewaySplit = gatewaySt && gatewaySt !== origin && gatewaySt !== accessSt;

    if (useGatewaySplit) {
      // step 1 は新幹線経由か確認してラベルを決定
      const step1Mode = SHINKANSEN_STATIONS.has(gatewaySt) ? '新幹線' : '鉄道';
      // step 2 はローカル線・バスなど
      const step2Mode = _localSegmentMode(city);
      stepGroups.push({
        type: 'step-group',
        stepLabel: `${stepIdx(0)}  ${origin} → ${gatewaySt}（${step1Mode}）`,
        cta: null,
        caution: '▼ ここで乗り換え',
      });
      stepGroups.push({
        type: 'step-group',
        stepLabel: `${stepIdx(1)}  ${gatewaySt} → ${accessSt}（${step2Mode}）`,
        cta: null,
        caution: hasLocal ? `▼ ここで下車。この先は現地移動` : null,
      });
    } else {
      stepGroups.push({
        type: 'step-group',
        stepLabel: `${stepIdx(stepGroups.length)}  ${origin} → ${accessSt}（鉄道）`,
        cta: null,
        caution: hasLocal ? `▼ ここで下車。この先は現地移動` : null,
      });
    }
    if (hasLocal) {
      stepGroups.push(...buildLastSteps(accessSt, city, stepGroups.length));
    }
  }

  const links = buildLinksFromStepGroups(stepGroups, city, departure, fromCity);
  // 飛行機がメインのとき鉄道を代替候補として提示
  if (flightGateway && city.railProvider) {
    const altSteps = _buildRailOnlySteps(city, departure, fromCity);
    if (altSteps) links.push({ type: 'alt-route', label: '鉄道で行く', stepGroups: altSteps });
  }
  return links;
}

/**
 * suburban タイプ: 鉄道または飛行機でアクセス、その後ラストマイル。
 *   飛行機がある場合: ① 飛行機 → ② lastStep（buildLastSteps）
 *   鉄道の場合:       ① 鉄道（departure → accessStation）→ ② lastStep
 */
function buildSuburbanRoute(city, departure, fromCity) {
  const label    = cityLabel(city);
  const origin   = fromCity?.rail ?? departure;
  const accessSt = city.accessStation ?? city.railGateway ?? label;

  const stepGroups = [];

  // 飛行機チェック（railProvider=null の都市は飛行機が主アクセスの場合あり）
  const flightGateway = _appendFlightSteps(stepGroups, city, departure, fromCity);

  if (flightGateway) {
    /* 空港 → 最終目的地（必ず lastStep を生成） */
    if (!isAccessSameAsDest(flightGateway, label) || !!city.mapPoint || !!city.finalPoint) {
      stepGroups.push(...buildLastSteps(flightGateway, city, stepGroups.length));
    }
  } else {
    // gateway 経由の乗り換えが必要な場合は 2 ステップ
    const gatewaySt = city.gateway ?? city.hubStation ?? null;
    const useGatewaySplit = gatewaySt && gatewaySt !== origin && gatewaySt !== accessSt;

    if (useGatewaySplit) {
      const step1Mode = SHINKANSEN_STATIONS.has(gatewaySt) ? '新幹線' : '鉄道';
      const step2Mode = _localSegmentMode(city);
      // ① departure → gateway
      stepGroups.push({
        type: 'step-group',
        stepLabel: `${stepIdx(0)}  ${origin} → ${gatewaySt}（${step1Mode}）`,
        cta: null,
        caution: '▼ ここで乗り換え',
      });
      // ② gateway → accessStation
      stepGroups.push({
        type: 'step-group',
        stepLabel: `${stepIdx(1)}  ${gatewaySt} → ${accessSt}（${step2Mode}）`,
        cta: null,
        caution: '▼ 電車はここまで。この先は現地移動',
      });
    } else {
      // ① 直接鉄道 → accessStation
      stepGroups.push({
        type: 'step-group',
        stepLabel: `${stepIdx(stepGroups.length)}  ${origin} → ${accessSt}（鉄道）`,
        cta: null,
        caution: '▼ 電車はここまで。この先は現地移動',
      });
    }

    // ② or ③ 現地アクセス（accessStation → 目的地 or finalPoint）
    if (!isAccessSameAsDest(accessSt, label) || !!city.mapPoint || !!city.finalPoint) {
      stepGroups.push(...buildLastSteps(accessSt, city, stepGroups.length));
    }
  }

  return buildLinksFromStepGroups(stepGroups, city, departure, fromCity);
}

/**
 * rural タイプ: gateway経由の多段移動。
 *   ① 鉄道（departure → railGateway）— JR終点を明示
 *   ② バス（railGateway → accessStation）— gateway ≠ accessStation の場合のみ
 *   ③ ラストマイル（accessStation → 目的地）
 *
 *   railProvider = null の場合: 飛行機 → ラストマイル の構造（飛行機もなければ local のみ）
 */
function buildRuralRoute(city, departure, fromCity) {
  const label    = cityLabel(city);
  const origin   = fromCity?.rail ?? departure;
  const gateway  = city.railGateway ?? city.accessStation ?? label;  // primary gateway（必須経由）
  const accessSt = city.accessStation ?? gateway;

  const stepGroups = [];

  // railProvider がない場合: 飛行機ルート優先（離島以外で空港がある山岳・秘境）
  if (!city.railProvider) {
    const flightGateway = _appendFlightSteps(stepGroups, city, departure, fromCity);
    if (flightGateway) {
      /* 空港 → 最終目的地（必ず lastStep） */
      if (!isAccessSameAsDest(flightGateway, label) || !!city.mapPoint || !!city.finalPoint) {
        stepGroups.push(...buildLastSteps(flightGateway, city, stepGroups.length));
      }
    } else {
      if (city.railGateway) {
        const hasNextStep = (gateway !== accessSt) || !isAccessSameAsDest(accessSt, label);
        stepGroups.push({
          type: 'step-group',
          stepLabel: `${stepIdx(0)}  ${origin} → ${gateway}（鉄道）`,
          cta: null,
          caution: hasNextStep ? `▼ 電車はここまで。この先はバスに乗り換え` : null,
        });
        if (gateway !== accessSt) {
          stepGroups.push({
            type: 'step-group',
            stepLabel: `${stepIdx(stepGroups.length)}  ${gateway} → ${accessSt}（バス・タクシー）`,
            cta: buildGoogleMapsLink(gateway, accessSt, 'transit',
                   `${gateway} → ${accessSt} の行き方を見る`),
            caution: null,
          });
        }
        if (!isAccessSameAsDest(accessSt, label) || !!city.mapPoint || !!city.finalPoint) {
          stepGroups.push(...buildLastSteps(accessSt, city, stepGroups.length));
        }
      } else if (!isAccessSameAsDest(accessSt, label) || !!city.mapPoint || !!city.finalPoint) {
        stepGroups.push(...buildLastSteps(accessSt, city, stepGroups.length));
      }
    }
    return buildLinksFromStepGroups(stepGroups, city, departure, fromCity);
  }

  // ① 鉄道 → railGateway（primary gateway 強制経由）
  {
    const hasNextStep = (gateway !== accessSt) || !isAccessSameAsDest(accessSt, label) || !!city.mapPoint || !!city.finalPoint;
    stepGroups.push({
      type: 'step-group',
      stepLabel: `${stepIdx(stepGroups.length)}  ${origin} → ${gateway}（鉄道）`,
      cta: null,
      caution: hasNextStep ? `▼ 電車はここまで。この先はバスに乗り換え` : null,
    });
  }

  // ② gateway → accessStation（異なる場合のみ：バス区間）
  if (gateway !== accessSt) {
    stepGroups.push({
      type: 'step-group',
      stepLabel: `${stepIdx(stepGroups.length)}  ${gateway} → ${accessSt}（バス・タクシー）`,
      cta: buildGoogleMapsLink(gateway, accessSt, 'transit',
             `${gateway} → ${accessSt} の行き方を見る`),
      caution: null,
    });
  }

  // ③ ラストマイル（accessStation と目的地が実質異なる場合、またはmapPoint/finalPointあり）
  if (!isAccessSameAsDest(accessSt, label) || !!city.mapPoint || !!city.finalPoint) {
    stepGroups.push(...buildLastSteps(accessSt, city, stepGroups.length));
  }

  return buildLinksFromStepGroups(stepGroups, city, departure, fromCity);
}

/**
 * island パターン: フェリー必須（離島・半島離島）。
 *   ① [飛行機] → ② 港アクセス（Googleマップ）→ ③ フェリー
 *
 *   飛行機がない場合: 港ハブ都市への移動（JR予約は hubCity の railProvider で補完）
 */
function buildIslandRoute(city, departure, fromCity) {
  const label    = cityLabel(city);
  const origin   = fromCity?.rail ?? departure;
  const fromIata = CITY_AIRPORT[departure] ?? null;

  const _hubAirportName = city.flightHub ? (AIRPORT_HUB_GATEWAY[city.flightHub] ?? null) : null;
  const isViaHub = !!(_hubAirportName && _hubAirportName !== city.airportGateway);
  const hasFlight = isFlightAllowed(city, departure) && !!(fromIata && (
    (city.airportGateway && hasFlightRoute(departure, city.airportGateway)) ||
    (isViaHub && _hubAirportName && hasFlightRoute(departure, _hubAirportName))
  ));

  const stepGroups = [];
  let usedFlight = false;
  let flightArrivalAirport = null;  // 飛行機到着空港名（フェリー乗り場への接続に使用）

  if (hasFlight) {
    const flightFrom = formatAirportLabel(fromCity?.airport) ?? departure;
    if (isViaHub && _hubAirportName) {
      usedFlight = true;
      stepGroups.push({
        type: 'step-group',
        stepLabel: `${stepIdx(stepGroups.length)}  ${flightFrom} → ${_hubAirportName}（飛行機）`,
        cta: null,
        caution: city.ferryGateway ? `▼ 到着後、フェリー乗り場へ` : null,
      });
      flightArrivalAirport = _hubAirportName;
      if (city.ferryGateway) {
        stepGroups.push({
          type: 'step-group',
          stepLabel: `${stepIdx(stepGroups.length)}  ${_hubAirportName} → ${city.ferryGateway}（Googleマップ）`,
          cta: buildGoogleMapsLink(_hubAirportName, city.ferryGateway,
                 resolveMapMode(_hubAirportName, city.ferryGateway),
                 `${_hubAirportName} → ${city.ferryGateway} の行き方を見る`),
          caution: null,
        });
      }
    } else if (city.airportGateway) {
      const flightCta = buildSkyscannerLink(fromIata, city.airportGateway);
      if (flightCta) {
        usedFlight = true;
        flightArrivalAirport = city.airportGateway;
        stepGroups.push({
          type: 'step-group',
          stepLabel: `${stepIdx(stepGroups.length)}  ${flightFrom} → ${city.airportGateway}（飛行機）`,
          cta: null,
          caution: city.ferryGateway ? `▼ 到着後、フェリー乗り場へ` : null,
        });
        if (city.ferryGateway && city.airportGateway !== city.ferryGateway) {
          stepGroups.push({
            type: 'step-group',
            stepLabel: `${stepIdx(stepGroups.length)}  ${city.airportGateway} → ${city.ferryGateway}（Googleマップ）`,
            cta: buildGoogleMapsLink(city.airportGateway, city.ferryGateway,
                   resolveMapMode(city.airportGateway, city.ferryGateway),
                   `${city.airportGateway} → ${city.ferryGateway} の行き方を見る`),
            caution: null,
          });
        }
      }
    }
  }

  // 飛行機なし → フェリー港へのアクセスを補完
  if (!usedFlight && city.ferryGateway) {
    const hubCity = PORT_CITY_MAP[city.ferryGateway] ?? null;
    if (hubCity && hubCity !== departure) {
      stepGroups.push({
        type: 'step-group',
        stepLabel: `${stepIdx(stepGroups.length)}  ${origin} → ${hubCity}（鉄道）`,
        cta: null,
        caution: `▼ 到着後、${city.ferryGateway}へ移動`,
      });
      stepGroups.push({
        type: 'step-group',
        stepLabel: `${stepIdx(stepGroups.length)}  ${hubCity} → ${city.ferryGateway}（Googleマップ）`,
        cta: buildGoogleMapsLink(hubCity, city.ferryGateway,
               resolveMapMode(hubCity, city.ferryGateway),
               `${hubCity} → ${city.ferryGateway} の行き方を見る`),
        caution: null,
      });
    } else if (!hubCity) {
      stepGroups.push({
        type: 'step-group',
        stepLabel: `${stepIdx(stepGroups.length)}  ${origin} → ${city.ferryGateway}（Googleマップ）`,
        cta: buildGoogleMapsLink(origin, city.ferryGateway,
               resolveMapMode(origin, city.ferryGateway),
               `${origin} → ${city.ferryGateway} の行き方を見る`),
        caution: null,
      });
    }
  }

  // フェリーステップ（booking CTA は main-cta として配置）
  if (city.ferryGateway) {
    stepGroups.push({
      type: 'step-group',
      stepLabel: `${stepIdx(stepGroups.length)}  ${city.ferryGateway} → ${label}（フェリー）`,
      cta: null, caution: null,
    });
  } else if (usedFlight && flightArrivalAirport) {
    /* フェリーなし・飛行機のみで島到着 → 空港から最終目的地へのラストマイルを必ず生成 */
    if (!isAccessSameAsDest(flightArrivalAirport, label) || !!city.finalPoint) {
      stepGroups.push(...buildLastSteps(flightArrivalAirport, city, stepGroups.length));
    }
  }

  return buildLinksFromStepGroups(stepGroups, city, departure, fromCity);
}

/**
 * Phase 7: 鉄道のみのステップ配列を生成するヘルパー（longDistance 代替ルート用）。
 * buildLinksFromStepGroups に渡す前の stepGroups を返す。
 */
function _buildRailOnlySteps(city, departure, fromCity) {
  const label    = cityLabel(city);
  const mTo      = mapTarget(city);
  const origin   = fromCity?.rail ?? departure;
  const accessSt = city.accessStation ?? city.railGateway ?? label;

  if (!city.railProvider) return null;

  const steps = [];
  steps.push({
    type: 'step-group',
    stepLabel: `${STEP_IDX[0]}  ${origin} → ${accessSt}（鉄道）`,
    cta: null, caution: null,
  });
  if (accessSt !== label) {
    steps.push({
      type: 'step-group',
      stepLabel: `${STEP_IDX[1]}  ${accessSt} → ${label}（Googleマップ）`,
      cta: buildGoogleMapsLink(accessSt, mTo, resolveMapMode(accessSt, mTo),
             `${accessSt} → ${label} の行き方を見る`),
      caution: null,
    });
  }
  return steps;
}

/**
 * buildRouteByPattern — destination メタデータの固定構造からルートを生成する。
 *
 * BFS・全探索・最短経路は一切使用しない。
 * 各 destination の gateway / accessStation フィールドのみで構造を決定する。
 *
 * @param {object} city     — 目的地エントリ
 * @param {string} departure — 出発都市名
 * @param {object} fromCity  — DEPARTURE_CITY_INFO エントリ
 * @returns {Array}          — links 配列（summary + step-groups）
 */
function buildRouteByPattern(city, departure, fromCity) {
  const routeType = classifyDestRouteType(city);
  switch (routeType) {
    case 'island':   return buildIslandRoute(city, departure, fromCity);
    case 'rural':    return buildRuralRoute(city, departure, fromCity);
    case 'suburban': return buildSuburbanRoute(city, departure, fromCity);
    case 'city':
    default:         return buildCityTypeRoute(city, departure, fromCity);
  }
}

/* routes.js ステップをフィルタして buildLinksFromRoutes に渡す共通ヘルパー */
function _resolveFromRoutes(city, departure, fromCity) {
  const departureRoute = ROUTES[`${city.id}@${departure}`];
  const defaultRoute   = ROUTES[city.id];

  function filterSteps(steps) {
    return steps.filter(step => {
      if (step.type === 'flight' && !hasFlightRoute(departure, step.to)) return false;
      if (step.type === 'flight' && !isFlightAllowed(city, departure))   return false;
      if (step.type === 'rail'   && step.duration !== undefined && step.duration < 40) return false;
      return true;
    });
  }

  if (departureRoute && fromCity) {
    return buildLinksFromRoutes(filterSteps(departureRoute), city, departure, fromCity);
  }
  if (defaultRoute && fromCity) {
    if (scoreRouteSteps(defaultRoute, departure, city) > 45) return null;
    return buildLinksFromRoutes(filterSteps(defaultRoute), city, departure, fromCity);
  }
  return null;
}

function _resolve(city, departure) {
  const fromCity = DEPARTURE_CITY_INFO[departure];

  /* ── Layer ② + ①: Route Resolver（BFS → Gateway DB） ── */
  const resolved = resolveRoute(departure, city);
  if (resolved?.steps?.length > 0) {
    return bfsStepsToLinks(resolved.steps, departure, city);
  }

  /* ── Layer ③ フォールバック: パターンビルダー ── */
  return buildRouteByPattern(city, departure, fromCity);
}

/* ══════════════════════════════════════════════════════
   公開 API
══════════════════════════════════════════════════════ */

/**
 * 目的地・出発地から step-group 配列を返す。
 * 結果が空の場合は Google Maps フォールバックを保証する。
 *
 * @param {object} city      — destinations.json エントリ
 * @param {string} departure — 出発都市名
 * @returns {Array}          — step-group 配列
 */
export function resolveTransportLinks(city, departure) {
  const links = _resolve(city, departure);
  if (!links || links.length === 0) {
    const fallbackCta = buildGoogleMapsLink(departure, city.name, 'transit', 'Googleマップで確認');
    return appendSpotAccessSteps([
      { type: 'summary',    transfers: 0 },
      { type: 'main-cta',  cta: fallbackCta },
      { type: 'step-group', stepLabel: `① ${departure} → ${cityLabel(city)}`, cta: fallbackCta, caution: null },
    ], city);
  }
  return appendSpotAccessSteps(links, city);  // Phase 4: ラストマイル追加
}
