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
    // Node.js 環境かチェック（ブラウザで file:// を開いた場合と区別）
    const isNode = typeof process !== 'undefined' && process.versions?.node;
    if (isNode) {
      const { readFile } = await import('node:fs/promises');
      return JSON.parse(await readFile(url, 'utf8'));
    }
    // ブラウザで file:// を開いた場合 → 明示的エラー
    throw new Error(
      '[loadJson] file:// プロトコルはブラウザで動作しません。\n' +
      'ターミナルで "npx serve ." を実行し、http://localhost:3000 からアクセスしてください。'
    );
  }
  // ブラウザ環境 (http/https)
  const res = await fetch(url);
  if (!res.ok) throw new Error(`[loadJson] HTTP ${res.status}: ${url}`);
  return res.json();
}
