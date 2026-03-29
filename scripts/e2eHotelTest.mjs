/**
 * e2eHotelTest.mjs — 宿リンク完全検証スクリプト
 *
 * 実行:
 *   node scripts/e2eHotelTest.mjs              # 全件（静的 + 実ページ）
 *   node scripts/e2eHotelTest.mjs --sample     # ランダム20件
 *   node scripts/e2eHotelTest.mjs --static     # 静的チェックのみ（高速）
 *   node scripts/e2eHotelTest.mjs --id nikko   # 特定IDのみ
 *
 * 検証フェーズ:
 *   Phase 1 — MD検証（destinations.json のフィールドチェック）
 *   Phase 2 — URL静的検証（エンコード・形式）
 *   Phase 3 — 実ページ検証（Playwright）
 *
 * 出力: NG + WARNING のみ一覧表示、修正提案つき
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { chromium } from 'playwright';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

/* ── CLI オプション ── */
const SAMPLE_MODE  = process.argv.includes('--sample');
const STATIC_ONLY  = process.argv.includes('--static');
const SAMPLE_SIZE  = 20;
const ID_FLAG_IDX  = process.argv.indexOf('--id');
const FILTER_ID    = ID_FLAG_IDX >= 0 ? process.argv[ID_FLAG_IDX + 1] : null;

/* ── データ読み込み ── */
const dests = JSON.parse(readFileSync(join(ROOT, 'src/data/destinations.json'), 'utf8'));
const { buildHotelLinks } = await import(`file://${ROOT}/src/hotel/hotelLinkBuilder.js`);

/* ── 対象を決定 ── */
let targets = [...dests];
if (FILTER_ID) {
  targets = targets.filter(d => d.id === FILTER_ID);
  if (targets.length === 0) {
    console.error(`ERROR: id="${FILTER_ID}" が見つかりません`);
    process.exit(1);
  }
} else if (SAMPLE_MODE) {
  for (let i = targets.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [targets[i], targets[j]] = [targets[j], targets[i]];
  }
  targets = targets.slice(0, SAMPLE_SIZE);
}

/* ══════════════════════════════════════════
   Phase 1 — MD（destinations.json）検証
   ══════════════════════════════════════════ */

/**
 * 検索クエリとして弱いキーワードパターン
 * → NG ではなく WARNING として扱い、修正提案を出す
 */
const WEAK_PATTERNS = [
  { re: /温泉郷$/,   suggest: (kw) => kw.replace(/温泉郷$/, '温泉'),    reason: '「温泉郷」→「温泉」の方が検索ヒット数が多い' },
  { re: /郷$/,       suggest: (kw) => kw.replace(/郷$/, ''),             reason: '「郷」はじゃらん・楽天で検索ヒットが少ない' },
  { re: /[町村]$/,   suggest: (kw) => null,                              reason: '「町」「村」単位では宿が少ない可能性あり（上位の市名を推奨）' },
  { re: /観光/,      suggest: (kw) => kw.replace(/観光.*$/, '').trim(),  reason: '観光スポット名そのままでは宿検索にならない' },
];

function checkMd(dest) {
  const issues = [];
  const kw = dest.hotelKeyword;

  // hotelKeyword 未設定
  if (!kw || kw.trim() === '') {
    issues.push({
      level: 'NG',
      phase: 'MD',
      reason: 'hotelKeyword が未設定',
      suggest: dest.name,
    });
    return issues;
  }

  // hotelKeyword === name → INFO（多数あるので WARN 以下）
  if (kw === dest.name) {
    // 弱いパターンに該当する場合だけ WARNING
    for (const pat of WEAK_PATTERNS) {
      if (pat.re.test(kw)) {
        issues.push({
          level: 'WARN',
          phase: 'MD',
          reason: pat.reason,
          suggest: pat.suggest(kw) ?? '要確認',
        });
        break;
      }
    }
  }

  return issues;
}

/* ══════════════════════════════════════════
   Phase 2 — URL静的検証
   ══════════════════════════════════════════ */

function checkUrlStatic(url, provider, dest) {
  const issues = [];
  const kw = dest.hotelKeyword ?? dest.name;

  // https 必須
  if (!url.startsWith('https://')) {
    issues.push({ level: 'NG', phase: 'URL', reason: `https でない: ${url}` });
  }

  // 二重エンコード禁止
  if (url.includes('%25')) {
    issues.push({ level: 'NG', phase: 'URL', reason: `二重エンコード (%25) を検出: ${url}` });
  }

  // 空 URL 禁止（ドメインのみ）
  if (url === 'https://travel.rakuten.co.jp' || url === 'https://travel.rakuten.co.jp/') {
    issues.push({ level: 'NG', phase: 'URL', reason: '楽天 URL がトップページのみ（エリアデータ未登録の可能性）' });
  }

  // じゃらん: keyword がデコードすると元のキーワードと一致するか
  if (provider === 'jalan') {
    const m = url.match(/keyword=([^&]*)/);
    if (!m) {
      issues.push({ level: 'NG', phase: 'URL', reason: 'じゃらん URL に keyword= がない' });
    } else {
      try {
        const decoded = decodeURIComponent(m[1]);
        if (decoded !== kw) {
          issues.push({
            level: 'WARN',
            phase: 'URL',
            reason: `keyword デコード不一致: URL="${decoded}" vs hotelKeyword="${kw}"`,
          });
        }
      } catch {
        issues.push({ level: 'NG', phase: 'URL', reason: `keyword デコード失敗: ${m[1]}` });
      }
    }
  }

  // 楽天: /yado/ パスを含む（トップ以外）
  if (provider === 'rakuten' && !url.includes('/yado/')) {
    issues.push({ level: 'WARN', phase: 'URL', reason: `楽天 URL に /yado/ がない（フォールバック未登録）: ${url}` });
  }

  return issues;
}

