/**
 * scripts/auditDestinations.js
 * 全 destination の品質を一括チェックする最終検査スクリプト。
 *
 * 使い方: node scripts/auditDestinations.js
 *
 * チェック項目:
 *   ① 楽天キーワード: 3語以上 / 都道府県含む / 温泉 or 宿含む
 *   ② Google Maps: navigation.lat/lng または lat/lng が存在する
 *   ③ CTA: 秘境タグ → requiresCar=true
 *   ④ CTA: 離島タグ → accessType が ferry/plane/car のいずれか
 *   ⑤ 楽天URL: japan.html?f_query= フォーマット準拠
 *
 * 出力: 問題のある destination のみ一覧表示
 */

import fs   from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DESTS_PATH = path.join(__dirname, '../src/data/destinations.json');

const PREFECTURE_NAMES = new Set([
  '北海道', '青森', '岩手', '宮城', '秋田', '山形', '福島',
  '茨城', '栃木', '群馬', '埼玉', '千葉', '東京', '神奈川',
  '新潟', '富山', '石川', '福井', '山梨', '長野', '岐阜',
  '静岡', '愛知', '三重', '滋賀', '京都', '大阪', '兵庫',
  '奈良', '和歌山', '鳥取', '島根', '岡山', '広島', '山口',
  '徳島', '香川', '愛媛', '高知',
  '福岡', '佐賀', '長崎', '熊本', '大分', '宮崎', '鹿児島', '沖縄',
]);

/** アフィリエイトURL から楽天の f_query キーワードを抽出 */
function extractRakutenKeyword(affilUrl) {
  if (!affilUrl) return null;
  try {
    const m = affilUrl.match(/[?&]pc=([^&]+)/);
    if (!m) return null;
    const rakutenUrl = decodeURIComponent(m[1]);
    const url = new URL(rakutenUrl);
    return url.searchParams.get('f_query');
  } catch { return null; }
}

/** アフィリエイトURL から楽天の実URL を抽出 */
function extractRakutenUrl(affilUrl) {
  if (!affilUrl) return null;
  try {
    const m = affilUrl.match(/[?&]pc=([^&]+)/);
    if (!m) return affilUrl;
    return decodeURIComponent(m[1]);
  } catch { return affilUrl; }
}

// ── メイン ──────────────────────────────────────────────────────────
const dests = JSON.parse(fs.readFileSync(DESTS_PATH, 'utf-8'));
const destOnly = dests.filter(d => d.type === 'destination');

const issues = [];   // { id, name, category, detail }
const stats  = {
  total:       destOnly.length,
  rakutenOk:   0,
  mapsOk:      0,
  ctaOk:       0,
  islandOk:    0,
  urlFormatOk: 0,
};

