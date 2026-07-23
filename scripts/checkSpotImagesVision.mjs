// checkSpotImagesVision.mjs
// スポット画像(spot-0〜spot-3)を全件Vision APIでチェック・修正する。
//
// 判定基準:
//  1. 日本国内の画像か
//  2. spot.name + spot.descriptionの内容と一致しているか(例: 北島酒造→火山はNG)
//
// 修正方針:
//  NG判定はCommonsで「{スポット名} {都道府県}」で再取得
//
// env:
//  RESUME=1   既存ログのdone idをスキップ
//  DRY=1      書込みせず判定だけ
//  IDS=a,b,c  対象ID限定
//  START=0    開始オフセット
//  LIMIT=N    先頭N件のみ

import fs from 'node:fs';
import path from 'node:path';
import https from 'node:https';
import Anthropic from '@anthropic-ai/sdk';
import dotenv from 'dotenv';
dotenv.config({ path: '/Users/moririn/MORI-LAB/projects/dokoiko-site/.env' });

const ROOT = '/Users/moririn/MORI-LAB/projects/dokoiko';
const SITE = '/Users/moririn/MORI-LAB/projects/dokoiko-site';
const DEST_PUB  = path.join(ROOT, 'data/destinations.json');
const DEST_SITE = path.join(SITE, 'src/data/destinations.json');
const OUT = path.join(ROOT, 'logs/checkSpotVision.json');

const RESUME = process.env.RESUME === '1';
const DRY    = process.env.DRY === '1';
const UA = 'dokoiko-spot-check/1.0 (https://dokoiiko.com; morizou0718@gmail.com)';
const THUMB_W = 500;   // Vision判定用thumbnail幅
const SAVE_W  = 1024;  // 置換URL用の幅
const SITE_PUBLIC = path.join(SITE, 'public'); // ローカル画像のベースパス

// ---------- ユーティリティ ----------
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function randWait() {
  return 3000 + Math.floor(Math.random() * 2000); // 3〜5秒
}

function httpGet(url, asBuffer = false, tries = 5) {
  return new Promise((resolve, reject) => {
    let hops = 0;
    const attempt = (u, left) => {
      hops++; if (hops > 12) return reject(new Error('too many redirects'));
      https.get(u, { headers: { 'User-Agent': UA, 'Accept': '*/*' } }, (r) => {
        const code = r.statusCode;
        if (code >= 300 && code < 400 && r.headers.location) {
          r.resume();
          const next = r.headers.location.startsWith('http')
            ? r.headers.location
            : new URL(r.headers.location, u).toString();
          return attempt(next, left);
        }
        if ((code === 429 || code === 503 || code >= 500) && left > 0) {
          const ra = Number(r.headers['retry-after']);
          r.resume();
          const wait = (ra > 0 ? ra * 1000 : 2000 * (tries - left + 1));
          return setTimeout(() => attempt(u, left - 1), wait);
        }
        if (code !== 200) { r.resume(); return reject(new Error('HTTP ' + code)); }
        if (asBuffer) {
          const chunks = [];
          r.on('data', (c) => chunks.push(c));
          r.on('end', () => resolve(Buffer.concat(chunks)));
        } else {
          let b = ''; r.setEncoding('utf-8');
          r.on('data', (c) => b += c);
          r.on('end', () => resolve(b));
        }
      }).on('error', (e) => {
        if (left > 0) return setTimeout(() => attempt(u, left - 1), 1500 * (tries - left + 1));
        reject(e);
      });
    };
    attempt(url, tries);
  });
}

// ---------- Wikimedia Commons ----------
const BAD_NAME = /(\.svg$|map|plan|diagram|locator|logo|icon|seal|coat[_ ]of[_ ]arms|flag|chart|graph|symbol|emblem|\bsign\b|timetable|route|railway[_ ]map|monochrome|illustration|drawing|ukiyo|woodblock)/i;
function isPhotoCandidate(c) {
  if (!c.url) return false;
  if (!/image\/(jpeg|png)/.test(c.mime || '')) return false;
  if (BAD_NAME.test(c.title || '')) return false;
  if (BAD_NAME.test(c.url)) return false;
  if (!c.width || !c.height) return false;
  if (c.width < 800) return false;
  const ar = c.width / c.height;
  if (ar < 0.4 || ar > 3.5) return false;
  return true;
}

async function commonsSearch(query, limit = 15) {
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
    });
  }
  return out.filter(isPhotoCandidate);
}

