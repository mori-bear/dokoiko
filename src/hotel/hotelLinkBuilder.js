/**
 * 宿泊リンクビルダー
 *
 * 楽天: hb.afl.rakuten.co.jp アフィリエイト経由
 *   → travel.rakuten.co.jp/yado/{pref}/{area}.html に飛ぶ
 *   エリアは hotelAreas.json の rakutenPath / rakutenFallback を使用
 *
 * じゃらん: ValueCommerce 経由
 *   → jalan.net/uw/uwp2011/uww2011init.do?keyword={keyword} に飛ぶ
 *
 * エンコードルール:
 *   すべて UTF-8 / encodeURIComponent のみ使用（Shift-JIS廃止）
 *   楽天リンク先URL: encodeURIComponent 1回のみ
 *
 * ハブ判定: dest.hubCity !== dest.name のとき hubCity エリアを直接使用
 *
 * 3段フォールバック（hubCity === dest.name の場合のみ）:
 *   Tier1: dest自身の hotelAreas エントリ（area-specific）
 *   Tier2: dest.fallbackCity → hotelAreas エントリ（weak時またはTier1失敗時）
 *   Tier3: dest.prefecture のキーワード検索（最終手段）
 *
 * weak判定: requiresCar=true かつ destType=mountain/remote のとき
 */

import { loadJson }       from '../lib/loadJson.js';
import { getDefaultDates } from '../utils/date.js';
import { calcDistanceKm }  from '../utils/geo.js';

/* hotelAreas.json / affiliateProviders.json を起動時に1回ロード */
const HOTEL_AREAS  = await loadJson('../data/hotelAreas.json',        import.meta.url);
const AFFILIATE    = await loadJson('../data/affiliateProviders.json', import.meta.url);
const AREAS_BY_ID  = new Map(HOTEL_AREAS.map(a => [a.id, a]));
const AREAS_BY_NAME = new Map(HOTEL_AREAS.map(a => [a.name, a]));

/** hotelAreas.json に登録された温泉エリア名のホワイトリスト */
const ONSEN_STAY_AREAS = new Set(
  HOTEL_AREAS.filter(a => a.name.includes('温泉')).map(a => a.name)
);

/* アフィリエイト設定 */
const RAKUTEN_AFID = AFFILIATE.rakuten.affiliateId;   // 5113ee4b.8662cfc5.5113ee4c.119de89a
const JALAN_VC_SID = AFFILIATE.jalan.vcSid;           // 3764408
const JALAN_VC_PID = AFFILIATE.jalan.vcPid;           // 892559858

/**
 * destinations.json の ID と hotelAreas.json の ID が異なるケースの対応
 * （destinations で同名地が複数ある場合 -t / -o / -k 等のサフィックスが付く）
 */
const DEST_TO_AREA_ID = {
  'shirakawago-t':   'shirakawago',
  'kurashiki-o':     'kurashiki',
  'takayama-o':      'takayama',
  'kurokawa-k':      'kurokawa',
  'esashi-hokkaido': 'esashi',
};

/**
 * weak判定: 宿が非常に少ない（山奥・極地）系の目的地
 * Tier2（fallbackCity）を優先使用する
 */
function isWeak(dest) {
  return !!(dest.requiresCar && (dest.destType === 'mountain' || dest.destType === 'remote'));
}

/**
 * stayArea フィールドからサービス別キーワードを取得。
 * stayArea が string → 楽天・じゃらん共通（後方互換）
 * stayArea が { rakuten, jalan } → サービス別
 */
function getStayAreaFor(dest, service) {
  const sa = dest.stayArea;
  if (!sa) return null;
  if (typeof sa === 'string') return sa;
  const other = service === 'rakuten' ? 'jalan' : 'rakuten';
  return sa[service] ?? sa[other] ?? null;
}

/**
 * 宿検索エリアを解決する（観光エリア粒度 — 楽天/じゃらん検索キーワード用）。
 * 優先順位:
 *   1. dest.stayArea.rakuten（migrateBookingData.js で設定済み）
 *   2. ONSEN_STAY_AREAS ホワイトリスト
 *   3. 島名
 *   4. hotelAreas エリア名
 *   5. dest.name（最終フォールバック）
 */
function resolveStayArea(dest) {
  // stayArea が設定済みならそれを最優先
  const sa = getStayAreaFor(dest, 'rakuten');
  if (sa) return sa;

  const name = dest.displayName || dest.name;
  // 温泉名はホワイトリスト照合（「温泉」を含むだけでは許可しない）
  if (ONSEN_STAY_AREAS.has(name)) return name;
  if (dest.isIsland || dest.destType === 'island') return name;
  const area = lookupAreaById(dest.id);
  if (area?.name) return area.name;
  return name;
}

