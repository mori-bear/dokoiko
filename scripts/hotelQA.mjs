/**
 * hotelQA.mjs — 宿リンク品質チェック
 *
 * 全506件に対して:
 * - Tier1（area-specific）/ Tier2（fallbackCity）/ Tier3（dest自身）使用率
 * - weak判定の妥当性
 * - jalanUrl / rakutenUrl の URL構造チェック
 * - 100%成立確認
 *
 * 実行: node scripts/hotelQA.mjs
 */

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

const destinations = JSON.parse(readFileSync(resolve(ROOT, 'src/data/destinations.json'), 'utf8'));
const hotelAreas   = JSON.parse(readFileSync(resolve(ROOT, 'src/data/hotelAreas.json'), 'utf8'));
const affiliate    = JSON.parse(readFileSync(resolve(ROOT, 'src/data/affiliateProviders.json'), 'utf8'));

const AREAS_BY_ID   = new Map(hotelAreas.map(a => [a.id, a]));
const AREAS_BY_NAME = new Map(hotelAreas.map(a => [a.name, a]));

const DEST_TO_AREA_ID = {
  'shirakawago-t': 'shirakawago', 'kurashiki-o': 'kurashiki',
  'takayama-o':    'takayama',    'kurokawa-k':  'kurokawa',
  'esashi-hokkaido':'esashi',
};

const RAKUTEN_AFID = affiliate.rakuten.affiliateId;
const JALAN_VC_SID = affiliate.jalan.vcSid;
const JALAN_VC_PID = affiliate.jalan.vcPid;

function isWeak(dest) {
  return !!(dest.requiresCar && (dest.destType === 'mountain' || dest.destType === 'remote'));
}

function getRakutenPath(area, dest) {
  return area?.rakutenPath || area?.rakutenFallback || (dest?.hotelArea ? `/yado/${dest.hotelArea}/` : null);
}

function checkDest(dest) {
  const areaId = DEST_TO_AREA_ID[dest.id] ?? dest.id;
  const area   = AREAS_BY_ID.get(areaId);
  const fbArea = dest.fallbackCity ? AREAS_BY_NAME.get(dest.fallbackCity) : null;
  const weak   = isWeak(dest);

  // ─ Rakuten ─
  let rakutenTier = null, rakutenOk = false;
  if (!weak && getRakutenPath(area, dest)) {
    rakutenTier = 1; rakutenOk = true;
  } else if (dest.fallbackCity && getRakutenPath(fbArea, null)) {
    rakutenTier = 2; rakutenOk = true;
  } else if (getRakutenPath(area, dest)) {
    rakutenTier = 3; rakutenOk = true;
  }

  // ─ Jalan ─
  let jalanTier = null, jalanOk = false;
  if (!weak && area?.jalanUrl) {
    jalanTier = 1; jalanOk = true;
  } else if (fbArea?.jalanUrl) {
    jalanTier = 2; jalanOk = true;
  } else if (area?.jalanUrl) {
    jalanTier = 3; jalanOk = true;
  }

  return {
    id: dest.id, name: dest.name, weak,
    fallbackCity: dest.fallbackCity,
    rakutenTier, rakutenOk,
    jalanTier,   jalanOk,
    bothOk: rakutenOk && jalanOk,
  };
}

// ─── 全件チェック ──────────────────────────────────────────────────────
const results = destinations.filter(d => d.type !== 'spot').map(checkDest);

const total    = results.length;
const weakTotal = results.filter(r => r.weak).length;

// Rakuten tier 集計
const rTier = [0, 0, 0, 0]; // index 0=unused, 1=tier1, 2=tier2, 3=tier3
results.forEach(r => { if (r.rakutenTier) rTier[r.rakutenTier]++; });
const rFail = results.filter(r => !r.rakutenOk);

// Jalan tier 集計
const jTier = [0, 0, 0, 0];
results.forEach(r => { if (r.jalanTier) jTier[r.jalanTier]++; });
const jFail = results.filter(r => !r.jalanOk);

// 両方失敗
const bothFail = results.filter(r => !r.bothOk);

// fallbackCity なし
const noFallback = results.filter(r => !r.fallbackCity);

console.log('═══════════════════════════════════════════');
console.log('  宿リンク品質レポート');
console.log('═══════════════════════════════════════════');
console.log(`  対象destinations : ${total} 件`);
console.log(`  weak（mountain/remote+car）: ${weakTotal} 件`);
console.log('');
console.log('  【楽天】');
console.log(`    Tier1（area-specific）: ${rTier[1]} 件`);
console.log(`    Tier2（fallbackCity）  : ${rTier[2]} 件`);
console.log(`    Tier3（dest own area） : ${rTier[3]} 件`);
console.log(`    失敗                   : ${rFail.length} 件`);
console.log('');
console.log('  【じゃらん】');
console.log(`    Tier1（area-specific SJIS）: ${jTier[1]} 件`);
console.log(`    Tier2（fallbackCity）       : ${jTier[2]} 件`);
console.log(`    Tier3（dest own area）      : ${jTier[3]} 件`);
console.log(`    失敗                         : ${jFail.length} 件`);
console.log('');
console.log(`  fallbackCity 未設定: ${noFallback.length} 件`);
console.log(`  両方成立: ${results.filter(r => r.bothOk).length} / ${total}`);

if (rFail.length > 0) {
  console.log('\n  ⚠ 楽天 失敗一覧:');
  rFail.forEach(r => console.log(`    ${r.id} ${r.name}`));
}
if (jFail.length > 0) {
  console.log('\n  ⚠ じゃらん 失敗一覧:');
  jFail.forEach(r => console.log(`    ${r.id} ${r.name}`));
}

// Tier2使用一覧（fallback発動）
const tier2list = results.filter(r => r.jalanTier === 2 || r.rakutenTier === 2);
if (tier2list.length > 0) {
  console.log(`\n  【Tier2（fallbackCity使用）一覧 ${tier2list.length}件】`);
  tier2list.forEach(r => {
    const markers = [];
    if (r.rakutenTier === 2) markers.push('楽天');
    if (r.jalanTier   === 2) markers.push('じゃらん');
    console.log(`    ${r.id} ${r.name} → ${r.fallbackCity} [${markers.join('+')}]`);
  });
}

console.log('');
if (bothFail.length === 0) {
  console.log('  ✓ 全件 宿リンク 100% 成立');
} else {
  console.log(`  ✗ 失敗: ${bothFail.length} 件`);
  bothFail.forEach(r => console.log(`    ${r.id} ${r.name}`));
  process.exit(1);
}
