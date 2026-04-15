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

const DESTS_PATH      = path.join(__dirname, '../src/data/destinations.json');
const HOTEL_AREAS_PATH = path.join(__dirname, '../src/data/hotelAreas.json');
const AFFILIATE_PATH  = path.join(__dirname, '../src/data/affiliateProviders.json');

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

function safeEncode(area) {
  try {
    return decodeURIComponent(area) !== area
      ? encodeURIComponent(decodeURIComponent(area))
      : encodeURIComponent(area);
  } catch {
    return encodeURIComponent(area);
  }
}

function lookupAreaById(destId) {
  const areaId = DEST_TO_AREA_ID[destId] ?? destId;
  return AREAS_BY_ID.get(areaId) ?? null;
}

function lookupAreaByName(name) {
  return AREAS_BY_NAME.get(name) ?? null;
}

function getRakutenPath(area, dest) {
  return area?.rakutenPath
    || area?.rakutenFallback
    || (dest?.hotelArea ? `/yado/${dest.hotelArea}/` : null);
}

function isCoarseRakutenPath(p) {
  if (!p) return true;
  return !p.includes('.html');
}

function buildRakutenDestUrl(p) {
  return `https://travel.rakuten.co.jp${p ?? '/'}`;
}

/** アフィリエイトURL（日付なし — フロントで appendDateParams を付与） */
function buildRakutenAffilUrl(destUrl) {
  return `https://hb.afl.rakuten.co.jp/hgc/${RAKUTEN_AFID}/?pc=${encodeURIComponent(destUrl)}`;
}

/** アフィリエイトURL（日付なし — フロントで appendDateParams を付与） */
function buildJalanAffilUrl(rawJalanUrl) {
  return `https://ck.jp.ap.valuecommerce.com/servlet/referral?sid=${JALAN_VC_SID}&pid=${JALAN_VC_PID}&vc_url=${encodeURIComponent(rawJalanUrl)}`;
}

function buildRakutenUrl(area) {
  return `https://travel.rakuten.co.jp/yado/japan.html?f_query=${safeEncode(normalizeArea(area))}`;
}

/** じゃらんキーワード検索URL（Shift-JIS エンコード） */
function buildJalanUrl(area) {
  const normalized = normalizeArea(area);
  const sjisBytes = iconv.encode(normalized, 'cp932');
  const encoded = Array.from(sjisBytes)
    .map(b => '%' + b.toString(16).toUpperCase().padStart(2, '0'))
    .join('');
  return `https://www.jalan.net/uw/uwp2011/uww2011init.do?keyword=${encoded}`;
}

/**
 * 楽天キーワード検索URL を生成する。
 *
 * 単体ワード禁止: 必ず「地名＋都道府県名」にすることで楽天のエリア認識を確実にする。
 *
 * キーワード決定ロジック（優先順位）:
 *   1. keyword（stayArea.rakuten）がある場合 → "{keyword} {prefecture}"
 *   2. onsen 目的地でキーワードに「温泉」なし → "{keyword}温泉 {prefecture}"
 *   3. keyword が空 / fallback → "{prefecture} 宿"
 */
function buildRakutenKeywordUrl(keyword, dest) {
  // 都道府県名（末尾の県/府/都/道を除去）
  const pref = String(dest?.prefecture ?? '').replace(/[県府都道]$/, '');

  if (!keyword) {
    // ③ fallback: "都道府県 宿"
    return pref ? buildRakutenAffilUrl(buildRakutenUrl(`${pref} 宿`)) : null;
  }

  let q = keyword;

  // ② 温泉目的地でキーワードに「温泉」なし → 「温泉」補完
  if (dest?.destType === 'onsen' && !q.includes('温泉')) {
    q = q + '温泉';
  }

  // ① 単体ワード禁止: 都道府県名を付加（既に含む場合はスキップ）
  if (pref && !q.includes(pref)) {
    q = `${q} ${pref}`;
  }

  return buildRakutenAffilUrl(buildRakutenUrl(q));
}

