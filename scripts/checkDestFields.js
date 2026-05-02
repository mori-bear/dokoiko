import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const data = JSON.parse(fs.readFileSync(path.join(__dirname, '../src/data/destinations.json'), 'utf8'));
const d = data[0];

const keys = ['requiresCar', 'stayRecommendation', 'situations', 'situation', 'staySupport', 'catch'];
keys.forEach(k => console.log(k + ':', JSON.stringify(d[k])));

console.log('\n--- situations サンプル ---');
data.slice(0, 10).forEach(x => console.log(x.name, '| situations:', JSON.stringify(x.situations), '| requiresCar:', x.requiresCar, '| stayRecommendation:', x.stayRecommendation));
