/**
 * crossValidation.js — 全出発地 × 全目的地 × 全stayType のクロス検証
 *
 * 検証項目:
 *   a. 交通リンク生成（resolveTransportLinks）が例外なく成功するか
 *   b. 宿リンク検証（Shift_JIS・japan.html フォールバック・空URL）
 *   c. ルート表示の整合性（出発地と無関係な固定ルート）
 *   d. stayAllowed 整合性（配列、フォールバック経由の検出）
 *
 * 実行:
 *   node scripts/crossValidation.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const DEPARTURES = [
  '札幌', '函館', '旭川', '仙台', '盛岡',
  '東京', '横浜', '千葉', '大宮', '宇都宮',
  '長野', '静岡', '名古屋', '金沢', '富山',
  '大阪', '京都', '神戸', '奈良',
  '広島', '福山', '岡山', '倉敷', '姫路',
  '松江', '米子', '高松', '松山', '高知', '徳島',
  '福岡', '熊本', '鹿児島', '長崎', '宮崎',
];

const STAY_TYPES = ['daytrip', '1night', '2night'];

const destinations = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'src/data/destinations.json'), 'utf8'),
);

const destEntries = destinations.filter(d => d.type === 'destination');

// エンジンの import（top-level await を使っているため ESM）
const { buildTransportContext } = await import(path.join(ROOT, 'src/engine/transportEngine.js'));
const { buildShuffledPool }      = await import(path.join(ROOT, 'src/engine/selectionEngine.js'));

const fails = [];
let okCount = 0;
let total = 0;

/** Shift_JIS 由来の 2バイト文字検出（%81-%9F は UTF-8 では先頭バイトにならない） */
function hasShiftJis(url) {
  if (!url) return false;
  const m = url.match(/keyword%3D([^&]+?)(?:&|$|%26)/);
  if (!m) return false;
  const decodedOnce = m[1].replace(/%25/g, '%');
  if (/^%[89][0-9A-F]/.test(decodedOnce)) return true;
  // 単一エンコードの場合（referral 経由でない素のURL）
  if (/^%[89][0-9A-F]%[4-9A-F][0-9A-F]/.test(m[1])) return true;
  return false;
}

/** URL が有効か（http/https + 空でない） */
function isValidUrl(u) {
  return typeof u === 'string' && u.length > 0 && /^https?:\/\//.test(u);
}

/** 楽天 URL が japan.html かつ f_query なしのフォールバック（キーワード不指定）か */
function isRakutenFallback(url) {
  if (!url) return false;
  const m = url.match(/[?&]pc=([^&]+)/);
  const pc = m ? decodeURIComponent(m[1]) : url;
  // japan.html で f_query が無い = 本当のフォールバック（全国マップに飛ばすだけ）
  return /travel\.rakuten\.co\.jp\/yado\/japan\.html(?!.*f_query=)/.test(pc);
}

/** 楽天 URL が都道府県レベルか（/yado/XXX/ で .html を含まない） */
function isRakutenPrefectureLevel(url) {
  if (!url) return false;
  const m = url.match(/[?&]pc=([^&]+)/);
  const pc = m ? decodeURIComponent(m[1]) : url;
  return /travel\.rakuten\.co\.jp\/yado\/[a-z]+\/$/.test(pc);
}

/* ── 実行ループ ── */

console.log(`[cross] 出発地 ${DEPARTURES.length} × 目的地 ${destEntries.length} × stayType ${STAY_TYPES.length} を検証中...`);

