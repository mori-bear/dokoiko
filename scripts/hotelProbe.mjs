/**
 * hotelProbe.mjs — 宿リンク実通信検証スクリプト
 *
 * 実行: node scripts/hotelProbe.mjs
 *
 * 検証内容:
 *   [P1] じゃらんURLエンドポイント形式（uww2011init.do vs uww2011.do）
 *   [P2] 楽天 direct URL（アフィリエイトなし）で宿一覧存在確認
 *   [P3] じゃらん direct URL で宿一覧存在確認
 *   [P4] 二重エンコード検出（%25 含む URL を報告）
 *   [P5] NG destination 一覧レポート
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const dests = JSON.parse(readFileSync(join(ROOT, 'src/data/destinations.json'), 'utf8'));
const { buildHotelLinks } = await import(join(ROOT, 'src/hotel/hotelLinkBuilder.js'));

/* ── 設定 ── */
const CONCURRENCY   = 4;
const TIMEOUT_MS    = 8000;
const UA            = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

/* ── 宿一覧ありと判断するキーワード ── */
function hasHotelContent(html) {
  return (
    html.includes('ホテル') ||
    html.includes('旅館') ||
    html.includes('宿泊') ||
    html.includes('空室') ||
    html.includes('プラン')
  );
}

/* ── 結果なしと判断するキーワード ── */
function hasNoResult(html) {
  return (
    html.includes('0件') ||
    html.includes('条件に合う宿') ||
    html.includes('見つかりませんでした') ||
    html.includes('該当する施設') ||
    html.includes('ご指定の条件に合う宿泊施設はありません')
  );
}

/* ── HTTP fetch（タイムアウト付き） ── */
async function fetchHtml(url) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: {
        'User-Agent': UA,
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'ja,en;q=0.9',
      },
      redirect: 'follow',
    });
    const text = await res.text();
    return { ok: true, status: res.status, html: text, finalUrl: res.url };
  } catch (e) {
    return { ok: false, status: 0, html: '', error: e.message, finalUrl: url };
  } finally {
    clearTimeout(timer);
  }
}

/* ── 並列処理ヘルパー ── */
async function runConcurrent(tasks, concurrency) {
  const results = [];
  for (let i = 0; i < tasks.length; i += concurrency) {
    const batch = tasks.slice(i, i + concurrency);
    const batchResults = await Promise.all(batch.map(t => t()));
    results.push(...batchResults);
    process.stdout.write(`  [${Math.min(i + concurrency, tasks.length)}/${tasks.length}]\r`);
  }
  return results;
}

/* ── エンコード検証ヘルパー ── */
function checkEncoding(url, label) {
  if (url.includes('%25')) return `${label}: 二重エンコード(%25)検出`;
  if (url.includes('%2520')) return `${label}: 二重エンコード(%2520)検出`;
  return null;
}

/* ── 楽天 direct URL 生成（アフィリエイトなし） ── */
function buildRakutenDirect(keyword) {
  return `https://travel.rakuten.co.jp/search?keyword=${encodeURIComponent(keyword)}`;
}

/* ── じゃらん direct URL 生成（アフィリエイトなし、両形式） ── */
function buildJalanDirectInit(keyword) {
  return `https://www.jalan.net/uw/uwp2011/uww2011init.do?keyword=${encodeURIComponent(keyword)}`;
}
function buildJalanDirectDo(keyword) {
  return `https://www.jalan.net/uw/uwp2011/uww2011.do?keyword=${encodeURIComponent(keyword)}`;
}

/* ─────────────────────────────────────────────────── */

console.log('\n=== 宿リンク実通信検証 ===\n');

/* ── [P4] 全件エンコードチェック（静的） ── */
console.log('[P4] エンコード静的チェック...');
const encodeErrors = [];
for (const dest of dests) {
  const result = buildHotelLinks(dest);
  for (const link of result.links) {
    const err = checkEncoding(link.url, `${dest.id}/${link.type}`);
    if (err) encodeErrors.push(err);
  }
  if (result.hubLinks) {
    for (const link of result.hubLinks.links) {
      const err = checkEncoding(link.url, `${dest.id}/hub/${link.type}`);
      if (err) encodeErrors.push(err);
    }
  }
}
if (encodeErrors.length === 0) {
  console.log('  ✓ 二重エンコードなし（全299件）');
} else {
  console.log(`  ✗ ${encodeErrors.length}件の二重エンコード検出:`);
  encodeErrors.forEach(e => console.log(`    ${e}`));
}