async function getThumbUrl(title, w) {
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

// ---------- Vision ----------
const client = new Anthropic();
const VMODEL = 'claude-haiku-4-5-20251001';
const VSYS = 'あなたは日本の旅行サイト用の写真を審査する厳格な審査員です。返答はJSONオブジェクトのみ。';
const VSCHEMA = '{"japan":bool(日本国内の風景・施設・自然),"match":bool(指定のスポットそのものか。同名の別地・全く異なる被写体ならfalse),"photo":bool(実写真。地図/図/イラスト/ロゴ/文字主体ならfalse),"reason":"<=40字"}';

async function visionCheck(buf, spotName, spotDesc, place) {
  const data = buf.toString('base64');
  const descLine = spotDesc ? `\nスポット説明(参考): ${spotDesc.slice(0, 100)}` : '';
  const prompt = `チェック対象スポット: ${spotName}（${place}）${descLine}\nこの画像が「${spotName}」そのものを写しているか厳密に評価せよ。\n判定基準:\n- japan: 日本国内の風景・建物・施設か\n- match: 指定スポットそのものか(説明と全く合わない被写体ならfalse)\n- photo: 実写真か\n${VSCHEMA}`;
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
      if (!m) return { error: 'NO_JSON', raw: txt.slice(0, 80) };
      return JSON.parse(m[0]);
    } catch (e) {
      const msg = String(e.message || e);
      if (/429|rate_limit|overloaded|529/i.test(msg)) {
        await sleep(4000 * (attempt + 1));
        continue;
      }
      return { error: msg.slice(0, 100) };
    }
  }
  return { error: 'RETRY_EXHAUSTED' };
}

function isPass(v) {
  if (!v || v.error) return false;
  return v.japan === true && v.match === true && v.photo !== false;
}

// ---------- Commons置換 ----------
async function findReplacement(spotName, destName, pref) {
  const prefShort = (pref || '').replace(/[県府都]$/, '').split(/[・,／\/]/)[0].trim();
  const queries = [
    `${spotName} ${prefShort}`,
    `${spotName} ${destName}`,
    `${spotName} ${destName} ${prefShort}`,
    spotName,
  ].filter(Boolean);

  for (const q of queries) {
    let cands;
    try { cands = await commonsSearch(q, 10); } catch { cands = []; }
    for (const c of cands) {
      let buf;
      try { buf = await httpGet(c.thumbUrl || c.url, true); }
      catch { continue; }
      const v = await visionCheck(buf, spotName, '', `${destName} ${pref}`);
      if (isPass(v)) {
        const saveThumb = await getThumbUrl(c.title, SAVE_W) || c.thumbUrl || c.url;
        return { url: saveThumb, title: c.title, score: v };
      }
      await sleep(1200);
    }
    await sleep(800);
  }
  return null;
}

// ---------- メイン ----------
function loadJson(p) { return JSON.parse(fs.readFileSync(p, 'utf-8')); }

