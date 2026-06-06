// imageQualityUpgrade.mjs
// 全destinationの画像(ヒーローmain + spot 3枚)をWikimedia Commonsのみで高品質化する。
//
// 手順 (各画像スロットごと):
//  1. description由来のスポット名/ランドマーク名(spots[].name)+地名+県名でクエリ生成
//  2. Wikimedia Commons APIで候補検索 → 写真のみ(地図/図/ロゴ除外) → 大サイズ順に最大CAND件
//  3. Claude Visionで各候補を判定: 正しい場所か / 日本か / 写真か / 映えるか(appeal) / 画質(quality)
//  4. 現在の画像もVision判定し、候補が明確に上回る時のみ置換(劣化防止)
//  5. 合格候補なし or 現状を超えない → 既存維持(skip)
//
// 出力先:
//  - ヒーロー: public/images/<id>/main.jpg (site) と images/<id>/main.jpg (pub) を上書きDL
//  - スポット: spots[i].imageUrl を高解像Wikimedia URLに更新 + spot-(i+1).jpg もDL
//  - destinations.json は site/pub 両方を更新
//
// env:
//  IDS=a,b,c     対象ID限定
//  LIMIT=20      先頭N件のみ
//  START=0       LIMITと併用の開始オフセット
//  SLOTS=all     all|main|spots  処理するスロット
//  CONC=4        並列数
//  DRY=1         書込みせず判定だけ(レポート用)
//  RESUME=1      既存ログのdone idをスキップ
//  CAND=6        スロットごとの最大候補数
//  VJUDGE=4      Visionで判定する候補上限
//  MARGIN=1      置換に必要なスコア差(候補-現在)
//  OUT=logs/imageQualityUpgrade.json

import fs from 'node:fs';
import path from 'node:path';
import https from 'node:https';
import Anthropic from '@anthropic-ai/sdk';
import dotenv from 'dotenv';
dotenv.config({ path: '/Users/moririn/MORI-LAB/projects/dokoiko-site/.env' });

const ROOT = '/Users/moririn/MORI-LAB/projects/dokoiko';
const SITE = '/Users/moririn/MORI-LAB/projects/dokoiko-site';
const SITE_IMG = path.join(SITE, 'public/images');
const PUB_IMG = path.join(ROOT, 'images');
const DEST_SITE = path.join(SITE, 'src/data/destinations.json');
const DEST_PUB = path.join(ROOT, 'data/destinations.json');
const OUT = path.join(ROOT, process.env.OUT || 'logs/imageQualityUpgrade.json');

const SLOTS = process.env.SLOTS || 'all';
const CONC = Number(process.env.CONC || 4);
const DRY = process.env.DRY === '1';
const RESUME = process.env.RESUME === '1';
const CAND = Number(process.env.CAND || 6);
const VJUDGE = Number(process.env.VJUDGE || 4);
const MARGIN = Number(process.env.MARGIN || 1);
const SAVE_W = 1280;   // 保存する画像幅
const JUDGE_W = 768;   // Vision判定用の幅(トークン節約)
const SPOT_URL_W = 1024; // spots[].imageUrl に保存する幅

const UA = 'dokoiko-image-upgrade/1.0 (https://dokoiiko.com; morizou0718@gmail.com)';

