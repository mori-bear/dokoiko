/**
 * generateSitemap.js — sitemap.xml の自動生成
 *
 * 含めるページ:
 *   - / (index.html)
 *   - /destinations.html (目的地一覧)
 *   - /destinations/{id}.html (個別ページ、gen_* 除外)
 *   - /pages/about.html / privacy.html / disclaimer.html
 *
 * 実行: node scripts/generateSitemap.js
 * 出力: sitemap.xml（プロジェクトルート）
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DESTS_PATH = path.join(ROOT, 'src/data/destinations.json');
const OUT_PATH   = path.join(ROOT, 'sitemap.xml');

const SITE_ORIGIN = 'https://tabidokoiko.com';

const dests = JSON.parse(fs.readFileSync(DESTS_PATH, 'utf8'));
const targets = dests.filter(d => d.type === 'destination');

const today = new Date().toISOString().slice(0, 10);

/** URL をXMLエスケープ（& → &amp; 等） */
function xmlEsc(s) {
  return String(s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
}

function urlEntry(loc, { priority = '0.5', changefreq = 'monthly' } = {}) {
  return `  <url>
    <loc>${xmlEsc(loc)}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
  </url>`;
}

const urls = [];

/* トップページ（最優先） */
urls.push(urlEntry(`${SITE_ORIGIN}/`, { priority: '1.0', changefreq: 'daily' }));
/* 目的地一覧 */
urls.push(urlEntry(`${SITE_ORIGIN}/destinations.html`, { priority: '0.9', changefreq: 'weekly' }));

/* 個別目的地ページ */
for (const d of targets) {
  urls.push(urlEntry(`${SITE_ORIGIN}/destinations/${d.id}.html`, { priority: '0.7', changefreq: 'monthly' }));
}

/* 静的ページ */
for (const slug of ['about', 'privacy', 'disclaimer']) {
  urls.push(urlEntry(`${SITE_ORIGIN}/pages/${slug}.html`, { priority: '0.3', changefreq: 'yearly' }));
}

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join('\n')}
</urlset>
`;

fs.writeFileSync(OUT_PATH, xml);
console.log(`✓ sitemap.xml 生成完了: ${urls.length} URLs → ${OUT_PATH}`);
