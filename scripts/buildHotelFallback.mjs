/**
 * buildHotelFallback.mjs
 *
 * 1. hotelAreas.json に未登録の193件を自動追記
 *    - rakutenPath: /yado/{hotelArea}/ (都道府県レベル)
 *    - jalanUrl: iconv-lite で Shift-JIS エンコード
 *
 * 2. destinations.json に fallbackCity を追記
 *    - weak (mountain/remote/requiresCar) → 専用マッピング
 *    - その他 → 都道府県フォールバック or gatewayHub
 *    - 全506件対象
 *
 * 実行: node scripts/buildHotelFallback.mjs
 */

import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import iconv from 'iconv-lite';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

const DEST_PATH  = resolve(ROOT, 'src/data/destinations.json');
const AREAS_PATH = resolve(ROOT, 'src/data/hotelAreas.json');

const destinations = JSON.parse(readFileSync(DEST_PATH, 'utf8'));
const hotelAreas   = JSON.parse(readFileSync(AREAS_PATH, 'utf8'));

const AREAS_BY_ID   = new Map(hotelAreas.map(a => [a.id, a]));
const AREAS_BY_NAME = new Map(hotelAreas.map(a => [a.name, a]));

/* destinations.json の id → hotelAreas.json の id */
const DEST_TO_AREA_ID = {
  'shirakawago-t': 'shirakawago',
  'kurashiki-o':   'kurashiki',
  'takayama-o':    'takayama',
  'kurokawa-k':    'kurokawa',
  'esashi-hokkaido':'esashi',
};

// ─── Shift-JIS URL 生成 ───────────────────────────────────────────────
function encodeToSJIS(str) {
  const buf = iconv.encode(str, 'Shift_JIS');
  return [...buf].map(b => '%' + b.toString(16).padStart(2, '0').toUpperCase()).join('');
}
function buildJalanUrlSJIS(keyword) {
  return `https://www.jalan.net/uw/uwp2011/uww2011init.do?keyword=${encodeToSJIS(keyword)}&screenId=UWW1402`;
}

// ─── weak 専用フォールバック ──────────────────────────────────────────
const WEAK_FALLBACK = {
  'ryusendo':              '盛岡',
  'akita-oga':             '角館',
  'gassan':                '蔵王',
  'akakura-onsen':         '新潟',
  'togakushi':             '松本',
  'innoshima':             '尾道',
  'nemuro':                '釧路',
  'ogata':                 '角館',
  'nagi':                  '岡山',
  'otoyo':                 '高知',
  'yuwaku-onsen':          '金沢',
  'yura-wakayama':         '白浜',
  'ebino':                 '宮崎',
  'minamikyushu':          '鹿児島',
  'minamiosumi':           '鹿児島',
  'chatan':                '那覇',
  'uruma':                 '那覇',
  'nanto':                 '立山黒部',
  'hakusan':               '金沢',
  'kamo-kyoto':            '奈良',
  'myoko':                 '新潟',
  'akkeshi':               '釧路',
  'kitami':                '旭川',
  'monbetsu':              '旭川',
  'mashike':               '旭川',
  'nokogiriyama':          '館山',
  'tango-kyoto':           '天橋立',
  'nagato-yamaguchi':      '萩',
  'mine-yamaguchi':        '萩',
  'tosa-city':             '高知',
  'oguni-kumamoto':        '黒川温泉',
  'nanjo-okinawa':         '那覇',
  'ikata':                 '松山',
  'muroto-cape':           '高知',
  'oshima-yamaguchi':      '萩',
  'uda-nara':              '奈良',
  'takayama-kogen':        '高山',
  'togatta-onsen':         '蔵王',
  'hachimantai-onsen':     '角館',
  'nomaike':               '鹿児島',
  'hioki':                 '鹿児島',
  'hirakawa':              '弘前',
  'kurikoma':              '仙台',
  'namioka':               '弘前',
  'shimokita':             '奥入瀬',
  'towada-lake':           '奥入瀬',
  'oshika':                '仙台',
  'tateyama-toyama':       '立山黒部',
  'suo-sanbe':             '松江',
  'takachihogo-shishiku':  '高千穂',
  'kamishihoro':           '帯広',
  'unzen2':                '長崎',
  'ogimi':                 '那覇',
};

