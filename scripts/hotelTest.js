/**
 * hotelTest.js — 宿リンク HTTP 検証テスト（Node.js）
 *
 * 実行:
 *   node hotelTest.js          # サンプル（地域バランス抽出）
 *   node hotelTest.js --all    # 全 destination 対象（完全検証）
 *
 * チェック内容:
 *   1. 全都市で宿リンク 2 件（楽天 + じゃらん）生成されること
 *   2. 全都市の hotelHub が keyword に使われること
 *   3. HUB_PREFECTURE 未登録の hotelHub が 0 件
 *   4. 楽天 target URL（yado/{prefecture}/）→ HTTP 200
 *   5. じゃらん target URL（uwp2011?keyword=...）→ HTTP 200
 *
 * 判定:
 *   200, 301, 302 → 成功（リダイレクトは正常応答）
 *   404, 500, 0   → 失敗
 */

'use strict';

const fs    = require('fs');
const https = require('https');
const { URL } = require('url');

/* ── 設定 ── */

const ALL_MODE = process.argv.includes('--all');
const TIMEOUT  = 10000;
const PARALLEL = 6;

/* ── データ読み込み ── */

const rawData = JSON.parse(
  fs.readFileSync('./data/destinations.json', 'utf8'),
);
const allCities = (Array.isArray(rawData) ? rawData : rawData.destinations)
  .filter(c => c.type !== 'spot');

/* ── HUB_PREFECTURE（hotelLinkBuilder.js と同期） ── */

const HUB_PREFECTURE = {
  '札幌':'hokkaido','函館':'hokkaido','旭川':'hokkaido',
  '小樽':'hokkaido','富良野':'hokkaido','美瑛':'hokkaido',
  '知床':'hokkaido','洞爺湖':'hokkaido','登別':'hokkaido',
  '釧路':'hokkaido','定山渓':'hokkaido',
  '弘前':'aomori','奥入瀬':'aomori',
  '盛岡':'iwate','平泉':'iwate',
  '仙台':'miyagi','松島':'miyagi','鳴子温泉':'miyagi',
  '秋田':'akita','角館':'akita','乳頭温泉':'akita',
  '山形':'yamagata','銀山温泉':'yamagata','酒田':'yamagata','蔵王':'yamagata',
  '会津若松':'fukushima','大内宿':'fukushima',
  '水戸':'ibaraki',
  '日光':'tochigi','益子':'tochigi',
  '草津温泉':'gunma','四万温泉':'gunma','水上温泉':'gunma',
  '館山':'chiba',
  '東京':'tokyo','伊豆大島':'tokyo','高尾山':'tokyo','神津島':'tokyo',
  '横浜':'kanagawa','鎌倉':'kanagawa','箱根':'kanagawa',
  '新潟':'niigata',
  '氷見':'toyama','立山黒部':'toyama',
  '金沢':'ishikawa','輪島':'ishikawa','和倉温泉':'ishikawa','加賀温泉郷':'ishikawa',
  '甲府':'yamanashi','富士河口湖':'yamanashi',
  '松本':'nagano','上高地':'nagano','白馬':'nagano','軽井沢':'nagano',
  '別所温泉':'nagano','野沢温泉':'nagano','小布施':'nagano',
  '木曽':'nagano','妻籠':'nagano','飯田':'nagano',
  '高山':'gifu','下呂温泉':'gifu','岐阜':'gifu','馬籠':'gifu',
  '熱海':'shizuoka','静岡':'shizuoka','下田':'shizuoka','修善寺':'shizuoka',
  '名古屋':'aichi','犬山':'aichi',
  '伊勢':'mie','鳥羽':'mie',
  '彦根':'shiga','長浜':'shiga',
  '京都':'kyoto','天橋立':'kyoto','伊根':'kyoto','美山':'kyoto',
  '大阪':'osaka',
  '神戸':'hyogo','城崎温泉':'hyogo','有馬温泉':'hyogo',
  '姫路':'hyogo','出石':'hyogo','淡路島':'hyogo',
  '奈良':'nara',
  '白浜':'wakayama','高野山':'wakayama','和歌山':'wakayama',
  '鳥取':'tottori','三朝温泉':'tottori','米子':'tottori',
  '松江':'shimane','津和野':'shimane','奥出雲':'shimane',
  '倉敷':'okayama','岡山':'okayama',
  '広島':'hiroshima','尾道':'hiroshima','宮島':'hiroshima','竹原':'hiroshima',
  '下関':'yamaguchi','萩':'yamaguchi','湯田温泉':'yamaguchi',
  '徳島':'tokushima','祖谷':'tokushima','大歩危':'tokushima',
  '高松':'kagawa','琴平':'kagawa','小豆島':'kagawa','直島':'kagawa',
  '松山':'ehime','内子':'ehime','宇和島':'ehime',
  '高知':'kochi','足摺岬':'kochi','室戸':'kochi',
  '博多':'fukuoka','福岡':'fukuoka',
  '佐賀':'saga','嬉野温泉':'saga',
  '長崎':'nagasaki','五島列島':'nagasaki','佐世保':'nagasaki',
  '平戸':'nagasaki','雲仙':'nagasaki',
  '熊本':'kumamoto','人吉':'kumamoto','阿蘇':'kumamoto',
  '南阿蘇':'kumamoto','天草':'kumamoto','黒川温泉':'kumamoto',
  '湯布院':'oita','別府':'oita',
  '宮崎':'miyazaki','高千穂':'miyazaki','飫肥':'miyazaki',
  '鹿児島':'kagoshima','指宿':'kagoshima','屋久島':'kagoshima','奄美大島':'kagoshima',
  '那覇':'okinawa','石垣島':'okinawa','宮古島':'okinawa',
  '久米島':'okinawa','渡嘉敷島':'okinawa','宮古':'okinawa',
};

