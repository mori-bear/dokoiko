// scripts/fixAllHotels.js
// ビルド時に全宿泊リンクを事前生成し destinations.json の hotelLinks フィールドに保存する
// Node.js 専用（iconv-lite 使用 — ブラウザ不可）
//
// 使い方: node scripts/fixAllHotels.js
// 出力:   各 destination に { hotelLinks: { rakuten, jalan } } を追加
//
// ■ 安全装置（全国フォールバック防止）
//   keyword 生成後に品質チェックを実施し、NG なら 3 段階の自動修正を試みる。
//   すべてのステップで NG の場合は keywordOverrides.json に追記してログ出力する。

import fs   from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import iconv from 'iconv-lite';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const DESTS_PATH       = path.join(__dirname, '../src/data/destinations.json');
const HOTEL_AREAS_PATH = path.join(__dirname, '../src/data/hotelAreas.json');
const AFFILIATE_PATH   = path.join(__dirname, '../src/data/affiliateProviders.json');
const OVERRIDES_PATH   = path.join(__dirname, '../src/data/keywordOverrides.json');

const dests       = JSON.parse(fs.readFileSync(DESTS_PATH, 'utf-8'));
const HOTEL_AREAS = JSON.parse(fs.readFileSync(HOTEL_AREAS_PATH, 'utf-8'));
const AFFILIATE   = JSON.parse(fs.readFileSync(AFFILIATE_PATH, 'utf-8'));

const AREAS_BY_ID   = new Map(HOTEL_AREAS.map(a => [a.id, a]));
const AREAS_BY_NAME = new Map(HOTEL_AREAS.map(a => [a.name, a]));

const RAKUTEN_AFID = AFFILIATE.rakuten.affiliateId;
const JALAN_VC_SID = AFFILIATE.jalan.vcSid;
const JALAN_VC_PID = AFFILIATE.jalan.vcPid;

const ONSEN_STAY_AREAS = new Set(
  HOTEL_AREAS.filter(a => a.name.includes('温泉')).map(a => a.name)
);

// hotelAreas.json と destinations.json の ID 差異を吸収
const DEST_TO_AREA_ID = {
  'shirakawago-t':   'shirakawago',
  'kurashiki-o':     'kurashiki',
  'takayama-o':      'takayama',
  'kurokawa-k':      'kurokawa',
  'esashi-hokkaido': 'esashi',
};

// 都道府県名 → Rakuten Travel URL コード
// dest.prefecture の値に合わせた完全一致キー（北海道/東京都/京都府/大阪府 + XX県）
const PREF_CODE_MAP = {
  '北海道': 'hokkaido', '青森県': 'aomori', '岩手県': 'iwate', '宮城県': 'miyagi',
  '秋田県': 'akita',   '山形県': 'yamagata', '福島県': 'fukushima', '茨城県': 'ibaraki',
  '栃木県': 'tochigi', '群馬県': 'gunma', '埼玉県': 'saitama', '千葉県': 'chiba',
  '東京都': 'tokyo',   '神奈川県': 'kanagawa', '新潟県': 'niigata', '富山県': 'toyama',
  '石川県': 'ishikawa','福井県': 'fukui', '山梨県': 'yamanashi', '長野県': 'nagano',
  '岐阜県': 'gifu',   '静岡県': 'shizuoka', '愛知県': 'aichi', '三重県': 'mie',
  '滋賀県': 'shiga',  '京都府': 'kyoto', '大阪府': 'osaka', '兵庫県': 'hyogo',
  '奈良県': 'nara',   '和歌山県': 'wakayama', '鳥取県': 'tottori', '島根県': 'shimane',
  '岡山県': 'okayama','広島県': 'hiroshima', '山口県': 'yamaguchi', '徳島県': 'tokushima',
  '香川県': 'kagawa', '愛媛県': 'ehime', '高知県': 'kochi', '福岡県': 'fukuoka',
  '佐賀県': 'saga',   '長崎県': 'nagasaki', '熊本県': 'kumamoto', '大分県': 'oita',
  '宮崎県': 'miyazaki','鹿児島県': 'kagoshima', '沖縄県': 'okinawa',
};

