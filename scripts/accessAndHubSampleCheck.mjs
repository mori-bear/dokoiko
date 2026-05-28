// STEP4/5 のアクセスセクション + 近隣hub の総合サンプル確認。
// 各種類の destination 12件 (本州・北海道・離島・沖縄・複数県) でテンプレートが期待通りに動くか検証。
import fs from 'node:fs';
import path from 'node:path';

const BASE = 'http://localhost:4173';

const SAMPLE_IDS = [
  // 鉄道完結 (Yahoo乗換出る + 電車・バスボタン出る)
  'kamakura',          // 神奈川 / east
  'kyoto',             // 京都 / west
  'sapporo',           // 北海道 / hokkaido
  'fukuoka',           // 福岡 / kyushu
  // 離島 (電車・バスボタン非表示 + スカイスキャナー出る期待)
  'kumejima',          // 沖縄 / 離島
  'ishigaki-island',
  'sado-island',       // 新潟 / 離島
  // 複数県またぎ
  'ontake',            // 長野・岐阜
  // hub city チェック
  'oguni-kumamoto',
  'magome',            // 長野 / hubCity=馬籠
  // 通常
  'beppu', 'nikko',
];

const RX = {
  trainBtnRaw: /電車・バスで行く/,
  jrEkinet: /えきねっと/,
  jrE5489: /e5489/,
  jrSmartex: /スマートEX/,
  jrKyushu: /JR九州ネット予約/,
  midori: /みどりの窓口/,
  skyscanner: /スカイスキャナー/,
  gmapBtn: /Googleマップで見る/,
  hourMin: /約\d+時間\d*分?|約\d+分(?![号])/,
  nearbyCard: /class="nearby-card/,
  hotelTabLocal: /hotel-tab-label-local/,
  hotelTabHub: /hotel-tab-label-hub/,
};

async function fetchPage(id) {
  const url = `${BASE}/destinations/${encodeURIComponent(id)}`;
  const res = await fetch(url);
  if (!res.ok) return { id, error: 'HTTP ' + res.status };
  return { id, html: await res.text() };
}

function extractAccessSection(html) {
  const m = html.match(/class="access-section"[\s\S]*?(?=<hr class="section-divider"|<section\b)/);
  return m ? m[0] : html;
}

const report = [];
for (const id of SAMPLE_IDS) {
  const r = await fetchPage(id);
  if (r.error) { report.push({ id, error: r.error }); continue; }
  const html = r.html;
  const access = extractAccessSection(html);

  // 所要時間「約N時間N分」が access section に表示されていないか
  const timeMatches = (access.match(RX.hourMin) || []);
  const hasTimeInAccess = timeMatches.length > 0;

  // 出発地別 JR ボタンの種類
  const hasEkinet = RX.jrEkinet.test(access);
  const hasE5489  = RX.jrE5489.test(access);
  const hasSmartex= RX.jrSmartex.test(access);
  const hasKyushu = RX.jrKyushu.test(access);
  const hasMidori = RX.midori.test(access);

  // 電車・バスで行く (Yahoo乗換) — 鉄道完結以外で非表示の期待
  const trainBtn = RX.trainBtnRaw.test(access);
  // スカイスキャナー (離島・空路で出る)
  const sky = RX.skyscanner.test(access);
  // Gmap
  const gmap = RX.gmapBtn.test(access);
  // 近隣カード (本文に含まれる)
  const nearby = RX.nearbyCard.test(html);
  // hub 宿タブ
  const hubTab = RX.hotelTabHub.test(html);
  const localTab = RX.hotelTabLocal.test(html);

  report.push({
    id, hasTimeInAccess, timeMatches: timeMatches.slice(0,3),
    trainBtn, sky, gmap, nearby, hubTab, localTab,
    jr: { ekinet: hasEkinet, e5489: hasE5489, smartex: hasSmartex, kyushu: hasKyushu, midori: hasMidori },
  });
}

console.log('id'.padEnd(20), 'time', 'train', 'sky ', 'gmap', 'near', 'hubT', 'JRs');
for (const r of report) {
  if (r.error) { console.log(r.id.padEnd(20), 'ERR:', r.error); continue; }
  const jrs = ['ekinet','e5489','smartex','kyushu','midori'].filter(k => r.jr[k]).map(k => k[0].toUpperCase()).join('');
  console.log(
    r.id.padEnd(20),
    r.hasTimeInAccess ? 'NG  ' : 'OK  ',
    r.trainBtn ? 'yes ' : 'no  ',
    r.sky ? 'yes ' : 'no  ',
    r.gmap ? 'yes ' : 'no  ',
    r.nearby ? 'yes ' : 'no  ',
    r.hubTab ? 'yes ' : 'no  ',
    jrs
  );
}

fs.writeFileSync('logs/sampleAccessReport.json', JSON.stringify(report, null, 2));
console.log('\nSaved logs/sampleAccessReport.json');