// ---------- HTTP ----------
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// 429/503/5xx はバックオフして自動リトライ(Wikimediaのレート制限対策)
function httpGet(url, asBuffer = false, tries = 5) {
  return new Promise((resolve, reject) => {
    let hops = 0;
    const attempt = (u, left) => {
      hops++; if (hops > 12) return reject(new Error('too many redirects'));
      https.get(u, { headers: { 'User-Agent': UA, 'Accept': '*/*' } }, (r) => {
        const code = r.statusCode;
        if (code >= 300 && code < 400 && r.headers.location) {
          r.resume();
          const next = r.headers.location.startsWith('http') ? r.headers.location : new URL(r.headers.location, u).toString();
          return attempt(next, left);
        }
        if ((code === 429 || code === 503 || code >= 500) && left > 0) {
          const ra = Number(r.headers['retry-after']);
          r.resume();
          const wait = (ra > 0 ? ra * 1000 : 1500 * (tries - left + 1)) + Math.floor(hops % 7) * 200;
          return setTimeout(() => attempt(u, left - 1), wait);
        }
        if (code !== 200) { r.resume(); return reject(new Error('HTTP ' + code)); }
        if (asBuffer) {
          const chunks = [];
          r.on('data', (c) => chunks.push(c));
          r.on('end', () => resolve(Buffer.concat(chunks)));
        } else {
          let b = ''; r.setEncoding('utf-8');
          r.on('data', (c) => b += c); r.on('end', () => resolve(b));
        }
      }).on('error', (e) => {
        if (left > 0) return setTimeout(() => attempt(u, left - 1), 1200 * (tries - left + 1));
        reject(e);
      });
    };
    attempt(url, tries);
  });
}
async function downloadTo(url, dst) {
  const buf = await httpGet(url, true);
  if (buf.length < 4000) throw new Error('too small ' + buf.length);
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  fs.writeFileSync(dst, buf);
  return buf.length;
}

// Wikimedia は API が返した正確な幅の thumburl のみ有効(任意幅への文字列書換は400)。
// 指定幅の正規 thumburl は API から取得する。
async function getThumbByTitle(title, w) {
  const params = new URLSearchParams({
    action: 'query', format: 'json', titles: title,
    prop: 'imageinfo', iiprop: 'url|size|mime', iiurlwidth: String(w),
  });
  try {
    const j = JSON.parse(await httpGet('https://commons.wikimedia.org/w/api.php?' + params.toString()));
    const p = Object.values(j?.query?.pages || {})[0];
    return p?.imageinfo?.[0]?.thumburl || null;
  } catch { return null; }
}

// ---------- Wikimedia Commons 検索 ----------
const BAD_NAME = /(\.svg$|map|plan|diagram|locator|logo|icon|seal|coat[_ ]of[_ ]arms|flag|chart|graph|symbol|emblem|\bsign\b|signboard|timetable|route|railway[_ ]map|\bgraph\b|monochrome|illustration|drawing|ukiyo|woodblock)/i;
function isPhotoCandidate(c) {
  if (!c.url) return false;
  if (!/image\/(jpeg|png)/.test(c.mime || '')) return false;
  if (BAD_NAME.test(c.title || '')) return false;
  if (BAD_NAME.test(c.url)) return false;
  if (!c.width || !c.height) return false;
  if (c.width < 1100) return false;            // 元画像が十分大きい
  const ar = c.width / c.height;
  if (ar < 0.45 || ar > 3.2) return false;     // 極端な縦長/横長(パノラマ・図表)を除外
  return true;
}
async function commonsSearch(query, limit = 20) {
  const params = new URLSearchParams({
    action: 'query', format: 'json', generator: 'search',
    gsrsearch: query, gsrnamespace: '6', gsrlimit: String(limit),
    prop: 'imageinfo', iiprop: 'url|size|mime', iiurlwidth: String(SAVE_W),
  });
  const url = 'https://commons.wikimedia.org/w/api.php?' + params.toString();
  let j;
  try { j = JSON.parse(await httpGet(url)); } catch { return []; }
  const pages = j?.query?.pages ? Object.values(j.query.pages) : [];
  const out = [];
  for (const p of pages) {
    const ii = p.imageinfo?.[0]; if (!ii) continue;
    out.push({
      title: p.title || '', url: ii.url, thumbUrl: ii.thumburl,
      width: ii.width, height: ii.height, mime: ii.mime,
      index: p.index ?? 999,
    });
  }
  return out;
}

