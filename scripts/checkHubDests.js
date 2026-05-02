import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const data = JSON.parse(fs.readFileSync(path.join(__dirname, '../src/data/destinations.json'), 'utf8'));

// hubCity が自分以外の目的地（乗り継ぎが必要な例）
const needsHub = data.filter(d => d.hubCity && d.hubCity !== d.name).slice(0, 10);
console.log('=== hubCity が自分以外の目的地 ===');
needsHub.forEach(d => console.log(`${d.name} → hubCity: ${d.hubCity}`));
