import { RAKUTEN_AFF_ID } from '../config/constants.js';

/**
 * 宿泊リンクを組み立てる。
 *
 * URL設計方針:
 *   楽天 : search.travel.rakuten.co.jp/ds/yado/ + キーワード検索
 *   じゃらん : jalan.net/yadolist/ + キーワード検索
 *   ※ エリアID依存URLは使用しない（壊れやすいため）
 *   ※ checkIn未設定・不正な場合は日付パラメータを付与しない
 *
 * @param {object} city        - 都市オブジェクト
 * @param {string} date        - "YYYY-MM-DD" 形式の日付文字列（nullable）
 * @param {string} stayType    - "daytrip" | "1night"
 * @param {string} people      - "1" | "2" | "3-4" | "5+"
 */
export function buildHotelLinks(city, date, stayType, people) {
  if (stayType !== '1night') {
    return { destination: [], hub: [] };
  }
  if (!city.affiliate?.hotelArea) {
    return { destination: [], hub: [] };
  }

  const area  = city.affiliate.hotelArea;
  const dates = resolveDates(date);
  const adult = resolveAdultCount(people);

  return {
    destination: [
      buildRakutenLink(area, dates, adult),
      buildJalanLink(area),
    ],
    hub: [],
  };
}

/* ── 楽天トラベル ── */

function buildRakutenLink(area, dates, adult) {
  // 必ず絶対URLで生成（相対パス禁止）
  const base = 'https://search.travel.rakuten.co.jp/ds/yado/';
  let url = `${base}?f_keyword=${encodeURIComponent(area)}&f_adult=${adult}&scid=af_pc_link_url&sc2id=${RAKUTEN_AFF_ID}`;
  if (dates) {
    url += `&f_checkin=${dates.checkIn}&f_checkout=${dates.checkOut}`;
  }
  return { type: 'rakuten', label: 'この街の宿を見てみる（楽天トラベル）', url };
}

/* ── じゃらん ── */

function buildJalanLink(area) {
  return {
    type:  'jalan',
    label: 'じゃらんで宿を探す',
    url:   `https://www.jalan.net/uw/uwp2011/uww2011.do?keyword=${encodeURIComponent(area)}`,
  };
}

/* ── 日付処理 ── */

/**
 * "YYYY-MM-DD" 文字列から YYYYMMDD 形式のチェックイン/チェックアウトを生成する。
 * 不正な入力の場合は null を返す（日付パラメータを付与しない）。
 * タイムゾーン依存を避けるため Date(year, month, day) ローカルコンストラクタを使用。
 */
function resolveDates(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') return null;

  const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;

  const y = parseInt(match[1], 10);
  const m = parseInt(match[2], 10);
  const d = parseInt(match[3], 10);

  if (isNaN(y) || isNaN(m) || isNaN(d)) return null;

  const checkIn  = `${match[1]}${match[2]}${match[3]}`;
  const outDate  = new Date(y, m - 1, d + 1);   // ローカル時刻でtimezone-safe
  const checkOut = `${outDate.getFullYear()}${pad(outDate.getMonth() + 1)}${pad(outDate.getDate())}`;

  return { checkIn, checkOut };
}

function pad(n) {
  return String(n).padStart(2, '0');
}

/* ── 人数処理 ── */

/**
 * 人数文字列を楽天の f_adult 数値に変換する。
 * 不正・未設定の場合は 1 を返す。
 */
function resolveAdultCount(people) {
  switch (people) {
    case '1':   return 1;
    case '2':   return 2;
    case '3-4': return 3;
    case '5+':  return 5;
    default:    return 1;
  }
}
