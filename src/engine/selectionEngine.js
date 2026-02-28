/**
 * 抽選エンジン
 *
 * buildPool  : 条件に合う全件をシャッフルして返す
 * selectDestination : 後方互換（buildPool()[0]と同義）
 *
 * stayType === 'daytrip' の場合、distanceLevel 4・5 を除外する。
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
 *   1. departure + distanceLevel 完全一致
 *   2. distance ±1〜2（複数delta分まとめて）
 *   3. departure 一致のみ
 *   4. 全国フォールバック
 */
export function buildPool(destinations, departure, distanceLevel, stayType) {
  const maxDL = stayType === 'daytrip' ? 3 : 5;
  const eligible    = destinations.filter((d) => d.distanceLevel <= maxDL);
  const byDeparture = eligible.filter((d) => d.departures.includes(departure));

  // 1. 完全一致
  const exact = byDeparture.filter((d) => d.distanceLevel === distanceLevel);
  if (exact.length > 0) return shuffle(exact);

  // 2. ±1〜2（重複なし）
  const seen = new Set();
  const expanded = [];
  for (const delta of [1, -1, 2, -2]) {
    const dl = distanceLevel + delta;
    if (dl < 1 || dl > maxDL) continue;
    for (const d of byDeparture) {
      if (d.distanceLevel === dl && !seen.has(d.id)) {
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
export function selectDestination(destinations, departure, distanceLevel, stayType) {
  return buildPool(destinations, departure, distanceLevel, stayType)[0];
}
