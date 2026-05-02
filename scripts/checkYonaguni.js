import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const data = JSON.parse(fs.readFileSync(path.join(__dirname, '../src/data/destinations.json'), 'utf8'));

const y = data.find(d => d.name.includes('与那国'));
console.log('travelTime:', JSON.stringify(y?.travelTime, null, 2));
console.log('stayAllowed:', y?.stayAllowed);
console.log('departures:', y?.departures);
