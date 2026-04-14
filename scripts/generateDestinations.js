/**
 * generateDestinations.js — destination 自動生成パイプライン
 *
 * Wikipedia API から温泉・島・山・観光地のカテゴリページを取得し、
 * 正規化・分類・重複排除して generated.json に出力する。
 *
 * 使い方:
 *   node scripts/generateDestinations.js                # 本番実行（数分〜）
 *   node scripts/generateDestinations.js --test         # 1カテゴリのみサンプル
 *   node scripts/generateDestinations.js --batch=200    # 生成件数上限
 *   node scripts/generateDestinations.js --auto-merge   # enrich→merge→dedupe→validate自動実行
 *
 * 出力: src/data/destinations/generated.json
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..');
const OUTPUT_DIR = path.join(PROJECT_ROOT, 'src/data/destinations');
const OUTPUT_FILE = path.join(OUTPUT_DIR, 'generated.json');
const EXISTING_FILE = path.join(PROJECT_ROOT, 'src/data/destinations.json');

const WIKIPEDIA_API = 'https://ja.wikipedia.org/w/api.php';
const TEST_MODE = process.argv.includes('--test');
const AUTO_MERGE = process.argv.includes('--auto-merge');
// --batch=200 形式でバッチサイズ指定（destination件数上限）
const BATCH_ARG = process.argv.find(a => a.startsWith('--batch='));
const BATCH_LIMIT = BATCH_ARG ? parseInt(BATCH_ARG.split('=')[1], 10) : null;

/* ── 都道府県別カテゴリテンプレート ──
 * 「日本の温泉」は空なので、都道府県ごとに「〇〇県の温泉」で取得
 */
const CATEGORY_TEMPLATES = [
  { suffix: 'の温泉', destType: 'onsen' },
  { suffix: 'の島',   destType: 'island' },
  { suffix: 'の山',   destType: 'mountain' },
  { suffix: 'の観光地', destType: 'sight' },
  { suffix: 'の滝',   destType: 'sight' },
  { suffix: 'の湖',   destType: 'sight' },
  { suffix: 'の城',   destType: 'sight' },
  { suffix: 'の神社', destType: 'sight' },
  { suffix: 'の寺院', destType: 'sight' },
];

/** 都道府県 × テンプレートでカテゴリリスト生成 */
function buildCategories() {
  const cats = [];
  for (const pref of PREFECTURES) {
    for (const tpl of CATEGORY_TEMPLATES) {
      cats.push({
        cat: `${pref}${tpl.suffix}`,
        destType: tpl.destType,
        pref,  // 所属prefectureを事前付与（API取得省略可能）
      });
    }
  }
  return cats;
}

/* ── 都道府県一覧 ── */
const PREFECTURES = [
  '北海道', '青森県', '岩手県', '宮城県', '秋田県', '山形県', '福島県',
  '茨城県', '栃木県', '群馬県', '埼玉県', '千葉県', '東京都', '神奈川県',
  '新潟県', '富山県', '石川県', '福井県', '山梨県', '長野県',
  '岐阜県', '静岡県', '愛知県', '三重県',
  '滋賀県', '京都府', '大阪府', '兵庫県', '奈良県', '和歌山県',
  '鳥取県', '島根県', '岡山県', '広島県', '山口県',
  '徳島県', '香川県', '愛媛県', '高知県',
  '福岡県', '佐賀県', '長崎県', '熊本県', '大分県', '宮崎県', '鹿児島県', '沖縄県',
];

/* ── 県庁所在地（fallbackCity用） ── */
const PREF_CAPITAL = {
  '北海道': '札幌', '青森県': '青森', '岩手県': '盛岡', '宮城県': '仙台',
  '秋田県': '秋田', '山形県': '山形', '福島県': '福島',
  '茨城県': '水戸', '栃木県': '宇都宮', '群馬県': '前橋',
  '埼玉県': 'さいたま', '千葉県': '千葉', '東京都': '東京', '神奈川県': '横浜',
  '新潟県': '新潟', '富山県': '富山', '石川県': '金沢', '福井県': '福井',
  '山梨県': '甲府', '長野県': '長野',
  '岐阜県': '岐阜', '静岡県': '静岡', '愛知県': '名古屋', '三重県': '津',
  '滋賀県': '大津', '京都府': '京都', '大阪府': '大阪', '兵庫県': '神戸',
  '奈良県': '奈良', '和歌山県': '和歌山',
  '鳥取県': '鳥取', '島根県': '松江', '岡山県': '岡山', '広島県': '広島', '山口県': '山口',
  '徳島県': '徳島', '香川県': '高松', '愛媛県': '松山', '高知県': '高知',
  '福岡県': '福岡', '佐賀県': '佐賀', '長崎県': '長崎', '熊本県': '熊本',
  '大分県': '大分', '宮崎県': '宮崎', '鹿児島県': '鹿児島', '沖縄県': '那覇',
};

