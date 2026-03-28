/**
 * loadJson — JSON ファイルローダー（ブラウザ / Node.js 両対応）
 *
 * 背景:
 *   `import X from './x.json' with { type: 'json' }` は Import Attributes (Safari 17.2+) 限定。
 *   Safari 15〜17.1 では SyntaxError → JS 全体が読み込まれない → ボタン全滅。
 *
 *   fetch() は file:// プロトコルを扱えないため、Node.js（テストスクリプト）では
 *   fs/promises を使う。ブラウザでは fetch() を使う。
 *
 * 使い方:
 *   import { loadJson } from '../lib/loadJson.js';
 *   const DATA = await loadJson('../data/something.json', import.meta.url);
 */

export async function loadJson(relPath, metaUrl) {
  const url = new URL(relPath, metaUrl);
  if (url.protocol === 'file:') {
    // Node.js 環境（scripts/*.mjs などのテストから呼ばれる場合）
    const { readFile } = await import('node:fs/promises');
    return JSON.parse(await readFile(url, 'utf8'));
  }
  // ブラウザ環境
  const res = await fetch(url);
  if (!res.ok) throw new Error(`[loadJson] HTTP ${res.status}: ${url}`);
  return res.json();
}
