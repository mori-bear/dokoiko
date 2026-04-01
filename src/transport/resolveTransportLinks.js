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
import { DEPARTURE_CITY_INFO }          from '../config/constants.js';
import { CITY_AIRPORT }                 from '../utilities/airportMap.js';
import {
  buildGoogleMapsLink,
  buildSkyscannerLink,
  buildJrLink,
  buildFerryLink,
  buildFerryLinkForDest,
  buildRentalLink,
  buildHighwayBusLink,
  AIRPORT_HUB_GATEWAY,
  resolveMapMode,
} from './linkBuilder.js';
import { buildRoute } from '../engine/bfsEngine.js';
import { loadJson } from '../lib/loadJson.js';

/* `with { type: 'json' }` は Safari 17.2+ 限定のため loadJson() に切り替え（Safari 15+ 対応） */
const [PORTS_DATA, SPOT_ACCESS_DATA] = await Promise.all([
  loadJson('../data/ports.json',       import.meta.url),
  loadJson('../data/spotAccess.json', import.meta.url),
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

/* ── Phase 2: 交通モードアイコン ── */
function stepTypeIcon(type) {
  const M = {
    shinkansen: '', rail: '', flight: '',
    ferry: '', bus: '', car: '', localMove: '',
  };
  return M[type] ?? '';
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
    car: 'レンタカー',    ferry: 'フェリー', bus: 'バス', localMove: 'ローカル移動',
  };
  return MAP[type] ?? '';
}

/** 交通種別を表示用に正規化（列車名・路線名は非表示） */
function normalizeStepLabel(label, stepType, operator = '') {
  if (stepType === 'shinkansen') return '新幹線';
  if (stepType === 'rail') {
    if (operator && !operator.startsWith('JR')) return operator;
    return '電車';
  }
  return label;
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

const IC_CAUTION = 'ICカードでそのまま改札通れます（予約不要）';

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
   メイン CTA 導出
   優先順位: shinkansen > flight > ferry > rail > その他
══════════════════════════════════════════════════════ */

/* メイン CTA 優先順位:
 *   フライト > JR > フェリー > バス/レンタカー
 *
 *   フライトルートでは Skyscanner が最優先（JR の在来線は step 内で補助表示）。
 *   JR のみのルートでは JR 予約が最優先。
 *   google-maps は各 step の補助リンク専用（main-cta に昇格しない）。
 */
const MAIN_CTA_PRIORITY = [
  'skyscanner', 'google-flights',
  'jr-ex', 'jr-east', 'jr-west', 'jr-kyushu', 'jr-window',
  'ferry',
  'bus', 'rental',
];

function deriveMainCta(stepGroups) {
  let best = null;
  let bestPriority = Infinity;
  for (const sg of stepGroups) {
    if (!sg.cta?.url) continue;
    const idx = MAIN_CTA_PRIORITY.indexOf(sg.cta.type);
    if (idx === -1) continue;  // Phase 5: リストにない型（google-maps等）はmainCtaに昇格しない
    if (idx < bestPriority) { bestPriority = idx; best = sg.cta; }
  }
  return best ? { type: 'main-cta', cta: best } : null;
}

/* ══════════════════════════════════════════════════════
   step → CTA 変換（BFS ステップ用）
══════════════════════════════════════════════════════ */

function bfsStepToCta(step, departure) {
  switch (step.type) {
    case 'shinkansen': {
      // グラフ由来のステップは provider が直接設定されている
      const provider = step.provider ?? detectShinkansenProvider(step, departure);
      return { cta: buildJrLink(provider), caution: null };
    }
    case 'rail': {
      // 私鉄（JR以外の operator が明示されている）: IC乗車のみ・予約CTA不要
      if (step.operator && !step.operator.startsWith('JR')) {
        return { cta: null, caution: IC_CAUTION };
      }
      // JR（operator が JR で始まる / label に JR|新幹線|特急 を含む / operator 未設定）:
      // IC乗車可能な路線でも予約・購入ページへの導線として必ず CTA を表示する
      const provider = step.provider ?? operatorToProvider(step.operator ?? '');
      return { cta: buildJrLink(provider), caution: null };
    }
    case 'flight': {
      // グラフ由来: step.fromIata が直接設定される
      const fromIata = step.fromIata ?? CITY_AIRPORT[step.from] ?? CITY_AIRPORT[departure] ?? null;
      if (fromIata && step.to) return { cta: buildSkyscannerLink(fromIata, step.to) ?? null, caution: null };
      return { cta: null, caution: null };
    }
    case 'ferry': {
      // グラフ由来: step.destId がある場合は目的地IDベースの正確なフェリーリンク
      if (step.destId) {
        return { cta: buildFerryLinkForDest(step.destId, step.from ?? '', step.ferryUrl ?? null, step.ferryOperator ?? null), caution: null };
      }
      return { cta: buildFerryLink(step.from ?? '', step.ferryUrl ?? null, step.ferryOperator ?? null), caution: null };
    }
    case 'bus':
      // Phase 6: 高速バスは bushikaku.net へ
      return { cta: buildHighwayBusLink(step.from ?? departure, step.to ?? ''), caution: null };
    case 'localMove': {
      const from = step.from || '';
      const to   = step.to   || '';
      const mode = resolveMapMode(from, to);
      return { cta: buildGoogleMapsLink(from, to, mode, `${from} → ${to} の行き方を見る`), caution: null };
    }
    case 'car': {
      const from = step.from || '';
      const to   = step.to   || '';
      return { cta: buildGoogleMapsLink(from, to, 'driving', `${from} → ${to} の行き方を見る`), caution: null };
    }
    default:
      return { cta: null, caution: null };
  }
}

/* ══════════════════════════════════════════════════════
   step → CTA 変換（routes.js 手動定義ステップ用）
══════════════════════════════════════════════════════ */

function routeStepToCta(step, from, to, departure, fromCity, city) {
  switch (step.type) {
    case 'shinkansen': {
      const provider = detectShinkansenProvider(step, departure);
      return { cta: buildJrLink(provider), caution: null };
    }
    case 'rail': {
      // 私鉄（JR以外の operator が明示されている）: IC乗車のみ・予約CTA不要
      if (step.operator && !step.operator.startsWith('JR')) {
        return { cta: null, caution: IC_CAUTION };
      }
      // JR: IC乗車可能な路線でも予約・購入ページへの導線として必ず CTA を表示する
      return { cta: buildJrLink(operatorToProvider(step.operator ?? '')), caution: null };
    }
    case 'flight': {
      const fromIata = CITY_AIRPORT[departure] || fromCity.iata;
      if (fromIata && step.to) return { cta: buildSkyscannerLink(fromIata, step.to) ?? null, caution: null };
      return { cta: null, caution: null };
    }
    case 'ferry':
      return { cta: buildFerryLink(from, step.ferryUrl ?? null, step.ferryOperator ?? null), caution: null };
    case 'bus':
      // Phase 6: 高速バスは bushikaku.net へ
      return { cta: buildHighwayBusLink(from, to), caution: null };
    case 'localMove': {
      const co   = coords(city);
      const mode = resolveMapMode(from, to);
      return { cta: buildGoogleMapsLink(from, to, mode, `${from} → ${to} の行き方を見る`, co), caution: null };
    }
    case 'car': {
      return { cta: buildGoogleMapsLink(from, to, 'driving', `${from} → ${to} の行き方を見る`, coords(city)), caution: null };
    }
    default:
      return { cta: null, caution: null };
  }
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

  // 移動時間 200分未満（目安 〜300km）は飛行機不要
  // 200min = 在来線・新幹線で概ね300km相当
  const travelMin = city.travelTimeMinutes ?? 999;
  if (travelMin > 0 && travelMin < 200) return false;

  // 同一地方は飛行機不要（例: 九州 → 九州, 関東 → 関東）
  const depArea  = getArea(departure);
  const destArea = city.region ?? null;
  if (depArea && destArea && depArea === destArea) return false;

  return true;
}

/* ══════════════════════════════════════════════════════
   ルートパターン分類
   island       → 離島（フェリー必須）
   longDistance → 遠距離（240分以上 / 飛行機選択肢あり）
   local        → 近距離同一地域（鉄道のみで完結）
   city         → 標準都市間（新幹線・特急）
══════════════════════════════════════════════════════ */

/**
 * 目的地・出発地の組み合わせからルートパターンを分類する。
 *
 * @param {object} city      — 目的地エントリ（travelTimeMinutes 付きが望ましい）
 * @param {string} departure — 出発地名
 * @returns {'island'|'longDistance'|'local'|'city'}
 */
function classifyRoute(city, departure) {
  // 離島・ferryGateway があるものはフェリー経由が前提
  if (city.isIsland || city.destType === 'island' || city.ferryGateway) return 'island';

  const travelMin = city.travelTimeMinutes ?? 999;
  const depArea   = getArea(departure);
  const destArea  = city.region ?? null;

  // 同一地域かつ移動時間が短い → ローカル（BFS が得意）
  if (depArea && destArea && depArea === destArea && travelMin < 240) return 'local';

  // 240分以上 or flightHub 経由 → 遠距離
  if (travelMin >= 240 || city.flightHub) return 'longDistance';

  return 'city';
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

  /* ── step-group 生成 ── */
  const stepGroups = [];
  let displayIdx   = 0;
  for (let i = 0; i < steps.length; i++) {
    const s    = steps[i];
    const icon = stepTypeIcon(s.type);
    const mode = normalizeStepLabel(s.label ?? stepTypeLabel(s.type), s.type, s.operator ?? '');

    /* Phase 2: 出発点ラベル最適化（最初のステップのみ補正） */
    const fromLabel = i === 0
      ? getDepartureLabel(departure, s.type)
      : s.from ?? '';

    const stepLabel = `${stepIdx(displayIdx)} ${icon} ${fromLabel} → ${s.to}（${mode}）`;
    const { cta, caution } = bfsStepToCta(s, departure);
    const duration = (s.minutes && s.minutes > 0) ? s.minutes : null;
    // car ステップの rentalLink は step-group に埋め込む（ローカル移動セクション内で表示）
    const rentalLink = (s.type === 'car') ? buildRentalLink(fromLabel.replace(/駅$/, '')) : null;
    stepGroups.push({ type: 'step-group', stepLabel, cta, caution, duration, rentalLink });
    displayIdx++;
  }

  /* ── メインCTA（summary 用に保持、render.js では各 step-group CTA を使用）── */
  const mainCta = deriveMainCta(stepGroups);
  if (mainCta) {
    /* 統合ステップ表示: 各ステップが個別CTAを保持（重複除去なし）*/
    links.push(mainCta);
  }

  /* Phase 2: レンタカー補完（car step がなく needsCar/mountain/remote の場合のみ）*/
  const hasCar = steps.some(s => s.type === 'car');
  if (!hasCar && (city.needsCar || ['remote', 'mountain'].includes(city.destType))) {
    // 到着点（最終ステップの to）でレンタカー受取
    const lastHub = steps[steps.length - 1]?.to?.replace(/駅$/, '') ?? departure;
    links.push(buildRentalLink(lastHub));
  }

  /* フォールバック: 全ステップに CTA がない（IC在来線のみ等）→ 最終ステップに Google Maps を付与 */
  const hasAnyCta = stepGroups.some(sg => sg.cta?.url) || mainCta;
  if (!hasAnyCta && stepGroups.length > 0) {
    const label  = cityLabel(city);
    const mTo    = mapTarget(city);
    const lastSg = stepGroups[stepGroups.length - 1];
    const gFrom  = lastSg.stepLabel?.match(/[①-⑧\d+.]\s+\S+\s+(.+?) →/)?.[1] ?? departure;
    if (gFrom !== label) {
      lastSg.cta = buildGoogleMapsLink(
        gFrom, mTo, resolveMapMode(gFrom, mTo),
        `${gFrom} → ${label} の行き方を見る`,
      );
    }
  }

  links.push(...stepGroups);
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

  const stepGroups = [];
  let displayIdx   = 0;
  let prevStepTo   = null; // Problem 2: step[i].from は常に step[i-1].to を使う

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

    const { cta, caution } = routeStepToCta(step, from, to, departure, fromCity, city);
    // car ステップの rentalLink は step-group に埋め込む（ローカル移動セクション内で表示）
    const rentalLink = (step.type === 'car') ? buildRentalLink(from.replace(/駅$/, '')) : null;
    stepGroups.push({ type: 'step-group', stepLabel, cta, caution, rentalLink });
    prevStepTo = to;
    displayIdx++;
  }

  if (stepGroups.length === 0) {
    const _fbFromSt = fromCity.rail.replace(/駅$/, '');
    const fallbackCta = buildGoogleMapsLink(
      _fbFromSt, label, resolveMapMode(_fbFromSt, label), `${_fbFromSt} → ${label} の行き方を見る`, coords(city)
    );
    stepGroups.push({ type: 'step-group', stepLabel: `① ${departure} → ${label}`, cta: fallbackCta, caution: null });
  }

  /* Phase 2: needsCar / mountain / remote のみレンタカー表示（car step が既にある場合は追加しない） */
  const hasCar = routes.some(s => s.type === 'car');
  if (!hasCar && (city.needsCar || ['remote', 'mountain'].includes(city.destType))) {
    // 到着点（最終ルートステップの to）でレンタカー受取
    const lastHub = prevStepTo?.replace(/駅$/, '') ?? departure;
    links.push(buildRentalLink(lastHub));
  }

  const mainCta = deriveMainCta(stepGroups);
  if (mainCta) {
    /* 統合ステップ表示: 各ステップが個別CTAを保持（重複除去なし）*/
    links.push(mainCta);
  }

  /* no-CTA fallback: 全ステップにCTAがない場合（IC在来線のみ等）最終ステップにGoogle Maps追加 */
  const hasAnyCta = stepGroups.some(sg => sg.cta?.url) || links.some(l => l.type === 'main-cta' && l.cta?.url);
  if (!hasAnyCta && stepGroups.length > 0) {
    const mTo    = mapTarget(city);
    const lastSg = stepGroups[stepGroups.length - 1];
    const gFrom  = lastSg.stepLabel?.match(/[①-⑧\d+.]\s+\S+\s+(.+?) →/)?.[1] ?? departure;
    if (gFrom !== label) {
      lastSg.cta = buildGoogleMapsLink(
        gFrom, mTo, resolveMapMode(gFrom, mTo),
        `${gFrom} → ${label} の行き方を見る`,
      );
    }
  }

  links.push(...stepGroups);
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
          cta: flightCta, caution: null,
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
  const rentalLinks = (city.needsCar || ['remote', 'mountain'].includes(city.destType))
    ? [buildRentalLink(fromCity?.rail?.replace(/駅$/, '') ?? departure)] : [];

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
      const m = sg.stepLabel?.match(/^[①②③④⑤\d\.]+\s*[✈🚄🚃🚢🚌🚗📍]*\s*(.+?)\s*→\s*(.+?)（/u);
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

  const mainCta = deriveMainCta(stepGroups);
  if (mainCta) {
    /* 統合ステップ表示: 各ステップが個別CTAを保持（重複除去なし）*/
    links.push(mainCta);
  }
  links.push(...stepGroups);
  links.push(...rentalLinks);
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
 * step-group 配列 → links 配列（summary + main-cta + step-groups + rentals）。
 * buildAutoLinks / bfsStepsToLinks と同じ形式を返す。
 */
function buildLinksFromStepGroups(stepGroups, city, rentalLinks = []) {
  const pts = [];
  for (const sg of stepGroups) {
    if (sg._overview) continue; // 概要ステップは waypoints に含めない
    const m = sg.stepLabel?.match(/[①-⑧\d+.]+\s*\S*\s*(.+?)\s*→\s*(.+?)（/u);
    if (!m) continue;
    const from = m[1].trim(), to = m[2].trim();
    if (pts.length === 0) pts.push(from);
    if (to && to !== pts[pts.length - 1]) pts.push(to);
  }
  const waypoints = pts.length >= 2 ? pts : null;

  // 乗換回数: Google Maps / 概要 を除いた主要 CTA の数 - 1
  const mainSteps = stepGroups.filter(sg => {
    const ct = sg.cta?.type ?? '';
    return ['skyscanner','google-flights','jr-east','jr-west','jr-kyushu','jr-ex','jr-window','ferry','bus'].includes(ct);
  });
  const transfers = Math.max(0, mainSteps.length - 1);

  const links = [];
  links.push({
    type: 'summary',
    transfers,
    waypoints,
    stayRecommend: getStayRecommend(city),
    routeLabel:    getRouteLabel(transfers, city),
  });
  const mainCta = deriveMainCta(stepGroups);
  if (mainCta) links.push(mainCta);
  links.push(...stepGroups);
  links.push(...rentalLinks);
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

/**
 * city パターン: 新幹線 / 特急で到達できる標準距離目的地。
 *   ① Google Maps 概要
 *   ② JR 予約（accessStation まで）
 *   ③ accessStation → 目的地（Google Maps、駅≠目的地の場合のみ）
 */
function buildCityRoute(city, departure, fromCity) {
  const label    = cityLabel(city);
  const mTo      = mapTarget(city);
  const origin   = fromCity?.rail ?? departure;
  const accessSt = city.accessStation ?? city.railGateway ?? label;

  const stepGroups = [buildOverviewStep(departure, city, fromCity)];

  if (city.railProvider) {
    const jrCta = buildJrLink(city.railProvider);
    if (jrCta) {
      const fromDisp = origin.replace(/駅$/, '');
      const toDisp   = accessSt.replace(/駅$/, '');
      stepGroups.push({
        type: 'step-group',
        stepLabel: `${stepIdx(stepGroups.length)}  ${origin} → ${accessSt}（鉄道）`,
        cta: jrCta,
        caution: null,
        ctaLabel: `鉄道を予約する（${fromDisp} → ${toDisp}）`,
      });
      // Phase 5: accessStation と目的地が異なる場合のみラストマイルを追加
      if (accessSt !== label) {
        stepGroups.push({
          type: 'step-group',
          stepLabel: `${stepIdx(stepGroups.length)}  ${accessSt} → ${label}（Googleマップ）`,
          cta: buildGoogleMapsLink(accessSt, mTo, resolveMapMode(accessSt, mTo),
                 `${accessSt} → ${label} の行き方を見る`),
          caution: null,
        });
      }
    }
  }

  const rentalLinks = (city.needsCar || ['remote', 'mountain'].includes(city.destType))
    ? [buildRentalLink(accessSt.replace(/駅$/, ''))]
    : [];
  return buildLinksFromStepGroups(stepGroups, city, rentalLinks);
}

/**
 * longDistance パターン: 飛行機 or 新幹線の長距離移動。
 *   飛行機優先: ① Maps概要 → ② Skyscanner → ③ 空港 → 目的地
 *   飛行機不可: city パターンと同等（鉄道）
 */
function buildLongDistanceRoute(city, departure, fromCity) {
  const label    = cityLabel(city);
  const mTo      = mapTarget(city);
  const origin   = fromCity?.rail ?? departure;
  const fromIata = CITY_AIRPORT[departure] ?? null;

  const _hubAirportName = city.flightHub ? (AIRPORT_HUB_GATEWAY[city.flightHub] ?? null) : null;
  const isViaHub = !!(_hubAirportName && _hubAirportName !== city.airportGateway);
  const hasFlight = isFlightAllowed(city, departure) && !!(fromIata && (
    (city.airportGateway && hasFlightRoute(departure, city.airportGateway)) ||
    (isViaHub && _hubAirportName && hasFlightRoute(departure, _hubAirportName))
  ));

  const stepGroups = [buildOverviewStep(departure, city, fromCity)];

  if (hasFlight) {
    const flightFrom = formatAirportLabel(fromCity?.airport) ?? departure;

    if (isViaHub && _hubAirportName) {
      // ハブ経由乗り継ぎ
      stepGroups.push({
        type: 'step-group',
        stepLabel: `${stepIdx(stepGroups.length)}  ${flightFrom} → ${_hubAirportName}（飛行機）`,
        cta: buildSkyscannerLink(fromIata, _hubAirportName),
        caution: null,
      });
      const arrivalAirport = city.airportGateway ?? _hubAirportName;
      if (arrivalAirport !== _hubAirportName) {
        stepGroups.push({
          type: 'step-group',
          stepLabel: `${stepIdx(stepGroups.length)}  ${_hubAirportName} → ${arrivalAirport}（乗り継ぎ）`,
          cta: null,
          caution: '※乗り継ぎ便が必要です（ハブ空港で乗り換え）',
        });
      }
      if (arrivalAirport !== label) {
        stepGroups.push({
          type: 'step-group',
          stepLabel: `${stepIdx(stepGroups.length)}  ${arrivalAirport} → ${label}（Googleマップ）`,
          cta: buildGoogleMapsLink(arrivalAirport, mTo, resolveMapMode(arrivalAirport, mTo),
                 `${arrivalAirport} → ${label} の行き方を見る`),
          caution: null,
        });
      }
    } else if (city.airportGateway) {
      // 直行便
      const flightCta = buildSkyscannerLink(fromIata, city.airportGateway);
      if (flightCta) {
        stepGroups.push({
          type: 'step-group',
          stepLabel: `${stepIdx(stepGroups.length)}  ${flightFrom} → ${city.airportGateway}（飛行機）`,
          cta: flightCta, caution: null,
        });
        if (city.airportGateway !== label) {
          stepGroups.push({
            type: 'step-group',
            stepLabel: `${stepIdx(stepGroups.length)}  ${city.airportGateway} → ${label}（Googleマップ）`,
            cta: buildGoogleMapsLink(city.airportGateway, mTo, resolveMapMode(city.airportGateway, mTo),
                   `${city.airportGateway} → ${label} の行き方を見る`),
            caution: null,
          });
        }
      }
    }
  } else {
    // 鉄道ルート（city パターンと同等）
    const accessSt = city.accessStation ?? city.railGateway ?? label;
    if (city.railProvider) {
      const jrCta = buildJrLink(city.railProvider);
      if (jrCta) {
        const fromDisp = origin.replace(/駅$/, '');
        const toDisp   = accessSt.replace(/駅$/, '');
        stepGroups.push({
          type: 'step-group',
          stepLabel: `${stepIdx(stepGroups.length)}  ${origin} → ${accessSt}（鉄道）`,
          cta: jrCta, caution: null,
          ctaLabel: `鉄道を予約する（${fromDisp} → ${toDisp}）`,
        });
        if (accessSt !== label) {
          stepGroups.push({
            type: 'step-group',
            stepLabel: `${stepIdx(stepGroups.length)}  ${accessSt} → ${label}（Googleマップ）`,
            cta: buildGoogleMapsLink(accessSt, mTo, resolveMapMode(accessSt, mTo),
                   `${accessSt} → ${label} の行き方を見る`),
            caution: null,
          });
        }
      }
    }
  }

  const rentalLinks = (city.needsCar || ['remote', 'mountain'].includes(city.destType))
    ? [buildRentalLink((city.accessStation ?? label).replace(/駅$/, ''))]
    : [];
  return buildLinksFromStepGroups(stepGroups, city, rentalLinks);
}

/**
 * island パターン: フェリー必須（離島・半島離島）。
 *   ① Maps概要 → ② [飛行機→] ③ 港アクセス → ④ フェリー
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

  const stepGroups = [buildOverviewStep(departure, city, fromCity)];
  let usedFlight = false;

  if (hasFlight) {
    const flightFrom = formatAirportLabel(fromCity?.airport) ?? departure;
    if (isViaHub && _hubAirportName) {
      usedFlight = true;
      stepGroups.push({
        type: 'step-group',
        stepLabel: `${stepIdx(stepGroups.length)}  ${flightFrom} → ${_hubAirportName}（飛行機）`,
        cta: buildSkyscannerLink(fromIata, _hubAirportName),
        caution: null,
      });
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
        stepGroups.push({
          type: 'step-group',
          stepLabel: `${stepIdx(stepGroups.length)}  ${flightFrom} → ${city.airportGateway}（飛行機）`,
          cta: flightCta, caution: null,
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
        stepLabel: `${stepIdx(stepGroups.length)}  ${origin} → ${hubCity}（交通手段で移動）`,
        cta: buildGoogleMapsLink(origin, hubCity, resolveMapMode(origin, hubCity),
               `${origin} → ${hubCity} の行き方を見る`),
        caution: null,
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
    // departure === hubCity → 直接フェリーへ（追加ステップ不要）
  }

  // フェリーステップ（常に最後）
  if (city.ferryGateway) {
    const ferryCta = buildFerryLinkForDest(city.id, city.ferryGateway);
    stepGroups.push({
      type: 'step-group',
      stepLabel: `${stepIdx(stepGroups.length)}  ${city.ferryGateway} → ${label}（フェリー）`,
      cta: ferryCta, caution: null,
    });
  }

  return buildLinksFromStepGroups(stepGroups, city);
}

/**
 * local パターン: 同一地域の近距離移動。
 *   BFS 優先（ローカル鉄道に強い）。失敗時は gateway フォールバック。
 */
function buildLocalRoute(city, departure, fromCity) {
  // BFS を試みる（local のみ BFS 使用）
  const bfsSteps = buildRoute(departure, city);
  if (bfsSteps.length > 0 && isBfsRouteValid(bfsSteps, city, departure)) {
    return bfsStepsToLinks(bfsSteps, departure, city);
  }

  // BFS 失敗 → gateway フォールバック（city と同等）
  return buildCityRoute(city, departure, fromCity);
}

/**
 * buildRouteByPattern — パターン分類に基づく gateway 主導ルート生成。
 *
 * routes.js / BFS（local 以外）を使わず、目的地メタデータのみからルートを生成する。
 * 全パターンで ① Google Maps 概要 が先頭に配置される（Phase 4）。
 *
 * @param {object} city     — 目的地エントリ（classifyRoute 済みが望ましい）
 * @param {string} departure — 出発都市名
 * @param {object} fromCity  — DEPARTURE_CITY_INFO エントリ
 * @returns {Array}          — links 配列（summary + step-groups）
 */
function buildRouteByPattern(city, departure, fromCity) {
  const pattern = classifyRoute(city, departure);
  switch (pattern) {
    case 'island':       return buildIslandRoute(city, departure, fromCity);
    case 'local':        return buildLocalRoute(city, departure, fromCity);
    case 'longDistance': return buildLongDistanceRoute(city, departure, fromCity);
    case 'city':
    default:             return buildCityRoute(city, departure, fromCity);
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
  // gateway 主導ルート生成（Phase 1–5）
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
