/**
 * Data migration:
 * 1. Convert secondaryTransport object → string ('bus'|'ferry'|'car')
 * 2. Add missing gatewayHub
 * 3. Add missing secondaryTransport (string)
 */
const fs = require('fs');
const data = JSON.parse(fs.readFileSync('./src/data/destinations.json', 'utf8'));

// ── 1. secondaryTransport object → string ──────────────────────
for (const d of data) {
  if (d.secondaryTransport && typeof d.secondaryTransport === 'object') {
    d.secondaryTransport = d.secondaryTransport.type || 'bus';
  }
}

// ── 2. Add missing gatewayHub (for railNote destinations) ───────
const GATEWAY_HUB_PATCH = {
  'mihonoseki':  '境港',
  'ryujin-onsen':'田辺',
  'arima-onsen': '三ノ宮',
  'wajima':      '金沢',
  'jozankei':    '札幌',
  'kiso':        '南木曽',
  'bungo-takada': null,  // air-only, no rail gateway
  'motobu':      null,   // drive from Naha
};
for (const d of data) {
  if (GATEWAY_HUB_PATCH.hasOwnProperty(d.id)) {
    d.gatewayHub = GATEWAY_HUB_PATCH[d.id];
  }
}

// ── 3. Add missing secondaryTransport (string) ──────────────────
const ST_PATCH = {
  // railGateway exists → bus/car needed after station
  'kusatsu-onsen':   'bus',   // 長野原草津口駅 → バス
  'shiretoko':       'bus',   // 知床斜里駅 → バス
  'hirado':          'bus',   // 平戸口駅 → バス
  'tateyama-kurobe': 'bus',   // 立山駅 → トロッコ+バス
  'koyasan':         'bus',   // 高野山駅 → ケーブル+バス
  'yoshino':         'bus',   // 吉野駅 → バス
  'eiheiji':         'bus',   // 永平寺口駅 → バス
  'shimabara':       'bus',   // 島原駅 → バス（市内）
  'shimanto':        'car',   // 窪川 → レンタカー
  // islands → ferry
  'iriomote':        'ferry',
  'shijishima':      'ferry',
  'rebun-island':    'ferry',
  'rishiri-island':  'ferry',
  'sado-island':     'ferry',
  'suo-oshima':      'ferry',
  'kashiwajima':     'ferry',
  'tanegashima':     'ferry',
  'taketomi-island': 'ferry',
  'ie-island':       'ferry',
  'kohama-island':   'ferry',
};
for (const d of data) {
  if (ST_PATCH.hasOwnProperty(d.id) && !d.secondaryTransport) {
    d.secondaryTransport = ST_PATCH[d.id];
  }
}

// ── 4. Verify ───────────────────────────────────────────────────
const objFormat = data.filter(d => d.secondaryTransport && typeof d.secondaryTransport === 'object');
if (objFormat.length) console.error('STILL OBJECT FORMAT:', objFormat.map(d=>d.id));

const gwNoST = data.filter(d => d.gatewayHub && !d.secondaryTransport);
if (gwNoST.length) console.warn('gatewayHub but no secondaryTransport:', gwNoST.map(d=>d.id).join(', '));

const stats = {bus: 0, ferry: 0, car: 0, none: 0};
for (const d of data) {
  const st = d.secondaryTransport;
  if (!st) stats.none++;
  else stats[st] = (stats[st] || 0) + 1;
}
console.log('secondaryTransport stats:', JSON.stringify(stats));

fs.writeFileSync('./src/data/destinations.json', JSON.stringify(data, null, 2), 'utf8');
console.log('Done. Total:', data.length);
