/**
 * 交通リンクアセンブラ — routes.js 唯一参照
 *
 * 出力フォーマット（step-group方式）:
 *   [
 *     { type: 'summary', transfers: N },
 *     { type: 'main-cta', cta: {...} },          // ルート全体の最重要CTA（shinkansen>flight>ferry>rail）
 *     { type: 'step-group', stepLabel, cta, caution },  // 区間ごとCTA
 *     ...
 *     { type: 'rental', ... },                   // 車ステップがある場合のみ
 *   ]
 *
 * step type と CTA の対応:
 *   shinkansen(東海道・山陽) → EXで予約する
 *   shinkansen(JR東)        → えきねっとで予約する
 *   rail(IC可)              → Googleマップ + 「ICカードでそのまま改札通れます（予約不要）」
 *   rail(特急)              → JR予約リンク
 *   flight                  → Skyscanner
 *   ferry                   → フェリー予約リンク
 *   bus                     → Googleマップ（transit）
 *   car                     → Googleマップ（driving）+ 別途 rental リンク
 *   localMove               → Googleマップ（transit）
 */

import { ROUTES, CITY_TO_SHINKANSEN } from './routes.js';
import { DEPARTURE_CITY_INFO } from '../../config/constants.js';
import { CITY_AIRPORT }        from '../../utilities/airportMap.js';
import {
  buildGoogleMapsLink,
  buildSkyscannerLink,
  buildJrLink,
  buildFerryLink,
  buildRentalLink,
} from '../../transport/linkBuilder.js';
import { buildRoute } from '../../engine/bfsEngine.js';

/* ── 就航路線DB（Node.js / ブラウザ 両対応） ── */
let FLIGHT_ROUTES = [];
if (typeof process !== 'undefined' && process.versions?.node) {
  // Node.js（テストスクリプト）
  const { readFileSync }  = await import('fs');
  const { fileURLToPath } = await import('url');
  const { dirname, join } = await import('path');
  const _root = join(dirname(fileURLToPath(import.meta.url)), '../../../');
  FLIGHT_ROUTES = JSON.parse(readFileSync(join(_root, 'data/flightRoutes.json'), 'utf8'));
} else {
  // ブラウザ — import.meta.url を基点にフェッチ
  const _url = new URL('../../../data/flightRoutes.json', import.meta.url);
  FLIGHT_ROUTES = await fetch(_url).then(r => r.json());
}

/** 出発地 → 到着空港名 の就航路線が存在するか */
function hasFlightRoute(departure, airportName) {
  return FLIGHT_ROUTES.some(r => r.from === departure && r.to === airportName);
}

/* ── JR会社名 → 予約システムID ── */
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

/* ── 新幹線ラインDB ── */
/** 新幹線として扱う路線名の正規DB（マリンライナー等の誤判定防止） */
const SHINKANSEN_LINES = [
  '東海道新幹線', '山陽新幹線', '東北新幹線', '北陸新幹線', '九州新幹線',
  '山形新幹線', '秋田新幹線', '上越新幹線', '北海道新幹線',
];

/** 路線名 → 予約システムID マップ */
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

/** step.label が正規新幹線路線名かどうかを判定する */
function isShinkansenLine(label) {
  return SHINKANSEN_LINES.some(line => label.includes(line));
}

/**
 * 新幹線ステップの予約プロバイダを判定する。
 * ① 出発エリアが西日本圏（四国/関西/中国/九州）→ e5489（最優先・EX誤爆防止）
 * ② JR東日本系路線（東北/上越/北海道/山形/秋田）→ ekinet
 * ③ 東海道・山陽（関東/東北/北海道/中部発）→ EX
 * ④ 路線名マップ → オペレーター フォールバック
 * @param {object} step - ルートステップ
 * @param {string} [departure] - 出発都市名
 */