async function gatherCandidates(queries) {
  const seen = new Set();
  const all = [];
  for (const q of queries) {
    let hits;
    try { hits = await commonsSearch(q, 15); } catch { hits = []; }
    for (const h of hits) {
      if (seen.has(h.url)) continue;
      if (!isPhotoCandidate(h)) continue;
      seen.add(h.url);
      all.push({ ...h, query: q });
    }
    await new Promise((r) => setTimeout(r, 120));
    if (all.length >= CAND * 2) break;
  }
  // 大サイズ順
  all.sort((a, b) => (b.width * b.height) - (a.width * a.height));
  return all.slice(0, CAND);
}

// ---------- Vision 判定 ----------
const client = new Anthropic();
const VMODEL = 'claude-haiku-4-5-20251001';
const VSYS = 'あなたは日本の旅行サイト用の写真を評価する厳格な審査員です。返答はJSONオブジェクトのみ。';
const VSCHEMA = '{"match":bool(指定の場所・被写体そのものか。同名でも別の市町村/都道府県/島なら必ずfalse),"japan":bool(日本国内の風景),"photo":bool(実写真。地図/図/イラスト/ロゴ/文字主体ならfalse),"appeal":1-5(旅行写真としての魅力),"quality":1-5(解像感・構図・明るさ),"reason":"<=40字"}';

async function visionJudge(buf, subject, place, hint) {
  const data = buf.toString('base64');
  const hintLine = hint ? `\nWikimediaファイル名(撮影地の手がかり): "${hint}"\n→ ファイル名が指定地と異なる地名(別の市町村・都道府県・島・寺社)を示す場合は match=false。` : '';
  const prompt = `指定の場所/被写体: ${subject}${place ? `（${place}）` : ''}${hintLine}\nこの画像が「${subject}」そのものを写しているか厳密に評価せよ。同名の別物・別地は match=false。\n${VSCHEMA}`;
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const res = await client.messages.create({
        model: VMODEL, max_tokens: 200, system: VSYS,
        messages: [{ role: 'user', content: [
          { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data } },
          { type: 'text', text: prompt },
        ] }],
      });
      const txt = res.content?.[0]?.text || '';
      const m = txt.match(/\{[\s\S]*\}/);
      if (!m) return { error: 'NO_JSON' };
      const o = JSON.parse(m[0]);
      return o;
    } catch (e) {
      const msg = String(e.message || e);
      if (/429|rate_limit|overloaded|529/i.test(msg)) { await new Promise((r) => setTimeout(r, 3000 * (attempt + 1))); continue; }
      return { error: msg.slice(0, 120) };
    }
  }
  return { error: 'RETRY_EXHAUSTED' };
}
function scoreOf(v) {
  if (!v || v.error) return -1;
  if (!(v.match && v.japan && v.photo)) return 0;
  if ((v.appeal || 0) < 3) return 0;
  return (v.appeal || 0) + (v.quality || 0); // 2..10
}

// ---------- スロット処理 ----------
async function fetchJpeg(url) {
  const buf = await httpGet(url, true);
  return buf;
}

