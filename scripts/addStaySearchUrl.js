/**
 * addStaySearchUrl.js — 全 destination に staySearchUrl を追加
 *
 * ロジック:
 *   温泉 (destType=onsen / onsenLevel>=2): 温泉名で楽天・じゃらん検索
 *   island / portTown              : 島名 or hubCity で検索
 *   city                           : dest.name (都市名) で検索
 *   その他                          : hubCity で検索
 *
 * 出力: destinations.json を上書き（--apply フラグが必要）
 *
 * 使い方:
 *   node scripts/addStaySearchUrl.js            # dry-run
 *   node scripts/addStaySearchUrl.js --apply    # 書き込み
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const APPLY = process.argv.includes('--apply');
const DESTS_FILE = path.join(ROOT, 'src/data/destinations.json');
const DESTS = JSON.parse(fs.readFileSync(DESTS_FILE, 'utf8'));

/* 楽天トラベル アフィリエイト設定（既存の affiliateProviders.json から） */
const AFF_FILE = path.join(ROOT, 'src/data/affiliateProviders.json');
const AFFILIATE = JSON.parse(fs.readFileSync(AFF_FILE, 'utf8'));
const RAKUTEN_AFID = AFFILIATE.rakuten.affiliateId;

/**
 * 楽天トラベル キーワード検索 URL（アフィリエイト経由）
 * https://travel.rakuten.co.jp/search/?keyword={kwd}
 */
function buildRakutenSearchUrl(keyword) {
  const encoded = encodeURIComponent(keyword);
  const dest    = encodeURIComponent(`https://travel.rakuten.co.jp/search/?keyword=${keyword}`);
  return `https://hb.afl.rakuten.co.jp/hgc/${RAKUTEN_AFID}/?pc=${dest}&m=${dest}`;
}

/**
 * じゃらん キーワード検索 URL（ValueCommerce なし — 直接検索）
 * VCアフィリエイトはランタイムで生成するため、ここでは標準URLを使用
 */
function buildJalanSearchUrl(keyword) {
  const encoded = encodeURIComponent(keyword);
  return `https://www.jalan.net/uw/uwp2011/uww2011init.do?keyword=${encoded}`;
}

/**
 * 宿検索キーワードを解決する
 *   温泉系: 目的地名（温泉名そのまま）
 *   島 / 港町: 目的地名
 *   city: 都市名
 *   それ以外: hubCity → dest名の順
 */
function resolveStayKeyword(d) {
  const name = d.displayName || d.name;

  // 温泉
  if (d.destType === 'onsen' || (d.onsenLevel ?? 0) >= 2) {
    return name;  // 「草津温泉」「有馬温泉」等で直接検索
  }

  // 島・港町
  if (d.destType === 'island' || d.isIsland || d.destType === 'portTown') {
    return name;
  }

  // 都市: そのまま都市名
  if (d.destType === 'city') {
    return d.hotelKeyword || name;
  }

  // その他: hubCity があればそちら（山奥・秘境は最寄拠点で検索）
  return d.hubCity || d.hotelKeyword || name;
}

let added = 0, updated = 0, skipped = 0;

for (const d of DESTS) {
  const keyword = resolveStayKeyword(d);
  const staySearchUrl = buildRakutenSearchUrl(keyword);

  if (!d.staySearchUrl) {
    if (APPLY) d.staySearchUrl = staySearchUrl;
    added++;
  } else if (d.staySearchUrl !== staySearchUrl) {
    if (APPLY) d.staySearchUrl = staySearchUrl;
    updated++;
  } else {
    skipped++;
  }
}

console.log(`[addStaySearchUrl] ${APPLY ? 'APPLY' : 'DRY-RUN'}`);
console.log(`  追加: ${added}件 / 更新: ${updated}件 / スキップ: ${skipped}件 / 全${DESTS.length}件`);

if (APPLY) {
  fs.writeFileSync(DESTS_FILE, JSON.stringify(DESTS, null, 2), 'utf8');
  console.log(`[addStaySearchUrl] 書き込み完了`);
} else {
  // dry-run: サンプルを3件表示
  const samples = DESTS.slice(0, 3);
  for (const d of samples) {
    const kw = resolveStayKeyword(d);
    console.log(`  ${d.name} → keyword="${kw}"`);
    console.log(`    rakuten: ${buildRakutenSearchUrl(kw).slice(0, 80)}...`);
  }
}
