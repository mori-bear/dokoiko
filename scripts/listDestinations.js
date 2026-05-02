import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const data = JSON.parse(fs.readFileSync(path.join(__dirname, '../src/data/destinations.json'), 'utf8'));

const start = parseInt(process.argv[2] ?? '0');
const end   = parseInt(process.argv[3] ?? '100');

data.slice(start, end).forEach((d, i) => {
  console.log(`${start + i + 1}. ${d.name}`);
  console.log(`   description: ${d.description ?? ''}`);
  console.log(`   catch: ${d.catch ?? ''}`);
  console.log('');
});