function detectShinkansenProvider(step, departure) {
  const label = step.label ?? '';
  const depArea = departure ? getArea(departure) : null;

  // ① 出発エリアが西日本圏 → 常に e5489（高松/大阪/広島/福岡発など）
  if (['四国', '関西', '中国', '九州'].includes(depArea)) return 'e5489';

  // ② JR東日本系路線 → 常に ekinet（出発地問わず）
  const JR_EAST_ONLY = ['東北新幹線', '上越新幹線', '北海道新幹線', '山形新幹線', '秋田新幹線'];
  if (JR_EAST_ONLY.some(l => label.includes(l))) return 'ekinet';

  // ③ 東海道・山陽（非西日本出発）→ EX
  if ((label.includes('東海道') || label.includes('山陽')) && !label.includes('九州')) return 'ex';

  // ④ 路線名マップ（完全一致 → 部分一致）
  if (SHINKANSEN_LINE_PROVIDER[label]) return SHINKANSEN_LINE_PROVIDER[label];
  for (const [line, provider] of Object.entries(SHINKANSEN_LINE_PROVIDER)) {
    if (label.includes(line)) return provider;
  }
  return operatorToProvider(step.operator ?? '');
}

/**
 * IC乗車可能な在来線かどうか判定する（特急・急行・ライナー系は予約必要）。
 * マリンライナーはICカード乗車可能なので IC扱いにする。
 */
function isIcRail(step) {
  const label = step.label ?? '';
  if (label.includes('マリンライナー')) return true;  // マリンライナーはIC可
  return !label.match(/特急|急行|エクスプレス|ライナー/);
}

/* ── step.type → 日本語モード名 ── */
function stepTypeLabel(type) {
  if (type === 'shinkansen') return '新幹線';
  if (type === 'rail')       return '電車';
  if (type === 'flight')     return '飛行機';
  if (type === 'car')        return 'レンタカー';
  if (type === 'ferry')      return 'フェリー';
  if (type === 'bus')        return 'バス';
  if (type === 'localMove')  return 'ローカル移動';
  return '';
}

/** 特急列車名を汎用表記に正規化する（しおかぜ/能登かがり火 → JR（在来線特急）等） */
function normalizeStepLabel(label, stepType, operator = '') {
  if (!label || stepType !== 'rail') return label;
  // 私鉄はそのまま表示
  if (operator && !operator.startsWith('JR')) return label;
  // 「特急」を含む列車名はすべて汎用表記に統一
  if (label.includes('特急')) return 'JR（在来線特急）';
  return label;
}

/* ─────────────────────────────────────────────────
   ルートスコアリング（自然さ優先選択）
   スコア低 = より自然なルート
   ─ 乗換回数 × 10
   ─ エリア跨ぎ（本州↔四国など）+50
   ─ 不自然な遠回り（同エリアを中間経由）+30
───────────────────────────────────────────────── */

const AREA_REGION = {
  // 北海道
  '札幌':'北海道','函館':'北海道','旭川':'北海道','小樽':'北海道','新千歳空港':'北海道',
  // 東北
  '仙台':'東北','盛岡':'東北','八戸':'東北','青森':'東北','秋田':'東北','山形':'東北','福島':'東北',
  // 関東
  '東京':'関東','横浜':'関東','大宮':'関東','千葉':'関東','宇都宮':'関東','水戸':'関東',
  // 中部
  '長野':'中部','静岡':'中部','名古屋':'中部','金沢':'中部','富山':'中部','新潟':'中部',
  '岐阜':'中部','浜松':'中部','松本':'中部','甲府':'中部','敦賀':'中部',
  // 近畿
  '大阪':'近畿','京都':'近畿','神戸':'近畿','奈良':'近畿','和歌山':'近畿','津':'近畿',
  '新大阪':'近畿','三ノ宮':'近畿',
  // 中国
  '広島':'中国','岡山':'中国','松江':'中国','鳥取':'中国','山口':'中国','新山口':'中国',
  // 四国
  '高松':'四国','松山':'四国','高知':'四国','徳島':'四国',
  // 九州
  '福岡':'九州','博多':'九州','熊本':'九州','鹿児島':'九州','長崎':'九州','宮崎':'九州',
  '大分':'九州','佐賀':'九州','小倉':'九州',
};

