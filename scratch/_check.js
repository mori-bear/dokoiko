const d=require('./src/data/destinations.json');
const withCoords = d.filter(x=>x.lat && x.lng);
const without = d.filter(x=>!(x.lat && x.lng));
console.log('with coords:', withCoords.length, 'without:', without.length);
console.log('IDs without:');
without.forEach(x=>console.log(x.id, x.name));
