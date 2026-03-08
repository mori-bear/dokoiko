'use strict';
const d = require('../src/data/destinations.json');
const all = d.filter(function(x){return x.type !== 'spot';});
console.log('transport field exists?', all.some(function(x){return x.transport;}));
console.log('mapDestination exists?', all.some(function(x){return x.mapDestination;}));
console.log('\nrailNote examples:');
all.filter(function(x){return x.access && x.access.railNote;}).forEach(function(x){
  console.log(' ', x.id, x.name, '->', x.access.railNote);
});
console.log('\nferryGateway examples:');
all.filter(function(x){return x.access && x.access.ferryGateway;}).forEach(function(x){
  console.log(' ', x.id, x.name, '->', x.access.ferryGateway);
});
console.log('\nairportGateway + no rail:');
all.filter(function(x){return x.access && x.access.airportGateway && !x.access.railGateway;}).forEach(function(x){
  console.log(' ', x.id, x.name, '->', x.access.airportGateway);
});
console.log('\nneedsCar=true:');
all.filter(function(x){return x.needsCar;}).forEach(function(x){
  console.log(' ', x.id, x.name);
});
