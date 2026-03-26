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
} from './linkBuilder.js';
import { buildRoute } from '../engine/bfsEngine.js';
import PORTS_DATA       from '../data/ports.json'       with { type: 'json' };
import SPOT_ACCESS_DATA from '../data/spotAccess.json' with { type: 'json' };

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
  '大阪': '新大阪',
  '神戸': '新神戸',
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
    shinkansen: '🚄', rail: '🚃', flight: '✈',
    ferry: '🚢', bus: '🚌', car: '🚗', localMove: '📍',
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
  // rail / ferry / localMove / car
  const station = DEPARTURE_CITY_INFO[departure]?.rail;
  return station ? station.replace(/駅$/, '') : departure;
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

/** 特急列車名を汎用表記に正規化（私鉄はそのまま） */
function normalizeStepLabel(label, stepType, operator = '') {
  if (!label || stepType !== 'rail') return label;
  if (operator && !operator.startsWith('JR')) return label;
  if (label.includes('特急')) return 'JR（在来線特急）';
  return label;
}

function coords(city) {
  return (city.lat && city.lng) ? { lat: city.lat, lng: city.lng } : null;
}

function cityLabel(city) {
  return city.displayName || city.name;
}

const STEP_IDX = ['①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧'];
function stepIdx(i) {
  return STEP_IDX[i] ?? `${i + 1}.`;
}

const IC_CAUTION = 'ICカードでそのまま改札通れます（予約不要）';

/* ── Phase 4: spotAccess アイコン / ラベル ── */
const SPOT_TYPE_ICON  = { walk: '🚶', bus: '🚌', taxi: '🚕' };
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
    const icon  = SPOT_TYPE_ICON[sa.type]  ?? '📍';
    const label = SPOT_TYPE_LABEL[sa.type] ?? sa.type;
    links.push({
      type: 'step-group',
      stepLabel: `${stepIdx(baseIdx + i)} ${icon} ${sa.from} → ${sa.to}（${label} ${sa.minutes}分）`,
      cta: null,
      caution: null,
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

/* Phase 5: google-maps を除外 — Google Maps は各 step の補助リンクとしてのみ使用 */
/* Phase 6: bus / rental を追加 */
const MAIN_CTA_PRIORITY = [
  'jr-ex', 'jr-east', 'jr-west', 'jr-kyushu', 'jr-window',
  'skyscanner', 'google-flights',
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
      return { cta: buildJrLink(provider), caution: '※オンライン予約不可の場合はみどりの窓口をご利用ください' };
    }
    case 'rail': {
      // Phase 5: 在来線（私鉄・IC普通列車）はボタン不要
      if (step.operator && !step.operator.startsWith('JR')) {
        return { cta: null, caution: IC_CAUTION };
      }
      if (isIcRail(step)) {
        return { cta: null, caution: IC_CAUTION };
      }
      // JR特急など予約が必要な路線: buildJrLink を維持
      const provider = step.provider ?? operatorToProvider(step.operator ?? '');
      return { cta: buildJrLink(provider), caution: '※オンライン予約不可の場合はみどりの窓口をご利用ください' };
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
    case 'localMove':
      return { cta: buildGoogleMapsLink(step.from ?? '', step.to ?? '', 'transit', '📍 Googleマップで確認'), caution: null };
    case 'car':
      return { cta: buildGoogleMapsLink(step.from ?? '', step.to ?? '', 'driving', '📍 Googleマップで確認'), caution: null };
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
      return { cta: buildJrLink(provider), caution: '※オンライン予約不可の場合はみどりの窓口をご利用ください' };
    }
    case 'rail': {
      // Phase 5: 在来線（私鉄・IC普通列車）はボタン不要
      if (step.operator && !step.operator.startsWith('JR')) {
        return { cta: null, caution: IC_CAUTION };
      }
      if (isIcRail(step)) {
        return { cta: null, caution: IC_CAUTION };
      }
      return { cta: buildJrLink(operatorToProvider(step.operator ?? '')), caution: '※オンライン予約不可の場合はみどりの窓口をご利用ください' };
    }
    case 'flight': {
      const fromIata = CITY_AIRPORT[departure] || fromCity.iata;
      if (fromIata && step.to) return { cta: buildSkyscannerLink(fromIata, step.to) ?? null, caution: null };
      return { cta: null, caution: null };
    }
    case 'ferry':
      return { cta: buildFerryLink(step.from ?? from, step.ferryUrl ?? null, step.ferryOperator ?? null), caution: null };
    case 'bus':
      // Phase 6: 高速バスは bushikaku.net へ
      return { cta: buildHighwayBusLink(from, to), caution: null };
    case 'localMove': {
      const co = coords(city);
      return { cta: buildGoogleMapsLink(from, to, 'transit', '📍 Googleマップで確認', co), caution: null };
    }
    case 'car': {
      return { cta: buildGoogleMapsLink(from, to, 'driving', '📍 Googleマップで確認', coords(city)), caution: null };
    }
    default:
      return { cta: null, caution: null };
  }
}

