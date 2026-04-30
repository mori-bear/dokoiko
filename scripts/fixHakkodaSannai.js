/**
 * fixHakkodaSannai.js — 八甲田山・三内丸山遺跡の楽天リンク修正
 *
 * rakutenArea（廃止エンドポイント、404）を削除し、
 * 既存プロジェクトの affiliate フォーマットで青森市内キーワードURLを設定する。
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEST_FILE = path.join(__dirname, '../src/data/destinations.json');

const AFID = '5113ee4b.8662cfc5.5113ee4c.119de89a';

function buildRakutenAffilUrl(keyword) {
  const dest = `https://travel.rakuten.co.jp/yado/japan.html?f_query=${encodeURIComponent(keyword)}`;
  return `https://hb.afl.rakuten.co.jp/hgc/${AFID}/?pc=${encodeURIComponent(dest)}`;
}

const data = JSON.parse(fs.readFileSync(DEST_FILE, 'utf-8'));

for (const d of data) {
  if (d.id === 'hakkoda') {
    delete d.hotelLinks.rakutenArea;
    d.hotelLinks.rakuten = buildRakutenAffilUrl('青森 八甲田');
    console.log('八甲田山 修正完了');
    console.log('  rakuten:', d.hotelLinks.rakuten);
  }
  if (d.id === 'sannai-maruyama') {
    delete d.hotelLinks.rakutenArea;
    d.hotelLinks.rakuten = buildRakutenAffilUrl('青森市');
    console.log('三内丸山遺跡 修正完了');
    console.log('  rakuten:', d.hotelLinks.rakuten);
  }
}

fs.writeFileSync(DEST_FILE, JSON.stringify(data, null, 2), 'utf-8');
console.log('\ndestinations.json 更新完了');
