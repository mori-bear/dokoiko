import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const data = JSON.parse(fs.readFileSync(path.join(__dirname, '../src/data/destinations.json'), 'utf8'));

const short = data.filter(d => !d.description || d.description.length < 30);
console.log('説明文30文字未満:', short.length, '件');
short.slice(0, 5).forEach(d => console.log(' -', d.name, ':', d.description ?? '(なし)'));
