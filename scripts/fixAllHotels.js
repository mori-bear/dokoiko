// scripts/fixAllHotels.js
// ビルド時に全宿泊リンクを事前生成し destinations.json の hotelLinks フィールドに保存する
// Node.js 専用（iconv-lite 使用 — ブラウザ不可）
//
// 使い方: node scripts/fixAllHotels.js
// 出力:   各 destination に { hotelLinks: { rakuten, jalan } } を追加

import fs   from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import iconv from 'iconv-lite';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const DESTS_PATH       = path.join(__dirname, '../src/data/destinations.json');
const HOTEL_AREAS_PATH = path.join(__dirname, '../src/data/hotelAreas.json');
const AFFILIATE_PATH   = path.join(__dirname, '../src/data/affiliateProviders.json');

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

// ── 楽天URL生成 ──────────────────────────────────────────────────────

/**
 * 楽天キーワードを生成する。
 *
 * ① hubCity 最優先（最も安定したエリア名）
 * ② 都道府県（必須）
 * ③ 温泉 or 宿
 */
function buildRakutenKeyword(dest) {
  const parts = [];

  // ① hubCity最優先（最も安定）、なければ name
  if (dest.hubCity) {
    parts.push(dest.hubCity);
  } else if (dest.name) {
    parts.push(dest.name);
  }

  // ② 都道府県（必須）
  if (dest.prefecture) {
    parts.push(dest.prefecture);
  }

  // ③ 温泉 or 宿
  if (dest.tags?.includes('温泉')) {
    parts.push('温泉');
  } else {
    parts.push('宿');
  }

  return parts.join(' ');
}

/**
 * 楽天キーワード検索URL を生成する。
 * japan.html?f_query= を使用（唯一 HTTP 200 を返すエンドポイント）。
 * encodeURIComponent は1回のみ。
 */
function buildRakutenKeywordUrl(dest) {
  const keyword = buildRakutenKeyword(dest);
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

let updated = 0;

for (const dest of dests) {
  if (dest.type !== 'destination') continue;

  // 楽天: buildRakutenKeyword が hubCity を内部で優先するため全件統一処理
  const rakutenUrl = buildRakutenKeywordUrl(dest);

  // じゃらん: hubCity がある場合は hubCity のエリアを優先
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

fs.writeFileSync(DESTS_PATH, JSON.stringify(dests, null, 2), 'utf-8');
console.log(`✓ ホテルリンク事前生成完了: ${updated}件`);