const PREF_REGION = {
  '北海道': '北海道', '青森県': '東北', '岩手県': '東北', '宮城県': '東北',
  '秋田県': '東北', '山形県': '東北', '福島県': '東北',
  '茨城県': '関東', '栃木県': '関東', '群馬県': '関東',
  '埼玉県': '関東', '千葉県': '関東', '東京都': '関東', '神奈川県': '関東',
  '新潟県': '中部', '富山県': '中部', '石川県': '中部', '福井県': '中部',
  '山梨県': '中部', '長野県': '中部', '岐阜県': '中部', '静岡県': '中部', '愛知県': '中部',
  '三重県': '近畿', '滋賀県': '近畿', '京都府': '近畿', '大阪府': '近畿',
  '兵庫県': '近畿', '奈良県': '近畿', '和歌山県': '近畿',
  '鳥取県': '中国', '島根県': '中国', '岡山県': '中国', '広島県': '中国', '山口県': '中国',
  '徳島県': '四国', '香川県': '四国', '愛媛県': '四国', '高知県': '四国',
  '福岡県': '九州', '佐賀県': '九州', '長崎県': '九州', '熊本県': '九州',
  '大分県': '九州', '宮崎県': '九州', '鹿児島県': '九州', '沖縄県': '沖縄',
};

/* ── 除外ワード（イベント、施設名等） ── */
const EXCLUDE_PATTERN = /[（(]|祭|博覧会|フェスティバル|イベント|一覧|リスト|年表|歴史|建築|アーカイブ|資料|文書|法人|協会|学校|大学|病院|ホテル$|旅館$/;

/* ── ヘルパー ── */

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function wikiRequest(params) {
  const url = new URL(WIKIPEDIA_API);
  url.search = new URLSearchParams({
    format: 'json',
    ...params,
    origin: '*',
  });
  const res = await fetch(url, { headers: { 'User-Agent': 'dokoiko-generator/1.0' } });
  if (!res.ok) throw new Error(`Wikipedia API ${res.status}`);
  return res.json();
}

/** カテゴリ内ページ一覧取得（再帰・深さ制限あり） */
async function getCategoryMembers(category, depth = 1, limit = 500, seen = new Set()) {
  const members = [];
  let cmcontinue = null;
  const cacheKey = `cat:${category}`;
  if (seen.has(cacheKey)) return members;
  seen.add(cacheKey);

  while (members.length < limit) {
    const params = {
      action: 'query',
      list: 'categorymembers',
      cmtitle: `Category:${category}`,
      cmlimit: String(Math.min(500, limit - members.length)),
      cmtype: 'page|subcat',
    };
    if (cmcontinue) params.cmcontinue = cmcontinue;

    try {
      const data = await wikiRequest(params);
      const items = data.query?.categorymembers ?? [];
      for (const item of items) {
        if (item.ns === 14 && depth > 1) {
          // サブカテゴリ → 再帰
          const subCat = item.title.replace(/^Category:/, '');
          await sleep(300);
          const subMembers = await getCategoryMembers(subCat, depth - 1, limit, seen);
          members.push(...subMembers);
          if (members.length >= limit) break;
        } else if (item.ns === 0) {
          members.push(item.title);
        }
      }
      if (!data.continue?.cmcontinue) break;
      cmcontinue = data.continue.cmcontinue;
      await sleep(500);
    } catch (err) {
      console.warn(`  [warn] category=${category}: ${err.message}`);
      break;
    }
  }
  return members;
}

/** ページの緯度経度を取得（prefectureは呼び出し側で事前付与） */
async function getPageInfo(titles) {
  if (!titles.length) return {};
  const CHUNK = 50;
  const result = {};
  for (let i = 0; i < titles.length; i += CHUNK) {
    const chunk = titles.slice(i, i + CHUNK);
    const params = {
      action: 'query',
      prop: 'coordinates',
      titles: chunk.join('|'),
      coprimary: 'primary',
    };
    try {
      const data = await wikiRequest(params);
      const pages = data.query?.pages ?? {};
      for (const page of Object.values(pages)) {
        if (!page.title) continue;
        const coord = page.coordinates?.[0];
        result[page.title] = {
          lat: coord?.lat ?? null,
          lng: coord?.lon ?? null,
        };
      }
      await sleep(300);
    } catch (err) {
      console.warn(`  [warn] getPageInfo: ${err.message}`);
    }
  }
  return result;
}

/* ── 正規化 ── */

function normalize(name) {
  return name
    .replace(/（[^）]*）$/, '')        // 全角括弧内除去
    .replace(/\([^)]*\)$/, '')         // 半角括弧内除去
    .replace(/　/g, '')                 // 全角スペース除去
    .replace(/\s+/g, '')                // 空白除去
    .trim();
}