// ── ユーティリティ ────────────────────────────────────────────────────

function isWeak(dest) {
  return !!(dest.requiresCar && (dest.destType === 'mountain' || dest.destType === 'remote'));
}

function getStayAreaFor(dest, service) {
  const sa = dest.stayArea;
  if (!sa) return null;
  if (typeof sa === 'string') return sa;
  const other = service === 'rakuten' ? 'jalan' : 'rakuten';
  return sa[service] ?? sa[other] ?? null;
}

function normalizeArea(area) {
  return String(area ?? '')
    .trim()
    .replace(/[\u3000\s]+/g, ' ')
    .replace(/%/g, '')
    .replace(/[\x00-\x1F\x7F]/g, '')
    .trim();
}

function lookupAreaById(destId) {
  const areaId = DEST_TO_AREA_ID[destId] ?? destId;
  return AREAS_BY_ID.get(areaId) ?? null;
}

function lookupAreaByName(name) {
  return AREAS_BY_NAME.get(name) ?? null;
}

/** アフィリエイトURL（日付なし — フロントで appendDateParams を付与） */
function buildRakutenAffilUrl(destUrl) {
  return `https://hb.afl.rakuten.co.jp/hgc/${RAKUTEN_AFID}/?pc=${encodeURIComponent(destUrl)}`;
}

/** アフィリエイトURL（日付なし — フロントで appendDateParams を付与） */
function buildJalanAffilUrl(rawJalanUrl) {
  return `https://ck.jp.ap.valuecommerce.com/servlet/referral?sid=${JALAN_VC_SID}&pid=${JALAN_VC_PID}&vc_url=${encodeURIComponent(rawJalanUrl)}`;
}

// ── 楽天キーワード品質チェック ────────────────────────────────────────

// 都道府県名リスト（キーワード内包チェック用）
const PREFECTURE_NAMES = new Set([
  '北海道', '青森', '岩手', '宮城', '秋田', '山形', '福島',
  '茨城', '栃木', '群馬', '埼玉', '千葉', '東京', '神奈川',
  '新潟', '富山', '石川', '福井', '山梨', '長野', '岐阜',
  '静岡', '愛知', '三重', '滋賀', '京都', '大阪', '兵庫',
  '奈良', '和歌山', '鳥取', '島根', '岡山', '広島', '山口',
  '徳島', '香川', '愛媛', '高知',
  '福岡', '佐賀', '長崎', '熊本', '大分', '宮崎', '鹿児島', '沖縄',
]);

/**
 * 楽天キーワードの品質を検証する（静的チェック）。
 *
 * FAIL 条件:
 *   - キーワードが空
 *   - 2語未満（1語のみ）
 *   - 都道府県名が含まれない
 *   - 「温泉」or「宿」が含まれない
 *
 * @returns {{ ok: boolean, reason?: string }}
 */
function validateKeywordQuality(keyword) {
  if (!keyword || !keyword.trim()) {
    return { ok: false, reason: 'キーワードが空' };
  }

  const tokens = keyword.trim().split(/\s+/);
  if (tokens.length < 2) {
    return { ok: false, reason: `1語のみ（"${keyword}"）` };
  }

  const hasPref = [...PREFECTURE_NAMES].some(p => keyword.includes(p));
  if (!hasPref) {
    return { ok: false, reason: `都道府県名なし（"${keyword}"）` };
  }

  if (!keyword.includes('温泉') && !keyword.includes('宿')) {
    return { ok: false, reason: `「温泉」「宿」なし（"${keyword}"）` };
  }

  return { ok: true };
}

/**
 * キーワード品質 NG 時の 3 段階自動修正。
 *
 * Step1: "{name} {prefecture} 温泉/宿"
 * Step2: 温泉地なら "{name}温泉郷 {prefecture} 温泉"
 * Step3: hubCity ベースに切替 "{hubCity} {prefecture} 温泉/宿"
 *
 * @returns {{ keyword: string, step: number } | null}
 */