/**
 * 宿UIラベルを解決する（「〜で泊まる」の表示用）。
 *
 * 観光地名（川/山/岬/湖/海岸等）は宿泊地として不自然なため、
 * 駅名・市区町村名に変換する。
 *
 * 温泉名はホワイトリスト（ONSEN_STAY_AREAS）に登録された名称のみ許可。
 *
 * @param {string} rawName — resolveStayArea / hubCity の出力値
 * @param {object} dest    — destinations.json エントリ
 * @returns {string} UIに表示する宿泊地名
 */
const STAY_LABEL_SPOT = /川$|山$|岳$|峰$|滝$|湖$|渓谷|海岸|岬$|ロード$|街道/;

function resolveStayLabel(rawName, dest) {
  if (!rawName) return dest?.displayName || dest?.name || '';
  // 括弧付き名前は括弧前の部分で判定（"飛騨高山（北アルプス側）" → "飛騨高山"）
  const coreName = rawName.replace(/（.*）$/, '');
  // ホワイトリスト登録済み温泉名はそのまま許可
  if (ONSEN_STAY_AREAS.has(coreName) || ONSEN_STAY_AREAS.has(rawName)) return coreName;
  // 観光地パターンに一致しなければそのまま（括弧除去後で判定）
  if (!STAY_LABEL_SPOT.test(coreName)) return coreName;
  // 観光地名 → 駅名 or fallbackCity に変換し、元の観光地名を補足表示
  const clean = (n) => String(n ?? '').replace(/駅$/, '');
  const base = clean(dest?.representativeStation) || dest?.fallbackCity || dest?.displayName || dest?.name || coreName;
  if (base === coreName) return base;
  return `${base}（${coreName}）`;
}

function lookupAreaById(destId) {
  const areaId = DEST_TO_AREA_ID[destId] ?? destId;
  return AREAS_BY_ID.get(areaId) ?? null;
}

function lookupAreaByName(name) {
  return AREAS_BY_NAME.get(name) ?? null;
}

/**
 * 日付パラメータを外部URLに付与（best-effort）
 * Rakuten / Jalan の外部ページに checkin/checkout を渡す
 */
function appendDateParams(url) {
  try {
    const { checkin, checkout } = getDefaultDates();
    const u = new URL(url);
    u.searchParams.set('checkin',  checkin);
    u.searchParams.set('checkout', checkout);
    return u.toString();
  } catch {
    return url;
  }
}

/**
 * 楽天エリアページ URL
 * 優先: area.rakutenPath → area.rakutenFallback → dest.hotelArea パス
 */
function getRakutenPath(area, dest) {
  return area?.rakutenPath
    || area?.rakutenFallback
    || (dest?.hotelArea ? `/yado/${dest.hotelArea}/` : null);
}

function buildRakutenDestUrl(path) {
  return `https://travel.rakuten.co.jp${path ?? '/'}`;
}

function buildRakutenAffilUrl(destUrl) {
  return appendDateParams(`https://hb.afl.rakuten.co.jp/hgc/${RAKUTEN_AFID}/?pc=${encodeURIComponent(destUrl)}`);
}

/**
 * 二重エンコード防止エンコーダー。
 * すでに encodeURIComponent 済みの文字列が渡された場合、一度デコードしてから再エンコードする。
 * Shift_JIS 完全廃止 — UTF-8 のみ使用。
 */
function safeEncode(area) {
  try {
    return decodeURIComponent(area) !== area
      ? encodeURIComponent(decodeURIComponent(area))
      : encodeURIComponent(area);
  } catch {
    return encodeURIComponent(area);
  }
}

/**
 * エリア名を正規化する（エンコード前の前処理）。
 * 余分な空白・全角スペース・制御文字を除去する。
 */
function normalizeArea(area) {
  return String(area ?? '')
    .trim()
    .replace(/[\u3000\s]+/g, ' ')  // 全角スペース → 半角スペースに統一
    .trim();
}

/**
 * 楽天キーワード検索 純粋URL（アフィリエイトなし）
 * Shift_JIS 廃止・safeEncode で二重エンコード防止
 */
function buildRakutenUrl(area) {
  return `https://travel.rakuten.co.jp/yado/japan.html?f_query=${safeEncode(normalizeArea(area))}`;
}