/* ══════════════════════════════════════════
   Phase 3 — 実ページ検証（Playwright）
   ══════════════════════════════════════════ */

/* 楽天: OK条件キーワード */
const RAKUTEN_OK_WORDS = ['プラン', '空室', '泊から', '円〜', '円～', '一泊', '素泊', '朝食'];
/* 楽天: NG条件キーワード */
const RAKUTEN_NG_WORDS = [
  'ページが見つかりません',
  'お探しのページは見つかりませんでした',
  'このページは存在しません',
  'Not Found',
];

/* じゃらん: OK条件キーワード */
const JALAN_OK_WORDS = ['の検索結果', '泊から', '円〜', '宿・ホテル', '件の宿'];
/* じゃらん: NG条件キーワード */
const JALAN_NG_WORDS = [
  '該当する宿がありません',
  '条件に合う宿が見つかりません',
  '該当ページが存在しません',
  'ページが見つかりません',
  'お探しのページは',
  'Not Found',
];

async function checkPage(url, provider, context) {
  const page = await context.newPage();
  try {
    const response = await page.goto(url, {
      waitUntil: 'domcontentloaded',
      timeout: 30_000,
    });

    const status = response?.status() ?? 0;
    if (status !== 200) {
      return [{ level: 'NG', phase: 'PAGE', reason: `HTTP ${status}` }];
    }

    /* ドメイン流出チェック */
    const finalUrl = page.url();
    if (provider === 'rakuten' && !finalUrl.includes('travel.rakuten.co.jp')) {
      return [{ level: 'NG', phase: 'PAGE', reason: `楽天ドメイン外へリダイレクト: ${finalUrl}` }];
    }
    if (provider === 'jalan' && !finalUrl.includes('jalan.net')) {
      return [{ level: 'NG', phase: 'PAGE', reason: `じゃらんドメイン外へリダイレクト: ${finalUrl}` }];
    }

    const bodyText = await page.evaluate(() => document.body?.innerText ?? '');

    /* NG文言チェック */
    const ngWords = provider === 'rakuten' ? RAKUTEN_NG_WORDS : JALAN_NG_WORDS;
    for (const w of ngWords) {
      if (bodyText.includes(w)) {
        return [{ level: 'NG', phase: 'PAGE', reason: `エラー文言「${w}」を検出` }];
      }
    }

    /* OK条件チェック */
    const okWords = provider === 'rakuten' ? RAKUTEN_OK_WORDS : JALAN_OK_WORDS;
    const found = okWords.some(w => bodyText.includes(w));
    if (!found) {
      return [{
        level: 'NG',
        phase: 'PAGE',
        reason: `宿一覧が確認できない（${okWords.slice(0, 4).join('/')} が見つからない）`,
      }];
    }

    return [];
  } catch (err) {
    return [{ level: 'NG', phase: 'PAGE', reason: `例外: ${err.message?.slice(0, 120)}` }];
  } finally {
    await page.close();
  }
}

/* ══════════════════════════════════════════
   修正提案エンジン
   ══════════════════════════════════════════ */

function buildSuggestion(dest, issues, provider) {
  const kw = dest.hotelKeyword ?? dest.name;
  const suggestions = [];

  // MD由来のsuggestを優先
  for (const iss of issues) {
    if (iss.suggest) suggestions.push(`hotelKeyword: "${kw}" → "${iss.suggest}"`);
  }

  // PAGE NG で楽天 → フォールバックパスの見直しを提案
  if (issues.some(i => i.phase === 'PAGE') && provider === 'rakuten') {
    suggestions.push('hotelAreas.json の rakutenPath / rakutenFallback を確認・更新してください');
  }

  // PAGE NG で じゃらん → キーワード変更を提案
  if (issues.some(i => i.phase === 'PAGE') && provider === 'jalan') {
    suggestions.push(`hotelKeyword を "${kw}" から別の表現（例: ${dest.prefecture?.replace('県','').replace('府','').replace('都','') ?? ''}${dest.name}）に変更してください`);
  }

  return suggestions;
}

/* ══════════════════════════════════════════
   メイン処理
   ══════════════════════════════════════════ */

console.log('\n=== 宿リンク完全検証 ===');
console.log(`モード: ${FILTER_ID ? `ID="${FILTER_ID}"` : SAMPLE_MODE ? `ランダム ${SAMPLE_SIZE} 件` : `全 ${targets.length} 件`}`);
console.log(`フェーズ: MD検証 + URL静的検証${STATIC_ONLY ? '' : ' + 実ページ検証'}`);
console.log('');