function autoFixKeyword(dest) {
  const isOnsen = dest.destType === 'onsen' || (dest.tags?.includes('温泉') ?? false);
  const suffix  = isOnsen ? '温泉' : '宿';
  const pref    = dest.prefecture ?? '';

  // Step 1: name ベース
  if (dest.name && pref) {
    const kw1 = `${dest.name} ${pref} ${suffix}`;
    if (validateKeywordQuality(kw1).ok) return { keyword: kw1, step: 1 };
  }

  // Step 2: 温泉地なら「温泉郷」補完
  if (isOnsen && dest.name && pref) {
    const kw2 = `${dest.name}温泉郷 ${pref} 温泉`;
    if (validateKeywordQuality(kw2).ok) return { keyword: kw2, step: 2 };
  }

  // Step 3: hubCity ベース
  if (dest.hubCity && pref) {
    const kw3 = `${dest.hubCity} ${pref} ${suffix}`;
    if (validateKeywordQuality(kw3).ok) return { keyword: kw3, step: 3 };
  }

  return null;
}

// ── 楽天URL生成 ──────────────────────────────────────────────────────

// ── 楽天キーワード強制補正マップ（人間キュレーション） ─────────────────
// name に key が含まれる場合、value を固定キーワードとして使用する。
// 理由: 単体キーワードだと楽天が全国フォールバックするエリア名の修正。
const KEYWORD_OVERRIDES_STATIC = new Map([
  ['霧島',    '霧島温泉郷 鹿児島 温泉'],
  ['霧島温泉', '霧島温泉郷 鹿児島 温泉'],
  ['阿蘇',    '阿蘇温泉 熊本 温泉'],
  ['日田',    '日田温泉 大分 温泉'],
  ['高山',    '飛騨高山 岐阜 宿'],
  ['高千穂',  '高千穂 宮崎 宿'],
  ['黒川',    '黒川温泉 熊本 温泉'],
  ['別府',    '別府温泉 大分 温泉'],
  ['湯布院',  '湯布院温泉 大分 温泉'],
  ['由布院',  '湯布院温泉 大分 温泉'],
  ['草津',    '草津温泉 群馬 温泉'],
  ['箱根',    '箱根温泉 神奈川 温泉'],
  ['軽井沢',  '軽井沢 長野 宿'],
  ['白川郷',  '白川郷 岐阜 宿'],
  ['知床',    '知床 北海道 宿'],
  ['屋久島',  '屋久島 鹿児島 宿'],
]);

// ── 温泉郷強制上書きリスト ─────────────────────────────────────────────
// name にキーが含まれる場合、"{baseName}温泉郷 {prefecture} 温泉" を強制生成する。
// 対象: 地名単体では楽天が全国解釈するリスクの高い有名温泉地。
// name が「温泉」で終わる場合は「温泉」を除いて「温泉郷」に変換し二重化を防ぐ。
const FORCE_ONSEN = ['霧島', '阿蘇', '日田', '由布院', '黒川', '別府'];

// 自動生成 override（src/data/keywordOverrides.json から読み込み）
// フォーマット: { "dest_id": "keyword" }
const OVERRIDES_FILE = fs.existsSync(OVERRIDES_PATH)
  ? JSON.parse(fs.readFileSync(OVERRIDES_PATH, 'utf-8'))
  : {};

/**
 * 楽天キーワードを生成する。
 *
 * 優先順位:
 * ① KEYWORD_OVERRIDES_STATIC（人間キュレーション、name包含マッチ）
 * ② 自動生成 override（ID 完全一致）
 * ③ FORCE_ONSEN（温泉郷強制 — 全国フォールバックリスク排除）
 * ④ hubCity あり → "{hubCity} {prefecture} 宿"
 * ⑤ name に「温泉」含む or destType=onsen → "{name} {prefecture} 温泉"
 * ⑥ その他 → "{name} {prefecture} 宿"
 */