function buildJalanKeywordUrl(keyword) {
  if (!keyword) return null;
  return buildJalanAffilUrl(buildJalanUrl(keyword));
}

// ── 宿エリア解決 ──────────────────────────────────────────────────────

/**
 * 楽天検索キーワード用エリアを解決する。
 *
 * 優先順位:
 *   1. stayArea.rakuten（設定済みなら絶対これ）
 *   2. 温泉ホワイトリスト一致
 *   3. 島
 *   4. hotelAreas.name
 *   5. mainSpot（温泉を含む場合は優先 — "{mainSpot}温泉" として使用される）
 *   6. dest.name
 */
function resolveStayArea(dest) {
  // ① stayArea.rakuten が設定済みなら最優先（建前: 絶対これ）
  const sa = getStayAreaFor(dest, 'rakuten');
  if (sa) return sa;

  const name = dest.displayName || dest.name;
  // ② 温泉ホワイトリスト
  if (ONSEN_STAY_AREAS.has(name)) return name;
  // ③ 島
  if (dest.isIsland || dest.destType === 'island') return name;
  // ④ hotelAreas エントリ
  const area = lookupAreaById(dest.id);
  if (area?.name) return area.name;
  // ⑤ mainSpot（温泉含む場合は優先）
  if (dest.mainSpot) {
    if (dest.mainSpot.includes('温泉') || dest.destType === 'onsen') return dest.mainSpot;
  }
  // ⑥ dest.name
  return name;
}

// ── 楽天URL解決 ──────────────────────────────────────────────────────

function resolveRakutenUrl(dest) {
  if (!isWeak(dest)) {
    const area = lookupAreaById(dest.id);
    const p = getRakutenPath(area, dest);
    if (p && !isCoarseRakutenPath(p)) return buildRakutenAffilUrl(buildRakutenDestUrl(p));
    if (p) return buildRakutenKeywordUrl(resolveStayArea(dest), dest);
  }
  if (dest.fallbackCity) {
    const fbArea = lookupAreaByName(dest.fallbackCity);
    const p = getRakutenPath(fbArea, null);
    if (p && !isCoarseRakutenPath(p)) return buildRakutenAffilUrl(buildRakutenDestUrl(p));
    if (p) return buildRakutenKeywordUrl(dest.fallbackCity, dest);
  }
  const area = lookupAreaById(dest.id);
  const p = getRakutenPath(area, dest);
  if (p && !isCoarseRakutenPath(p)) return buildRakutenAffilUrl(buildRakutenDestUrl(p));
  return buildRakutenKeywordUrl(resolveStayArea(dest), dest);
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

  const destName = dest.displayName || dest.name;
  let rakutenUrl, jalanUrl;

  // hubCity が目的地と異なる → hubCity エリアを直接使用
  if (dest.hubCity && dest.hubCity !== destName) {
    const hubArea        = lookupAreaByName(dest.hubCity);
    const hubRakutenPath = getRakutenPath(hubArea, null);
    rakutenUrl = hubRakutenPath
      ? (isCoarseRakutenPath(hubRakutenPath)
        ? buildRakutenKeywordUrl(dest.hubCity)
        : buildRakutenAffilUrl(buildRakutenDestUrl(hubRakutenPath)))
      : buildRakutenKeywordUrl(dest.hubCity);
    jalanUrl = hubArea?.jalanUrl
      ? buildJalanAffilUrl(hubArea.jalanUrl)
      : buildJalanKeywordUrl(dest.hubCity);
  } else {
    rakutenUrl = resolveRakutenUrl(dest);
    jalanUrl   = resolveJalanUrl(dest);
  }

  dest.hotelLinks = {
    rakuten: rakutenUrl ?? null,
    jalan:   jalanUrl   ?? null,
  };
  updated++;
}

fs.writeFileSync(DESTS_PATH, JSON.stringify(dests, null, 2), 'utf-8');
console.log(`✓ ホテルリンク事前生成完了: ${updated}件`);