async function processSlot({ d, slotKey, subject, place, queries, currentLocalPath, currentRemoteUrl }) {
  const log = { slot: slotKey, subject, replaced: false, reason: '', candScores: [] };
  const cands = await gatherCandidates(queries);
  log.candCount = cands.length;
  if (!cands.length) { log.reason = 'NO_CANDIDATES'; return log; }

  // 候補をVision判定(大サイズ順)。合格(score>0)が出たら以降も上位までは見る。
  let best = null;
  const toJudge = cands.slice(0, VJUDGE);
  for (const c of toJudge) {
    let buf;
    try { buf = await fetchJpeg(c.thumbUrl); }
    catch { log.candScores.push({ title: c.title, err: 'DL_FAIL' }); continue; }
    const titleHint = (c.title || '').replace(/^File:/, '').replace(/\.(jpe?g|png)$/i, '');
    const v = await visionJudge(buf, subject, place, titleHint);
    const s = scoreOf(v);
    log.candScores.push({ title: c.title.replace(/^File:/, '').slice(0, 50), w: c.width, score: s, appeal: v.appeal, quality: v.quality, match: v.match });
    if (s > 0 && (!best || s > best.score)) best = { cand: c, score: s, v };
    await sleep(120);
  }
  if (!best) { log.reason = 'NO_PASS'; return log; }
  log.bestCandScore = best.score;

  // 現在画像を判定
  let curScore = -1, curMeta = null;
  try {
    let curBuf = null;
    if (currentRemoteUrl) curBuf = await fetchJpeg(currentRemoteUrl);
    else if (currentLocalPath && fs.existsSync(currentLocalPath)) curBuf = fs.readFileSync(currentLocalPath);
    if (curBuf) {
      const v = await visionJudge(curBuf, subject, place);
      curScore = scoreOf(v);
      curMeta = { score: curScore, appeal: v.appeal, quality: v.quality, match: v.match };
    }
  } catch { /* 現在画像判定不可 */ }
  log.currentScore = curScore;
  log.currentMeta = curMeta;

  // 置換判定: 現在が不合格(<=0)なら候補合格で置換。現在も合格なら明確差(MARGIN)が必要。
  const beats = curScore <= 0 ? best.score > 0 : best.score >= curScore + MARGIN;
  if (!beats) { log.reason = `KEEP (cand ${best.score} <= cur ${curScore})`; return log; }

  // 適用: 保存幅の正規 thumburl を API から取得(スポットは1024で軽量化)
  let saveThumb = best.cand.thumbUrl; // 既定は検索時の SAVE_W(1280)
  if (slotKey !== 'main') {
    const t = await getThumbByTitle(best.cand.title, SPOT_URL_W);
    if (t) saveThumb = t;
  }
  if (!DRY) {
    const fname = slotKey === 'main' ? 'main.jpg' : `${slotKey}.jpg`;
    await downloadTo(saveThumb, path.join(SITE_IMG, d.id, fname));
    await downloadTo(saveThumb, path.join(PUB_IMG, d.id, fname));
  }
  log.replaced = true;
  log.newUrl = saveThumb;
  log.newWidth = best.cand.width;
  log.reason = `REPLACED (cand ${best.score} > cur ${curScore})`;
  return log;
}

// ---------- クエリ生成 ----------
function prefShort(d) {
  return (d.prefecture || '').replace(/[県府都]$/, '').split(/[・,／\/]/)[0].trim();
}
function heroQueries(d) {
  const pref = prefShort(d);
  const top = (d.spots && d.spots[0] && d.spots[0].name) || '';
  const qs = [`${d.name} ${pref}`, `${d.name} 風景`, `${d.name} 観光`];
  if (top) qs.push(`${top} ${d.name}`);
  qs.push(d.name);
  if (d.mainSpot && d.mainSpot !== top) qs.push(`${d.mainSpot} ${d.name}`);
  return [...new Set(qs)].filter(Boolean);
}
function spotQueries(d, spotName) {
  const pref = prefShort(d);
  return [...new Set([
    `${spotName} ${d.name}`,
    `${spotName} ${pref}`,
    `${spotName} ${d.name} ${pref}`,
    spotName,
  ])].filter(Boolean);
}

// ---------- メイン ----------
function loadJson(p) { return JSON.parse(fs.readFileSync(p, 'utf-8')); }
function pickTargets(dests) {
  if (process.env.IDS) {
    const ids = process.env.IDS.split(',').map((s) => s.trim()).filter(Boolean);
    return dests.filter((d) => ids.includes(d.id));
  }
  const start = Number(process.env.START || 0);
  const limit = process.env.LIMIT ? Number(process.env.LIMIT) : dests.length;
  return dests.slice(start, start + limit);
}

