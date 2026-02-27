/**
 * 抽選エンジン
 *
 * 優先順位:
 *   1. distanceLevel × budgetLevel 完全一致
 *   2. distance ±1、budget 完全一致
 *   3. distance 完全一致、budget ±1
 *   4. departure 一致のみ
 *   5. 全国フォールバック
 *
 * 常に 1 件を返す。空配列にはならない。
 */
function pick(pool) {
  return pool[Math.floor(Math.random() * pool.length)];
}

export function selectDestination(destinations, departure, distanceLevel, budgetLevel) {
  const byDeparture = destinations.filter((d) => d.departures.includes(departure));

  // 1. 完全一致
  let pool = byDeparture.filter(
    (d) => d.distanceLevel === distanceLevel && d.budgetLevel === budgetLevel
  );
  if (pool.length > 0) return pick(pool);

  // 2. distance ±1〜2、budget 完全一致
  for (const delta of [1, -1, 2, -2]) {
    const dl = distanceLevel + delta;
    if (dl < 1 || dl > 5) continue;
    pool = byDeparture.filter(
      (d) => d.distanceLevel === dl && d.budgetLevel === budgetLevel
    );
    if (pool.length > 0) return pick(pool);
  }

  // 3. distance 完全一致、budget ±1〜2
  for (const delta of [1, -1, 2, -2]) {
    const bl = budgetLevel + delta;
    if (bl < 1 || bl > 5) continue;
    pool = byDeparture.filter(
      (d) => d.distanceLevel === distanceLevel && d.budgetLevel === bl
    );
    if (pool.length > 0) return pick(pool);
  }

  // 4. departure 一致のみ
  if (byDeparture.length > 0) return pick(byDeparture);

  // 5. 全国フォールバック
  return pick(destinations);
}
