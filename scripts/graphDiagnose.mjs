/**
 * graphDiagnose.mjs — 未到達 destination の原因診断
 *
 * 実行: node scripts/graphDiagnose.mjs
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const GRAPH = JSON.parse(readFileSync(join(__dirname, '../src/data/transportGraph.json'), 'utf8'));
const DESTS = JSON.parse(readFileSync(join(__dirname, '../src/data/destinations.json'), 'utf8'));

const ADJ   = {};  // outgoing
const RADJ  = {};  // incoming
for (const edge of GRAPH.edges) {
  if (!ADJ[edge.from])  ADJ[edge.from]  = [];
  if (!RADJ[edge.to])   RADJ[edge.to]   = [];
  ADJ[edge.from].push(edge);
  RADJ[edge.to].push(edge);
}

function findPath(fromId, toId) {
  const queue   = [[fromId]];
  const visited = new Set();
  while (queue.length) {
    const path = queue.shift();
    const node = path[path.length - 1];
    if (node === toId) return path;
    if (!visited.has(node)) {
      visited.add(node);
      for (const e of (ADJ[node] ?? [])) {
        if (!visited.has(e.to)) queue.push([...path, e.to]);
      }
    }
  }
  return null;
}

const HUBS = ['hub:東京', 'hub:大阪', 'hub:福岡'];

console.log('════════════════════════════════════════════════');
console.log('  未到達 destination 原因診断');
console.log('════════════════════════════════════════════════\n');

for (const dest of DESTS) {
  const toId = `destination:${dest.id}`;
  if (!GRAPH.nodes[toId]) {
    console.log(`[ノードなし] ${dest.name} (${dest.id})`);
    continue;
  }
  const reachable = HUBS.some(h => GRAPH.nodes[h] && findPath(h, toId));
  if (reachable) continue;

  // 診断: 直前ノードを調べる
  const incoming = RADJ[toId] ?? [];
  const incomingIds = incoming.map(e => e.from);

  // 直前ノードが到達可能か
  const reachableIncoming = incomingIds.filter(nid =>
    HUBS.some(h => GRAPH.nodes[h] && findPath(h, nid))
  );

  console.log(`[未到達] ${dest.name} (${dest.id})`);
  console.log(`  destination node: ${toId}`);
  console.log(`  直前ノード(${incoming.length}件): ${incomingIds.join(', ')}`);
  if (reachableIncoming.length > 0) {
    console.log(`  ✓ 到達可能な直前ノード: ${reachableIncoming.join(', ')}`);
    console.log(`  → destination への最後のエッジが存在するが何か問題`);
  } else {
    console.log(`  ✗ 直前ノードも全て未到達`);
    // その直前ノードの直前を調べる
    for (const inId of incomingIds.slice(0, 2)) {
      const inIncoming = (RADJ[inId] ?? []).map(e => e.from);
      const reachableInIn = inIncoming.filter(nid =>
        HUBS.some(h => GRAPH.nodes[h] && findPath(h, nid))
      );
      if (reachableInIn.length > 0) {
        console.log(`    ${inId} の直前: ${reachableInIn.join(', ')} → [到達可] → ${inId} → (行き止まり?)`);
        // ADJ[inId] を表示して出口を確認
        const outgoing = (ADJ[inId] ?? []).map(e => `${e.to}(${e.type})`);
        console.log(`    ${inId} の出口: ${outgoing.join(', ')}`);
      }
    }
  }
  console.log('');
}

// 特定パターン調査: hub ノードは存在するが destination に繋がっていないケース
console.log('\n════════════════════════════════════════════════');
console.log('  hub ノードは存在するが destination ノードへの接続なし');
console.log('════════════════════════════════════════════════\n');

for (const dest of DESTS) {
  const toId  = `destination:${dest.id}`;
  const hubId = `hub:${dest.name}`;
  if (!GRAPH.nodes[toId]) continue;
  if (!GRAPH.nodes[hubId]) continue;

  // hub:X は存在するが destination から到達できない場合
  const reachable = HUBS.some(h => GRAPH.nodes[h] && findPath(h, toId));
  if (!reachable) {
    const hubOutgoing = (ADJ[hubId] ?? []).map(e => `${e.to}(${e.type})`);
    const destIncoming = (RADJ[toId] ?? []).map(e => `${e.from}(${e.type})`);
    const hubReachable = HUBS.some(h => GRAPH.nodes[h] && findPath(h, hubId));
    console.log(`${dest.name}: hub:${dest.name} → 到達可能=${hubReachable}`);
    console.log(`  hub出口: ${hubOutgoing.join(', ') || 'なし'}`);
    console.log(`  dest入口: ${destIncoming.join(', ') || 'なし'}`);
    console.log('');
  }
}
