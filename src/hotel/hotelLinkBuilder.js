/**
 * 宿泊リンクビルダー — 完全データ駆動 + 検索フォールバック
 *
 * データソース: data/hotels.js（HOTELS）
 * HOTELS に登録がない destination は楽天/じゃらん検索URLでフォールバックする。
 * null は絶対に返さない。
 *
 * 返り値: { solo, couple, friends } 各属性は { name, reason, links }
 */

import { HOTELS } from '../../data/hotels.js';

const RAKUTEN_AFF = 'https://hb.afl.rakuten.co.jp/hgc/5113ee4b.8662cfc5.5113ee4c.119de89a/?pc=';
const VC_BASE     = 'https://ck.jp.ap.valuecommerce.com/servlet/referral?sid=3764408&pid=892559858&vc_url=';

function buildAttr(entry, destName) {
  if (!entry) return null;
  const links = [];
  if (entry.rakutenUrl) {
    links.push({ type: 'rakuten', label: `${destName}の宿を見る（楽天）`, url: RAKUTEN_AFF + encodeURIComponent(entry.rakutenUrl) });
  }
  if (entry.jalanUrl) {
    links.push({ type: 'jalan', label: `${destName}の宿を見る（じゃらん）`, url: VC_BASE + encodeURIComponent(entry.jalanUrl) });
  }
  return { name: entry.name, reason: entry.reason, links };
}

/** HOTELS 未登録の都市用フォールバック（検索リンク） */
function buildFallback(cityName) {
  const enc = encodeURIComponent;
  const rakutenSearch = `https://travel.rakuten.co.jp/keyword/?f_query=${enc(cityName)}`;
  const jalanSearch   = `https://www.jalan.net/hotel/search/?keyWord=${enc(cityName)}`;
  const links = [
    { type: 'rakuten', label: `${cityName}の宿を探す（楽天）`, url: RAKUTEN_AFF + enc(rakutenSearch) },
    { type: 'jalan',   label: `${cityName}の宿を探す（じゃらん）`, url: VC_BASE + enc(jalanSearch) },
  ];
  const entry = { name: `${cityName}のおすすめの宿`, reason: '最安値を比較してご予約ください', links };
  return { solo: entry, couple: entry, friends: entry };
}

/**
 * @param {object} dest — destination エントリ
 * @returns {{ solo, couple, friends }} — null を返さない
 */
export function buildHotelLinks(dest) {
  const data = HOTELS[dest.id];
  if (!data) return buildFallback(dest.name);
  return {
    solo:    buildAttr(data.solo,    dest.name),
    couple:  buildAttr(data.couple,  dest.name),
    friends: buildAttr(data.friends, dest.name),
  };
}

/* app.js 互換スタブ（no-op） */
export function initHotelAreas() {}
