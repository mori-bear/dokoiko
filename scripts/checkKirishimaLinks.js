import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { buildHotelLinks } from '../src/hotel/hotelLinkBuilder.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const data = JSON.parse(fs.readFileSync(path.join(__dirname, '../src/data/destinations.json'), 'utf-8'));

const kirishima = data.find(d => d.id === 'kirishima');
if (!kirishima) { console.log('kirishima not found'); process.exit(1); }

const result = buildHotelLinks(kirishima);
console.log('stayCityName:', result.stayCityName);
console.log('bestType:', result.bestType);
result.links.forEach(l => console.log(`[${l.type}] ${l.url}`));