/**
 * じゃらんキーワード検索 純粋URL（アフィリエイトなし）
 * Shift_JIS 廃止・normalizeArea + safeEncode で二重エンコード防止
 */
function buildJalanUrl(area) {
  return `https://www.jalan.net/uw/uwp2011/uww2011init.do?keyword=${safeEncode(normalizeArea(area))}`;
}

/**
 * 楽天キーワード検索URL（エリア特化ページがない場合のフォールバック）
 * 観光エリア名で直接検索し、都道府県レベルより精度の高い結果を返す
 *
 * @param {string} keyword — 検索キーワード
 * @param {object} [dest]  — destinations エントリ（温泉補完に使用）
 */
function buildRakutenKeywordUrl(keyword, dest) {
  if (!keyword) return null;
  let q = keyword;
  // 温泉目的地でキーワードに「温泉」が含まれない場合は補完（検索精度向上）
  if (dest?.destType === 'onsen' && !q.includes('温泉')) {
    q = q + '温泉';
  }
  return buildRakutenAffilUrl(buildRakutenUrl(q));
}

/** rakutenPath が都道府県レベル（粗粒度）かどうかを判定 */
function isCoarseRakutenPath(path) {
  if (!path) return true;
  // /yado/hokkaido/ のような .html なしパスは都道府県レベル
  return !path.includes('.html');
}

/**
 * じゃらん VC アフィリエイトリンク
 * jalanUrl は UTF-8 safeEncode 済みの URL（Shift-JIS廃止）
 */
function buildJalanAffilUrl(rawJalanUrl) {
  return appendDateParams(`https://ck.jp.ap.valuecommerce.com/servlet/referral?sid=${JALAN_VC_SID}&pid=${JALAN_VC_PID}&vc_url=${encodeURIComponent(rawJalanUrl)}`);
}

/**
 * じゃらんキーワード検索URL（スポット単位・UTF-8）
 * 温泉名・スポット名で直接検索し、県・市レベルより精度向上。
 */
function buildJalanKeywordUrl(keyword) {
  if (!keyword) return null;
  return buildJalanAffilUrl(buildJalanUrl(keyword));
}

/**
 * 3段フォールバック + キーワード検索で楽天URLを解決
 *
 * エリア特化ページ（.html）がある → そのまま使用
 * 都道府県レベル（粗粒度）→ resolveStayArea でキーワード検索に切り替え
 */
function resolveRakutenUrl(dest) {
  // Tier1: dest自身のエリア（weak でなければ優先）
  if (!isWeak(dest)) {
    const area = lookupAreaById(dest.id);
    const path = getRakutenPath(area, dest);
    if (path && !isCoarseRakutenPath(path)) {
      return buildRakutenAffilUrl(buildRakutenDestUrl(path));
    }
    // 粗粒度 → キーワード検索で観光エリア粒度に
    if (path) {
      const stayArea = resolveStayArea(dest);
      return buildRakutenKeywordUrl(stayArea, dest);
    }
  }

  // Tier2: fallbackCity
  if (dest.fallbackCity) {
    const fbArea = lookupAreaByName(dest.fallbackCity);
    const path = getRakutenPath(fbArea, null);
    if (path && !isCoarseRakutenPath(path)) {
      return buildRakutenAffilUrl(buildRakutenDestUrl(path));
    }
    if (path) {
      return buildRakutenKeywordUrl(dest.fallbackCity, dest);
    }
  }

  // Tier3: dest 自身のエリア（weak でも強制使用）
  const area = lookupAreaById(dest.id);
  const path = getRakutenPath(area, dest);
  if (path && !isCoarseRakutenPath(path)) {
    return buildRakutenAffilUrl(buildRakutenDestUrl(path));
  }
  // 最終フォールバック: キーワード検索
  const stayArea = resolveStayArea(dest);
  return buildRakutenKeywordUrl(stayArea, dest);
}

/**
 * じゃらんURLをスポット単位で解決（CV向上: 温泉名/島名で検索）
 *
 * 優先順位:
 *   1. dest.stayArea.jalan（migrateBookingData.js で設定済み）
 *   2. 温泉（destType=onsen or ONSEN_STAY_AREAS一致）→ 温泉名でキーワード検索
 *   3. 島（destType=island）→ 島名でキーワード検索
 *   4. hotelAreas.jalanUrl（UTF-8市区町村検索）
 *   5. fallbackCity の jalanUrl
 *   6. 最終フォールバック: displayName でキーワード検索
 */