async function main() {
  const destPub  = loadJson(DEST_PUB);
  const destSite = loadJson(DEST_SITE);
  const pubMap  = new Map(destPub.map((d) => [d.id, d]));
  const siteMap = new Map(destSite.map((d) => [d.id, d]));

  // チェックポイント読込
  let prior = { results: [] };
  if (RESUME && fs.existsSync(OUT)) {
    try { prior = loadJson(OUT); } catch { /* ignore */ }
  }
  const doneSet = new Set(
    RESUME ? (prior.results || []).map((r) => `${r.id}:${r.spotIdx}`) : []
  );
  const results = RESUME ? (prior.results || []) : [];

  // 対象選択
  let targets = [...destPub];
  if (process.env.IDS) {
    const ids = process.env.IDS.split(',').map((s) => s.trim());
    targets = targets.filter((d) => ids.includes(d.id));
  } else {
    const start = Number(process.env.START || 0);
    const limit = process.env.LIMIT ? Number(process.env.LIMIT) : targets.length;
    targets = targets.slice(start, start + limit);
  }

  // 全スポットをフラット化
  const tasks = [];
  for (const d of targets) {
    if (!Array.isArray(d.spots)) continue;
    for (let i = 0; i < d.spots.length; i++) {
      const sp = d.spots[i];
      if (!sp || !sp.name || !sp.imageUrl) continue;
      const key = `${d.id}:${i}`;
      if (doneSet.has(key)) continue;
      tasks.push({ d, i, sp });
    }
  }

  console.log(`targets: ${targets.length} dests, ${tasks.length} spot-images remaining (dry=${DRY}, resume=${RESUME})`);

  let processed = 0, replaced = 0, ng = 0, dirty = false;

  function saveCheckpoint() {
    fs.writeFileSync(OUT, JSON.stringify({ results, counts: { processed, replaced, ng } }, null, 2));
  }
  function saveData() {
    if (DRY || !dirty) return;
    fs.writeFileSync(DEST_PUB,  JSON.stringify(destPub,  null, 2));
    fs.writeFileSync(DEST_SITE, JSON.stringify(destSite, null, 2));
    dirty = false;
  }

  for (let t = 0; t < tasks.length; t++) {
    const { d, i, sp } = tasks[t];
    const rec = { id: d.id, name: d.name, prefecture: d.prefecture, spotIdx: i, spotName: sp.name };

    let buf;
    try {
      if (sp.imageUrl.startsWith('http')) {
        buf = await httpGet(sp.imageUrl, true);
      } else {
        const localPath = path.join(SITE_PUBLIC, sp.imageUrl);
        if (!fs.existsSync(localPath)) throw new Error('LOCAL_NOT_FOUND: ' + localPath);
        buf = fs.readFileSync(localPath);
      }
    } catch (e) {
      rec.result = 'DL_FAIL';
      rec.error = String(e.message || e).slice(0, 80);
      results.push(rec);
      console.log(`[${t + 1}/${tasks.length}] ${d.id} spot-${i} DL_FAIL: ${rec.error}`);
      await sleep(randWait());
      if ((t + 1) % 10 === 0) { saveCheckpoint(); saveData(); await sleep(30000); }
      continue;
    }

    const v = await visionCheck(buf, sp.name, sp.description || '', `${d.name} ${d.prefecture}`);
    rec.vision = v;

    if (isPass(v)) {
      rec.result = 'OK';
      processed++;
      results.push(rec);
      console.log(`[${t + 1}/${tasks.length}] ${d.id} spot-${i} OK  ${sp.name}`);
    } else {
      ng++;
      rec.result = 'NG';
      rec.reason = v?.reason || v?.error || '';
      console.log(`[${t + 1}/${tasks.length}] ${d.id} spot-${i} NG  ${sp.name} (${rec.reason})`);

      // Commons置換を試みる
      const repl = await findReplacement(sp.name, d.name, d.prefecture);
      if (repl) {
        rec.result = 'REPLACED';
        rec.newUrl = repl.url;
        rec.replTitle = repl.title;
        console.log(`  → REPLACED: ${repl.title}`);
        if (!DRY) {
          const pd = pubMap.get(d.id), sd = siteMap.get(d.id);
          if (pd?.spots?.[i]) pd.spots[i].imageUrl = repl.url;
          if (sd?.spots?.[i]) sd.spots[i].imageUrl = repl.url;
          dirty = true;
          replaced++;
        }
      } else {
        rec.result = 'NG_NO_REPL';
        console.log(`  → NO_REPLACEMENT`);
      }
      processed++;
      results.push(rec);
    }

    await sleep(randWait()); // 3〜5秒ランダムウェイト

    // 10件ごとにチェックポイント保存 + 30秒休憩
    if ((t + 1) % 10 === 0) {
      saveCheckpoint();
      saveData();
      console.log(`--- checkpoint ${t + 1}/${tasks.length} (replaced=${replaced}, ng=${ng}) --- 30s break ---`);
      await sleep(30000);
    }
  }

  saveCheckpoint();
  saveData();

  const summary = {
    total: tasks.length + (RESUME ? (prior.results || []).length : 0),
    processed,
    replaced,
    ng,
    ngNoRepl: results.filter((r) => r.result === 'NG_NO_REPL').length,
    dlFail: results.filter((r) => r.result === 'DL_FAIL').length,
  };
  console.log('\n=== DONE ===');
  console.log(JSON.stringify(summary, null, 2));

  if (!DRY && replaced > 0) {
    console.log('\n自動デプロイを実行します...');
    const { execSync } = await import('node:child_process');
    try {
      execSync('git add data/destinations.json', { cwd: ROOT, stdio: 'inherit' });
      execSync('git commit -m "fix: スポット画像Vision品質チェック・修正"', { cwd: ROOT, stdio: 'inherit' });
      execSync('git push', { cwd: ROOT, stdio: 'inherit' });
      console.log('dokoiko data committed & pushed.');
    } catch (e) {
      console.error('dokoiko commit error:', e.message);
    }
    try {
      execSync('git add src/data/destinations.json', { cwd: SITE, stdio: 'inherit' });
      execSync('git commit -m "fix: スポット画像Vision品質チェック・修正"', { cwd: SITE, stdio: 'inherit' });
      execSync('git push', { cwd: SITE, stdio: 'inherit' });
      console.log('dokoiko-site committed & pushed.');
    } catch (e) {
      console.error('dokoiko-site commit error:', e.message);
    }
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