/* ── ヘルパー ── */

function resolveKeyword(city) {
  return city.hotelHub || city.hotelSearch || city.name;
}

function buildRakutenTarget(city) {
  const keyword    = resolveKeyword(city);
  const prefecture = HUB_PREFECTURE[keyword] || HUB_PREFECTURE[city.hotelHub] || HUB_PREFECTURE[city.name];
  return prefecture
    ? `https://travel.rakuten.co.jp/yado/${prefecture}/`
    : `https://travel.rakuten.co.jp/yado/`;
}

function buildJalanTarget(city) {
  const keyword = resolveKeyword(city);
  return `https://www.jalan.net/uw/uwp2011/uww2011init.do?keyword=${encodeURIComponent(keyword)}`;
}

function httpsGet(targetUrl) {
  return new Promise((resolve) => {
    try {
      const parsed = new URL(targetUrl);
      const options = {
        hostname: parsed.hostname,
        path:     parsed.pathname + parsed.search,
        method:   'HEAD', // HEAD で高速チェック
        timeout:  TIMEOUT,
        headers:  { 'User-Agent': 'Mozilla/5.0 (compatible; DokoikoBot/1.0)' },
      };
      const req = https.request(options, (res) => {
        // 200/301/302 は成功
        const ok = res.statusCode < 400;
        resolve({ status: res.statusCode, ok });
        res.resume();
      });
      req.on('timeout', () => { req.destroy(); resolve({ status: 0, ok: false, error: 'timeout' }); });
      req.on('error',  (e) => resolve({ status: 0, ok: false, error: e.message }));
      req.end();
    } catch (e) {
      resolve({ status: 0, ok: false, error: e.message });
    }
  });
}

async function runBatched(tasks, batchSize) {
  const results = [];
  for (let i = 0; i < tasks.length; i += batchSize) {
    const batch = tasks.slice(i, i + batchSize).map(t => t());
    results.push(...(await Promise.all(batch)));
    if (i + batchSize < tasks.length) await new Promise(r => setTimeout(r, 300));
  }
  return results;
}

function sampleCities(cities) {
  // 地域別均等サンプリング
  const byRegion = {};
  cities.forEach(c => {
    const r = c.region || 'other';
    if (!byRegion[r]) byRegion[r] = [];
    byRegion[r].push(c);
  });
  const result = [];
  Object.values(byRegion).forEach(arr => {
    // 各地域から最大 3 件
    arr.slice(0, 3).forEach(c => result.push(c));
  });
  return result;
}

/* ── メイン ── */

