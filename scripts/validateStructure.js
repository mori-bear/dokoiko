/**
 * validateStructure.js — destination 必須フィールド検証
 *
 * チェック項目:
 *   - 必須フィールドの存在
 *   - lat/lng が数値範囲内
 *   - destType が許可値
 *   - weight が数値
 *
 * 出力: structure_validation_failures.csv
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const DESTS = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/data/destinations.json'), 'utf8'));

const REQUIRED = ['id', 'name', 'prefecture', 'lat', 'lng', 'destType', 'hubCity'];
const VALID_TYPES = new Set([
  'onsen', 'island', 'mountain', 'city', 'sight', 'remote', 'peninsula',
  // ── ニッチ拡張 (T1) ──
  'hidden', 'view', 'weird', 'ruins', 'portTown', 'railway',
]);

// 旅行目的地として不適な destType（交通ハブ系）
const BAD_DEST_TYPES = new Set(['airport', 'station', 'terminal', 'transport_hub', 'access_point']);
// 名前に含まれてはいけないキーワード
const BAD_NAME_PATTERN = /空港|ターミナル|バスターミナル/;

const OUT_CSV = path.join(ROOT, 'structure_validation_failures.csv');
const rows = ['type,destId,field,detail'];

let missingFields = 0, badLatLng = 0, badType = 0, badWeight = 0, badNumber = 0, duplicateIds = 0,
    missingStayUrl = 0, badStayUrl = 0, airportDest = 0, ok = 0;
const seenIds = new Set();

for (const d of DESTS) {
  let fail = 0;

  // 必須フィールドチェック
  for (const f of REQUIRED) {
    if (d[f] === undefined || d[f] === null || d[f] === '') {
      rows.push(`missing,${d.id},${f},required field missing`);
      missingFields++;
      fail++;
    }
  }

  // lat/lng 範囲
  if (typeof d.lat === 'number') {
    if (d.lat < 24 || d.lat > 46) { rows.push(`bad_lat,${d.id},lat,${d.lat} out of JP range`); badLatLng++; fail++; }
  }
  if (typeof d.lng === 'number') {
    if (d.lng < 122 || d.lng > 146) { rows.push(`bad_lng,${d.id},lng,${d.lng} out of JP range`); badLatLng++; fail++; }
  }

  // destType
  if (d.destType && !VALID_TYPES.has(d.destType)) {
    rows.push(`bad_destType,${d.id},destType,"${d.destType}" not in valid set`);
    badType++;
    fail++;
  }

  // 空港・ターミナル系 destType 検知（旅行目的地として不適）
  if (BAD_DEST_TYPES.has(d.destType)) {
    rows.push(`airport_destType,${d.id},destType,"${d.destType}" is transport hub — should not be destination`);
    airportDest++;
    fail++;
  }

  // 名前に空港・ターミナルを含む場合も検知
  const checkName = d.displayName || d.name || '';
  if (BAD_NAME_PATTERN.test(checkName)) {
    rows.push(`airport_name,${d.id},name,"${checkName}" contains transport hub keyword`);
    airportDest++;
    fail++;
  }

  // weight
  if (d.weight !== undefined && typeof d.weight !== 'number') {
    rows.push(`bad_weight,${d.id},weight,not a number`);
    badWeight++;
    fail++;
  }

  // id重複
  if (seenIds.has(d.id)) {
    rows.push(`duplicate_id,${d.id},id,duplicated`);
    duplicateIds++;
    fail++;
  }
  seenIds.add(d.id);

  // staySearchUrl (T8): 宿泊プランは必須（daytrip専用でなければ）
  if (d.isStayable !== false) {
    if (!d.staySearchUrl) {
      rows.push(`missing_staySearchUrl,${d.id},staySearchUrl,required for stayable dest`);
      missingStayUrl++;
      fail++;
    } else if (!d.staySearchUrl.startsWith('https://')) {
      rows.push(`bad_staySearchUrl,${d.id},staySearchUrl,must start with https://`);
      badStayUrl++;
      fail++;
    }
  }

  // Maps URL 生成可否: lat/lng または hubCity が必要
  if (!d.lat && !d.lng && !d.hubCity && !d.accessStation) {
    rows.push(`no_maps_anchor,${d.id},maps,no lat/lng/hubCity/accessStation for Maps URL`);
    fail++;
  }

  if (fail === 0) ok++;
}

fs.writeFileSync(OUT_CSV, rows.join('\n'));
console.log(`[validateStructure] ok=${ok}/${DESTS.length}`);
console.log(`  missingFields=${missingFields}, badLatLng=${badLatLng}, badType=${badType}, badWeight=${badWeight}, duplicateIds=${duplicateIds}`);
console.log(`  missingStayUrl=${missingStayUrl}, badStayUrl=${badStayUrl}`);
if (airportDest > 0) console.log(`  ⚠️  airportDest=${airportDest} — 空港・ターミナル系の目的地が含まれています！要削除`);
console.log(`  → ${OUT_CSV}`);