function getArea(nameOrStation) {
  return AREA_REGION[nameOrStation?.replace(/駅$/, '')] ?? null;
}

/**
 * ルートステップ配列の「不自然さスコア」を返す。
 * 低いほどユーザーにとって自然なルート。
 * @param {Array} steps - routes.js ステップ配列
 * @param {string} departure - 出発都市名
 * @returns {number}
 */
function scoreRouteSteps(steps, departure) {
  const meaningful = steps.filter(s => s.type !== 'localMove' && s.type !== 'transfer');
  const transfers = Math.max(0, meaningful.length - 1);
  let score = transfers * 10; // 乗換回数ペナルティ

  // 直通ボーナス
  if (transfers === 0) score -= 20;

  // 総移動時間による調整（duration があるステップのみ）
  const totalMinutes = steps.reduce((sum, s) => sum + (s.duration ?? 0), 0);
  if (totalMinutes > 0) score += Math.floor(totalMinutes / 30); // 30分ごと +1

  // 高松発で岡山行き新幹線ルートを禁止（マリンライナー=在来線が正解）
  if (departure === '高松' && steps.some(s => s.type === 'shinkansen' && s.to === '岡山')) {
    score += 100;
  }

  const depArea = getArea(departure);

  // 四国発で新幹線あり → 在来線ルート優先（軽ペナルティ）
  if (depArea === '四国' && steps.some(s => s.type === 'shinkansen')) {
    score += 20;
  }

  const areasVisited = new Set();
  for (const s of meaningful) {
    const toArea = getArea(s.to);
    if (toArea) areasVisited.add(toArea);
  }

  // エリア跨ぎ検出：出発地エリアと同じエリアを中間に「迂回」している場合 +50
  if (depArea && areasVisited.size > 1 && areasVisited.has(depArea)) {
    score += 50;
  }

  // エリアを逆戻り（同エリア2回通過 +30）
  let prevArea = depArea;
  const visitedInOrder = [];
  for (const s of meaningful) {
    const toArea = getArea(s.to);
    if (toArea && toArea !== prevArea) {
      if (visitedInOrder.includes(toArea)) {
        score += 30;
      }
      visitedInOrder.push(toArea);
      prevArea = toArea;
    }
  }

  return score;
}

/* ── 座標ヘルパー ── */
function coords(city) {
  return (city.lat && city.lng) ? { lat: city.lat, lng: city.lng } : null;
}

/* ── 表示名ヘルパー ── */
function cityLabel(city) {
  return city.displayName || city.name;
}

/* ── ステップインデックス文字 ── */
const STEP_IDX = ['①', '②', '③', '④', '⑤'];
function stepIdx(i) {
  return STEP_IDX[i] ?? `${i + 1}.`;
}

/* ── IC区間の注記テキスト ── */
const IC_CAUTION = 'ICカードでそのまま改札通れます（予約不要）';

/* ─────────────────────────────────────────────────
   ルート全体メインCTA導出
   優先順位: shinkansen > flight > ferry > rail > その他
───────────────────────────────────────────────── */

const MAIN_CTA_PRIORITY = [
  // shinkansen 系
  'jr-ex', 'jr-east', 'jr-west', 'jr-kyushu', 'jr-window',
  // flight
  'skyscanner', 'google-flights',
  // ferry
  'ferry',
  // rail / その他
  'google-maps', 'bus', 'rental',
];

/**
 * step-group 配列からルート全体のメインCTAを1つ選ぶ。
 * @param {Array} stepGroups
 * @returns {{ type: 'main-cta', cta: object } | null}
 */