async function main() {
  const destSite = loadJson(DEST_SITE);
  const destPub = loadJson(DEST_PUB);
  const pubMap = new Map(destPub.map((d) => [d.id, d]));
  const siteMap = new Map(destSite.map((d) => [d.id, d]));

  let prior = { results: [] };
  if (fs.existsSync(OUT)) { try { prior = loadJson(OUT); } catch { /* ignore */ } }
  const doneIds = new Set(RESUME ? (prior.results || []).map((r) => r.id) : []);

  const targets = pickTargets(destPub).filter((d) => !doneIds.has(d.id));
  console.log(`targets: ${targets.length} (slots=${SLOTS}, conc=${CONC}, dry=${DRY})`);

  const results = RESUME ? (prior.results || []) : [];
  let processed = 0, dirty = false;

  function writeData() {
    if (DRY || !dirty) return;
    fs.writeFileSync(DEST_PUB, JSON.stringify(destPub, null, 2));
    fs.writeFileSync(DEST_SITE, JSON.stringify(destSite, null, 2));
    dirty = false;
  }
  function writeLog() {
    fs.writeFileSync(OUT, JSON.stringify({
      finishedAt: null, slots: SLOTS, dry: DRY,
      counts: summarize(results), results,
    }, null, 2));
  }

  async function handleOne(d) {
    const rec = { id: d.id, name: d.name, prefecture: d.prefecture, slots: [] };
    try {
      const doMain = SLOTS === 'all' || SLOTS === 'main';
      const doSpots = SLOTS === 'all' || SLOTS === 'spots';
      if (doMain) {
        const r = await processSlot({
          d, slotKey: 'main',
          subject: `${d.name}の代表的な風景・ランドマーク`,
          place: d.prefecture,
          queries: heroQueries(d),
          currentLocalPath: path.join(PUB_IMG, d.id, 'main.jpg'),
          currentRemoteUrl: null,
        });
        rec.slots.push(r);
      }
      if (doSpots && Array.isArray(d.spots)) {
        for (let i = 0; i < Math.min(3, d.spots.length); i++) {
          const sp = d.spots[i];
          if (!sp || !sp.name) continue;
          const r = await processSlot({
            d, slotKey: `spot-${i + 1}`,
            subject: sp.name, place: `${d.name} ${d.prefecture}`,
            queries: spotQueries(d, sp.name),
            currentLocalPath: null,
            currentRemoteUrl: sp.imageUrl || null,
          });
          // spots[].imageUrl 更新
          if (r.replaced && !DRY) {
            const pd = pubMap.get(d.id), sd = siteMap.get(d.id);
            if (pd?.spots?.[i]) pd.spots[i].imageUrl = r.newUrl;
            if (sd?.spots?.[i]) sd.spots[i].imageUrl = r.newUrl;
            dirty = true;
          }
          rec.slots.push(r);
        }
      }
    } catch (e) {
      rec.error = String(e.message || e).slice(0, 160);
    }
    return rec;
  }

  let idx = 0;
  async function worker() {
    while (idx < targets.length) {
      const k = idx++;
      const d = targets[k];
      const rec = await handleOne(d);
      results.push(rec);
      processed++;
      const repl = rec.slots.filter((s) => s.replaced).length;
      console.log(`[${processed}/${targets.length}] ${d.id} (${d.name}) replaced=${repl}/${rec.slots.length}`);
      if (processed % 5 === 0) { writeData(); writeLog(); }
    }
  }
  await Promise.all(Array.from({ length: CONC }, () => worker()));
  writeData(); writeLog();

  const sum = summarize(results);
  console.log('\n=== DONE ===');
  console.log(JSON.stringify(sum, null, 2));
  // 完了時刻スタンプ(Date不可のため省略可)
}

function summarize(results) {
  let slotsTotal = 0, replaced = 0, kept = 0, noCand = 0, noPass = 0, errs = 0;
  const replacedDests = new Set();
  for (const r of results) {
    if (r.error) errs++;
    for (const s of (r.slots || [])) {
      slotsTotal++;
      if (s.replaced) { replaced++; replacedDests.add(r.id); }
      else if (s.reason?.startsWith('KEEP')) kept++;
      else if (s.reason === 'NO_CANDIDATES') noCand++;
      else if (s.reason === 'NO_PASS') noPass++;
    }
  }
  return { dests: results.length, replacedDests: replacedDests.size, slotsTotal, replaced, kept, noCandidates: noCand, noPass, errors: errs };
}

main().catch((e) => { console.error(e); process.exit(1); });
