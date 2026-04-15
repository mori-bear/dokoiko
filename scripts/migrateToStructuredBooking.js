// scripts/migrateToStructuredBooking.js
// bookingStation を string → {name, company} オブジェクト形式に移行する
//
// 形式: { name: "片瀬江ノ島駅", company: "小田急" } | null
// JR以外の会社名を明示し、「実在する主要駅」ならJR・私鉄問わず許容する
//
// 処理内容:
//   1. 現在 string の bookingStation を {name, company} に変換（デフォルト JR）
//   2. 非JR駅に正しい会社名を付与
//   3. 元々 null → private rail があるべき目的地を復元
//   4. 非JR強制変更（前セッションの JR置き換え）を private rail に戻す
//   5. isValidStation で無効な駅名を null に変換

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DESTS_PATH = path.join(__dirname, '../src/data/destinations.json');
const dests = JSON.parse(fs.readFileSync(DESTS_PATH, 'utf-8'));

// ── 実在する駅かどうかを検証 ────────────────────────────────────────
function isValidStation(name) {
  if (!name || typeof name !== 'string') return false;
  if (!name.endsWith('駅')) return false;
  // 空港・港・ターミナル・バスセンターは駅として扱わない
  if (/空港|バスターミナル|バスセンター/.test(name)) return false;
  // 港で終わる（駅の前が港）= 港駅は OK（例: ○○港駅は港+駅なのでチェック）
  // 「港」を含みかつ「駅」が無い = NG（港のみ）は上で弾いている
  return true;
}

// ── 駅名 → 鉄道会社 マッピング（非JR確定分） ───────────────────────
const STATION_COMPANY = {
  // 伊豆箱根鉄道
  '修善寺駅':       '伊豆箱根鉄道',
  // 伊豆急行
  '伊豆高原駅':     '伊豆急行',
  '伊豆急下田駅':   '伊豆急行',
  // 富士急行
  '河口湖駅':       '富士急行',
  // 小田急電鉄
  '片瀬江ノ島駅':   '小田急',
  '箱根湯本駅':     '小田急',
  // 近鉄
  '賢島駅':         '近鉄',
  // 南海電鉄
  '堺東駅':         '南海',
  'みさき公園駅':   '南海',
  '極楽橋駅':       '南海',
  // 京阪電鉄
  '伏見稲荷駅':     '京阪',
  // 西日本鉄道
  '西鉄柳川駅':     '西鉄',
  '太宰府駅':       '西鉄',
  '西鉄久留米駅':   '西鉄',
  // 京都丹後鉄道
  '天橋立駅':       '京都丹後鉄道',
  '宮津駅':         '京都丹後鉄道',
  // 名古屋鉄道
  '豊田市駅':       '名鉄',
  // 上田電鉄
  '別所温泉駅':     '上田電鉄',
  // 島原鉄道
  '島原駅':         '島原鉄道',
  // 伊予鉄道
  '道後温泉駅':     '伊予鉄',
  '松山市駅':       '伊予鉄',
  // つくばエクスプレス
  'つくば駅':       'TX',
  // ゆいレール
  '那覇空港駅':     'ゆいレール',
  // 三陸鉄道
  '盛駅':           '三陸鉄道',
  // 長野電鉄
  '湯田中駅':       '長野電鉄',
  // 真岡鐵道
  '益子駅':         '真岡鐵道',
};

// ── 目的地ID → bookingStation 上書きテーブル ─────────────────────────
// 前セッションでJR強制変更した駅を私鉄に戻し、null → 私鉄を補完する
const BOOKING_RESTORE = {
  // null → 私鉄復元
  'yanagawa':     { name: '西鉄柳川駅',    company: '西鉄' },
  'dazaifu':      { name: '太宰府駅',      company: '西鉄' },
  'tsukuba':      { name: 'つくば駅',      company: 'TX'   },
  'misaki-osaka': { name: 'みさき公園駅',  company: '南海' },
  // JR → 正しい私鉄に戻す
  'enoshima':     { name: '片瀬江ノ島駅',  company: '小田急' },
  'fushimi':      { name: '伏見稲荷駅',    company: '京阪'   },
  'sakai':        { name: '堺東駅',        company: '南海'   },
  // 道後温泉: 松山駅(JR)のまま維持（JR乗車区間の終点として妥当）
};

let converted = 0, restored = 0, invalid = 0;
const log = [];

for (const dest of dests) {
  if (dest.type !== 'destination') continue;

  // ① ID単位の上書き（最優先）
  if (dest.id in BOOKING_RESTORE) {
    const prev = JSON.stringify(dest.bookingStation);
    dest.bookingStation = BOOKING_RESTORE[dest.id];
    log.push(`[RESTORE] ${dest.name}(${dest.id}): ${prev} → ${JSON.stringify(dest.bookingStation)}`);
    restored++;
    continue;
  }

  // ② null はそのまま
  if (dest.bookingStation === null || dest.bookingStation === undefined) continue;

  // ③ 既にオブジェクト形式 → スキップ
  if (typeof dest.bookingStation === 'object') continue;

  // ④ string → {name, company} 変換
  const name = String(dest.bookingStation);

  // 無効な駅名（実在しない）→ null
  if (!isValidStation(name)) {
    log.push(`[INVALID] ${dest.name}(${dest.id}): "${name}" → null`);
    dest.bookingStation = null;
    invalid++;
    continue;
  }

  const company = STATION_COMPANY[name] ?? 'JR';
  dest.bookingStation = { name, company };
  if (company !== 'JR') {
    log.push(`[PRIVATE] ${dest.name}(${dest.id}): "${name}" → ${company}`);
  }
  converted++;
}

fs.writeFileSync(DESTS_PATH, JSON.stringify(dests, null, 2), 'utf-8');

console.log(`\n変換完了:`);
console.log(`  string→object: ${converted}件`);
console.log(`  私鉄/復元:     ${restored}件`);
console.log(`  無効→null:     ${invalid}件`);
console.log('\n--- 変更ログ ---');
log.forEach(l => console.log(l));