function resolveJalanUrl(dest) {
  const name = dest.displayName || dest.name;

  // stayArea.jalan が設定済みならそれを最優先（文字化け防止）
  const jalanArea = getStayAreaFor(dest, 'jalan');
  if (jalanArea) return buildJalanKeywordUrl(jalanArea);

  // 温泉: 温泉名で直接検索（じゃらんの強み）
  if (dest.destType === 'onsen' || ONSEN_STAY_AREAS.has(name)) {
    return buildJalanKeywordUrl(name);
  }
  // 島: 島名で直接検索
  if (dest.destType === 'island' || dest.isIsland) {
    return buildJalanKeywordUrl(name);
  }

  // Tier1: dest自身のエリア（weak でなければ優先）
  if (!isWeak(dest)) {
    const area = lookupAreaById(dest.id);
    if (area?.jalanUrl) return buildJalanAffilUrl(area.jalanUrl);
  }

  // Tier2: fallbackCity
  if (dest.fallbackCity) {
    const fbArea = lookupAreaByName(dest.fallbackCity);
    if (fbArea?.jalanUrl) return buildJalanAffilUrl(fbArea.jalanUrl);
  }

  // Tier3: dest 自身のエリア（weak でも使用）
  const area = lookupAreaById(dest.id);
  if (area?.jalanUrl) return buildJalanAffilUrl(area.jalanUrl);

  // 最終フォールバック: displayNameでキーワード検索
  return buildJalanKeywordUrl(name);
}

/**
 * 近隣ホテルリンク（30km以内の別エリア）
 * lat/lng のある hotelAreas から距離順で最大2件を返す。
 * hubLinks が別途生成される mountain/remote は除外。
 *
 * @param {object} dest — destination エントリ
 * @returns {Array<{heading, links}> | null}
 */
function buildNearbyHotelLinks(dest) {
  if (!dest.lat || !dest.lng) return null;
  /* mountain/remote は hubLinks 側で「アクセス良い街」を案内済み → ここでは不要 */
  if (dest.requiresCar || dest.destType === 'mountain' || dest.destType === 'remote') return null;

  const AREACODE = DEST_TO_AREA_ID[dest.id] ?? dest.id;

  const nearby = HOTEL_AREAS
    .filter(a => a.lat && a.lng && a.id !== AREACODE)
    .map(a => ({ ...a, dist: calcDistanceKm(dest, a) }))
    .filter(a => a.dist >= 3 && a.dist <= 30)   // 3km以上30km以内（同一市内除外）
    .sort((a, b) => a.dist - b.dist)
    .slice(0, 2);

  if (nearby.length === 0) return null;

  return nearby.map(area => {
    const rakutenPath = getRakutenPath(area, null);
    const rakutenUrl  = rakutenPath
      ? (isCoarseRakutenPath(rakutenPath)
        ? buildRakutenKeywordUrl(area.name)
        : buildRakutenAffilUrl(buildRakutenDestUrl(rakutenPath)))
      : null;
    const jalanUrl = area.jalanUrl ? buildJalanAffilUrl(area.jalanUrl) : null;
    if (!rakutenUrl && !jalanUrl) return null;

    const distStr = `${Math.round(area.dist)}km`;
    return {
      heading: `${area.name}（${distStr}）`,
      links: [
        ...(rakutenUrl ? [{ type: 'rakuten', label: '楽天で宿を見る',   url: rakutenUrl }] : []),
        ...(jalanUrl   ? [{ type: 'jalan',   label: 'じゃらんで宿を見る', url: jalanUrl }] : []),
      ],
    };
  }).filter(Boolean);
}

/**
 * 宿泊地を解決する（交通ロジックから独立）。
 *
 * 優先順位:
 *   1. stayAreas[0]          — 明示的な宿泊エリア指定
 *   2. stayPriority='high'   → 現地泊（温泉・島など）
 *   3. destType='city'       → 都市なら自身に泊まる
 *   4. hubCity               — 拠点都市（山岳・秘境・半島など）
 *   5. dest.name             — 最終フォールバック
 *
 * stayPriority:
 *   high   — 現地泊を優先（onsen, island）
 *   medium — 既存ロジック通り（city, sight）
 *   low    — hubCity泊を優先（mountain, remote, peninsula）
 *
 * @param {object} dest — destinations.json エントリ
 * @returns {string} 宿泊地名
 */
