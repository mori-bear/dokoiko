/**
 * addHotelArea.mjs — 全 destination に hotelArea フィールドを付与
 *
 * hotelArea = Rakuten Travel の都道府県コード（英字）
 * search.travel.rakuten.co.jp/ds/yado/{hotelArea}/?keyword= で使用
 *
 * 実行: node scripts/addHotelArea.mjs
 */

import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const PATH = join(ROOT, 'src/data/destinations.json');

/* ── 都道府県 → Rakuten エリアコード ── */
const PREF_TO_AREA = {
  '北海道':   'hokkaido',
  '青森県':   'aomori',
  '岩手県':   'iwate',
  '宮城県':   'miyagi',
  '秋田県':   'akita',
  '山形県':   'yamagata',
  '福島県':   'fukushima',
  '茨城県':   'ibaraki',
  '栃木県':   'tochigi',
  '群馬県':   'gunma',
  '埼玉県':   'saitama',
  '千葉県':   'chiba',
  '東京都':   'tokyo',
  '神奈川県': 'kanagawa',
  '新潟県':   'niigata',
  '富山県':   'toyama',
  '石川県':   'ishikawa',
  '福井県':   'fukui',
  '山梨県':   'yamanashi',
  '長野県':   'nagano',
  '岐阜県':   'gifu',
  '静岡県':   'shizuoka',
  '愛知県':   'aichi',
  '三重県':   'mie',
  '滋賀県':   'shiga',
  '京都府':   'kyoto',
  '大阪府':   'osaka',
  '兵庫県':   'hyogo',
  '奈良県':   'nara',
  '和歌山県': 'wakayama',
  '鳥取県':   'tottori',
  '島根県':   'shimane',
  '岡山県':   'okayama',
  '広島県':   'hiroshima',
  '山口県':   'yamaguchi',
  '徳島県':   'tokushima',
  '香川県':   'kagawa',
  '愛媛県':   'ehime',
  '高知県':   'kochi',
  '福岡県':   'fukuoka',
  '佐賀県':   'saga',
  '長崎県':   'nagasaki',
  '熊本県':   'kumamoto',
  '大分県':   'oita',
  '宮崎県':   'miyazaki',
  '鹿児島県': 'kagoshima',
  '沖縄県':   'okinawa',
};

/* ── 跨県 hotelSearch の手動上書き ── */
// hotelSearch が別都道府県の都市名を指している場合は正しいエリアコードを指定
const MANUAL_OVERRIDE = {
  'mihonoseki':   'tottori',   // hotelSearch=米子 → 鳥取県
  'gokayama':     'gifu',      // hotelSearch=高山 → 岐阜県
};

/* ── 処理 ── */
// 全件上書き: 旧 city-level コードを prefecture コードに統一
// （理由: search.travel.rakuten.co.jp/ds/yado/{area}/ は hyphen NG、prefecture コードのみ 200）
const dests = JSON.parse(readFileSync(PATH, 'utf8'));

let updated_count = 0;
let failed = 0;

const updated = dests.map(d => {
  const code = MANUAL_OVERRIDE[d.id] ?? PREF_TO_AREA[d.prefecture];
  if (!code) {
    console.warn(`[WARN] hotelArea 解決できず: ${d.id} (prefecture: ${d.prefecture})`);
    failed++;
    return d;
  }
  updated_count++;
  return { ...d, hotelArea: code };
});

writeFileSync(PATH, JSON.stringify(updated, null, 2) + '\n');

console.log(`\n hotelArea 更新完了（prefecture コードに統一）`);
console.log(`  更新: ${updated_count} 件`);
console.log(`  失敗: ${failed} 件`);
if (failed > 0) {
  console.log('  ※ 失敗した dest の prefecture を確認してください');
}
