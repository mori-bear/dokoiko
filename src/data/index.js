/**
 * データローダー
 *
 * hubs.json + destinations.json + spots.json を並列フェッチして結合。
 * 起動時に id / name の重複チェックも実行する。
 *
 * 使い方:
 *   import { loadDestinations } from './src/data/index.js';
 *   const destinations = await loadDestinations();
 */

/**
 * フラットな都市配列を返す（hubs + destinations）。
 * spots は現在 0 件のため除外済み。
 *
 * @returns {Promise<Array>}
 */
export async function loadDestinations() {
  const [hubsRes, destsRes] = await Promise.all([
    fetch('./data/hubs.json'),
    fetch('./data/destinations.json'),
  ]);

  if (!hubsRes.ok)  throw new Error(`hubs.json: HTTP ${hubsRes.status}`);
  if (!destsRes.ok) throw new Error(`destinations.json: HTTP ${destsRes.status}`);

  const [hubs, destinations] = await Promise.all([hubsRes.json(), destsRes.json()]);

  const all = [...hubs, ...destinations];

  assertNoDuplicates(all);

  return all;
}

/**
 * id / name の重複を検出する。重複があれば Error を throw。
 */
function assertNoDuplicates(destinations) {
  const idSeen   = new Map();
  const nameSeen = new Map();
  const dupIds   = [];
  const dupNames = [];

  for (const d of destinations) {
    if (idSeen.has(d.id))     dupIds.push(d.id);
    if (nameSeen.has(d.name)) dupNames.push(d.name);
    idSeen.set(d.id, true);
    nameSeen.set(d.name, true);
  }

  if (dupIds.length > 0 || dupNames.length > 0) {
    const msg = [
      dupIds.length   ? `重複ID: ${[...new Set(dupIds)].join(', ')}`   : '',
      dupNames.length ? `重複名: ${[...new Set(dupNames)].join(', ')}` : '',
    ].filter(Boolean).join(' / ');
    throw new Error(`[データ整合性エラー] ${msg}`);
  }
}