/* ══════════════════════════════════════════════════════
   スコアリング（不自然なルートを自動生成に差し替え）
   スコア低 = より自然なルート
══════════════════════════════════════════════════════ */

function scoreRouteSteps(steps, departure) {
  const meaningful = steps.filter(s => s.type !== 'localMove' && s.type !== 'transfer');
  const transfers  = Math.max(0, meaningful.length - 1);
  let score = transfers * 10;

  if (transfers === 0) score -= 20; // 直通ボーナス

  const totalMinutes = steps.reduce((sum, s) => sum + (s.duration ?? 0), 0);
  if (totalMinutes > 0) score += Math.floor(totalMinutes / 30);

  if (departure === '高松' && steps.some(s => s.type === 'shinkansen' && s.to === '岡山')) {
    score += 100; // 高松発で岡山行き新幹線は禁止
  }

  const depArea = getArea(departure);
  if (depArea === '四国' && steps.some(s => s.type === 'shinkansen')) score += 20;

  const areasVisited = new Set();
  for (const s of meaningful) {
    const toArea = getArea(s.to);
    if (toArea) areasVisited.add(toArea);
  }
  if (depArea && areasVisited.size > 1 && areasVisited.has(depArea)) score += 50;

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
    stepGroups.push({ type: 'step-group', stepLabel, cta, caution });
    if (s.type === 'car') links.push(buildRentalLink());
    displayIdx++;
  }

  /* ── メインCTA 決定 ── */
  const mainCta = deriveMainCta(stepGroups);
  if (mainCta) {
    /* Phase 2: 重複CTA排除 — mainCta と同じ URL の step CTA を非表示 */
    for (const sg of stepGroups) {
      if (sg.cta?.url && mainCta.cta?.url && sg.cta.url === mainCta.cta.url) {
        sg.cta = null;
      }
    }

    /* Phase 2: bookingTarget（「○○まで予約して○○で○○へ」説明文）*/
    const firstMeaningful = meaningfulSteps[0];
    if (firstMeaningful && firstMeaningful.to !== cityLabel(city)) {
      const nextStep        = meaningfulSteps[1];
      const nextModeLabel   = nextStep
        ? { shinkansen: '新幹線', rail: '在来線', bus: 'バス',
            ferry: 'フェリー', flight: '飛行機', car: 'レンタカー', localMove: 'Googleマップ'
          }[nextStep.type] ?? '移動'
        : '移動';
      const firstModeLabel  = firstMeaningful.type === 'shinkansen' ? '新幹線'
                            : firstMeaningful.type === 'flight'     ? '飛行機'
                            : firstMeaningful.type === 'ferry'      ? 'フェリー'
                            : '電車';
      mainCta.bookingTarget = `${firstMeaningful.to}まで${firstModeLabel} → ${nextModeLabel}で${cityLabel(city)}へ`;
    }
    links.push(mainCta);
  }

  /* Phase 2: レンタカー補完（car step がなく needsCar/mountain/remote の場合のみ）*/
  const hasCar = steps.some(s => s.type === 'car');
  if (!hasCar && (city.needsCar || ['remote', 'mountain'].includes(city.destType))) {
    links.push(buildRentalLink());
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
    if (SHIKOKU_DEPARTURES_SET.has(departure)) return '岡山';
    const railName = fromCity.rail.replace(/駅$/, '');
    return CITY_TO_SHINKANSEN[railName] ?? CITY_TO_SHINKANSEN[departure] ?? railName;
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

  for (const step of routes) {
    const mode = normalizeStepLabel(step.label ?? stepTypeLabel(step.type), step.type, step.operator ?? '');

    const from = step.step === 1
      ? (step.type === 'shinkansen'
          ? shinkansenFrom()
          : step.type === 'flight'
            ? (formatAirportLabel(fromCity.airport) ?? departure)
            : fromCity.rail.replace(/駅$/, ''))
      : step.from ?? '';
    const to   = step.to ?? label;

    if ((step.type === 'shinkansen' || step.type === 'rail') && from === to) continue;

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
        stepLabel = `${stepIdx(displayIdx)} ${icon} ${step.from ?? from} → ${label}（フェリー）`; break;
      case 'car':
        stepLabel = `${stepIdx(displayIdx)} ${icon} ${from} → ${label}（レンタカー）`; break;
      case 'bus':
        stepLabel = `${stepIdx(displayIdx)} ${icon} ${from} → ${label}（${mode}）`; break;
      case 'localMove':
        stepLabel = `${stepIdx(displayIdx)} ${icon} ${step.from ?? from} → ${step.to ?? label}（Googleマップ）`; break;
      default:
        stepLabel = `${stepIdx(displayIdx)} ${icon} ${from} → ${to}（${mode}）`;
    }

    const { cta, caution } = routeStepToCta(step, from, to, departure, fromCity, city);
    stepGroups.push({ type: 'step-group', stepLabel, cta, caution });
    if (step.type === 'car') links.push(buildRentalLink());
    displayIdx++;
  }

  if (stepGroups.length === 0) {
    const fallbackCta = buildGoogleMapsLink(
      fromCity.rail.replace(/駅$/, ''), label, 'transit', '📍 Googleマップで確認', coords(city)
    );
    stepGroups.push({ type: 'step-group', stepLabel: `① ${departure} → ${label}`, cta: fallbackCta, caution: null });
  }

  /* Phase 2: needsCar / mountain / remote のみレンタカー表示 */
  if (city.needsCar || ['remote', 'mountain'].includes(city.destType)) links.push(buildRentalLink());

  const mainCta = deriveMainCta(stepGroups);
  if (mainCta) {
    /* Phase 2: 重複CTA排除 */
    for (const sg of stepGroups) {
      if (sg.cta?.url && mainCta.cta?.url && sg.cta.url === mainCta.cta.url) sg.cta = null;
    }
    const firstJrIdx = routes.findIndex(s => s.type === 'shinkansen' || s.type === 'rail');
    if (firstJrIdx !== -1) {
      const firstJrStep  = routes[firstJrIdx];
      const stepTo       = firstJrStep.to;
      const destName     = cityLabel(city);
      if (stepTo !== destName) {
        const nextStep      = routes[firstJrIdx + 1];
        const nextModeLabel = nextStep
          ? (nextStep.type === 'car'        ? 'レンタカー'
           : nextStep.type === 'bus'        ? 'バス'
           : nextStep.type === 'ferry'      ? 'フェリー'
           : nextStep.type === 'flight'     ? '飛行機'
           : nextStep.type === 'rail'       ? '在来線'
           : nextStep.type === 'shinkansen' ? '新幹線'
           : '移動')
          : '移動';
        const firstModeLabel = firstJrStep.type === 'shinkansen' ? '新幹線' : '電車';
        mainCta.bookingTarget = `${stepTo}まで${firstModeLabel} → ${nextModeLabel}で${destName}へ`;
      } else {
        mainCta.bookingTarget = `${stepTo}まで予約`;
      }
    }
    links.push(mainCta);
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
  const origin      = fromCity?.rail?.replace(/駅$/, '') ?? departure;
  const baseStation = (city.accessStation ?? city.railGateway ?? label).replace(/駅$/, '');
  const destSt      = city.shinkansenStation ?? baseStation;

  const stepGroups = [];

  /* ── 飛行機 ── */
  const fromIata   = CITY_AIRPORT[departure] ?? null;
  const hasFlight  = !!(city.airportGateway && fromIata &&
                        hasFlightRoute(departure, city.airportGateway));

  if (hasFlight) {
    const flightCta = buildSkyscannerLink(fromIata, city.airportGateway);
    if (flightCta) {
      const flightFrom = formatAirportLabel(fromCity?.airport) ?? departure;
      stepGroups.push({
        type: 'step-group',
        stepLabel: `${stepIdx(stepGroups.length)} ✈ ${flightFrom} → ${city.airportGateway}（飛行機）`,
        cta: flightCta, caution: null,
      });

      if (city.ferryGateway) {
        /* ── step補完: flight → ferry（空港 → 港）── */
        stepGroups.push({
          type: 'step-group',
          stepLabel: `${stepIdx(stepGroups.length)} ${city.airportGateway} → ${city.ferryGateway}（Googleマップ）`,
          cta: buildGoogleMapsLink(city.airportGateway, city.ferryGateway, 'transit', '📍 空港から港へ（Googleマップ）'),
          caution: null,
        });
      } else {
        /* ── step補完: flight → 観光地（空港 → 目的地）── */
        const co = city.lat && city.lng ? { lat: city.lat, lng: city.lng } : null;
        stepGroups.push({
          type: 'step-group',
          stepLabel: `${stepIdx(stepGroups.length)} ${city.airportGateway} → ${label}（Googleマップ）`,
          cta: buildGoogleMapsLink(city.airportGateway, label, 'transit',
                 `📍 ${label}への行き方（Googleマップ）`, co),
          caution: null,
        });
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
        const co = city.lat && city.lng ? { lat: city.lat, lng: city.lng } : null;
        stepGroups.push({
          type: 'step-group',
          stepLabel: `${stepIdx(stepGroups.length)} ${destSt} → ${label}（Googleマップ）`,
          cta: buildGoogleMapsLink(destSt, label, 'transit',
                 `📍 ${label}への行き方（Googleマップ）`, co),
          caution: null,
        });
      }
    }
  }

  /* ── フェリー ── */
  if (city.ferryGateway) {
    /* ── step補完: ferry のみ（飛行機なし）→ 港ハブ都市への経路を追加 ── */
    if (!hasFlight) {
      const hubCity = PORT_CITY_MAP[city.ferryGateway] ?? null;
      if (hubCity && hubCity !== departure) {
        /* departure → ハブ都市（Google Maps transit） */
        stepGroups.push({
          type: 'step-group',
          stepLabel: `${stepIdx(stepGroups.length)} ${departure} → ${hubCity}（交通手段で移動）`,
          cta: buildGoogleMapsLink(origin, hubCity, 'transit',
                 `📍 ${hubCity}への行き方（Googleマップ）`),
          caution: null,
        });
        /* ハブ都市 → 港（Google Maps） */
        stepGroups.push({
          type: 'step-group',
          stepLabel: `${stepIdx(stepGroups.length)} ${hubCity} → ${city.ferryGateway}（Googleマップ）`,
          cta: buildGoogleMapsLink(hubCity, city.ferryGateway, 'transit',
                 `📍 ${city.ferryGateway}（Googleマップ）`),
          caution: null,
        });
      } else if (!hubCity) {
        /* 未登録港 → 目的地まで Google Maps で */
        stepGroups.push({
          type: 'step-group',
          stepLabel: `${stepIdx(stepGroups.length)} ${departure} → ${city.ferryGateway}（Googleマップ）`,
          cta: buildGoogleMapsLink(origin, city.ferryGateway, 'transit',
                 `📍 ${city.ferryGateway}（Googleマップ）`),
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
    ? [buildRentalLink()] : [];

  /* ── Google Maps（フォールバック / 何もない場合）── */
  if (stepGroups.length === 0) {
    const gmapCta = buildGoogleMapsLink(
      fromCity?.rail ?? departure, destSt, 'transit', '📍 行き方を見る（Googleマップ）',
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
    /* Phase 2: 重複CTA排除 */
    for (const sg of stepGroups) {
      if (sg.cta?.url && mainCta.cta?.url && sg.cta.url === mainCta.cta.url) sg.cta = null;
    }
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
function isBfsRouteValid(steps, city) {
  const hasFlight = steps.some(s => s.type === 'flight');
  const hasFerry  = steps.some(s => s.type === 'ferry');

  // 飛行機ルートだが airportGateway がない → 陸路目的地への飛行機は不適切
  if (hasFlight && !city.airportGateway) return false;

  // railProvider がある（鉄道でアクセス可能）のに飛行機ルートが選ばれた
  // → ホップ数優先 BFS の誤選択。routes.js / buildAutoLinks の鉄道ルートを使う
  if (hasFlight && city.railProvider) return false;

  // ferryGateway がある（島や港目的地）のに ferry step がない
  // → グラフが ferry 経路を bus/localMove で省略している → 詳細 fallback を使う
  if (city.ferryGateway && !hasFerry) return false;

  return true;
}

function _resolve(city, departure) {
  /* ── Phase 1: transportGraph.json BFS を最優先で試みる ── */
  const bfsSteps = buildRoute(departure, city);
  if (bfsSteps.length > 0 && isBfsRouteValid(bfsSteps, city)) {
    return bfsStepsToLinks(bfsSteps, departure, city);
  }

  /* ── Fallback: routes.js 手動定義 or metadata 自動生成 ── */
  const departureRoute = ROUTES[`${city.id}@${departure}`];
  const defaultRoute   = ROUTES[city.id];
  const fromCity       = DEPARTURE_CITY_INFO[departure];

  if (departureRoute && fromCity) {
    const routes = departureRoute.filter(step => {
      if (step.type === 'flight' && !hasFlightRoute(departure, step.to)) return false;
      if (step.type === 'rail'   && step.duration !== undefined && step.duration < 40) return false;
      return true;
    });
    return buildLinksFromRoutes(routes, city, departure, fromCity);
  }

  if (defaultRoute && fromCity) {
    if (scoreRouteSteps(defaultRoute, departure) > 45) {
      return buildAutoLinks(city, departure, fromCity);
    }
    const routes = defaultRoute.filter(step => {
      if (step.type === 'flight' && !hasFlightRoute(departure, step.to)) return false;
      if (step.type === 'rail'   && step.duration !== undefined && step.duration < 40) return false;
      return true;
    });
    return buildLinksFromRoutes(routes, city, departure, fromCity);
  }

  return buildAutoLinks(city, departure, fromCity);
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
    const fallbackCta = buildGoogleMapsLink(departure, city.name, 'transit', '📍 Googleマップで確認');
    return appendSpotAccessSteps([
      { type: 'summary',    transfers: 0 },
      { type: 'main-cta',  cta: fallbackCta },
      { type: 'step-group', stepLabel: `① ${departure} → ${cityLabel(city)}`, cta: fallbackCta, caution: null },
    ], city);
  }
  return appendSpotAccessSteps(links, city);  // Phase 4: ラストマイル追加
}
