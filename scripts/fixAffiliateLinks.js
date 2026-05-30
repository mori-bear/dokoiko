#!/usr/bin/env node
/**
 * fixAffiliateLinks.js
 * destinations.json の hotelLinks.rakuten / hotelLinks.jalan を全件アフィリエイト形式へ変換する。
 *
 * 楽天:
 *   - すでに hb.afl.rakuten.co.jp 形式 → そのまま維持
 *   - travel.rakuten.co.jp などの素リンク → アフィリ形式へ変換
 * じゃらん:
 *   - すでに valuecommerce 形式 → そのまま維持
 *   - www.jalan.net などの素リンク → ValueCommerce 形式へ変換
 *
 * hotelLinks 以外の rakuten/jalan キー（キーワード文字列など）は一切触らない。
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const DESTS_PATH     = path.join(__dirname, '../data/destinations.json');
const AFFILIATE_PATH = path.join(__dirname, '../src/data/affiliateProviders.json');

const AFFILIATE = JSON.parse(fs.readFileSync(AFFILIATE_PATH, 'utf-8'));

const RAKUTEN_AFID = AFFILIATE.rakuten.affiliateId;
const JALAN_VC_SID = AFFILIATE.jalan.vcSid;
const JALAN_VC_PID = AFFILIATE.jalan.vcPid;

const RAKUTEN_AFFIL_PREFIX = 'https://hb.afl.rakuten.co.jp/hgc/';
const JALAN_VC_PREFIX      = 'https://ck.jp.ap.valuecommerce.com/servlet/referral';

function buildRakutenAffilUrl(destUrl) {
  return `${RAKUTEN_AFFIL_PREFIX}${RAKUTEN_AFID}/?pc=${encodeURIComponent(destUrl)}`;
}

function buildJalanAffilUrl(rawJalanUrl) {
  return `${JALAN_VC_PREFIX}?sid=${JALAN_VC_SID}&pid=${JALAN_VC_PID}&vc_url=${encodeURIComponent(rawJalanUrl)}`;
}

const stats = {
  rakutenTotal: 0,
  rakutenAlready: 0,
  rakutenConverted: 0,
  rakutenSkipped: 0,
  jalanTotal: 0,
  jalanAlready: 0,
  jalanConverted: 0,
  jalanSkipped: 0,
};

function processHotelLinks(hl) {
  // 楽天
  if (typeof hl.rakuten === 'string' && hl.rakuten.startsWith('http')) {
    stats.rakutenTotal++;
    if (hl.rakuten.startsWith(RAKUTEN_AFFIL_PREFIX)) {
      stats.rakutenAlready++;
    } else if (hl.rakuten.includes('rakuten.co.jp')) {
      hl.rakuten = buildRakutenAffilUrl(hl.rakuten);
      stats.rakutenConverted++;
    } else {
      stats.rakutenSkipped++;
    }
  }
  // じゃらん
  if (typeof hl.jalan === 'string' && hl.jalan.startsWith('http')) {
    stats.jalanTotal++;
    if (hl.jalan.startsWith(JALAN_VC_PREFIX)) {
      stats.jalanAlready++;
    } else if (hl.jalan.includes('jalan.net')) {
      hl.jalan = buildJalanAffilUrl(hl.jalan);
      stats.jalanConverted++;
    } else {
      stats.jalanSkipped++;
    }
  }
}

// hotelLinks を持つオブジェクトを再帰的に探索して処理する
function walk(node) {
  if (Array.isArray(node)) {
    node.forEach(walk);
    return;
  }
  if (node && typeof node === 'object') {
    if (node.hotelLinks && typeof node.hotelLinks === 'object') {
      processHotelLinks(node.hotelLinks);
    }
    for (const key of Object.keys(node)) {
      if (key === 'hotelLinks') continue; // 既処理
      walk(node[key]);
    }
  }
}

const data = JSON.parse(fs.readFileSync(DESTS_PATH, 'utf-8'));
walk(data);

fs.writeFileSync(DESTS_PATH, JSON.stringify(data, null, 2) + '\n', 'utf-8');

console.log('=== アフィリエイトリンク変換結果 ===');
console.log('[楽天]');
console.log(`  対象URL総数 : ${stats.rakutenTotal}`);
console.log(`  既にアフィリ : ${stats.rakutenAlready}（維持）`);
console.log(`  新規変換    : ${stats.rakutenConverted}（素リンク→アフィリ）`);
console.log(`  対象外スキップ: ${stats.rakutenSkipped}`);
console.log('[じゃらん]');
console.log(`  対象URL総数 : ${stats.jalanTotal}`);
console.log(`  既にVC形式  : ${stats.jalanAlready}（維持）`);
console.log(`  新規変換    : ${stats.jalanConverted}（素リンク→ValueCommerce）`);
console.log(`  対象外スキップ: ${stats.jalanSkipped}`);