/* Playwright 起動（静的チェックのみならスキップ） */
let browser = null;
let bContext = null;
if (!STATIC_ONLY) {
  browser = await chromium.launch({ headless: true });
  bContext = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    locale: 'ja-JP',
    timezoneId: 'Asia/Tokyo',
  });
}

const results = [];   // { dest, provider, url, issues }
let ngCount   = 0;
let warnCount = 0;
let passCount = 0;

for (let i = 0; i < targets.length; i++) {
  const dest = targets[i];
  const progress = `[${String(i + 1).padStart(3)}/${targets.length}]`;
  process.stdout.write(`${progress} ${dest.id.padEnd(22)} `);

  /* Phase 1: MD */
  const mdIssues = checkMd(dest);

  /* ホテルリンク生成 */
  const hotelLinks = buildHotelLinks(dest);
  const rakuten = hotelLinks.links.find(l => l.type === 'rakuten');
  const jalan   = hotelLinks.links.find(l => l.type === 'jalan');

  for (const [provider, link] of [['rakuten', rakuten], ['jalan', jalan]]) {
    if (!link) continue;

    const issues = [...mdIssues];

    /* Phase 2: URL静的 */
    issues.push(...checkUrlStatic(link.url, provider, dest));

    /* Phase 3: 実ページ（静的モード以外） */
    if (!STATIC_ONLY && !issues.some(i => i.level === 'NG' && i.phase === 'URL')) {
      const pageIssues = await checkPage(link.url, provider, bContext);
      issues.push(...pageIssues);
      await new Promise(r => setTimeout(r, 600));
    }

    const hasNg   = issues.some(i => i.level === 'NG');
    const hasWarn = issues.some(i => i.level === 'WARN');

    if (hasNg) {
      ngCount++;
      process.stdout.write('F');
      results.push({ dest, provider, url: link.url, issues, suggestions: buildSuggestion(dest, issues, provider) });
    } else if (hasWarn) {
      warnCount++;
      process.stdout.write('W');
      results.push({ dest, provider, url: link.url, issues, suggestions: buildSuggestion(dest, issues, provider) });
    } else {
      passCount++;
      process.stdout.write('.');
    }
  }

  process.stdout.write('\n');
}

if (browser) await browser.close();

/* ── 結果出力 ── */
console.log('');
console.log(`PASS: ${passCount}  WARN: ${warnCount}  FAIL: ${ngCount}  TOTAL: ${targets.length * 2}`);

if (results.length === 0) {
  console.log('\n✅ 全件 OK（NG・WARNING なし）');
  process.exit(0);
}

/* NG/WARN 一覧 */
const ngResults   = results.filter(r => r.issues.some(i => i.level === 'NG'));
const warnResults = results.filter(r => !r.issues.some(i => i.level === 'NG') && r.issues.some(i => i.level === 'WARN'));

if (ngResults.length > 0) {
  console.log('\n────────────────────────────────');
  console.log('❌ NG 一覧');
  console.log('────────────────────────────────');
  for (const r of ngResults) {
    const kw = r.dest.hotelKeyword ?? r.dest.name;
    console.log(`\n[${r.dest.id}] ${r.dest.name}  keyword="${kw}"  provider=${r.provider}`);
    console.log(`  URL: ${r.url}`);
    for (const iss of r.issues.filter(i => i.level === 'NG')) {
      console.log(`  NG  [${iss.phase}] ${iss.reason}`);
    }
    for (const s of r.suggestions) {
      console.log(`  💡 ${s}`);
    }
  }
}

if (warnResults.length > 0) {
  console.log('\n────────────────────────────────');
  console.log('⚠️  WARNING 一覧');
  console.log('────────────────────────────────');
  for (const r of warnResults) {
    const kw = r.dest.hotelKeyword ?? r.dest.name;
    console.log(`\n[${r.dest.id}] ${r.dest.name}  keyword="${kw}"  provider=${r.provider}`);
    console.log(`  URL: ${r.url}`);
    for (const iss of r.issues.filter(i => i.level === 'WARN')) {
      console.log(`  WARN [${iss.phase}] ${iss.reason}`);
    }
    for (const s of r.suggestions) {
      console.log(`  💡 ${s}`);
    }
  }
}

/* JSON サマリー（--json フラグ時のみ） */
if (process.argv.includes('--json')) {
  console.log('\n--- JSON NG 一覧 ---');
  console.log(JSON.stringify(ngResults.map(r => ({
    id:           r.dest.id,
    name:         r.dest.name,
    hotelKeyword: r.dest.hotelKeyword,
    provider:     r.provider,
    url:          r.url,
    issues:       r.issues.filter(i => i.level === 'NG').map(i => ({ phase: i.phase, reason: i.reason })),
    suggestions:  r.suggestions,
  })), null, 2));
}

if (ngCount > 0) {
  console.log('\n❌ NG あり — 修正後に再実行してください');
  process.exit(1);
} else {
  console.log('\n⚠️  WARNING のみ — 確認推奨');
}