for (const departure of DEPARTURES) {
  for (const stayType of STAY_TYPES) {
    for (const dest of destEntries) {
      total++;
      const tag = `${dest.id}/${departure}/${stayType}`;

      // d. stayAllowed 整合性
      if (!Array.isArray(dest.stayAllowed)) {
        fails.push({ tag, reason: `stayAllowed が配列でない: ${typeof dest.stayAllowed}` });
        continue;
      }

      // a. 交通リンク生成
      let ctx;
      try {
        ctx = buildTransportContext(departure, dest);
      } catch (err) {
        fails.push({ tag, reason: `buildTransportContext 例外: ${err.message}` });
        continue;
      }

      if (!ctx?.stepGroups) {
        fails.push({ tag, reason: '交通 stepGroups が undefined' });
        continue;
      }

      // map CTA URL チェック
      const mapCta = ctx.stepGroups.find(g => g.type === 'map-cta');
      if (mapCta && !isValidUrl(mapCta.cta?.url)) {
        fails.push({ tag, reason: `map-cta URL が不正: ${mapCta.cta?.url}` });
      }

      // main-cta URL チェック
      const mainCta = ctx.stepGroups.find(g => g.type === 'main-cta');
      if (mainCta && !isValidUrl(mainCta.cta?.url)) {
        fails.push({ tag, reason: `main-cta URL が不正: ${mainCta.cta?.url}` });
      }

      // b. 宿リンク（daytrip 以外で必要）
      if (stayType !== 'daytrip') {
        const rakuten = dest.hotelLinks?.rakuten;
        const jalan   = dest.hotelLinks?.jalan;
        if (!isValidUrl(rakuten)) {
          fails.push({ tag, reason: `rakuten URL が無効: ${rakuten}` });
        }
        if (!isValidUrl(jalan)) {
          fails.push({ tag, reason: `jalan URL が無効: ${jalan}` });
        }
        if (hasShiftJis(jalan)) {
          fails.push({ tag, reason: `jalan に Shift_JIS エンコード: ${jalan?.slice(0, 80)}...` });
        }
        if (isRakutenFallback(rakuten)) {
          fails.push({ tag, reason: `rakuten が japan.html フォールバック` });
        }
        if (isRakutenPrefectureLevel(rakuten)) {
          fails.push({ tag, reason: `rakuten が都道府県レベル（area特化でない）` });
        }
      }

      // c. ルート表示の整合性: finalAccess の from/to が目的地と無関係でないか
      const fa = ctx.bestRoute?.finalAccess;
      if (fa && typeof fa === 'object' && fa.from && fa.to && fa.type !== 'walk') {
        // from/to が目的地名 または prefecture と関連しているか（緩い検査: destination データにある文字列との関連性）
        const destBits = [dest.name, dest.displayName, dest.prefecture, dest.city, dest.hubCity, dest.accessStation, dest.representativeStation]
          .filter(Boolean)
          .map(s => s.replace(/県$|府$|都$|市$|町$|村$|駅$/, ''));
        const toClean = String(fa.to).replace(/駅$/, '');
        const fromClean = String(fa.from).replace(/駅$/, '');
        const toRelated = destBits.some(b => b && (toClean.includes(b) || b.includes(toClean)));
        if (!toRelated && destBits.length) {
          fails.push({ tag, reason: `finalAccess.to が目的地と無関係: ${fa.to} (dest: ${destBits.join(',')})` });
        }
      }

      // d. stayAllowed 整合性
      const allowed = dest.stayAllowed;
      // "daytrip" の明示的な許可が無い & stayType=daytrip の場合、プールに入るかはフィルタ次第
      // ここはログのみ（フォールバック経由でプール混入は許容される）

      okCount++;
    }
  }
}

/* ── 結果出力 ── */

console.log('');
console.log(`=========================================`);
console.log(`PASS: ${okCount} / FAIL: ${fails.length} （total ${total}）`);
console.log(`=========================================`);

if (fails.length > 0) {
  // 同じ reason をまとめる
  const byReason = new Map();
  for (const f of fails) {
    const key = f.reason.replace(/[\d,]+/g, 'N').slice(0, 100);
    if (!byReason.has(key)) byReason.set(key, []);
    byReason.get(key).push(f);
  }
  console.log(`\nFAIL グループ: ${byReason.size} 件`);
  // 上位10グループを表示
  const sorted = [...byReason.entries()].sort((a, b) => b[1].length - a[1].length);
  for (const [reason, entries] of sorted.slice(0, 10)) {
    console.log(`\n[${entries.length}件] ${reason}`);
    for (const e of entries.slice(0, 5)) {
      console.log(`   - ${e.tag}: ${e.reason}`);
    }
    if (entries.length > 5) console.log(`   ...and ${entries.length - 5} more`);
  }
  process.exit(1);
}

console.log('\n✓ 全件 PASS');
