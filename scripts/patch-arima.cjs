'use strict';
const fs = require('fs');
const path = require('path');
const src = path.join(__dirname, '../src/data/destinations.json');
const data = JSON.parse(fs.readFileSync(src, 'utf8'));

let fixed = 0;
const result = data.map(function(d) {
  if (d.id === 'arima-onsen') {
    fixed++;
    return Object.assign({}, d, { access: Object.assign({}, d.access, { railNote: 'バスあり' }) });
  }
  return d;
});

fs.writeFileSync(src, JSON.stringify(result, null, 2));
console.log('有馬温泉 railNote修正:', fixed, '件');
