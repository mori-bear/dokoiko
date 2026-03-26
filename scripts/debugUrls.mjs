/**
 * debugUrls.mjs — URL生成の実値ログ確認
 * 実行: node scripts/debugUrls.mjs [--sample N] [--dest id]
 */
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

const dests = JSON.parse(readFileSync(join(root, 'src/data/destinations.json'), 'utf8'));
const { buildHotelLinks } = await import(`file://${root}/src/hotel/hotelLinkBuilder.js`);

const args = process.argv.slice(2);
const sampleArg = args.find(a => a.startsWith('--sample='));
const destArg   = args.find(a => a.startsWith('--dest='));
const sampleN   = sampleArg ? parseInt(sampleArg.split('=')[1]) : null;
const destId    = destArg ? destArg.split('=')[1] : null;

function buildGoogleMapsUrl(from, to) {
  if (!from || !to) return null;
  return `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(from)}&destination=${encodeURIComponent(to)}&travelmode=transit`;
}

const targets = destId
  ? dests.filter(d => d.id === destId)
  : (sampleN ? dests.slice(0, sampleN) : dests);

let ngCount = 0;
const ngs = [];

console.log(`\n=== URL生成デバッグ（${targets.length}件）===\n`);

for (const dest of targets) {
  const hotel  = buildHotelLinks(dest);
  const rakuten = hotel.links.find(l => l.type === 'rakuten');
  const jalan   = hotel.links.find(l => l.type === 'jalan');
  // 離島は accessStation がなく port でアクセス → port をfallback
  const mapsFrom = dest.accessStation || dest.port;
  const maps     = buildGoogleMapsUrl(mapsFrom, dest.name);

  const issues = [];

  /* Phase 3: 楽天URLチェック */
  if (!rakuten?.url) {
    issues.push('楽天URL: null/undefined');
  } else {
    if (rakuten.url.includes('hb.afl.rakuten') || rakuten.url.includes('valuecommerce')) {
      issues.push(`楽天: アフィリエイトラッパー残存 → ${rakuten.url.slice(0, 80)}`);
    }
    if (!rakuten.url.includes('/yado/')) {
      issues.push(`楽天: /yado/ 形式でない → ${rakuten.url.slice(0, 80)}`);
    }
    if (rakuten.url.includes('%25')) {
      issues.push(`楽天: 二重エンコード(%25) → ${rakuten.url.slice(0, 80)}`);
    }
    if (rakuten.url.includes('undefined')) {
      issues.push(`楽天: URL に undefined → ${rakuten.url.slice(0, 80)}`);
    }
  }

  /* Phase 4: じゃらんURLチェック */
  if (!jalan?.url) {
    issues.push('じゃらんURL: null/undefined');
  } else {
    if (!jalan.url.includes('jalan.net')) {
      issues.push(`じゃらん: jalan.net でない → ${jalan.url.slice(0, 80)}`);
    }
    if (!jalan.url.includes('keyword=')) {
      issues.push(`じゃらん: keyword= なし → ${jalan.url.slice(0, 80)}`);
    }
    if (jalan.url.includes('%25')) {
      issues.push(`じゃらん: 二重エンコード(%25) → ${jalan.url.slice(0, 80)}`);
    }
    if (jalan.url.includes('undefined')) {
      issues.push(`じゃらん: URL に undefined → ${jalan.url.slice(0, 80)}`);
    }
  }

  /* Phase 5: Google Maps チェック */
  if (!maps) {
    issues.push(`Google Maps: null（from=${mapsFrom ?? 'undefined'}, to=${dest.name}）`);
  } else if (maps.includes('undefined')) {
    issues.push(`Google Maps: undefined混入 → ${maps.slice(0, 80)}`);
  }

  if (issues.length > 0) {
    ngCount++;
    ngs.push({ name: dest.name, id: dest.id, hotelArea: dest.hotelArea, accessStation: dest.accessStation, issues });
    console.log(`❌ ${dest.name}（${dest.id}）`);
    issues.forEach(i => console.log(`   ${i}`));
  }

  /* 詳細ダンプ（--dest 指定時のみ） */
  if (destId) {
    console.log('\n--- 詳細ダンプ ---');
    console.log('hotelArea     :', dest.hotelArea);
    console.log('accessStation :', dest.accessStation);
    console.log('楽天URL       :', rakuten?.url);
    console.log('じゃらんURL   :', jalan?.url);
    console.log('Google Maps   :', maps);
  }
}

console.log(`\n=== 結果 ===`);
console.log(`対象: ${targets.length}件 / NG: ${ngCount}件`);

if (ngs.length === 0) {
  console.log('\n✅ 全件OK — URL生成に問題なし');
} else {
  console.log(`\n❌ NG ${ngCount}件:`);
  ngs.forEach(n => {
    console.log(`  ${n.id} (hotelArea=${n.hotelArea}, access=${n.accessStation})`);
    n.issues.forEach(i => console.log(`    → ${i}`));
  });
  process.exit(1);
}
