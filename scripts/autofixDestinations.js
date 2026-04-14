/**
 * autofixDestinations.js — validation結果CSVを元に destinations.json を自動修正
 *
 * 修正可能なケース（安全・データ整合性保証）:
 *   ✅ unknown_hub: 最寄りhotelArea/hub名に置換（距離ベース）
 *   ✅ bad_station: representativeStation から accessStation を再導出
 *
 * 修正不可なケース（外部知識要・手動対応）:
 *   ❌ detour:       transportGraph への直通エッジ追加が必要
 *   ❌ unreachable:  transportGraph ノード接続追加が必要
 *   ❌ too_long:     hubCity 変更は影響範囲大（手動判断）
 *
 * 使い方:
 *   node scripts/autofixDestinations.js              # dry-run（変更なし）
 *   node scripts/autofixDestinations.js --apply      # 実際に書き込む
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const APPLY = process.argv.includes('--apply');

const { calcDistanceKm } = await import('../src/utils/geo.js');

const DESTS_FILE = path.join(ROOT, 'src/data/destinations.json');
const DESTS = JSON.parse(fs.readFileSync(DESTS_FILE, 'utf8'));
const AREAS = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/data/hotelAreas.json'), 'utf8'));
const HUBS  = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/data/hubs.json'), 'utf8'));

// 有効hub名セット
const VALID_HUB_NAMES = new Set([
  ...AREAS.map(a => a.name),
  ...HUBS.map(h => h.name),
  ...DESTS.map(d => d.name),
  ...DESTS.map(d => d.displayName).filter(Boolean),
]);

// 座標付きhub名リスト（最寄り検索用）
const COORDINATED_HUBS = [
  ...AREAS.filter(a => a.lat && a.lng).map(a => ({ name: a.name, lat: a.lat, lng: a.lng, src: 'area' })),
  ...HUBS.filter(h => h.lat && h.lng).map(h => ({ name: h.name, lat: h.lat, lng: h.lng, src: 'hub' })),
];

/** 最寄りhub名を距離順で検索 */
function findNearestHub(lat, lng, maxKm = 100) {
  const candidates = COORDINATED_HUBS
    .map(h => ({ ...h, km: calcDistanceKm({ lat, lng }, h) }))
    .filter(h => h.km <= maxKm)
    .sort((a, b) => a.km - b.km);
  return candidates[0] ?? null;
}

/**
 * accessStation 修正は無効化（安全に自動化不可）
 *
 * 単純に「駅」を追加すると「南三陸駅」「蓼科駅」「四国カルスト駅」など
 * 実在しない駅を作成してしまう。道路アクセス・バスアクセスのポイントは
 * そのまま維持するのが正解。この項目は手動で個別対応する。
 */
function fixStationSuffix(dest) {
  return null; // 常に変更なし
}

/**
 * hubCity が "〇〇温泉" で area が別名で登録されている場合、
 * 近距離（同一地点）ならそのまま残す方が宿UXに好ましい。
 * 修正対象: 座標マッチがない or 明らかに誤ったhub
 */
function shouldFixHub(dest, nearest) {
  if (!nearest) return false;
  // 温泉hub（例：阿寒湖温泉）は宿泊地として有効 → 距離0でも置換しない
  if (/温泉/.test(dest.hubCity) && nearest.km < 5) return false;
  return true;
}

/* ══════════════════════════════════════════════ */

let fixHub = 0, fixStation = 0;
const log = [];

for (const d of DESTS) {
  // ① unknown_hub: hotelAreas/hubs/destinationsにない → 最寄りhubに置換
  //    ただし温泉hubは距離0なら維持（宿泊地として有効）
  if (d.hubCity && !VALID_HUB_NAMES.has(d.hubCity) && d.lat && d.lng) {
    const nearest = findNearestHub(d.lat, d.lng, 100);
    if (nearest && shouldFixHub(d, nearest)) {
      log.push(`[fix_hub] ${d.id}: "${d.hubCity}" → "${nearest.name}" (${Math.round(nearest.km)}km, ${nearest.src})`);
      if (APPLY) d.hubCity = nearest.name;
      fixHub++;
    } else if (nearest) {
      log.push(`[keep_hub] ${d.id}: "${d.hubCity}" を維持（温泉hub・${Math.round(nearest.km)}km内に${nearest.name}）`);
    }
  }

  // ② bad_station: accessStation suffix欠落 → 補正
  const newStation = fixStationSuffix(d);
  if (newStation && newStation !== d.accessStation) {
    log.push(`[fix_station] ${d.id}: "${d.accessStation}" → "${newStation}"`);
    if (APPLY) d.accessStation = newStation;
    fixStation++;
  }
}

/* ログ出力 */
console.log(`[autofix] ${APPLY ? 'APPLY' : 'DRY-RUN'}`);
console.log(`  unknown_hub 修正: ${fixHub}`);
console.log(`  bad_station 修正: ${fixStation}`);
log.slice(0, 15).forEach(l => console.log('  ' + l));
if (log.length > 15) console.log(`  ... 他 ${log.length - 15} 件`);

/* 書き込み */
if (APPLY && (fixHub + fixStation) > 0) {
  fs.writeFileSync(DESTS_FILE, JSON.stringify(DESTS, null, 2));
  console.log(`\n[autofix] 書き込み完了: ${DESTS_FILE}`);
  console.log('[next] node scripts/validateHubs.js で再検証');
} else if (!APPLY) {
  console.log('\n[autofix] 実行には --apply フラグを付けてください');
}
