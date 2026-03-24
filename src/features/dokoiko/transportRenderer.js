/**
 * 交通リンクアセンブラ — routes.js 唯一参照
 *
 * データソース: routes.js（ROUTES） のみ。自動ロジックなし。
 * ROUTES に未登録の destination → [{ type:'note', label:'現在準備中です' }] を返す。
 * null は絶対に返さない。
 *
 * step type:
 *   shinkansen / rail → JR予約リンク
 *   flight           → Skyscanner
 *   car              → Google Maps（driving）+ レンタカー
 *   ferry            → フェリー予約リンク（+ Google Maps は noLocalMaps:true で抑制可）
 *   bus              → Google Maps（transit）
 *   localMove        → Google Maps（transit）中継地点用
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

/* ─────────────────────────────────────────────────
   メインエントリ
───────────────────────────────────────────────── */
export function resolveTransportLinks(city, departure) {
  const links = _resolveTransportLinks(city, departure);
  if (!links || links.length === 0) {
    return [{
      type:  'google-maps',
      label: '📍 この区間を地図で見る',
      url:   `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(departure)}&destination=${encodeURIComponent(city.name)}&travelmode=transit`,
    }];
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
   BFS ステップ → リンク配列（主要1リンク方式）
───────────────────────────────────────────────── */
function bfsStepsToLinks(steps, departure, city) {
  const links = [];

  /* ステップノート（全行程） */
  const noteLabels = steps.map((s, i) => {
    const idx  = ['①', '②', '③', '④'][i] ?? `${i + 1}.`;
    const mode = s.label ?? stepTypeLabel(s.type);
    return `${idx} ${s.from} → ${s.to}（${mode}）`;
  });
  links.push({ type: 'note', label: noteLabels.join('　'), transfers: noteLabels.length - 1 });

  /* 主要1リンク */
  const mainMode = detectMainMode(steps);

  if (mainMode === 'ferry') {
    const ferryStep = steps.find(s => s.type === 'ferry');
    const ferryLink = buildFerryLink(ferryStep.from, ferryStep.ferryUrl ?? null, ferryStep.ferryOperator ?? null);
    if (ferryLink) links.push(ferryLink);

  } else if (mainMode === 'flight') {
    const flightStep = steps.find(s => s.type === 'flight');
    const fromIata   = CITY_AIRPORT[flightStep.from];
    if (fromIata && flightStep.to) {
      const skyLink = buildSkyscannerLink(fromIata, flightStep.to);
      if (skyLink) links.push(skyLink);
    }

  } else if (mainMode === 'shinkansen' || mainMode === 'rail') {
    const jrStep = steps.find(s => s.type === 'shinkansen') ?? steps.find(s => s.type === 'rail');
    if (jrStep) {
      if (jrStep.operator && !jrStep.operator.startsWith('JR')) {
        /* 私鉄 → Googleマップ */
        links.push(buildGoogleMapsLink(jrStep.from, jrStep.to, 'transit', '📍 この区間を地図で見る'));
      } else if (jrStep.type === 'rail' && isIcRail(jrStep)) {
        /* IC対応路線 → 地図リンク + ICノート */
        links.push(buildGoogleMapsLink(jrStep.from, jrStep.to, 'transit', '📍 乗り方を確認する（Googleマップ）'));
        links.push({ type: 'note-caution', label: '※ICカード・切符でご乗車いただけます（予約不要）' });
      } else {
        const provider = jrStep.type === 'shinkansen'
          ? detectShinkansenProvider(jrStep)
          : operatorToProvider(jrStep.operator ?? '');
        const jrLink = buildJrLink(provider, { from: jrStep.from, to: jrStep.to });
        if (jrLink) {
          links.push(jrLink);
          links.push({ type: 'note-caution', label: '※オンライン予約不可の場合はみどりの窓口をご利用ください' });
        }
      }
    }

  } else if (mainMode === 'car') {
    const carStep = steps.find(s => s.type === 'car');
    links.push(buildGoogleMapsLink(carStep.from, carStep.to, 'driving', '📍 この区間を地図で見る'));
    links.push(buildRentalLink());
  }

  return links.filter(Boolean);
}

/* ─────────────────────────────────────────────────
   主要モード判定（ルート全体から最重要モードを1つ選ぶ）
───────────────────────────────────────────────── */
function detectMainMode(steps) {
  if (steps.some(s => s.type === 'ferry'))      return 'ferry';
  if (steps.some(s => s.type === 'flight'))     return 'flight';
  if (steps.some(s => s.type === 'shinkansen')) return 'shinkansen';
  if (steps.some(s => s.type === 'rail'))       return 'rail';
  if (steps.some(s => s.type === 'bus'))        return 'bus';
  if (steps.some(s => s.type === 'car'))        return 'car';
  return 'unknown';
}

/* ─────────────────────────────────────────────────
   ルートステップ → リンク配列（主要1リンク方式）
───────────────────────────────────────────────── */
function buildLinksFromRoutes(routes, city, departure, fromCity) {
  const co    = coords(city);
  const label = cityLabel(city);
  const links = [];

  /* ── 新幹線乗車駅を解決（大阪→新大阪 等） ── */
  function shinkansenFrom() {
    const railName = fromCity.rail.replace(/駅$/, '');
    return CITY_TO_SHINKANSEN[railName] ?? CITY_TO_SHINKANSEN[departure] ?? railName;
  }

  /* ── ステップノート（全行程を1行で） ── */
  const stepLabels = [];
  for (let i = 0; i < routes.length; i++) {
    const step = routes[i];
    const idx  = ['①', '②', '③', '④'][i] ?? `${i + 1}.`;
    const mode = step.label ?? stepTypeLabel(step.type);
    const from = step.step === 1
      ? ((step.type === 'shinkansen') ? shinkansenFrom() : fromCity.rail.replace(/駅$/, ''))
      : step.from ?? '';

    if (step.type === 'shinkansen' || step.type === 'rail') {
      if (from === step.to) continue;
      stepLabels.push(`${idx} ${from} → ${step.to}（${mode}）`);
    } else if (step.type === 'flight') {
      stepLabels.push(`${idx} ${departure} → ${step.to}（${mode}）`);
    } else if (step.type === 'car') {
      stepLabels.push(`${idx} ${from} → ${label}（レンタカー）`);
    } else if (step.type === 'ferry') {
      stepLabels.push(`${idx} ${step.from ?? ''} → ${label}（フェリー）`);
    } else if (step.type === 'bus') {
      stepLabels.push(`${idx} ${from} → ${label}（${mode}）`);
    } else if (step.type === 'localMove') {
      stepLabels.push(`${idx} ${step.from ?? ''} → ${step.to ?? label}（Googleマップ）`);
    }
  }
  if (stepLabels.length >= 1) {
    links.push({ type: 'note', label: stepLabels.join('　'), transfers: stepLabels.length - 1 });
  }

  /* ── 主要1リンク生成 ── */
  const mainMode = detectMainMode(routes);

  if (mainMode === 'ferry') {
    /* フェリー → フェリー予約1本のみ */
    const ferryStep = routes.find(s => s.type === 'ferry');
    const ferryLink = buildFerryLink(ferryStep.from ?? '', ferryStep.ferryUrl ?? null, ferryStep.ferryOperator ?? null);
    if (ferryLink) links.push(ferryLink);

  } else if (mainMode === 'flight') {
    /* 飛行機 → Skyscanner 1本のみ */
    const flightStep = routes.find(s => s.type === 'flight');
    const fromIata   = CITY_AIRPORT[departure] || fromCity.iata;
    if (fromIata && flightStep.to) {
      const skyLink = buildSkyscannerLink(fromIata, flightStep.to);
      if (skyLink) links.push(skyLink);
    }

  } else if (mainMode === 'shinkansen' || mainMode === 'rail') {
    /* 鉄道 → 有効な最初のステップ1本のみ + 注意書き
       ※ 出発地と to が同じ（大阪→新大阪スキップ等）は飛ばして次のstepを使う */
    let found = null;
    for (const step of routes) {
      if (step.type !== 'shinkansen' && step.type !== 'rail') continue;
      const from = step.step === 1
        ? ((step.type === 'shinkansen') ? shinkansenFrom() : fromCity.rail.replace(/駅$/, ''))
        : step.from ?? '';
      if (from === step.to) continue;
      found = { step, from };
      break;
    }
    if (found) {
      const { step: jrStep, from } = found;
      if (jrStep.type === 'rail' && isIcRail(jrStep)) {
        /* IC対応路線（快速・普通等）→ 地図リンク + ICノート */
        links.push(buildGoogleMapsLink(from, jrStep.to, 'transit', '📍 乗り方を確認する（Googleマップ）'));
        links.push({ type: 'note-caution', label: '※ICカード・切符でご乗車いただけます（予約不要）' });
      } else {
        const provider = jrStep.type === 'shinkansen'
          ? detectShinkansenProvider(jrStep)
          : operatorToProvider(jrStep.operator ?? '');
        const jrLink = buildJrLink(provider, { from, to: jrStep.to });
        if (jrLink) {
          links.push(jrLink);
          links.push({ type: 'note-caution', label: '※オンライン予約不可の場合はみどりの窓口をご利用ください' });
        }
      }
    } else {
      /* 有効なJRステップなし（出発地=乗換駅など）→ バス/ローカル移動をGoogle Maps で補完 */
      const busStep = routes.find(s => s.type === 'bus' || s.type === 'localMove');
      if (busStep) {
        const origin = busStep.from ?? fromCity.rail;
        const dest   = busStep.to ?? label;
        links.push(buildGoogleMapsLink(origin, dest, 'transit', '📍 この区間を地図で見る', co));
      }
    }
    /* 車ステップが含まれる場合はレンタカーも追加 */
    if (routes.some(s => s.type === 'car')) links.push(buildRentalLink());

  } else if (mainMode === 'car') {
    /* 車のみ → Google Maps + レンタカー */
    const carStep = routes.find(s => s.type === 'car');
    const origin  = carStep.from ? `${carStep.from}駅` : fromCity.rail;
    links.push(buildGoogleMapsLink(origin, label, 'driving', '📍 この区間を地図で見る', co));
    links.push(buildRentalLink());

  } else if (mainMode === 'bus') {
    /* バス → Google Maps transit */
    links.push(buildGoogleMapsLink(fromCity.rail, label, 'transit', '📍 この区間を地図で見る', co));
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