function deriveMainCta(stepGroups) {
  let best = null;
  let bestPriority = Infinity;

  for (const sg of stepGroups) {
    if (!sg.cta?.url) continue;
    const idx = MAIN_CTA_PRIORITY.indexOf(sg.cta.type);
    const pri = idx === -1 ? MAIN_CTA_PRIORITY.length : idx;
    if (pri < bestPriority) {
      bestPriority = pri;
      best = sg.cta;
    }
  }

  return best ? { type: 'main-cta', cta: best } : null;
}

/* ─────────────────────────────────────────────────
   BFS ステップ → CTA（1ステップ分）
───────────────────────────────────────────────── */

/**
 * BFSエンジンが返すステップから CTA を生成する。
 * @returns {{ cta: object|null, caution: string|null }}
 */
function bfsStepToCta(step, departure) {
  switch (step.type) {
    case 'shinkansen': {
      const provider = detectShinkansenProvider(step, departure);
      return { cta: buildJrLink(provider), caution: '※オンライン予約不可の場合はみどりの窓口をご利用ください' };
    }
    case 'rail': {
      if (step.operator && !step.operator.startsWith('JR')) {
        /* 私鉄 → Googleマップ */
        return {
          cta: buildGoogleMapsLink(step.from, step.to, 'transit', '📍 Googleマップで確認'),
          caution: null,
        };
      }
      if (isIcRail(step)) {
        return {
          cta: buildGoogleMapsLink(step.from, step.to, 'transit', '📍 Googleマップで確認'),
          caution: IC_CAUTION,
        };
      }
      const provider = operatorToProvider(step.operator ?? '');
      return { cta: buildJrLink(provider), caution: '※オンライン予約不可の場合はみどりの窓口をご利用ください' };
    }
    case 'flight': {
      const fromIata = CITY_AIRPORT[step.from] ?? CITY_AIRPORT[departure] ?? null;
      if (fromIata && step.to) {
        const cta = buildSkyscannerLink(fromIata, step.to);
        return { cta: cta ?? null, caution: null };
      }
      return { cta: null, caution: null };
    }
    case 'ferry': {
      const cta = buildFerryLink(step.from ?? '', step.ferryUrl ?? null, step.ferryOperator ?? null);
      return { cta, caution: null };
    }
    case 'bus':
    case 'localMove': {
      const cta = buildGoogleMapsLink(step.from ?? '', step.to ?? '', 'transit', '📍 Googleマップで確認');
      return { cta, caution: null };
    }
    case 'car': {
      const cta = buildGoogleMapsLink(step.from ?? '', step.to ?? '', 'driving', '📍 Googleマップで確認');
      return { cta, caution: null };
    }
    default:
      return { cta: null, caution: null };
  }
}

/* ─────────────────────────────────────────────────
   routes.js ステップ → CTA（1ステップ分）
───────────────────────────────────────────────── */

function routeStepToCta(step, from, to, departure, fromCity, city) {
  switch (step.type) {
    case 'shinkansen': {
      const provider = detectShinkansenProvider(step, departure);
      return { cta: buildJrLink(provider), caution: '※オンライン予約不可の場合はみどりの窓口をご利用ください' };
    }
    case 'rail': {
      // 私鉄・第三セクター → Googleマップのみ（JR予約リンク不要）
      if (step.operator && !step.operator.startsWith('JR')) {
        return {
          cta: buildGoogleMapsLink(from, to, 'transit', '📍 Googleマップで確認'),
          caution: null,
        };
      }
      if (isIcRail(step)) {
        return {
          cta: buildGoogleMapsLink(from, to, 'transit', '📍 Googleマップで確認'),
          caution: IC_CAUTION,
        };
      }
      const provider = operatorToProvider(step.operator ?? '');
      return { cta: buildJrLink(provider), caution: '※オンライン予約不可の場合はみどりの窓口をご利用ください' };
    }
    case 'flight': {
      const fromIata = CITY_AIRPORT[departure] || fromCity.iata;
      if (fromIata && step.to) {
        const cta = buildSkyscannerLink(fromIata, step.to);
        return { cta: cta ?? null, caution: null };
      }
      return { cta: null, caution: null };
    }
    case 'ferry': {
      const cta = buildFerryLink(step.from ?? from, step.ferryUrl ?? null, step.ferryOperator ?? null);
      return { cta, caution: null };
    }
    case 'bus':
    case 'localMove': {
      const co = coords(city);
      const cta = buildGoogleMapsLink(from, to, 'transit', '📍 Googleマップで確認', step.type === 'localMove' ? co : null);
      return { cta, caution: null };
    }
    case 'car': {
      const co = coords(city);
      const cta = buildGoogleMapsLink(from, to, 'driving', '📍 Googleマップで確認', co);
      return { cta, caution: null };
    }
    default:
      return { cta: null, caution: null };
  }
}

