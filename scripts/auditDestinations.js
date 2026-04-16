/**
 * scripts/auditDestinations.js
 * 全 destination の品質を一括チェックする最終検査スクリプト。
 *
 * 使い方: node scripts/auditDestinations.js
 *
 * チェック項目:
 *   ① 楽天URL: エリアパス(/yado/XX/YY.html) または 都道府県パス(/yado/XX/)
 *              ※ japan.html?f_query= は SPA全国マップのため NG
 *   ② Google Maps: navigation.lat/lng または lat/lng が存在する
 *   ③ CTA: 秘境タグ → requiresCar=true
 *   ④ CTA: 離島タグ → accessType が ferry/plane/car のいずれか
 *
 * 出力: 問題のある destination のみ一覧表示
 */

import fs   from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DESTS_PATH = path.join(__dirname, '../src/data/destinations.json');

/** アフィリエイトURL から楽天の実URL を抽出 */
function extractRakutenUrl(affilUrl) {
  if (!affilUrl) return null;
  try {
    const m = affilUrl.match(/[?&]pc=([^&]+)/);
    if (!m) return affilUrl;
    return decodeURIComponent(m[1]);
  } catch { return affilUrl; }
}

/**
 * 楽天URLが有効なフォーマットか判定。
 * OK: エリアパス /yado/XX/YY.html または 都道府県パス /yado/XX/
 * NG: japan.html?f_query=（SPA全国マップ、f_queryを無視する）
 */
function classifyRakutenUrl(realUrl) {
  if (!realUrl) return { ok: false, type: 'none', detail: 'URL未設定' };
  if (/\/yado\/[a-z]+\/[a-z][a-z0-9-]*\.html/.test(realUrl)) {
    return { ok: true, type: 'area' };
  }
  if (/\/yado\/[a-z]+\/$/.test(realUrl)) {
    return { ok: true, type: 'pref' };
  }
  if (/\/yado\/japan\.html/.test(realUrl)) {
    return { ok: false, type: 'japan_html', detail: 'japan.html（SPA全国マップ）—エリア/都道府県パスに修正が必要' };
  }
  return { ok: false, type: 'unknown', detail: `未知のURLフォーマット: ${realUrl.slice(0, 60)}` };
}

// ── メイン ──────────────────────────────────────────────────────────
const dests = JSON.parse(fs.readFileSync(DESTS_PATH, 'utf-8'));
const destOnly = dests.filter(d => d.type === 'destination');

const issues = [];   // { id, name, category, detail }
const stats  = {
  total:       destOnly.length,
  urlAreaOk:   0,   // エリアパス（最高品質）
  urlPrefOk:   0,   // 都道府県パス（良好）
  mapsOk:      0,
  ctaOk:       0,
  islandOk:    0,
};

for (const d of destOnly) {
  const tags = d.tags ?? [];

  // ① 楽天URL フォーマット
  const affilUrl = d.hotelLinks?.rakuten;
  if (!affilUrl) {
    issues.push({ id: d.id, name: d.name, category: '楽天URL', detail: 'hotelLinks.rakuten が未設定' });
  } else {
    const realUrl = extractRakutenUrl(affilUrl);
    const cls     = classifyRakutenUrl(realUrl);
    if (!cls.ok) {
      issues.push({ id: d.id, name: d.name, category: '楽天URL', detail: cls.detail });
    } else if (cls.type === 'area') {
      stats.urlAreaOk++;
    } else {
      stats.urlPrefOk++;
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

  // ④ CTA: 離島タグ → accessType が ferry / plane / car のいずれか
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

const urlTotal = stats.urlAreaOk + stats.urlPrefOk;
console.log(`  対象: ${stats.total} destinations`);
console.log(`  楽天URL OK  : ${urlTotal} / ${stats.total}`);
console.log(`    エリアパス  : ${stats.urlAreaOk} 件（/yado/XX/YY.html）`);
console.log(`    都道府県パス: ${stats.urlPrefOk} 件（/yado/XX/）`);
console.log(`  MapsOK      : ${stats.mapsOk} / ${stats.total}`);

const secrecyTotal = destOnly.filter(d => (d.tags ?? []).includes('秘境')).length;
const islandTotal  = destOnly.filter(d => (d.tags ?? []).includes('離島')).length;
console.log(`  秘境CTA OK  : ${stats.ctaOk} / ${secrecyTotal}`);
console.log(`  離島CTA OK  : ${stats.islandOk} / ${islandTotal}`);

if (issues.length === 0) {
  console.log('\n✓ 全チェック PASS — 問題なし\n');
} else {
  console.log(`\n⚠ 問題あり: ${issues.length} 件\n`);
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

// ── 詳細サンプル（秘境・温泉郷 20件のURL確認） ────────────────────────
console.log('━━ 秘境・温泉郷 サンプル（楽天URL確認） ━━');
const samples = destOnly.filter(d =>
  (d.tags ?? []).some(t => ['秘境', '山奥'].includes(t)) ||
  d.name.includes('温泉郷')
).slice(0, 20);
for (const d of samples) {
  const realUrl = extractRakutenUrl(d.hotelLinks?.rakuten ?? '');
  const cls     = classifyRakutenUrl(realUrl);
  const nav     = d.navigation ? `ナビ: ${d.navigation.name}` : '(nav なし)';
  const urlShort = realUrl ? realUrl.replace('https://travel.rakuten.co.jp', '') : '(なし)';
  console.log(`  ${(d.name).padEnd(14)} req=${String(d.requiresCar).padEnd(5)} [${cls.type}] ${urlShort}`);
  if (d.navigation) console.log(`    ${' '.repeat(14)} → ${nav}`);
}
console.log('');
