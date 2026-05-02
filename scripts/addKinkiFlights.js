import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const file = path.join(__dirname, '../src/data/flightRoutes.json');
const routes = JSON.parse(fs.readFileSync(file, 'utf8'));

const baseCities = ['大阪', '和歌山'];
const newCities = ['新宮', '田辺', '白浜', '串本'];

const baseRoutes = routes.filter(r => baseCities.includes(r.from));
const existing = new Set(routes.map(r => `${r.from}-${r.to}`));

let addedCount = 0;
newCities.forEach(city => {
  baseRoutes.forEach(r => {
    const key = `${city}-${r.to}`;
    if (!existing.has(key)) {
      routes.push({ ...r, from: city });
      existing.add(key);
      addedCount++;
    }
  });
});

fs.writeFileSync(file, JSON.stringify(routes, null, 2), 'utf8');
console.log(`✅ 近畿フライトルート追加: ${addedCount}件`);
newCities.forEach(city => {
  const count = routes.filter(r => r.from === city).length;
  console.log(`  ${city}: ${count}件`);
});