/* ─────────────────────────────────────────────────
   メインエントリ
───────────────────────────────────────────────── */
export function resolveTransportLinks(city, departure) {
  const links = _resolveTransportLinks(city, departure);
  if (!links || links.length === 0) {
    const fallbackCta = {
      type:  'google-maps',
      label: '📍 Googleマップで確認',
      url:   `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(departure)}&destination=${encodeURIComponent(city.name)}&travelmode=transit`,
    };
    return [
      { type: 'summary', transfers: 0 },
      { type: 'main-cta', cta: fallbackCta },
      { type: 'step-group', stepLabel: `① ${departure} → ${city.displayName || city.name}`, cta: fallbackCta, caution: null },
    ];
  }
  return links;
}

/* ─────────────────────────────────────────────────
   destination metadata から自動リンク生成
   ROUTES 未定義・gateway 未設定の destination 用
   「準備中」は絶対に返さない
───────────────────────────────────────────────── */
function buildAutoLinks(city, departure, fromCity) {
  const label  = cityLabel(city);
  const origin = fromCity?.rail?.replace(/駅$/, '') ?? departure;
  const baseStation = (city.accessStation ?? city.railGateway ?? label).replace(/駅$/, '');
  // 新幹線降車駅が設定されている場合はそちらを優先（例: 下関 → 新下関）
  const destSt = city.shinkansenStation ?? baseStation;

  const stepGroups = [];

  /* ── 飛行機（airportGateway あり + 就航路線DB 一致） ── */
  if (city.airportGateway) {
    const fromIata = CITY_AIRPORT[departure] ?? null;
    if (fromIata && hasFlightRoute(departure, city.airportGateway)) {
      const flightCta = buildSkyscannerLink(fromIata, city.airportGateway);
      if (flightCta) {
        stepGroups.push({
          type: 'step-group',
          stepLabel: `① ${departure} → ${city.airportGateway}（飛行機）`,
          cta: flightCta,
          caution: null,
        });
      }
    }
  }

  /* ── JR 予約（railProvider 設定あり） ── */
  if (city.railProvider) {
    const jrCta = buildJrLink(city.railProvider);
    if (jrCta) {
      stepGroups.push({
        type: 'step-group',
        stepLabel: `① ${origin} → ${destSt}（鉄道）`,
        cta: jrCta,
        caution: null,
      });
    }
  }

  /* ── フェリー（ferryGateway あり） ── */
  if (city.ferryGateway) {
    const ferryCta = buildFerryLink(city.ferryGateway);
    stepGroups.push({
      type: 'step-group',
      stepLabel: `② ${city.ferryGateway} → ${label}（フェリー）`,
      cta: ferryCta,
      caution: null,
    });
  }

  /* ── Google Maps（常時保証） ── */
  const gmapCta = buildGoogleMapsLink(
    fromCity?.rail ?? departure,
    destSt,
    'transit',
    '📍 行き方を見る（Googleマップ）',
    city.lat && city.lng ? { lat: city.lat, lng: city.lng } : null,
  );
  stepGroups.push({
    type: 'step-group',
    stepLabel: `① ${departure} → ${label}（Googleマップ）`,
    cta: gmapCta,
    caution: null,
  });

  const links = [];
  links.push({ type: 'summary', transfers: Math.max(0, stepGroups.length - 1) });
  const mainCta = deriveMainCta(stepGroups);
  if (mainCta) links.push(mainCta);
  links.push(...stepGroups);
  return links;
}

