/**
 * addDestinations_31.js で追加した31件のQA FAIL修正
 * - gateway/accessStation 整合性
 * - catch文字数超過（30文字以内）
 * - hasDirectFlight, ferryGateway 修正
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEST_FILE = path.join(__dirname, '../src/data/destinations.json');

const FIXES = {
  'kamui-misaki': {
    gateway: '新千歳空港',
    gatewayStations: [{ name: '新千歳空港', type: 'airport', priority: 1 }, { name: '小樽駅', type: 'major', priority: 2 }],
  },
  'mashu-ko': {
    gateway: '釧路空港',
    gatewayStations: [{ name: '釧路空港', type: 'airport', priority: 1 }, { name: '摩周駅', type: 'major', priority: 2 }],
  },
  'kussharo-ko': {
    gateway: '釧路空港',
    gatewayStations: [{ name: '釧路空港', type: 'airport', priority: 1 }, { name: '摩周駅', type: 'major', priority: 2 }],
  },
  'chokai-san': {
    gateway: '秋田駅',
    gatewayStations: [{ name: '秋田駅', type: 'shinkansen', priority: 1 }, { name: '庄内空港', type: 'airport', priority: 2 }, { name: '酒田駅', type: 'major', priority: 3 }],
  },
  'eshima-miyagi': {
    gateway: '仙台駅',
    gatewayStations: [{ name: '仙台駅', type: 'shinkansen', priority: 1 }, { name: '女川駅', type: 'major', priority: 2 }],
    ferryGateway: null,
  },
  'keta-taisha': {
    gateway: '金沢駅',
    gatewayStations: [{ name: '金沢駅', type: 'major', priority: 1 }, { name: '小松空港', type: 'airport', priority: 2 }],
  },
  'uryunuma': {
    catch: '高層湿原の花畑。ここが北海道だとは思えない。',
  },
  'chikubushima': {
    catch: '湖の中に神の島がある。船が近づくほど、本当にそう思えた。',
    ferryGateway: null,
  },
  'gokase': {
    catch: '宮崎にこんな山里があるとは。山道が続いた。',
  },
  'mitsuke-jima':         { hasDirectFlight: false },
  'rokkozaki':            { hasDirectFlight: false },
  'sozogi':               { hasDirectFlight: false },
  'shiroyone-senmaida':   { hasDirectFlight: false },
  'kudakajima':           { ferryGateway: null },
  // gateway === accessStation 追加修正
  'kirigamine':           { gateway: null },
  'nyukasa':              { gateway: null },
  'ontake':               { gateway: '名古屋駅', gatewayStations: [{ name: '名古屋駅', type: 'shinkansen', priority: 1 }, { name: '木曽福島駅', type: 'major', priority: 2 }] },
  'mitsuke-jima':         { gateway: '金沢駅', gatewayStations: [{ name: '金沢駅', type: 'major', priority: 1 }, { name: '能登空港', type: 'airport', priority: 2 }] },
  'rokkozaki':            { gateway: '金沢駅', gatewayStations: [{ name: '金沢駅', type: 'major', priority: 1 }, { name: '能登空港', type: 'airport', priority: 2 }] },
  'sozogi':               { gateway: '金沢駅', accessStation: '輪島' },
  'shiroyone-senmaida':   { gateway: '金沢駅', accessStation: '輪島' },
  'tojinbo':              { gateway: null },
  'kaizu-osaki':          { gateway: null },
  'chikubushima':         { gateway: null },
  'metasequoia':          { gateway: null },
  'tango-matsushima':     { gateway: '京都駅', gatewayStations: [{ name: '京都駅', type: 'shinkansen', priority: 1 }, { name: '天橋立駅', type: 'major', priority: 2 }] },
  'kuju-kogen':           { gateway: null },
  'ikoma-kogen':          { gateway: null },
  'shimanami-kaido':      { gateway: '広島駅', gatewayStations: [{ name: '広島駅', type: 'shinkansen', priority: 1 }, { name: '広島空港', type: 'airport', priority: 2 }, { name: '尾道駅', type: 'major', priority: 3 }] },
  'gokase':               { gateway: null },
};

const data = JSON.parse(fs.readFileSync(DEST_FILE, 'utf-8'));
let fixedCount = 0;

for (const dest of data) {
  const fix = FIXES[dest.id];
  if (!fix) continue;
  Object.assign(dest, fix);
  console.log(`✅ 修正: ${dest.id} (${dest.name})`);
  fixedCount++;
}

fs.writeFileSync(DEST_FILE, JSON.stringify(data, null, 2), 'utf-8');
console.log(`\n修正完了: ${fixedCount}件`);
