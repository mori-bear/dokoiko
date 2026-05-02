import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const destFile = path.join(__dirname, '../src/data/destinations.json');
const data = JSON.parse(fs.readFileSync(destFile, 'utf8'));

let addedDeps = 0;
let addedTimes = 0;

for (const dest of data) {
  if (!dest.departures) continue;
  if (!dest.departures.includes('大阪')) continue;

  if (!dest.departures.includes('和歌山')) {
    dest.departures.push('和歌山');
    addedDeps++;
  }

  if (dest.travelTime && dest.travelTime.osaka != null && dest.travelTime.wakayama == null) {
    dest.travelTime.wakayama = dest.travelTime.osaka + 30;
    addedTimes++;
  }
}

fs.writeFileSync(destFile, JSON.stringify(data, null, 2), 'utf8');
console.log(`📊 departures追加: ${addedDeps}件, travelTime.wakayama追加: ${addedTimes}件`);
