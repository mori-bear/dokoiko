// scripts/fixNewDestinations.js
// QAエラーを修正: gateway===accessStation, catch文字数超過
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DESTS_PATH = path.join(__dirname, '../src/data/destinations.json');

const dests = JSON.parse(fs.readFileSync(DESTS_PATH, 'utf-8'));

for (const d of dests) {
  // gateway === accessStation → gateway を null に
  if (d.gateway && d.gateway === d.accessStation) {
    console.log(`gateway fix: ${d.id} (${d.gateway})`);
    d.gateway = null;
  }

  // uji の catch を30文字以内に修正
  if (d.id === 'uji') {
    d.catch = '平等院を見て、抹茶を飲んだ。それだけで十分だった。';
    console.log(`catch fix: uji → ${d.catch} (${d.catch.length}文字)`);
  }
}

fs.writeFileSync(DESTS_PATH, JSON.stringify(dests, null, 2), 'utf-8');
console.log('✓ 修正完了');