function _resolveTransportLinks(city, departure) {
  /* ── BFS優先（destination に gateway が設定されている場合） ── */
  if (city.gateway) {
    const rawSteps = buildRoute(departure, city);
    // fallbackケース: すでにリンクオブジェクト（url あり）
    if (rawSteps[0]?.url) return rawSteps;
    return bfsStepsToLinks(rawSteps, departure, city);
  }

  /* ── routes.js（出発地別 → 汎用の順で参照） ── */
  const departureRoute = ROUTES[`${city.id}@${departure}`]; // 出発地特例ルート（最優先）
  const defaultRoute   = ROUTES[city.id];
  const fromCity       = DEPARTURE_CITY_INFO[departure];

  // 出発地特例ルートがあれば無条件採用（スコアリング不要）
  if (departureRoute && fromCity) {
    const routes = departureRoute.filter(step => {
      if (step.type === 'flight' && !hasFlightRoute(departure, step.to)) return false;
      if (step.type === 'rail' && step.duration !== undefined && step.duration < 40) return false;
      return true;
    });
    return buildLinksFromRoutes(routes, city, departure, fromCity);
  }

  // 汎用ルートがある場合: スコアリングで「不自然さ」を評価
  // スコアが高い（エリア跨ぎ等）場合は buildAutoLinks を優先
  if (defaultRoute && fromCity) {
    const routeScore = scoreRouteSteps(defaultRoute, departure);
    const SCORE_THRESHOLD = 45; // エリア跨ぎ1回（+50）を超えたら自動生成優先
    if (routeScore > SCORE_THRESHOLD) {
      return buildAutoLinks(city, departure, fromCity);
    }
    const routes = defaultRoute.filter(step => {
      if (step.type === 'flight' && !hasFlightRoute(departure, step.to)) return false;
      if (step.type === 'rail' && step.duration !== undefined && step.duration < 40) return false;
      return true;
    });
    return buildLinksFromRoutes(routes, city, departure, fromCity);
  }

  /* ROUTES 未定義 または 出発地未登録: metadata から自動生成（「準備中」禁止） */
  return buildAutoLinks(city, departure, fromCity);
}

/* ─────────────────────────────────────────────────
   BFS ステップ → リンク配列（区間ごとCTA方式）
───────────────────────────────────────────────── */
function bfsStepsToLinks(steps, departure, city) {
  const links = [];

  /* サマリー（乗換回数） */
  const meaningfulSteps = steps.filter(s => s.type !== 'localMove');
  links.push({ type: 'summary', transfers: Math.max(0, meaningfulSteps.length - 1) });

  /* 区間ごとCTA */
  const stepGroups = [];
  for (let i = 0; i < steps.length; i++) {
    const s    = steps[i];
    const idx  = stepIdx(i);
    const mode = normalizeStepLabel(s.label ?? stepTypeLabel(s.type), s.type, s.operator ?? '');
    const stepLabel = `${idx} ${s.from} → ${s.to}（${mode}）`;

    const { cta, caution } = bfsStepToCta(s, departure);
    const sg = { type: 'step-group', stepLabel, cta, caution };
    stepGroups.push(sg);

    /* 車ステップ: rental を別途追加 */
    if (s.type === 'car') {
      links.push(buildRentalLink());
    }
  }

  /* メインCTA（最重要ボタン）を先頭付近に挿入 */
  const mainCta = deriveMainCta(stepGroups);
  if (mainCta) links.push(mainCta);
  links.push(...stepGroups);

  return links.filter(Boolean);
}

