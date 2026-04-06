/**
 * addCatch.mjs — destinations.json に catch フィールドを追加する
 *
 * catch: 15〜30文字の体験ベースキャッチコピー
 *   1. 既存 description の第1文を抽出
 *   2. 30文字超の場合は自然な切れ目で短縮
 *   3. description がない場合はタグ + タイプから生成
 *
 * Usage: node scripts/addCatch.mjs
 */

import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT      = join(__dirname, '..');
const destsPath = join(ROOT, 'src/data/destinations.json');
const dests     = JSON.parse(readFileSync(destsPath, 'utf8'));

/** descriptionの第1文を抽出 */
function extractFirstSentence(desc) {
  if (!desc) return null;
  // 「。」または改行で分割
  const first = desc.split(/。|\n/)[0].trim();
  return first.length > 0 ? first : null;
}

/**
 * 30文字を超える場合に自然な位置で短縮する。
 * 読点（、）や助詞の手前で切る。
 */
function shortenTo30(str) {
  if (str.length <= 30) return str;
  // 28文字以内で最後の読点または助詞前の位置を探す
  const cutTarget = str.substring(0, 28);
  // 読点・接続詞の手前で切る
  const cutAt = cutTarget.search(/[、が、を、に、で、と、は、も、から、まで][^。]*$/);
  if (cutAt > 12) return cutTarget.substring(0, cutAt);
  // 見つからない場合は単純に28文字でカット
  return cutTarget + '…';
}

/**
 * タグとタイプからフォールバックcatchを生成
 */
function generateFromTags(dest) {
  const { tags = [], destType, name } = dest;

  const TYPE_PHRASES = {
    onsen:    '温泉と自然が楽しめる癒しの旅先',
    island:   '海と自然に囲まれた離島の旅',
    mountain: '山と絶景が楽しめる高原リゾート',
    remote:   '秘境の自然と静けさが魅力',
    sight:    '自然と文化が融合した観光地',
    city:     '歴史と風情が漂う街歩きの旅先',
  };

  if (TYPE_PHRASES[destType]) return TYPE_PHRASES[destType];
  if (tags.length >= 2) return `${tags[0]}と${tags[1]}を楽しむ旅`;
  if (tags.length === 1) return `${tags[0]}が魅力の旅先`;
  return `${name}の旅`;
}

let added = 0;
let skipped = 0;

for (const dest of dests) {
  if (dest.catch) { skipped++; continue; }

  const firstSentence = extractFirstSentence(dest.description);

  let catchCopy;
  if (firstSentence && firstSentence.length >= 12) {
    catchCopy = shortenTo30(firstSentence);
  } else {
    catchCopy = generateFromTags(dest);
  }

  dest.catch = catchCopy;
  added++;
}

writeFileSync(destsPath, JSON.stringify(dests, null, 2) + '\n', 'utf8');

console.log('catch フィールド追加完了:');
console.log(`  追加: ${added} 件`);
console.log(`  スキップ（既存）: ${skipped} 件`);

// サンプル確認
console.log('\nサンプル（最初の10件）:');
dests.slice(0, 10).forEach(d => {
  console.log(`  ${d.id}: "${d.catch}" (${d.catch.length}文字)`);
});