/** destType を name から推定（category指定を優先） */
function inferDestType(name, categoryDestType) {
  if (categoryDestType === 'onsen') return 'onsen';
  if (categoryDestType === 'island') return 'island';
  if (categoryDestType === 'mountain') return 'mountain';
  // 名前からの推定
  if (/温泉$/.test(name))   return 'onsen';
  if (/島$/.test(name))     return 'island';
  if (/[山岳峰]$/.test(name)) return 'mountain';
  return categoryDestType ?? 'sight';
}

/** id生成（prefecture + name） */
function generateId(name, prefecture) {
  // 英数字化は困難なので prefecture 頭文字 + 連番 + name hash
  const prefCode = (prefecture ?? '').slice(0, 2);
  const clean = normalize(name);
  return `gen_${prefCode}_${clean}`;
}

/* ── メイン処理 ── */

async function main() {
  console.log('[generate] 開始');
  const allCategories = buildCategories();
  const categories = TEST_MODE ? allCategories.slice(0, 9) : allCategories; // TEST: 最初の都道府県のみ
  console.log(`[generate] 対象カテゴリ: ${categories.length}`);

  // 既存destinationsのnormalized名を重複排除用に読み込み
  const existing = JSON.parse(fs.readFileSync(EXISTING_FILE, 'utf8'));
  const existingNames = new Set(existing.map(d => normalize(d.displayName || d.name)));
  console.log(`[generate] 既存 ${existingNames.size} 件 → 重複排除対象`);

  /* ① カテゴリごとに取得（都道府県情報は事前付与） */
  const allItems = new Map(); // normalizedName → { name, destType, prefecture }
  for (const { cat, destType, pref } of categories) {
    const titles = await getCategoryMembers(cat, 1, 500);
    if (titles.length > 0) {
      console.log(`  [${cat}] → ${titles.length} 件`);
    }

    for (const title of titles) {
      if (EXCLUDE_PATTERN.test(title)) continue;
      const nn = normalize(title);
      if (!nn || nn.length < 2) continue;
      if (existingNames.has(nn)) continue;
      // 既に登録済みなら destType の整合性チェック（onsen/island/mountain優先）
      if (allItems.has(nn)) {
        const existing = allItems.get(nn);
        if (['onsen','island','mountain'].includes(destType) && existing.destType === 'sight') {
          existing.destType = destType;
        }
        continue;
      }
      allItems.set(nn, { name: title, destType, prefecture: pref });
    }
  }
  console.log(`[generate] 重複排除後: ${allItems.size} 件`);

  /* バッチ制限: --batch=N で生成件数を上限N件に切り詰め */
  if (BATCH_LIMIT && allItems.size > BATCH_LIMIT) {
    const limited = new Map([...allItems.entries()].slice(0, BATCH_LIMIT));
    console.log(`[generate] バッチ制限 ${BATCH_LIMIT}件に切り詰め（元 ${allItems.size}件）`);
    allItems.clear();
    for (const [k, v] of limited) allItems.set(k, v);
  }

  /* ② メタデータ取得（緯度経度・都道府県） */
  console.log('[generate] メタデータ取得中...');
  const names = [...allItems.values()].map(v => v.name);
  const CHUNK = 500;
  const infoAll = {};
  for (let i = 0; i < names.length; i += CHUNK) {
    const chunk = names.slice(i, i + CHUNK);
    const info = await getPageInfo(chunk);
    Object.assign(infoAll, info);
    console.log(`  ${Math.min(i + CHUNK, names.length)}/${names.length}`);
    if (TEST_MODE && i >= 100) break;
  }

  /* ③ destination オブジェクト生成 */
  const generated = [];
  for (const [nn, { name, destType, prefecture }] of allItems.entries()) {
    const info = infoAll[name] ?? {};
    if (!prefecture || !info.lat || !info.lng) continue; // 必須情報なしはスキップ
    // 日本実効支配範囲外（北方領土等）は除外
    if (info.lat < 24 || info.lat > 46) continue;
    if (info.lng < 122 || info.lng > 146) continue;

    const capital = PREF_CAPITAL[prefecture] ?? null;
    const region  = PREF_REGION[prefecture]  ?? null;
    const finalDestType = inferDestType(nn, destType);

    generated.push({
      id: generateId(nn, prefecture),
      name: nn,
      displayName: nn,
      prefecture,
      region,
      lat: info.lat,
      lng: info.lng,
      destType: finalDestType,
      // 拠点都市（県庁所在地）
      hubCity: capital,
      fallbackCity: capital,
      // 宿泊可能性（手動エンリッチ前のデフォルト）
      isStayable: finalDestType === 'onsen' || finalDestType === 'sight',
      // 生成フラグ
      _generated: true,
      _source: 'wikipedia',
    });
  }

  console.log(`[generate] 生成完了: ${generated.length} 件（メタデータ欠損除外）`);

  /* ④ 出力 */
  if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(generated, null, 2));
  console.log(`[generate] 出力: ${OUTPUT_FILE}`);

  /* ⑤ QA */
  const noType = generated.filter(d => !d.destType).length;
  const noPref = generated.filter(d => !d.prefecture).length;
  const noHub  = generated.filter(d => !d.hubCity).length;
  const dupIds = new Set(generated.map(d => d.id)).size;
  console.log('\n[QA]');
  console.log(`  destType欠損: ${noType}`);
  console.log(`  prefecture欠損: ${noPref}`);
  console.log(`  hubCity欠損: ${noHub}`);
  console.log(`  uniqueID率: ${dupIds}/${generated.length}`);

  // 都道府県別分布
  const byPref = {};
  for (const d of generated) byPref[d.prefecture] = (byPref[d.prefecture] ?? 0) + 1;
  const topPrefs = Object.entries(byPref).sort((a, b) => b[1] - a[1]).slice(0, 10);
  console.log('\n[分布 Top10]');
  topPrefs.forEach(([p, n]) => console.log(`  ${p}: ${n}件`));

  /* ⑥ --auto-merge: enrich → merge → dedupe → validate を自動実行 */
  if (AUTO_MERGE) {
    console.log('\n═══════════════════════════════════');
    console.log('  auto-merge パイプライン実行');
    console.log('═══════════════════════════════════');

    const runStep = (label, cmd) => {
      console.log(`\n[${label}]`);
      try {
        execSync(cmd, { stdio: 'inherit', cwd: PROJECT_ROOT });
      } catch (err) {
        console.error(`[${label}] 失敗:`, err.message);
        throw err;
      }
    };

    runStep('enrich',   'node scripts/enrichDestinations.js');
    runStep('merge',    'node scripts/mergeDestinations.js');
    runStep('dedupe',   'node scripts/deduplicateDestinations.js --apply');
    runStep('validate', 'node scripts/validateStructure.js');

    /* 最終件数ログ */
    const final = JSON.parse(fs.readFileSync(EXISTING_FILE, 'utf8'));
    console.log('\n═══════════════════════════════════');
    console.log(`  ✓ final destinations: ${final.length}件`);
    console.log('═══════════════════════════════════');
  }
}

main().catch(err => {
  console.error('[FATAL]', err);
  process.exit(1);
});
