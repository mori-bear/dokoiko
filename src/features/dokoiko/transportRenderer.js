/**
 * transportRenderer.js — 後方互換エクスポート
 *
 * 交通ロジックの実装はすべて src/transport/resolveTransportLinks.js にある。
 * このファイルは app.js からの import パスを変えずに済むよう re-export するだけ。
 *
 * app.js:
 *   import { resolveTransportLinks } from './src/features/dokoiko/transportRenderer.js';
 *                                                         ↓ 実体
 *   src/transport/resolveTransportLinks.js
 */
export { resolveTransportLinks } from '../../transport/resolveTransportLinks.js';
