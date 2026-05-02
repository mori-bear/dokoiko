import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const data = JSON.parse(fs.readFileSync(path.join(__dirname, '../src/data/destinations.json'), 'utf-8'));

data.slice(0, 5).forEach(d => console.log(d.name, ':', d.description));
