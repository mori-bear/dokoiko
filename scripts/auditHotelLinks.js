import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const data = JSON.parse(fs.readFileSync(path.join(__dirname, '../src/data/destinations.json'), 'utf-8'));

// ── ステップ1: リンク種別の分布 ──
const stats = {
  rakuten_keyword: 0,
  rakuten_area:    0,
  rakuten_none:    0,
  jalan_url:       0,
  jalan_none:      0,
  both_none:       0,
};

data.forEach(d => {
  const r  = d.hotelLinks?.rakuten;
  const ra = d.hotelLinks?.rakutenArea;
  const j  = d.hotelLinks?.jalan;
  if      (r && r.includes('hb.afl')) stats.rakuten_keyword++;
  else if (ra)                         stats.rakuten_area++;
  else                                 stats.rakuten_none++;
  if (j) stats.jalan_url++;
  else   stats.jalan_none++;
  if (!r && !ra && !j) stats.both_none++;
});

console.log('\n=== ステップ1: リンク種別分布 ===');
console.log(JSON.stringify(stats, null, 2));

// ── ステップ2: 宿リンク完全なし ──
const noHotel = data.filter(d => {
  const r  = d.hotelLinks?.rakuten;
  const ra = d.hotelLinks?.rakutenArea;
  const j  = d.hotelLinks?.jalan;
  return !r && !ra && !j;
});

console.log(`\n=== ステップ2: 宿リンク完全なし ${noHotel.length}件 ===`);
noHotel.forEach(d => console.log(` - ${d.name} / ${d.prefecture ?? d.region} / ${d.id}`));

// ── ステップ3: rakutenAreaのみ（精度低め） ──
const areaOnly = data.filter(d => !d.hotelLinks?.rakuten && d.hotelLinks?.rakutenArea);

console.log(`\n=== ステップ3: rakutenAreaのみ ${areaOnly.length}件（先頭20件） ===`);
areaOnly.slice(0, 20).forEach(d =>
  console.log(` - ${d.name} / ${d.prefecture ?? d.region} / ${d.hotelLinks.rakutenArea}`)
);

// ── ステップ4: じゃらんリンク種別 ──
const jalanTypes = {};
data.forEach(d => {
  const j = d.hotelLinks?.jalan;
  if (!j) return;
  const type = j.includes('yadNo') ? 'ホテル直リンク'
             : j.includes('pref')  ? '都道府県リンク'
             : j.includes('LRG')   ? 'エリアリンク'
             :                       'その他（キーワード等）';
  jalanTypes[type] = (jalanTypes[type] || 0) + 1;
});
console.log('\n=== ステップ4: じゃらんリンク種別 ===');
console.log(JSON.stringify(jalanTypes, null, 2));