/* ─────────────────────────────────────────────────
   ルートステップ → リンク配列（区間ごとCTA方式）
───────────────────────────────────────────────── */
function buildLinksFromRoutes(routes, city, departure, fromCity) {
  const label = cityLabel(city);
  const links = [];

  /* ── 新幹線乗車駅を解決（大阪→新大阪 等） ── */
  function shinkansenFrom() {
    const railName = fromCity.rail.replace(/駅$/, '');
    return CITY_TO_SHINKANSEN[railName] ?? CITY_TO_SHINKANSEN[departure] ?? railName;
  }

  /* サマリー（乗換回数） */
  const meaningfulSteps = routes.filter(s => s.type !== 'localMove');
  links.push({ type: 'summary', transfers: Math.max(0, meaningfulSteps.length - 1) });

  /* 区間ごとCTA */
  const stepGroups = [];
  let displayIdx = 0;

  for (const step of routes) {
    const mode = normalizeStepLabel(step.label ?? stepTypeLabel(step.type), step.type, step.operator ?? '');

    /* 出発地の解決 */
    const from = step.step === 1
      ? ((step.type === 'shinkansen') ? shinkansenFrom() : fromCity.rail.replace(/駅$/, ''))
      : step.from ?? '';
    const to = step.to ?? label;

    /* 出発地 = 到着地 のステップはスキップ（大阪→新大阪 等） */
    if ((step.type === 'shinkansen' || step.type === 'rail') && from === to) continue;

    /* ステップラベル */
    let stepLabel;
    switch (step.type) {
      case 'shinkansen':
      case 'rail':
        stepLabel = `${stepIdx(displayIdx)} ${from} → ${to}（${mode}）`;
        break;
      case 'flight':
        stepLabel = `${stepIdx(displayIdx)} ${departure} → ${to}（飛行機）`;
        break;
      case 'ferry':
        stepLabel = `${stepIdx(displayIdx)} ${step.from ?? from} → ${label}（フェリー）`;
        break;
      case 'car':
        stepLabel = `${stepIdx(displayIdx)} ${from} → ${label}（レンタカー）`;
        break;
      case 'bus':
        stepLabel = `${stepIdx(displayIdx)} ${from} → ${label}（${mode}）`;
        break;
      case 'localMove':
        stepLabel = `${stepIdx(displayIdx)} ${step.from ?? from} → ${step.to ?? label}（Googleマップ）`;
        break;
      default:
        stepLabel = `${stepIdx(displayIdx)} ${from} → ${to}（${mode}）`;
    }

    const { cta, caution } = routeStepToCta(step, from, to, departure, fromCity, city);
    const sg = { type: 'step-group', stepLabel, cta, caution };
    stepGroups.push(sg);

    /* 車ステップ: rental を別途追加 */
    if (step.type === 'car') {
      links.push(buildRentalLink());
    }

    displayIdx++;
  }

  /* ステップが1件もなければ GoogleMaps フォールバック */
  if (stepGroups.length === 0) {
    const fallbackCta = buildGoogleMapsLink(
      fromCity.rail.replace(/駅$/, ''), label, 'transit', '📍 Googleマップで確認', coords(city)
    );
    const sg = { type: 'step-group', stepLabel: `① ${departure} → ${label}`, cta: fallbackCta, caution: null };
    stepGroups.push(sg);
  }

  /* メインCTA（最重要ボタン）を summary の直後に挿入 */
  const mainCta = deriveMainCta(stepGroups);
  if (mainCta) {
    /* 予約到達駅：最初の JR 予約ステップの to 駅を付与 */
    const firstJrIdx = routes.findIndex(s => s.type === 'shinkansen' || s.type === 'rail');
    if (firstJrIdx !== -1) {
      const firstJrStep = routes[firstJrIdx];
      const stepTo = firstJrStep.to;
      const destName = city.displayName || city.name;
      if (stepTo !== destName) {
        /* 次ステップの移動手段をラベル化 */
        const nextStep = routes[firstJrIdx + 1];
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