function buildRakutenKeyword(dest) {
  // ① 静的補正（name 包含マッチ）
  for (const [key, override] of KEYWORD_OVERRIDES_STATIC) {
    if (dest.name && dest.name.includes(key)) {
      return override;
    }
  }

  // ② 自動生成 override（ID 完全一致）
  if (OVERRIDES_FILE[dest.id]) {
    return OVERRIDES_FILE[dest.id];
  }

  const pref = dest.prefecture ?? '';
  const name = dest.displayName || dest.name || '';

  // ③ FORCE_ONSEN: 曖昧地名 → 温泉郷キーワードに強制変換
  // name が「温泉」で終わる場合は除去（"黒川温泉" → "黒川温泉郷" ≠ "黒川温泉温泉郷"）
  for (const k of FORCE_ONSEN) {
    if (dest.name && dest.name.includes(k)) {
      const baseName = name.endsWith('温泉') ? name.slice(0, -2) : name;
      return `${baseName}温泉郷 ${pref} 温泉`;
    }
  }

  // ④ hubCity: 拠点都市でホテルを検索（hubCity は宿泊地 → suffix は宿）
  // hubCity === name の場合（自身をhubに設定）は名前ベースロジックで処理する
  if (dest.hubCity && dest.hubCity !== name) {
    return `${dest.hubCity} ${pref} 宿`;
  }

  // ⑤ 温泉判定: name に「温泉」含む OR destType=onsen → suffix は「温泉」
  const isOnsen = name.includes('温泉') || dest.destType === 'onsen';
  const suffix  = isOnsen ? '温泉' : '宿';

  return `${name} ${pref} ${suffix}`;
}

/**
 * 楽天 destination URL を生成する。
 *
 * 優先順位:
 * ① hotelAreas.json の rakutenPath（エリア別ページ → 最も絞られた結果）
 * ② 都道府県別ページ /yado/{prefCode}/ （県内全宿を表示 → 確実に動作）
 * ③ f_query フォールバック（SPA全国マップになるが最後の手段）
 */
function buildRakutenDestUrl(dest) {
  // ① エリアパス（hotelAreas.json に rakutenPath がある場合）
  const areaId = DEST_TO_AREA_ID[dest.id] ?? dest.id;
  const area   = AREAS_BY_ID.get(areaId);
  if (area?.rakutenPath) {
    const url = `https://travel.rakuten.co.jp${area.rakutenPath}`;
    return buildRakutenAffilUrl(url);
  }

  // ② 都道府県別ページ
  const prefCode = PREF_CODE_MAP[dest.prefecture];
  if (prefCode) {
    const url = `https://travel.rakuten.co.jp/yado/${prefCode}/`;
    return buildRakutenAffilUrl(url);
  }

  // ③ f_query フォールバック（全国マップになる可能性あり）
  const keyword   = buildRakutenKeyword(dest);
  const searchUrl = `https://travel.rakuten.co.jp/yado/japan.html?f_query=${encodeURIComponent(keyword)}`;
  return buildRakutenAffilUrl(searchUrl);
}

// ── じゃらんURL生成 ──────────────────────────────────────────────────

/** じゃらんキーワード検索URL（Shift-JIS エンコード） */
function buildJalanUrl(area) {
  const normalized = normalizeArea(area);
  const sjisBytes = iconv.encode(normalized, 'cp932');
  const encoded = Array.from(sjisBytes)
    .map(b => '%' + b.toString(16).toUpperCase().padStart(2, '0'))
    .join('');
  return `https://www.jalan.net/uw/uwp2011/uww2011init.do?keyword=${encoded}`;
}

function buildJalanKeywordUrl(keyword) {
  if (!keyword) return null;
  return buildJalanAffilUrl(buildJalanUrl(keyword));
}

// ── じゃらんURL解決 ──────────────────────────────────────────────────

function resolveJalanUrl(dest) {
  const name = dest.displayName || dest.name;

  // stayArea.jalan が設定済みなら最優先
  const jalanArea = getStayAreaFor(dest, 'jalan');
  if (jalanArea) return buildJalanKeywordUrl(jalanArea);

  // 温泉
  if (dest.destType === 'onsen' || ONSEN_STAY_AREAS.has(name)) {
    return buildJalanKeywordUrl(name);
  }
  // 島
  if (dest.destType === 'island' || dest.isIsland) {
    return buildJalanKeywordUrl(name);
  }

  if (!isWeak(dest)) {
    const area = lookupAreaById(dest.id);
    if (area?.jalanUrl) return buildJalanAffilUrl(area.jalanUrl);
  }
  if (dest.fallbackCity) {
    const fbArea = lookupAreaByName(dest.fallbackCity);
    if (fbArea?.jalanUrl) return buildJalanAffilUrl(fbArea.jalanUrl);
  }
  const area = lookupAreaById(dest.id);
  if (area?.jalanUrl) return buildJalanAffilUrl(area.jalanUrl);

  return buildJalanKeywordUrl(name);
}

