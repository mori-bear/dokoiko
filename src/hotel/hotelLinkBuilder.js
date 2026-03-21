/**
 * 宿泊リンクビルダー — 完全データ駆動
 *
 * データソース: data/hotels.js（HOTELS）
 * ロジックによる URL 生成なし。
 * HOTELS に登録がない destination は null を返す（render.js 側で「準備中」表示）。
 *
 * 返り値: { solo, couple, friends } 各属性は { name, reason, links } | null
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

/**
 * @param {object} dest — destination エントリ
 * @returns {{ solo, couple, friends } | null}
 */
export function buildHotelLinks(dest) {
  const data = HOTELS[dest.id];
  if (!data) return null;
  return {
    solo:    buildAttr(data.solo,    dest.name),
    couple:  buildAttr(data.couple,  dest.name),
    friends: buildAttr(data.friends, dest.name),
  };
}

/* app.js 互換スタブ（no-op） */
export function initHotelAreas() {}
