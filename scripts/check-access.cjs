'use strict';
const d = require('../src/data/destinations.json');
const targets = ['arima-onsen','shirakawago-t','iya','jozankei','atami','kotohira','onomichi'];
targets.forEach(function(id) {
  const e = d.find(function(x){return x.id === id;});
  if (!e) { console.log(id, 'NOT FOUND'); return; }
  console.log(id, e.name, '| access:', JSON.stringify(e.access), '| needsCar:', e.needsCar);
});
