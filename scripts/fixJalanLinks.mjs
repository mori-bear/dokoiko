// NG な hotelLinks.jalan を ikisaki/map/{romaji}/ 形式に置換
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(process.cwd());
const SRC = '/Users/moririn/MORI-LAB/projects/dokoiko-site/src/data/destinations.json';
const REPORT = path.join(ROOT, 'logs/hotelLinkContent.json');

const PREF_ROMAJI = {
  '北海道':'hokkaido','青森県':'aomori','岩手県':'iwate','宮城県':'miyagi','秋田県':'akita','山形県':'yamagata','福島県':'fukushima',
  '茨城県':'ibaraki','栃木県':'tochigi','群馬県':'gunma','埼玉県':'saitama','千葉県':'chiba','東京都':'tokyo','神奈川県':'kanagawa',
  '新潟県':'niigata','富山県':'toyama','石川県':'ishikawa','福井県':'fukui','山梨県':'yamanashi','長野県':'nagano',
  '岐阜県':'gifu','静岡県':'shizuoka','愛知県':'aichi','三重県':'mie',
  '滋賀県':'shiga','京都府':'kyoto','大阪府':'osaka','兵庫県':'hyogo','奈良県':'nara','和歌山県':'wakayama',
  '鳥取県':'tottori','島根県':'shimane','岡山県':'okayama','広島県':'hiroshima','山口県':'yamaguchi',
  '徳島県':'tokushima','香川県':'kagawa','愛媛県':'ehime','高知県':'kochi',
  '福岡県':'fukuoka','佐賀県':'saga','長崎県':'nagasaki','熊本県':'kumamoto','大分県':'oita','宮崎県':'miyazaki','鹿児島県':'kagoshima','沖縄県':'okinawa',
};

const report = JSON.parse(fs.readFileSync(REPORT, 'utf-8'));
const ngIds = new Set(report.results.filter(r => !r.jalanOk).map(r => r.id));

const dests = JSON.parse(fs.readFileSync(SRC, 'utf-8'));
let fixed = 0, skipped = 0;
for (const d of dests) {
  if (!ngIds.has(d.id)) continue;
  // 複数県(例: "長野県・岐阜県")は最初の県を採用
  const firstPref = (d.prefecture || '').split(/[・,／\/]/)[0].trim();
  const romaji = PREF_ROMAJI[firstPref];
  if (!romaji) { console.warn('SKIP no romaji:', d.id, d.prefecture); skipped++; continue; }
  const newUrl = `https://www.jalan.net/ikisaki/map/${romaji}/`;
  d.hotelLinks = d.hotelLinks || {};
  const old = d.hotelLinks.jalan;
  d.hotelLinks.jalan = newUrl;
  fixed++;
  if (fixed <= 5) console.log(`${d.id} (${d.prefecture}): ${old} -> ${newUrl}`);
}
console.log(`fixed: ${fixed}, skipped: ${skipped}`);
fs.writeFileSync(SRC, JSON.stringify(dests, null, 2));
console.log('saved', SRC);