// ─── 都道府県 → フォールバック都市 ────────────────────────────────────
const PREF_FALLBACK = {
  hokkaido: '札幌',   aomori:  '弘前',    iwate:    '盛岡',
  miyagi:   '仙台',   akita:   '角館',    yamagata: '蔵王',
  fukushima:'会津若松',ibaraki: '水戸',    tochigi:  '日光',
  gunma:    '草津温泉',chiba:   '館山',    kanagawa: '横浜',
  nagano:   '松本',   shizuoka:'熱海',    aichi:    '名古屋',
  gifu:     '高山',   toyama:  '氷見',    ishikawa: '金沢',
  niigata:  '新潟',   kyoto:   '京都',    osaka:    '大阪',
  hyogo:    '城崎温泉',nara:    '奈良',    wakayama: '白浜',
  shimane:  '松江',   tottori: '鳥取',    okayama:  '倉敷',
  hiroshima:'広島',   yamaguchi:'萩',     tokushima:'徳島',
  kagawa:   '琴平',   kochi:   '高知',    ehime:    '松山',
  fukuoka:  '博多',   saga:    '嬉野温泉', nagasaki: '長崎',
  kumamoto: '熊本',   oita:    '湯布院',  miyazaki: '宮崎',
  kagoshima:'鹿児島', okinawa: '那覇',    fukui:    '敦賀',
  mie:      '伊勢',   tokyo:   '東京',    shiga:    '長浜',
  saitama:  '川越',   yamanashi:'富士河口湖',
};

// ─── Step 1: hotelAreas に未登録の193件を追記 ─────────────────────────
console.log('=== Step 1: hotelAreas.json に未登録エントリ追記 ===');

const newAreas = [];
let skipped = 0;

for (const dest of destinations) {
  const areaId = DEST_TO_AREA_ID[dest.id] ?? dest.id;
  if (AREAS_BY_ID.has(areaId)) { skipped++; continue; }

  const keyword = `${dest.prefecture} ${dest.hotelKeyword ?? dest.name}`;
  const jalanUrl = buildJalanUrlSJIS(keyword);
  const rakutenPath = `/yado/${dest.hotelArea}/`;

  const entry = {
    id:          dest.id,
    name:        dest.name,
    prefCode:    dest.hotelArea,
    prefecture:  dest.prefecture,
    rakutenPath,
    jalanUrl,
    jalanKeyword: keyword,
    _generated:  true,
  };

  newAreas.push(entry);
  AREAS_BY_ID.set(dest.id, entry);
  AREAS_BY_NAME.set(dest.name, entry);
}

console.log(`  既存: ${skipped} 件`);
console.log(`  新規追記: ${newAreas.length} 件`);

const updatedAreas = [...hotelAreas, ...newAreas];
writeFileSync(AREAS_PATH, JSON.stringify(updatedAreas, null, 2), 'utf8');
console.log(`  → hotelAreas.json 書き込み完了 (${updatedAreas.length} 件)`);

// ─── Step 2: destinations.json に fallbackCity を追記 ─────────────────
console.log('\n=== Step 2: destinations.json に fallbackCity 追記 ===');

let weakCount = 0, prefCount = 0, hubCount = 0, alreadyCount = 0;

const updatedDestinations = destinations.map(dest => {
  if (dest.fallbackCity) { alreadyCount++; return dest; }

  const isWeak = dest.requiresCar || dest.destType === 'remote' || dest.destType === 'mountain';
  let fallbackCity = null;

  if (WEAK_FALLBACK[dest.id]) {
    fallbackCity = WEAK_FALLBACK[dest.id];
    weakCount++;
  } else if (dest.gatewayHub && AREAS_BY_NAME.has(dest.gatewayHub)) {
    fallbackCity = dest.gatewayHub;
    hubCount++;
  } else {
    fallbackCity = PREF_FALLBACK[dest.hotelArea] ?? null;
    if (fallbackCity) prefCount++;
  }

  return { ...dest, fallbackCity };
});

console.log(`  weak専用マッピング: ${weakCount} 件`);
console.log(`  gatewayHub使用: ${hubCount} 件`);
console.log(`  都道府県フォールバック: ${prefCount} 件`);
console.log(`  既存(スキップ): ${alreadyCount} 件`);
console.log(`  fallbackCity未設定: ${updatedDestinations.filter(d => !d.fallbackCity).length} 件`);

writeFileSync(DEST_PATH, JSON.stringify(updatedDestinations, null, 2), 'utf8');
console.log(`  → destinations.json 書き込み完了 (${updatedDestinations.length} 件)`);

console.log('\n✓ buildHotelFallback 完了');
