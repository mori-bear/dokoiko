import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const data = JSON.parse(fs.readFileSync(path.join(__dirname, '../src/data/destinations.json'), 'utf-8'));

const kirishima = data.find(d => d.name.includes('霧島'));
if (!kirishima) { console.log('霧島 not found'); process.exit(1); }

console.log('name:', kirishima.name);
console.log('id:', kirishima.id);
console.log('prefecture:', kirishima.prefecture);
console.log('hotelLinks:', JSON.stringify(kirishima.hotelLinks, null, 2));
console.log('→ 使用URL:', kirishima.hotelLinks?.rakuten ? 'rakuten（個別）' : kirishima.hotelLinks?.rakutenArea ? 'rakutenArea（都道府県）' : 'なし');
