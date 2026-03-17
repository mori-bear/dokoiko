'use strict';
// hotelAreas.json の各エントリに jalanUrl (Shift-JIS encoded) を付与する
const fs    = require('fs');
const iconv = require('iconv-lite');

function encodeShiftJIS(str) {
  const buf = iconv.encode(str, 'Shift_JIS');
  let encoded = '';
  for (const byte of buf) {
    encoded += '%' + byte.toString(16).padStart(2, '0').toUpperCase();
  }
  return encoded;
}

function buildJalanTarget(keyword) {
  return 'https://www.jalan.net/uw/uwp2011/uww2011init.do?keyword=' + encodeShiftJIS(keyword);
}

const areas = JSON.parse(fs.readFileSync('src/data/hotelAreas.json', 'utf8'));

let updated = 0;
for (const area of areas) {
  const kw = area.rakutenKeyword;
  area.jalanUrl = buildJalanTarget(kw);
  updated++;
}

fs.writeFileSync('src/data/hotelAreas.json', JSON.stringify(areas, null, 2));
console.log(`Updated ${updated} areas with jalanUrl`);
console.log('Sample:');
areas.slice(0, 3).forEach(a => console.log(a.id, '→', a.jalanUrl.substring(0, 100)));