export function resolveStay(dest) {
  if (dest.stayAreas && dest.stayAreas.length > 0) {
    return dest.stayAreas[0];
  }
  if (dest.stayPriority === 'high') {
    return dest.displayName || dest.name;
  }
  if (dest.destType === 'city') {
    return dest.displayName || dest.name;
  }
  if (dest.hubCity) {
    return dest.hubCity;
  }
  return dest.displayName || dest.name;
}

/**
 * 目的地に直接泊まれるか判定する。
 * 小島・山岳・秘境・半島 → false（拠点泊が現実的）
 * 温泉・都市・観光地 → true
 */
function resolveHasStay(dest) {
  const dt = dest?.destType;
  if (dt === 'mountain' || dt === 'remote') return false;
  if (dt === 'peninsula') return false;
  // 島: 宿泊施設がある大きな島はtrue、小島はfalse
  if (dt === 'island' || dest?.isIsland) {
    return dest?.stayPriority === 'high';
  }
  return true;
}

/**
 * 宿泊理由テキスト（「日帰りのデメリット」= 事実ベース）。
 * destType に基づいて固定テンプレから生成。
 * stayDescription（体験描写）はnudge側で使用するため、ここでは使わない。
 */
const STAY_REASON_MAP = {
  onsen:     '山の宿で温泉に2回入って、部屋でゆっくりして寝る',
  island:    '昼と夕方で景色が変わるから、1泊して全部楽しむ',
  mountain:  '朝の空気と景色が別物、泊まらないと味わえない',
  remote:    '朝の空気と景色が別物、泊まらないと味わえない',
  city:      '夜ご飯と街歩きも含めて、まるごと1日楽しむ',
  sight:     '回りきれないから、1泊してゆっくり巡る',
  peninsula: '回りきれないから、1泊してゆっくり巡る',
};

function resolveStayReason(dest) {
  return STAY_REASON_MAP[dest?.destType] ?? '1泊するとゆっくり回れる';
}

/**
 * @param {object} dest — destination エントリ
 * @returns {{
 *   links: Array,               // 宿リンク（rakuten/jalan）
 *   stayCityName: string,       // UI表示用の宿泊地名
 *   bestUrl: string|null,       // 最良の宿リンクURL（1CTA用）
 *   bestType: string|null,      // 'rakuten' | 'jalan'
 *   hasStay: boolean,           // 目的地に直接泊まれるか
 *   stayReason: string|null,    // 泊まる理由（1行）
 * }}
 */
export function buildHotelLinks(dest) {
  const destName = dest.displayName || dest.name;

  /* ── hubCity が目的地と異なる → hubCity エリアを直接使用 ── */
  if (dest.hubCity && dest.hubCity !== destName) {
    const hubArea        = lookupAreaByName(dest.hubCity);
    const hubRakutenPath = getRakutenPath(hubArea, null);
    // hubCity でも粗粒度ならキーワード検索に切り替え
    const hubRakutenUrl  = hubRakutenPath
      ? (isCoarseRakutenPath(hubRakutenPath)
        ? buildRakutenKeywordUrl(dest.hubCity)
        : buildRakutenAffilUrl(buildRakutenDestUrl(hubRakutenPath)))
      : null;
    const hubJalanUrl    = hubArea?.jalanUrl ? buildJalanAffilUrl(hubArea.jalanUrl) : null;
    const links = [
      ...(hubRakutenUrl ? [{ type: 'rakuten', url: hubRakutenUrl }] : []),
      ...(hubJalanUrl   ? [{ type: 'jalan',   url: hubJalanUrl   }] : []),
    ];
    if (links.length) {
      return {
        links,
        stayCityName: resolveStayLabel(dest.hubCity, dest),
        bestUrl:  links[0]?.url  ?? null,
        bestType: links[0]?.type ?? null,
        hasStay:    resolveHasStay(dest),
        stayReason: resolveStayReason(dest),
      };
    }
  }

  /* ── 現地宿（Tier1 → Tier2 → Tier3）── */
  const rakutenUrl = resolveRakutenUrl(dest);
  const jalanUrl   = resolveJalanUrl(dest);

  const links = [
    ...(rakutenUrl ? [{ type: 'rakuten', url: rakutenUrl }] : []),
    ...(jalanUrl   ? [{ type: 'jalan',   url: jalanUrl   }] : []),
  ];

  return {
    links,
    stayCityName: resolveStayLabel(resolveStayArea(dest), dest),
    bestUrl:  links[0]?.url  ?? null,
    bestType: links[0]?.type ?? null,
    hasStay:    resolveHasStay(dest),
    stayReason: resolveStayReason(dest),
  };
}