(async () => {
  const cities = ALL_MODE ? allCities : sampleCities(allCities);

  console.log('=== 宿リンク HTTP 検証テスト ===');
  console.log(`対象: ${cities.length} 都市 ${ALL_MODE ? '（全件）' : '（地域バランスサンプル）'}`);
  console.log(`全 destination 数: ${allCities.length}\n`);

  /* 1. フォーマット検証（全件 · HTTP なし） */
  console.log('── [1] フォーマット検証（全 ' + allCities.length + ' 都市） ──');
  let fmtErrors = 0;
  const missingPrefecture = [];

  allCities.forEach(city => {
    const keyword    = resolveKeyword(city);
    const prefecture = HUB_PREFECTURE[keyword] || HUB_PREFECTURE[city.hotelHub] || HUB_PREFECTURE[city.name];

    if (!keyword || !keyword.trim()) {
      console.log(`  [ERR] ${city.id}: keyword 空`);
      fmtErrors++;
    }
    if (!prefecture) {
      missingPrefecture.push(`${city.name}（${city.id}）keyword=${keyword}`);
    }
    const jalanUrl = buildJalanTarget(city);
    if (!jalanUrl.includes('uwp2011/uww2011init.do')) {
      console.log(`  [ERR] ${city.id}: じゃらん URL 形式不正`);
      fmtErrors++;
    }
    const rakutenUrl = buildRakutenTarget(city);
    if (!rakutenUrl.includes('travel.rakuten.co.jp/yado/')) {
      console.log(`  [ERR] ${city.id}: 楽天 URL 形式不正`);
      fmtErrors++;
    }
  });

  if (missingPrefecture.length > 0) {
    console.log(`  [WARN] HUB_PREFECTURE 未登録: ${missingPrefecture.length} 件`);
    missingPrefecture.forEach(m => console.log(`    - ${m}`));
    fmtErrors += missingPrefecture.length;
  }

  console.log(fmtErrors === 0
    ? `  ✓ フォーマット 0 エラー\n`
    : `  ✗ フォーマットエラー: ${fmtErrors} 件\n`);

  /* 2. HTTP 検証 */
  console.log(`── [2] HTTP 検証（${cities.length} 都市 × 2 URL） ──`);
  const tasks = [];
  cities.forEach(city => {
    const rUrl = buildRakutenTarget(city);
    const jUrl = buildJalanTarget(city);
    tasks.push(() => httpsGet(rUrl).then(r => ({ city, svc: '楽天',    url: rUrl, ...r })));
    tasks.push(() => httpsGet(jUrl).then(r => ({ city, svc: 'じゃらん', url: jUrl, ...r })));
  });

  process.stdout.write(`  送信中 (${tasks.length} リクエスト)... `);
  const results = await runBatched(tasks, PARALLEL * 2);
  console.log('完了\n');

  let httpPass = 0, httpFail = 0;
  const httpErrors = [];

  results.forEach(r => {
    if (r.ok) {
      httpPass++;
    } else {
      httpFail++;
      const detail = r.error ? `ERR:${r.error}` : `HTTP ${r.status}`;
      httpErrors.push(`  ✗ [${r.svc}] ${r.city.name}（${r.city.id}）— ${detail}`);
      httpErrors.push(`      ${r.url}`);
    }
  });

  if (httpErrors.length > 0) {
    console.log('失敗した URL:');
    httpErrors.forEach(e => console.log(e));
    console.log('');
  }

  /* サマリ */
  const totalErrors = fmtErrors + httpFail;
  console.log('=== サマリ ===');
  console.log(`フォーマット検証: ${fmtErrors === 0 ? '✓' : '✗'} エラー ${fmtErrors} 件 / ${allCities.length} 都市`);
  console.log(`HTTP 検証:        PASS ${httpPass} / FAIL ${httpFail} （${cities.length} 都市 ${ALL_MODE ? '全件' : 'サンプル'}）`);
  console.log(`総エラー数:       ${totalErrors} 件`);

  if (totalErrors === 0) {
    console.log('\n宿リンク成功率 100% ✓');
  } else {
    console.log(`\n✗ エラー ${totalErrors} 件`);
    if (!ALL_MODE) console.log('  全件確認は: node hotelTest.js --all');
    process.exit(1);
  }
})();
