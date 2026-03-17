/**
 * transportGraph.json に新 destination ノード・エッジを追加
 * - 釜石 (kamaishi)   hub:遠野 → rail → destination:kamaishi
 * - 大船渡 (ofunato)  hub:仙台 → bus  → destination:ofunato
 * - 久慈 (kuji)       hub:八戸 → rail → destination:kuji
 * - 珠洲 (suzu)       station:金沢 → bus → destination:suzu
 *   （能登 noto は sanriku 同様 destination 削除、既存 wajima パターン流用）
 */
'use strict';
const fs = require('fs');
const g  = JSON.parse(fs.readFileSync('./src/data/transportGraph.json', 'utf8'));

// ── 追加ノード ──
const NEW_NODES = [
  { id:'destination:kamaishi', type:'destination', name:'釜石',   destId:'kamaishi', lat:39.2760, lng:141.8859 },
  { id:'destination:ofunato',  type:'destination', name:'大船渡', destId:'ofunato',  lat:39.0823, lng:141.7147 },
  { id:'destination:kuji',     type:'destination', name:'久慈',   destId:'kuji',     lat:40.1906, lng:141.7747 },
  { id:'destination:suzu',     type:'destination', name:'珠洲',   destId:'suzu',     lat:37.4290, lng:137.2648 },
];

// ── 追加エッジ (IDは既存最大値+1 以降) ──
const maxId = Math.max(...g.edges.map(e => parseInt(e.id.replace('e',''),10)));
let nextId  = maxId + 1;
function eid() { return 'e' + String(nextId++).padStart(4,'0'); }

const NEW_EDGES = [
  // 釜石: hub:遠野 → destination:kamaishi (JR釜石線, ~65分)
  { id:eid(), from:'hub:遠野',      to:'destination:kamaishi', type:'rail', minutes:65,  provider:'ekinet', service:'JR釜石線' },
  // 大船渡: hub:仙台 → destination:ofunato (BRT, ~150分)
  { id:eid(), from:'hub:仙台',      to:'destination:ofunato',  type:'bus',  minutes:150, local:true },
  // 久慈: hub:八戸 → destination:kuji (JR八戸線, ~100分)
  { id:eid(), from:'hub:八戸',      to:'destination:kuji',     type:'rail', minutes:100, provider:'ekinet', service:'JR八戸線' },
  // 珠洲: station:金沢 → destination:suzu (バス, ~150分 ※旧能登鉄道廃線のためバス)
  { id:eid(), from:'station:金沢',  to:'destination:suzu',     type:'bus',  minutes:150, local:true },
];

// 既存チェック
NEW_NODES.forEach(n => {
  if (g.nodes[n.id]) console.warn('既存ノード上書き:', n.id);
  g.nodes[n.id] = n;
});
g.edges.push(...NEW_EDGES);

// sanriku destination ノードは残してもBFS上問題ないが
// destinations_v2 にないため unreachable になるだけ。削除は不要。

console.log('追加ノード:', NEW_NODES.map(n=>n.id).join(', '));
console.log('追加エッジ:', NEW_EDGES.map(e=>`${e.from}→${e.to}(${e.type})`).join(', '));
console.log('総ノード数:', Object.keys(g.nodes).length, '総エッジ数:', g.edges.length);

fs.writeFileSync('./src/data/transportGraph.json', JSON.stringify(g, null, 2), 'utf8');
console.log('✓ transportGraph.json 更新完了');
