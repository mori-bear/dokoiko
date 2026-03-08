'use strict';
const d = require('../src/data/destinations.json');
const types = {};
d.forEach(function(x) { types[x.type] = (types[x.type]||0)+1; });
console.log('型分布:', JSON.stringify(types));

const islands = d.filter(function(x) { return x.isIsland; });
console.log('isIsland=true:', islands.length, '件', islands.map(function(x){return x.name;}).join(', '));

const spots = d.filter(function(x) { return x.type === 'spot'; });
const allIds = new Set(d.map(function(x){return x.id;}));
let orphanCount = 0;
spots.forEach(function(s) {
  if (allIds.has(s.parentDestination)) return;
  console.log('  ORPHAN:', s.id, '->', s.parentDestination);
  orphanCount++;
});
console.log('spot orphan:', orphanCount);

const dests = d.filter(function(x) { return x.type === 'destination'; });
const noHub = dests.filter(function(x) { return !x.hotelHub; });
console.log('destination.hotelHub未設定:', noHub.length);

const hubs = d.filter(function(x) { return x.type === 'hub'; });
console.log('---');
console.log('hub数:', hubs.length);
console.log('destination数:', dests.length);
console.log('spot数:', spots.length);
console.log('合計:', d.length);