for (const d of destOnly) {
  const tags = d.tags ?? [];

  // ① 楽天キーワード品質
  const affilUrl = d.hotelLinks?.rakuten;
  if (!affilUrl) {
    issues.push({ id: d.id, name: d.name, category: '楽天', detail: 'hotelLinks.rakuten が未設定' });
  } else {
    const realUrl = extractRakutenUrl(affilUrl);
    const kw      = extractRakutenKeyword(affilUrl);

    // URL フォーマット
    if (!/\/yado\/japan\.html/.test(realUrl ?? '')) {
      issues.push({ id: d.id, name: d.name, category: '楽天URL', detail: `japan.html 以外: ${realUrl?.slice(0, 60)}` });
    } else {
      stats.urlFormatOk++;
    }

    if (!kw) {
      issues.push({ id: d.id, name: d.name, category: '楽天KW', detail: 'f_query 抽出失敗' });
    } else {
      const tokens  = kw.trim().split(/\s+/);
      const hasPref = [...PREFECTURE_NAMES].some(p => kw.includes(p));
      const hasSuf  = kw.includes('温泉') || kw.includes('宿');

      if (tokens.length < 3) {
        issues.push({ id: d.id, name: d.name, category: '楽天KW', detail: `3語未満: "${kw}"` });
      } else if (!hasPref) {
        issues.push({ id: d.id, name: d.name, category: '楽天KW', detail: `都道府県なし: "${kw}"` });
      } else if (!hasSuf) {
        issues.push({ id: d.id, name: d.name, category: '楽天KW', detail: `温泉/宿なし: "${kw}"` });
      } else {
        stats.rakutenOk++;
      }
    }
  }

  // ② Google Maps: navigation または lat/lng が存在する
  const hasNav    = d.navigation?.lat && d.navigation?.lng;
  const hasLatLng = d.lat && d.lng;
  if (!hasNav && !hasLatLng) {
    issues.push({ id: d.id, name: d.name, category: 'Maps', detail: 'navigation も lat/lng も未設定（Mapsナビ不能）' });
  } else {
    stats.mapsOk++;
  }

  // ③ CTA: 秘境タグ → requiresCar=true であること
  if (tags.includes('秘境') && !d.requiresCar) {
    issues.push({ id: d.id, name: d.name, category: 'CTA', detail: '秘境タグだが requiresCar が未設定' });
  } else if (tags.includes('秘境')) {
    stats.ctaOk++;
  }

  // ④ CTA: 離島タグ → accessType が ferry / plane / car / undefined（陸路到達可能な場合）
  if (tags.includes('離島')) {
    const at = d.accessType;
    if (at && !['ferry', 'plane', 'car'].includes(at)) {
      issues.push({ id: d.id, name: d.name, category: 'CTA', detail: `離島だが accessType=${at}（ferry/plane/car が期待値）` });
    } else {
      stats.islandOk++;
    }
  }
}

// ── 結果出力 ──────────────────────────────────────────────────────
console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('  どこいこ destination 全件 audit');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

console.log(`  対象: ${stats.total} destinations`);
console.log(`  楽天KW OK   : ${stats.rakutenOk} / ${stats.total}`);
console.log(`  楽天URL OK  : ${stats.urlFormatOk} / ${stats.total}`);
console.log(`  MapsOK      : ${stats.mapsOk} / ${stats.total}`);

const secrecyTotal = destOnly.filter(d => (d.tags ?? []).includes('秘境')).length;
const islandTotal  = destOnly.filter(d => (d.tags ?? []).includes('離島')).length;
console.log(`  秘境CTA OK  : ${stats.ctaOk} / ${secrecyTotal}`);
console.log(`  離島CTA OK  : ${stats.islandOk} / ${islandTotal}`);

if (issues.length === 0) {
  console.log('\n✓ 全チェック PASS — 問題なし\n');
} else {
  console.log(`\n⚠ 問題あり: ${issues.length} 件\n`);
  // カテゴリ別に整理
  const byCategory = {};
  for (const iss of issues) {
    (byCategory[iss.category] ??= []).push(iss);
  }
  for (const [cat, list] of Object.entries(byCategory)) {
    console.log(`  【${cat}】 ${list.length}件`);
    for (const iss of list) {
      console.log(`    ${iss.name} (${iss.id})`);
      console.log(`      → ${iss.detail}`);
    }
    console.log('');
  }
}

// ── 詳細サンプル（秘境・温泉郷 20件のキーワード確認） ─────────────
console.log('━━ 秘境・温泉郷 サンプル（キーワード確認） ━━');
const samples = destOnly.filter(d =>
  (d.tags ?? []).some(t => ['秘境', '山奥'].includes(t)) ||
  d.name.includes('温泉郷')
).slice(0, 20);
for (const d of samples) {
  const kw  = extractRakutenKeyword(d.hotelLinks?.rakuten ?? '');
  const nav = d.navigation ? `→ ナビ: ${d.navigation.name}` : '(navigation なし)';
  console.log(`  ${(d.name).padEnd(14)} req=${String(d.requiresCar).padEnd(5)} kw="${kw}" ${nav}`);
}
console.log('');
