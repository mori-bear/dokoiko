/**
 * 交通リンクアセンブラ — 完全データ駆動
 *
 * データソース: data/routes.js（ROUTES）
 * ロジックによる自動判断なし。
 * ROUTES に登録がない destination は「現在準備中です」を表示。
 *
 * step type:
 *   shinkansen / rail → JR予約リンク
 *   flight           → Skyscanner
 *   car              → Google Maps（driving）+ レンタカー
 *   ferry            → フェリー予約リンク + Google Maps（transit）
 *   bus              → Google Maps（transit）
 */

import { ROUTES, CITY_TO_SHINKANSEN } from '../../data/routes.js';
import { DEPARTURE_CITY_INFO } from '../config/constants.js';
import { CITY_AIRPORT }        from './airportMap.js';
import {
  buildGoogleMapsLink,
  buildSkyscannerLink,
  buildJrLink,
  buildFerryLink,
  buildRentalLink,
} from './linkBuilder.js';

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
  const routes   = ROUTES[city.id];
  const fromCity = DEPARTURE_CITY_INFO[departure];

  if (!routes || !fromCity) {
    return [{ type: 'note', label: '現在準備中です' }];
  }

  return buildLinksFromRoutes(routes, city, departure, fromCity);
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
      const mapsLabel = `${fromPort} → ${label}（Googleマップ）`;
      links.push(buildGoogleMapsLink(fromPort, label, 'transit', mapsLabel, co));

    } else if (step.type === 'bus') {
      const origin    = step.from ? `${step.from}駅` : fromCity.rail;
      const mapsLabel = `${step.from ?? departure} → ${label}（Googleマップ）`;
      links.push(buildGoogleMapsLink(origin, label, 'transit', mapsLabel, co));
    }
  }

  return links.filter(Boolean);
}

/* ─────────────────────────────────────────────────
   app.js 互換スタブ（no-op）
───────────────────────────────────────────────── */
export function initTransportGraph() {}
