import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const data = JSON.parse(fs.readFileSync(path.join(__dirname, '../src/data/destinations.json'), 'utf8'));

const kirishima = data.find(d => d.id === 'kirishima');
console.log('weight:', kirishima.weight);
console.log('destType:', kirishima.destType);
console.log('stayAllowed:', kirishima.stayAllowed);
console.log('tags:', kirishima.tags);

console.log('\n--- 高松から1泊で行ける目的地 weight上位10件 ---');
data
  .filter(d => d.departures?.includes('高松') && d.stayAllowed?.includes('1night'))
  .sort((a, b) => (b.weight ?? 1) - (a.weight ?? 1))
  .slice(0, 10)
  .forEach(d => console.log(d.name, ':', d.weight));