/* ── [P1] じゃらんエンドポイント形式テスト ── */
console.log('\n[P1] じゃらんエンドポイント形式テスト（東京 ホテル）...');
const testKeyword = '東京 ホテル';
const [jInit, jDo] = await Promise.all([
  fetchHtml(buildJalanDirectInit(testKeyword)),
  fetchHtml(buildJalanDirectDo(testKeyword)),
]);
console.log(`  uww2011init.do → HTTP ${jInit.status}, 宿コンテンツ: ${hasHotelContent(jInit.html) ? '✓' : '✗'}, 0件: ${hasNoResult(jInit.html) ? '✗' : '–'}`);
console.log(`  uww2011.do     → HTTP ${jDo.status},   宿コンテンツ: ${hasHotelContent(jDo.html) ? '✓' : '✗'}, 0件: ${hasNoResult(jDo.html) ? '✗' : '–'}`);
const jalanEndpoint = (hasHotelContent(jDo.html) && !hasNoResult(jDo.html)) ? 'uww2011.do' : 'uww2011init.do';
console.log(`  → 採用エンドポイント: ${jalanEndpoint}`);

/* ── [P2] / [P3] リスク高 destination の実通信チェック ── */
const RISKY_IDS = [
  'shikoku-karst', 'iya', 'niyodogawa', 'yusuhara', 'tsunoshima',
  'kashiwajima', 'kumano-hongu', 'rausu', 'misaki-sadamisaki',
  'oirase', 'oboke', 'ebino-kogen',
  // 通常 dest（対照群）
  'kamakura', 'kyoto', 'nikko',
];

console.log(`\n[P2/P3] リスク destination 実通信チェック（${RISKY_IDS.length}件）...`);
const riskyDests = RISKY_IDS.map(id => dests.find(d => d.id === id)).filter(Boolean);

const probeResults = [];
const tasks = riskyDests.map(dest => async () => {
  const base    = dest.hotelSearch || dest.name;
  const keyword = `${base} ホテル`;
  const [rakuten, jalan] = await Promise.all([
    fetchHtml(buildRakutenDirect(keyword)),
    fetchHtml(jalanEndpoint === 'uww2011.do' ? buildJalanDirectDo(keyword) : buildJalanDirectInit(keyword)),
  ]);
  return {
    id: dest.id,
    name: dest.name,
    keyword,
    rakuten: {
      status: rakuten.status,
      hasContent: hasHotelContent(rakuten.html),
      noResult: hasNoResult(rakuten.html),
      error: rakuten.error,
    },
    jalan: {
      status: jalan.status,
      hasContent: hasHotelContent(jalan.html),
      noResult: hasNoResult(jalan.html),
      error: jalan.error,
    },
  };
});

const probed = await runConcurrent(tasks, CONCURRENCY);
console.log('');

/* ── レポート出力 ── */
const ngList = [];
for (const r of probed) {
  const rakutenStatus = r.rakuten.error  ? `ERROR(${r.rakuten.error})` :
                        r.rakuten.noResult ? '0件' :
                        r.rakuten.hasContent ? 'OK' : '不明';
  const jalanStatus   = r.jalan.error    ? `ERROR(${r.jalan.error})` :
                        r.jalan.noResult   ? '0件' :
                        r.jalan.hasContent ? 'OK' : '不明';

  const isNG = rakutenStatus !== 'OK' || jalanStatus !== 'OK';
  if (isNG) ngList.push({ ...r, rakutenStatus, jalanStatus });

  const mark = isNG ? '✗' : '✓';
  console.log(`  ${mark} ${r.id.padEnd(22)} [楽天:${rakutenStatus.padEnd(8)}] [じゃらん:${jalanStatus}]  "${r.keyword}"`);
}

/* ── [P5] NG destination 一覧 ── */
console.log('\n[P5] NG destination 一覧:');
if (ngList.length === 0) {
  console.log('  なし（全件OK）');
} else {
  for (const ng of ngList) {
    console.log(`  [NG] ${ng.id} (${ng.name})`);
    console.log(`       キーワード: "${ng.keyword}"`);
    console.log(`       楽天: ${ng.rakutenStatus} / じゃらん: ${ng.jalanStatus}`);
  }
}

/* ── 提案 ── */
if (ngList.length > 0) {
  console.log('\n[提案] 以下の hotelSearch を修正することを検討:');
  for (const ng of ngList) {
    const dest = dests.find(d => d.id === ng.id);
    const suggestion = dest?.hubCity ?? dest?.prefecture?.replace(/[都道府県]$/, '');
    console.log(`  ${ng.id}: "${ng.keyword}" → "${suggestion} ホテル" に変更候補`);
  }
}

console.log('\n=== 検証完了 ===');
