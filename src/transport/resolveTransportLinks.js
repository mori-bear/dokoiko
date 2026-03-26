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
} from './linkBuilder.js';
import { buildRoute } from '../engine/bfsEngine.js';
import PORTS_DATA    from '../data/ports.json'    with { type: 'json' };

/* ── 港名 → ハブ都市マップ（step補完用） ── */
const PORT_CITY_MAP = {};
for (const p of PORTS_DATA) {
  PORT_CITY_MAP[p.port] = p.city;
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

const STEP_IDX = ['①', '②', '③', '④', '⑤'];
function stepIdx(i) {
  return STEP_IDX[i] ?? `${i + 1}.`;
}

const IC_CAUTION = 'ICカードでそのまま改札通れます（予約不要）';

/* ══════════════════════════════════════════════════════
   メイン CTA 導出
   優先順位: shinkansen > flight > ferry > rail > その他
══════════════════════════════════════════════════════ */

const MAIN_CTA_PRIORITY = [
  'jr-ex', 'jr-east', 'jr-west', 'jr-kyushu', 'jr-window',
  'skyscanner', 'google-flights',
  'ferry',
  'google-maps', 'bus', 'rental',
];

function deriveMainCta(stepGroups) {
  let best = null;
  let bestPriority = Infinity;
  for (const sg of stepGroups) {
    if (!sg.cta?.url) continue;
    const idx = MAIN_CTA_PRIORITY.indexOf(sg.cta.type);
    const pri = idx === -1 ? MAIN_CTA_PRIORITY.length : idx;
    if (pri < bestPriority) { bestPriority = pri; best = sg.cta; }
  }
  return best ? { type: 'main-cta', cta: best } : null;
}

/* ══════════════════════════════════════════════════════
   step → CTA 変換（BFS ステップ用）
══════════════════════════════════════════════════════ */

function bfsStepToCta(step, departure) {
  switch (step.type) {
    case 'shinkansen': {
      const provider = detectShinkansenProvider(step, departure);
      return { cta: buildJrLink(provider), caution: '※オンライン予約不可の場合はみどりの窓口をご利用ください' };
    }
    case 'rail': {
      if (step.operator && !step.operator.startsWith('JR')) {
        return { cta: buildGoogleMapsLink(step.from, step.to, 'transit', '📍 Googleマップで確認'), caution: null };
      }
      if (isIcRail(step)) {
        return { cta: buildGoogleMapsLink(step.from, step.to, 'transit', '📍 Googleマップで確認'), caution: IC_CAUTION };
      }
      return { cta: buildJrLink(operatorToProvider(step.operator ?? '')), caution: '※オンライン予約不可の場合はみどりの窓口をご利用ください' };
    }
    case 'flight': {
      const fromIata = CITY_AIRPORT[step.from] ?? CITY_AIRPORT[departure] ?? null;
      if (fromIata && step.to) return { cta: buildSkyscannerLink(fromIata, step.to) ?? null, caution: null };
      return { cta: null, caution: null };
    }
    case 'ferry':
      return { cta: buildFerryLink(step.from ?? '', step.ferryUrl ?? null, step.ferryOperator ?? null), caution: null };
    case 'bus':
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
      if (step.operator && !step.operator.startsWith('JR')) {
        return { cta: buildGoogleMapsLink(from, to, 'transit', '📍 Googleマップで確認'), caution: null };
      }
      if (isIcRail(step)) {
        return { cta: buildGoogleMapsLink(from, to, 'transit', '📍 Googleマップで確認'), caution: IC_CAUTION };
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
    case 'localMove': {
      const co = coords(city);
      return { cta: buildGoogleMapsLink(from, to, 'transit', '📍 Googleマップで確認', step.type === 'localMove' ? co : null), caution: null };
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
  const meaningfulSteps = steps.filter(s => s.type !== 'localMove');
  links.push({ type: 'summary', transfers: Math.max(0, meaningfulSteps.length - 1) });

  const stepGroups = [];
  for (let i = 0; i < steps.length; i++) {
    const s         = steps[i];
    const mode      = normalizeStepLabel(s.label ?? stepTypeLabel(s.type), s.type, s.operator ?? '');
    const stepLabel = `${stepIdx(i)} ${s.from} → ${s.to}（${mode}）`;
    const { cta, caution } = bfsStepToCta(s, departure);
    stepGroups.push({ type: 'step-group', stepLabel, cta, caution });
    if (s.type === 'car') links.push(buildRentalLink());
  }

  const mainCta = deriveMainCta(stepGroups);
  if (mainCta) links.push(mainCta);
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

  const meaningfulSteps = routes.filter(s => s.type !== 'localMove');
  links.push({ type: 'summary', transfers: Math.max(0, meaningfulSteps.length - 1) });

  const stepGroups = [];
  let displayIdx   = 0;

  for (const step of routes) {
    const mode = normalizeStepLabel(step.label ?? stepTypeLabel(step.type), step.type, step.operator ?? '');

    const from = step.step === 1
      ? ((step.type === 'shinkansen') ? shinkansenFrom() : fromCity.rail.replace(/駅$/, ''))
      : step.from ?? '';
    const to   = step.to ?? label;

    if ((step.type === 'shinkansen' || step.type === 'rail') && from === to) continue;

    let stepLabel;
    switch (step.type) {
      case 'shinkansen':
      case 'rail':
        stepLabel = `${stepIdx(displayIdx)} ${from} → ${to}（${mode}）`; break;
      case 'flight':
        stepLabel = `${stepIdx(displayIdx)} ${departure} → ${to}（飛行機）`; break;
      case 'ferry':
        stepLabel = `${stepIdx(displayIdx)} ${step.from ?? from} → ${label}（フェリー）`; break;
      case 'car':
        stepLabel = `${stepIdx(displayIdx)} ${from} → ${label}（レンタカー）`; break;
      case 'bus':
        stepLabel = `${stepIdx(displayIdx)} ${from} → ${label}（${mode}）`; break;
      case 'localMove':
        stepLabel = `${stepIdx(displayIdx)} ${step.from ?? from} → ${step.to ?? label}（Googleマップ）`; break;
      default:
        stepLabel = `${stepIdx(displayIdx)} ${from} → ${to}（${mode}）`;
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

  /* needsCar フラグによるレンタカー追加（localMove ステップでも対応） */
  if (city.needsCar) links.push(buildRentalLink());

  const mainCta = deriveMainCta(stepGroups);
  if (mainCta) {
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
      stepGroups.push({
        type: 'step-group',
        stepLabel: `${stepIdx(stepGroups.length)} ${departure} → ${city.airportGateway}（飛行機）`,
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

  /* ── レンタカー（needsCar フラグ）── */
  const rentalLinks = city.needsCar ? [buildRentalLink()] : [];

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
  links.push({ type: 'summary', transfers: Math.max(0, stepGroups.length - 1) });
  const mainCta = deriveMainCta(stepGroups);
  if (mainCta) links.push(mainCta);
  links.push(...stepGroups);
  links.push(...rentalLinks);
  return links;
}

/* ══════════════════════════════════════════════════════
   内部ルーター（優先順位: BFS > 出発地特例 > 汎用+スコア > 自動生成）
══════════════════════════════════════════════════════ */

function _resolve(city, departure) {
  if (city.gateway) {
    const rawSteps = buildRoute(departure, city);
    if (rawSteps[0]?.url) return rawSteps; // fallback リンクオブジェクト
    return bfsStepsToLinks(rawSteps, departure, city);
  }

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
    return [
      { type: 'summary',    transfers: 0 },
      { type: 'main-cta',  cta: fallbackCta },
      { type: 'step-group', stepLabel: `① ${departure} → ${cityLabel(city)}`, cta: fallbackCta, caution: null },
    ];
  }
  return links;
}
