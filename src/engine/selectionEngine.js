/**
 * 抽選エンジン
 *
 * buildPool : 条件に合う全件をシャッフルして返す
 *
 * 抽選優先順:
 *   1. departure + distanceStars 完全一致 + stayAllowed
 *   2. distanceStars ±1〜2（departure + stayAllowed 維持）
 *   3. departure 一致のみ（stayAllowed 維持）
 *   4. 全国フォールバック（stayAllowed 維持）
 *
 * island は stayAllowed=["1night"] のみなので daytrip では自然に除外される。
 */

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function buildPool(destinations, departure, distanceStars, stayType) {
  // stayAllowed フィルタ（island=1night 除外もここで処理）
  const byStay      = destinations.filter(d => d.stayAllowed.includes(stayType));
  const byDeparture = byStay.filter(d => d.departures.includes(departure));

  // 1. 完全一致
  const exact = byDeparture.filter(d => d.distanceStars === distanceStars);
  if (exact.length > 0) return shuffle(exact);

  // 2. ±1〜2（stayAllowed + departure 維持）
  const seen     = new Set();
  const expanded = [];
  for (const delta of [1, -1, 2, -2]) {
    const s = distanceStars + delta;
    if (s < 1 || s > 5) continue;
    for (const d of byDeparture) {
      if (d.distanceStars === s && !seen.has(d.id)) {
        seen.add(d.id);
        expanded.push(d);
      }
    }
  }
  if (expanded.length > 0) return shuffle(expanded);

  // 3. departure 一致のみ（stayAllowed 維持）
  if (byDeparture.length > 0) return shuffle(byDeparture);

  // 4. 全国フォールバック（stayAllowed 維持）
  return shuffle(byStay.length > 0 ? byStay : destinations);
}

/** 後方互換: pool の先頭 1 件を返す */
export function selectDestination(destinations, departure, distanceStars, stayType) {
  return buildPool(destinations, departure, distanceStars, stayType)[0];
}
