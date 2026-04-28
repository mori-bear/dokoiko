/**
 * fixBrokenHotelLinks.js — checkHotelLinks.js で検出した 404 を修正
 *
 * 修正内容:
 *   1. omihachiman / nagano-iida / otsu-shiga / takashima-shiga
 *      廃止された静的エリアページ URL → キーワード検索 URL に置換
 *   2. hakkoda / sannai-maruyama
 *      無効なホテルID のリンクを削除
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEST_FILE = path.join(__dirname, '../src/data/destinations.json');
const AFFILIATE_BASE = 'https://hb.afl.rakuten.co.jp/hgc/5113ee4b.8662cfc5.5113ee4c.119de89a/?pc=';

function makeRakutenSearchUrl(query) {
  const inner = `https://travel.rakuten.co.jp/yado/japan.html?f_query=${query}`;
  return AFFILIATE_BASE + encodeURIComponent(inner);
}

// 修正マップ: id → { rakuten: 新URL | null }
// null = hotelLinks 自体を削除
const FIXES = {
  'omihachiman':     { rakuten: makeRakutenSearchUrl('近江八幡 滋賀県 宿') },
  'nagano-iida':     { rakuten: makeRakutenSearchUrl('飯田 長野県 宿') },
  'otsu-shiga':      { rakuten: makeRakutenSearchUrl('大津 滋賀県 宿') },
  'takashima-shiga': { rakuten: makeRakutenSearchUrl('高島 滋賀県 宿') },
  'hakkoda':         null,   // 無効ホテルID → hotelLinks 削除
  'sannai-maruyama': null,   // daytrip のみ、宿不要 → hotelLinks 削除
};

const data = JSON.parse(fs.readFileSync(DEST_FILE, 'utf-8'));

let changed = 0;
for (const dest of data) {
  if (!(dest.id in FIXES)) continue;

  const fix = FIXES[dest.id];
  if (fix === null) {
    if ('hotelLinks' in dest) {
      delete dest.hotelLinks;
      console.log(`🗑  ${dest.id} (${dest.name}): hotelLinks 削除`);
      changed++;
    }
  } else {
    if (!dest.hotelLinks) dest.hotelLinks = {};
    if (fix.rakuten) {
      dest.hotelLinks.rakuten = fix.rakuten;
      console.log(`🔧 ${dest.id} (${dest.name}): rakuten URL を検索URLに更新`);
      changed++;
    }
  }
}

fs.writeFileSync(DEST_FILE, JSON.stringify(data, null, 2), 'utf-8');
console.log(`\n合計 ${changed} 件修正`);
