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
    fetch('./src/data/hubs.json'),
    fetch('./src/data/destinations.json'),
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
 *
 * チェックルール:
 *   - id: hubs + destinations 全体でユニーク（型関係なく）
 *   - name: 同じ type 内でユニーク
 *     → hub と destination が同じ名前を持つのは許容
 *       （横浜はアクセス拠点（hub）にも旅先（destination）にも存在できる）
 */
function assertNoDuplicates(all) {
  const idSeen    = new Map();
  const nameSeen  = {};   // type → Set<name>
  const dupIds    = [];
  const dupNames  = [];

  for (const d of all) {
    // id は全体でユニーク
    if (idSeen.has(d.id)) dupIds.push(d.id);
    idSeen.set(d.id, true);

    // name は同じ type 内でユニーク
    const t = d.type ?? 'unknown';
    if (!nameSeen[t]) nameSeen[t] = new Map();
    if (nameSeen[t].has(d.name)) dupNames.push(`${d.name}(type=${t})`);
    nameSeen[t].set(d.name, true);
  }

  if (dupIds.length > 0 || dupNames.length > 0) {
    const msg = [
      dupIds.length   ? `重複ID: ${[...new Set(dupIds)].join(', ')}`    : '',
      dupNames.length ? `重複名: ${[...new Set(dupNames)].join(', ')}` : '',
    ].filter(Boolean).join(' / ');
    throw new Error(`[データ整合性エラー] ${msg}`);
  }
}