// ── メイン ───────────────────────────────────────────────────────────

let updated        = 0;
let autoFixed      = 0;     // 自動修正が成功した件数
let overrideAdded  = 0;     // overrides.json に追記した件数
const failList     = [];    // 全ステップ失敗（人間レビュー必要）
const newOverrides = { ...OVERRIDES_FILE }; // 自動修正結果を蓄積

for (const dest of dests) {
  if (dest.type !== 'destination') continue;

  // ── 楽天キーワード生成 + 安全チェック ──────────────────────────────

  let keyword = buildRakutenKeyword(dest);

  // ② 弱いキーワード検知（2語以下 → 温泉を補完）
  if (keyword.split(/\s+/).filter(Boolean).length <= 2) {
    keyword += ' 温泉';
  }

  const check = validateKeywordQuality(keyword);

  if (!check.ok) {
    // 自動修正チェーン（Step1 → Step2 → Step3）
    const fix = autoFixKeyword(dest);

    if (fix) {
      // 修正成功 → override として記録（次回実行でも使われる）
      if (!newOverrides[dest.id] || newOverrides[dest.id] !== fix.keyword) {
        newOverrides[dest.id] = fix.keyword;
        overrideAdded++;
      }
      keyword = fix.keyword;
      autoFixed++;
      console.log(`  ✏ [step${fix.step}] ${dest.name} (${dest.id})`);
      console.log(`    NG: "${buildRakutenKeyword(dest)}" → OK: "${fix.keyword}"`);
    } else {
      // 全ステップ失敗
      failList.push({ id: dest.id, name: dest.name, reason: check.reason, keyword });
      console.error(`  ❌ [FAIL] ${dest.name} (${dest.id}): ${check.reason}`);
    }
  }

  // keyword → URL（エリアパス優先、都道府県フォールバック）
  const rakutenUrl = buildRakutenDestUrl(dest);

  // ── じゃらんURL ─────────────────────────────────────────────────────
  const destName = dest.displayName || dest.name;
  let jalanUrl;
  if (dest.hubCity && dest.hubCity !== destName) {
    const hubArea = lookupAreaByName(dest.hubCity);
    jalanUrl = hubArea?.jalanUrl
      ? buildJalanAffilUrl(hubArea.jalanUrl)
      : buildJalanKeywordUrl(dest.hubCity);
  } else {
    jalanUrl = resolveJalanUrl(dest);
  }

  dest.hotelLinks = {
    rakuten: rakutenUrl ?? null,
    jalan:   jalanUrl   ?? null,
  };
  updated++;
}

// ── override ファイル保存 ────────────────────────────────────────────

fs.writeFileSync(OVERRIDES_PATH, JSON.stringify(newOverrides, null, 2), 'utf-8');

// ── destinations.json 保存 ───────────────────────────────────────────

fs.writeFileSync(DESTS_PATH, JSON.stringify(dests, null, 2), 'utf-8');

// ── 結果サマリ ───────────────────────────────────────────────────────

console.log('');
console.log(`✓ ホテルリンク事前生成完了: ${updated}件`);
console.log(`  自動修正: ${autoFixed}件`);
console.log(`  override追加: ${overrideAdded}件`);

if (failList.length > 0) {
  console.error(`\n⚠ 人間レビュー必要（全ステップ失敗 ${failList.length}件）:`);
  for (const f of failList) {
    console.error(`   ${f.name} (${f.id}): ${f.reason}`);
    console.error(`   → KEYWORD_OVERRIDES_STATIC に追加してください`);
  }
  console.error(`\n   ヒント: KEYWORD_OVERRIDES_STATIC に以下を追加:`);
  for (const f of failList) {
    console.error(`   ['${f.name}', '${f.name} ${f.keyword.split(' ').slice(1).join(' ')}'],`);
  }
  process.exit(1);
}
