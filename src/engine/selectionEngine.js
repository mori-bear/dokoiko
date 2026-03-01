/**
 * 抽選エンジン
 *
 * buildPool  : 条件に合う全件をシャッフルして返す
 * selectDestination : 後方互換（buildPool()[0]と同義）
 *
 * stayType === 'daytrip' の場合、star 4・5 を除外する（star 3以下のみ）。
 */

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * 条件に合うdestinationをシャッフルして全件返す。
 * 優先順位:
 *   1. departure + star 完全一致
 *   2. star ±1〜2（複数delta分まとめて）
 *   3. departure 一致のみ
 *   4. 全国フォールバック
 */
export function buildPool(destinations, departure, star, stayType) {
  const maxStar = stayType === 'daytrip' ? 3 : 5;
  const eligible    = destinations.filter((d) => d.star <= maxStar);
  const byDeparture = eligible.filter((d) => d.departures.includes(departure));

  // 1. 完全一致
  const exact = byDeparture.filter((d) => d.star === star);
  if (exact.length > 0) return shuffle(exact);

  // 2. ±1〜2（重複なし）
  const seen = new Set();
  const expanded = [];
  for (const delta of [1, -1, 2, -2]) {
    const s = star + delta;
    if (s < 1 || s > maxStar) continue;
    for (const d of byDeparture) {
      if (d.star === s && !seen.has(d.id)) {
        seen.add(d.id);
        expanded.push(d);
      }
    }
  }
  if (expanded.length > 0) return shuffle(expanded);

  // 3. departure 一致のみ
  if (byDeparture.length > 0) return shuffle(byDeparture);

  // 4. 全国フォールバック
  return shuffle(eligible.length > 0 ? eligible : destinations);
}

/** 後方互換: pool の先頭 1 件を返す */
export function selectDestination(destinations, departure, star, stayType) {
  return buildPool(destinations, departure, star, stayType)[0];
}
