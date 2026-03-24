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
      label: '📍 Googleマップで行き方を見る',
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
  const routes   = ROUTES[city.id];
  const fromCity = DEPARTURE_CITY_INFO[departure];

  if (!routes || !fromCity) {
    return [{ type: 'note', label: '現在準備中です' }];
  }

  return buildLinksFromRoutes(routes, city, departure, fromCity);
}

/* ─────────────────────────────────────────────────
   BFS ステップ → リンク配列
───────────────────────────────────────────────── */
function bfsStepsToLinks(steps, departure, city) {
  const label = city.displayName || city.name;
  const links = [];

  /* ステップノート（① ② ③ ...） */
  const noteLabels = steps.map((s, i) => {
    const idx  = ['①', '②', '③', '④'][i] ?? `${i + 1}.`;
    const mode = s.label ?? stepTypeLabel(s.type);
    return `${idx} ${s.from} → ${s.to}（${mode}）`;
  });
  links.push({ type: 'note', label: noteLabels.join('　') });

  /* 各ステップのリンク生成 */
  for (const step of steps) {
    if (step.type === 'shinkansen') {
      const provider = operatorToProvider(step.operator ?? '');
      const jrLink   = buildJrLink(provider, { from: step.from, to: step.to });
      if (jrLink) links.push(jrLink);

    } else if (step.type === 'rail') {
      if (step.operator && step.operator.startsWith('JR')) {
        const provider = operatorToProvider(step.operator);
        const jrLink   = buildJrLink(provider, { from: step.from, to: step.to });
        if (jrLink) links.push(jrLink);
      } else {
        /* 私鉄 → Googleマップ transit */
        links.push(buildGoogleMapsLink(
          step.from, step.to, 'transit',
          `${step.from} → ${step.to}（${step.label ?? '電車'}）`,
        ));
      }

    } else if (step.type === 'flight') {
      const fromIata = CITY_AIRPORT[step.from];
      if (fromIata && step.to) {
        const skyLink = buildSkyscannerLink(fromIata, step.to);
        if (skyLink) links.push(skyLink);
      }

    } else if (step.type === 'local') {
      links.push(buildGoogleMapsLink(
        step.from, step.to, 'transit',
        `${step.from} → ${step.to}（Googleマップ）`,
      ));

    } else if (step.type === 'ferry') {
      const ferryLink = buildFerryLink(step.from, step.ferryUrl ?? null, step.ferryOperator ?? null);
      if (ferryLink) links.push(ferryLink);

    } else if (step.type === 'car') {
      links.push(buildGoogleMapsLink(step.from, step.to, 'driving', `${step.from} → ${step.to}（ドライブ）`));
      links.push(buildRentalLink());
    }
  }

  return dedupeByUrl(links.filter(Boolean));
}

/* ─────────────────────────────────────────────────
   ルートステップ → リンク配列
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

  /* ── ステップノート ① ② を先頭に ── */
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
      stepLabels.push(`${idx} ${from} → ${label}（${mode}）`);
    } else if (step.type === 'ferry') {
      stepLabels.push(`${idx} ${step.from ?? ''} → ${label}（${mode}）`);
    } else if (step.type === 'bus') {
      stepLabels.push(`${idx} ${from} → ${label}（${mode}）`);
    } else if (step.type === 'localMove') {
      stepLabels.push(`${idx} ${step.from ?? ''} → ${step.to ?? label}（Googleマップ）`);
    }
  }

  if (stepLabels.length >= 1) {
    links.push({ type: 'note', label: stepLabels.join('　') });
  }

  /* ── 各ステップのリンク生成 ── */
  for (const step of routes) {
    if (step.type === 'shinkansen' || step.type === 'rail') {
      const from     = step.step === 1
        ? ((step.type === 'shinkansen') ? shinkansenFrom() : fromCity.rail.replace(/駅$/, ''))
        : step.from ?? '';
      if (from === step.to) continue;
      const provider = operatorToProvider(step.operator ?? '');
      const jrLink   = buildJrLink(provider, { from, to: step.to });
      if (jrLink) links.push(jrLink);

    } else if (step.type === 'flight') {
      const fromIata = CITY_AIRPORT[departure] || fromCity.iata;
      // 飛行機不可（fromIata/to 未解決）なら出さない
      if (fromIata && step.to) {
        const skyLink = buildSkyscannerLink(fromIata, step.to);
        if (skyLink) links.push(skyLink);
      }

    } else if (step.type === 'car') {
      const origin    = step.from ? `${step.from}駅` : fromCity.rail;
      const mapsLabel = `${step.from ?? departure} → ${label}（Googleマップ）`;
      links.push(buildGoogleMapsLink(origin, label, 'driving', mapsLabel, co));
      links.push(buildRentalLink());

    } else if (step.type === 'ferry') {
      const fromPort  = step.from ?? '';
      const ferryLink = buildFerryLink(fromPort, step.ferryUrl ?? null, step.ferryOperator ?? null);
      if (ferryLink) links.push(ferryLink);
      if (!step.noLocalMaps) {
        const mapsLabel = `${fromPort} → ${label}（Googleマップ）`;
        links.push(buildGoogleMapsLink(fromPort, label, 'transit', mapsLabel, co));
      }

    } else if (step.type === 'localMove') {
      const from      = step.from ?? '';
      const to        = step.to ?? label;
      const mapsLabel = `${from} → ${to}（Googleマップ）`;
      links.push(buildGoogleMapsLink(from, to, 'transit', mapsLabel));

    } else if (step.type === 'bus') {
      const origin    = step.from ? `${step.from}駅` : fromCity.rail;
      const mapsLabel = `${step.from ?? departure} → ${label}（Googleマップ）`;
      links.push(buildGoogleMapsLink(origin, label, 'transit', mapsLabel, co));
    }
  }

  return dedupeByUrl(links.filter(Boolean));
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

