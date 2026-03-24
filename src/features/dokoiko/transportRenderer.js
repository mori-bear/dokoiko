/**
 * 交通リンクアセンブラ — routes.js 唯一参照
 *
 * データソース: routes.js（ROUTES） のみ。自動ロジックなし。
 * ROUTES に未登録の destination → [{ type:'note', label:'現在準備中です' }] を返す。
 * null は絶対に返さない。
 *
 * 出力フォーマット（step-group方式）:
 *   [
 *     { type: 'summary', transfers: N },
 *     { type: 'step-group', stepLabel: '① A→B（新幹線）', cta: {...}, caution: '...' },
 *     { type: 'step-group', stepLabel: '② B→C（バス）',  cta: {...} },
 *     { type: 'rental', ... },   // 車ステップがある場合のみ
 *   ]
 *
 * step type と CTA の対応:
 *   shinkansen → EX / えきねっと / JRネット予約
 *   rail(IC可)  → Googleマップ + 「ICカードでそのまま乗車できます」
 *   rail(特急)  → JR予約リンク
 *   flight      → Skyscanner
 *   ferry       → フェリー予約リンク
 *   bus         → Googleマップ（transit）
 *   car         → Googleマップ（driving）+ 別途 rental リンク
 *   localMove   → Googleマップ（transit）
 */

import { readFileSync }          from 'fs';
import { fileURLToPath }         from 'url';
import { dirname, join }         from 'path';
import { ROUTES, CITY_TO_SHINKANSEN } from './routes.js';
import { DEPARTURE_CITY_INFO } from '../../config/constants.js';
import { CITY_AIRPORT }        from '../../lib/transportCore/airportMap.js';
import {
  buildGoogleMapsLink,
  buildSkyscannerLink,
  buildJrLink,
  buildFerryLink,
  buildRentalLink,
} from '../../transport/linkBuilder.js';
import { buildRoute } from '../../engine/bfsEngine.js';

/* ── 就航路線DB（出発地 × 到着空港） ── */
const _root = join(dirname(fileURLToPath(import.meta.url)), '../../../');
const FLIGHT_ROUTES = JSON.parse(
  readFileSync(join(_root, 'data/flightRoutes.json'), 'utf8'),
);

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

/* ── 新幹線ラインDB（路線名 → 予約システム） ── */
const SHINKANSEN_LINE_PROVIDER = {
  '東海道新幹線': 'ex',
  '山陽新幹線':   'ex',
};

/**
 * 新幹線ステップの予約プロバイダを路線ラベル優先で判定する。
 * 東海道・山陽 → スマートEX、JR東日本系 → えきねっと、その他 → operatorToProvider
 */
function detectShinkansenProvider(step) {
  const label = step.label ?? '';
  if (SHINKANSEN_LINE_PROVIDER[label]) return SHINKANSEN_LINE_PROVIDER[label];
  if (label.includes('東海道') || label.includes('山陽')) return 'ex';
  return operatorToProvider(step.operator ?? '');
}

/**
 * IC乗車可能な在来線かどうか判定する（特急・急行・ライナー系は予約必要）。
 */
function isIcRail(step) {
  const label = step.label ?? '';
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
      const provider = detectShinkansenProvider(step);
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
          caution: 'ICカードでそのまま乗車できます（予約不要）',
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

/**
 * routes.js の step から CTA を生成する。
 * @param {object} step - ROUTES エントリのステップ
 * @param {string} from - 解決済み出発地名
 * @param {string} to   - 解決済み到着地名
 * @param {string} departure - 出発都市名
 * @param {object} fromCity  - DEPARTURE_CITY_INFO エントリ
 * @param {object} city      - destination エントリ
 * @returns {{ cta: object|null, caution: string|null }}
 */
function routeStepToCta(step, from, to, departure, fromCity, city) {
  switch (step.type) {
    case 'shinkansen': {
      const provider = detectShinkansenProvider(step);
      return { cta: buildJrLink(provider), caution: '※オンライン予約不可の場合はみどりの窓口をご利用ください' };
    }
    case 'rail': {
      if (isIcRail(step)) {
        return {
          cta: buildGoogleMapsLink(from, to, 'transit', '📍 Googleマップで確認'),
          caution: 'ICカードでそのまま乗車できます（予約不要）',
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
    return [
      { type: 'summary', transfers: 0 },
      {
        type: 'step-group',
        stepLabel: `① ${departure} → ${city.displayName || city.name}`,
        cta: {
          type:  'google-maps',
          label: '📍 Googleマップで確認',
          url:   `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(departure)}&destination=${encodeURIComponent(city.name)}&travelmode=transit`,
        },
        caution: null,
      },
    ];
  }
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

  /* ── routes.js ── */
  const rawRoutes = ROUTES[city.id];
  const fromCity  = DEPARTURE_CITY_INFO[departure];

  if (!rawRoutes || !fromCity) {
    return [{ type: 'note', label: '現在準備中です' }];
  }

  /* ── 前処理: 無効 step の除去 ── */
  const routes = rawRoutes.filter(step => {
    // flight: 就航路線DBに存在しない場合は除外（次ステップで代替）
    if (step.type === 'flight' && !hasFlightRoute(departure, step.to)) return false;
    // rail: duration < 40分 の短距離在来線はリンク不要
    if (step.type === 'rail' && step.duration !== undefined && step.duration < 40) return false;
    return true;
  });

  return buildLinksFromRoutes(routes, city, departure, fromCity);
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
  for (let i = 0; i < steps.length; i++) {
    const s    = steps[i];
    const idx  = stepIdx(i);
    const mode = s.label ?? stepTypeLabel(s.type);
    const stepLabel = `${idx} ${s.from} → ${s.to}（${mode}）`;

    const { cta, caution } = bfsStepToCta(s, departure);

    /* 車ステップ: rental を別途追加 */
    if (s.type === 'car') {
      links.push({ type: 'step-group', stepLabel, cta, caution });
      links.push(buildRentalLink());
    } else {
      links.push({ type: 'step-group', stepLabel, cta, caution });
    }
  }

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
  let displayIdx = 0;

  for (const step of routes) {
    const mode = step.label ?? stepTypeLabel(step.type);

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

    /* 車ステップ: rental を別途追加 */
    if (step.type === 'car') {
      links.push({ type: 'step-group', stepLabel, cta, caution });
      links.push(buildRentalLink());
    } else {
      links.push({ type: 'step-group', stepLabel, cta, caution });
    }

    displayIdx++;
  }

  return links.filter(Boolean);
}

/* ─────────────────────────────────────────────────
   URL重複排除（同一URLは最初の1件のみ残す）
───────────────────────────────────────────────── */
function dedupeByUrl(links) {
  const seen = new Set();
  return links.filter(l => {
    if (!l.url) return true;           // note など URL なし → 常に残す
    if (seen.has(l.url)) return false;
    seen.add(l.url);
    return true;
  });
}
