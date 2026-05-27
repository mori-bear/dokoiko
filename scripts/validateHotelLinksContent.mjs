// 全destinationsの hotelLinks.rakuten/jalan を fetch して
// HTML 内に dest名 or prefecture名 が含まれるか確認。
// 並列度を制御し結果を logs/hotelLinkContent.json に保存。
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(process.cwd());
const DEST = path.join(ROOT, 'data/destinations.json');
const dests = JSON.parse(fs.readFileSync(DEST, 'utf-8'));

const CONCURRENCY = Number(process.env.CONC || 20);
const TIMEOUT_MS = 12000;

async function fetchText(url) {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      redirect: 'follow',
      signal: ac.signal,
      headers: {
        'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/130 Safari/537.36',
        'accept': 'text/html,application/xhtml+xml',
        'accept-language': 'ja,en;q=0.9',
      },
    });
    const text = await res.text();
    return { status: res.status, url: res.url, text };
  } catch (e) {
    return { status: 0, url, text: '', error: String(e.message || e) };
  } finally {
    clearTimeout(t);
  }
}

// 都道府県名のローマ字パターン (rakuten URL内に出る) — 検査用に補助マップ
const PREF_ROMAJI = {
  '北海道':'hokkaido','青森県':'aomori','岩手県':'iwate','宮城県':'miyagi','秋田県':'akita','山形県':'yamagata','福島県':'fukushima',
  '茨城県':'ibaraki','栃木県':'tochigi','群馬県':'gunma','埼玉県':'saitama','千葉県':'chiba','東京都':'tokyo','神奈川県':'kanagawa',
  '新潟県':'niigata','富山県':'toyama','石川県':'ishikawa','福井県':'fukui','山梨県':'yamanashi','長野県':'nagano',
  '岐阜県':'gifu','静岡県':'shizuoka','愛知県':'aichi','三重県':'mie',
  '滋賀県':'shiga','京都府':'kyoto','大阪府':'osaka','兵庫県':'hyogo','奈良県':'nara','和歌山県':'wakayama',
  '鳥取県':'tottori','島根県':'shimane','岡山県':'okayama','広島県':'hiroshima','山口県':'yamaguchi',
  '徳島県':'tokushima','香川県':'kagawa','愛媛県':'ehime','高知県':'kochi',
  '福岡県':'fukuoka','佐賀県':'saga','長崎県':'nagasaki','熊本県':'kumamoto','大分県':'oita','宮崎県':'miyazaki','鹿児島県':'kagoshima','沖縄県':'okinawa',
};

function judgeOk({ text, status, url, finalUrl }, dest) {
  if (status === 0) return { ok: false, reason: 'NETWORK' };
  if (status >= 400) return { ok: false, reason: `HTTP_${status}` };
  // 複数県(例: "長野県・岐阜県") を分割
  const prefList = (dest.prefecture || '').split(/[・,／\/]/).map(s => s.trim()).filter(Boolean);
  const needles = [dest.name, dest.prefecture];
  for (const p of prefList) {
    needles.push(p);                                 // "長野県"
    needles.push(p.replace(/[県府都]$/, ''));         // "長野"
    const r = PREF_ROMAJI[p] || PREF_ROMAJI[p.replace(/[県府都]$/, '') + '県'];
    if (r) needles.push(r);                          // "nagano"
  }
  const haystack = (text || '') + ' ' + (finalUrl || '');
  for (const n of needles) {
    if (n && haystack.includes(n)) return { ok: true, hit: n };
  }
  return { ok: false, reason: 'NO_PREF_OR_NAME' };
}

const results = [];
let idx = 0;
async function worker(id) {
  while (idx < dests.length) {
    const i = idx++;
    const d = dests[i];
    const out = { id: d.id, name: d.name, prefecture: d.prefecture,
      rakuten: d.hotelLinks?.rakuten || null, jalan: d.hotelLinks?.jalan || null,
      rakutenOk: null, rakutenReason: '', rakutenFinal: '',
      jalanOk: null, jalanReason: '', jalanFinal: '',
    };
    // rakuten
    if (out.rakuten) {
      const r = await fetchText(out.rakuten);
      out.rakutenFinal = r.url;
      const j = judgeOk({ text: r.text, status: r.status, finalUrl: r.url }, d);
      out.rakutenOk = j.ok;
      out.rakutenReason = j.ok ? '' : j.reason;
    } else { out.rakutenOk = false; out.rakutenReason = 'NO_URL'; }
    // jalan
    if (out.jalan) {
      const r = await fetchText(out.jalan);
      out.jalanFinal = r.url;
      const j = judgeOk({ text: r.text, status: r.status, finalUrl: r.url }, d);
      out.jalanOk = j.ok;
      out.jalanReason = j.ok ? '' : j.reason;
    } else { out.jalanOk = false; out.jalanReason = 'NO_URL'; }
    results.push(out);
    if (results.length % 50 === 0) {
      console.log(`[${results.length}/${dests.length}] ok=R${results.filter(x=>x.rakutenOk).length}/J${results.filter(x=>x.jalanOk).length}`);
    }
  }
}
const startTs = Date.now();
console.log(`fetching ${dests.length} x 2 = ${dests.length*2} URLs, concurrency=${CONCURRENCY}`);
await Promise.all(Array.from({length: CONCURRENCY}, (_,k)=>worker(k)));
const elapsed = ((Date.now()-startTs)/1000).toFixed(1);
console.log(`done in ${elapsed}s`);

const ngRakuten = results.filter(r => !r.rakutenOk);
const ngJalan = results.filter(r => !r.jalanOk);
console.log('NG rakuten:', ngRakuten.length, '/ NG jalan:', ngJalan.length);

fs.writeFileSync(path.join(ROOT, 'logs/hotelLinkContent.json'),
  JSON.stringify({ generatedAt: new Date().toISOString(), elapsedSec: Number(elapsed), results }, null, 2));

// 簡易レポート
const lines = ['# Hotel Link Content Check', `total: ${results.length}  NG_rakuten: ${ngRakuten.length}  NG_jalan: ${ngJalan.length}`, '', '## NG rakuten'];
for (const r of ngRakuten.slice(0, 100)) lines.push(`- ${r.id} (${r.name} / ${r.prefecture}) [${r.rakutenReason}] ${r.rakuten} -> ${r.rakutenFinal}`);
lines.push('', '## NG jalan');
for (const r of ngJalan.slice(0, 100)) lines.push(`- ${r.id} (${r.name} / ${r.prefecture}) [${r.jalanReason}] ${r.jalan} -> ${r.jalanFinal}`);
fs.writeFileSync(path.join(ROOT, 'logs/hotelLinkContent.md'), lines.join('\n'));

console.log('saved logs/hotelLinkContent.json + .md');
