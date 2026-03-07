/**
 * loader.js — 地域別JSONファイルを読み込み、フラットな都市配列を返す。
 *
 * 処理内容:
 *  1. 9地域ファイルを並列フェッチ
 *  2. hub エントリの locals[] / spots[] をフラット展開
 *  3. distanceMap を持つエントリを出発地stars別に複数エントリへ展開
 *     例: distanceMap={"東京":4,"福岡":5} → stars=4エントリ + stars=5エントリ
 */

const REGION_FILES = [
  'hokkaido',
  'tohoku',
  'kanto',
  'chubu',
  'kansai',
  'chugoku',
  'shikoku',
  'kyushu',
  'okinawa',
];

/**
 * distanceMap を持つエントリを stars 別のフラットエントリに展開する。
 * distanceMap がなければそのまま返す。
 */
function expandDistanceMap(entry) {
  if (!entry.distanceMap) return [entry];

  // departures を stars 値でグループ化
  const starGroups = {};
  for (const [dep, stars] of Object.entries(entry.distanceMap)) {
    if (!starGroups[stars]) starGroups[stars] = [];
    starGroups[stars].push(dep);
  }

  const starValues = Object.keys(starGroups).map(Number).sort();
  return starValues.map((stars, i) => {
    const deps = starGroups[stars];
    const suffix = i === 0 ? '' : `_${stars}`;
    const { distanceMap, ...rest } = entry;
    return { ...rest, id: rest.id + suffix, departures: deps, distanceStars: stars };
  });
}

/**
 * 1エントリをフラット配列に展開する（再帰的にネストを解消）。
 * - locals[] / spots[] を抽出して同じ処理を適用
 * - distanceMap を展開
 * - エントリ自身の locals/spots キーは除去
 */
function processEntry(entry) {
  const { locals = [], spots: nestedSpots = [], ...base } = entry;

  // このエントリ自身を distanceMap 展開
  const baseFlat = expandDistanceMap(base);

  // ネストされた locals と spots を再帰処理
  const localFlat = locals.flatMap(processEntry);
  const spotFlat  = nestedSpots.flatMap(processEntry);

  return [...baseFlat, ...localFlat, ...spotFlat];
}

/**
 * 全地域ファイルを読み込み、フラットな都市配列を返す。
 * @param {string} baseUrl  fetch のベースURL（デフォルト: './src/data/regions'）
 */
export async function loadDestinations(baseUrl = './src/data/regions') {
  const results = await Promise.all(
    REGION_FILES.map(name =>
      fetch(`${baseUrl}/${name}.json`).then(r => {
        if (!r.ok) throw new Error(`Failed to load ${name}.json: HTTP ${r.status}`);
        return r.json();
      })
    )
  );

  // 各地域配列をフラット展開して結合
  return results.flatMap(regionArray => regionArray.flatMap(processEntry));
}
