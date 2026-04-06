'use strict';
/**
 * destinations.json スキーマ正規化スクリプト
 *
 * hub        : { id, name, type:"hub", region, + 運用フィールド }
 * destination: { id, name, type:"destination", region, hub, hubCity, tags[], spots[], + 運用フィールド }
 * spot       : { id, name, type:"spot", destination }
 *
 * 削除: atmosphere, image, jr_region, mapDestination, parentHub, transport,
 *       airportAccess, jalanUrl, rakutenUrl, accessFromHub, access_city,
 *       hubCity, port (island), access.railBookingProvider, nearCity,
 *       stayMinutes (spot のみ)
 * リネーム: themes → tags, parentDestination → destination
 * 新規追加: destination.hub (親hubのid)
 */

const fs   = require('fs');
const path = require('path');
const src  = path.join(__dirname, '../src/data/destinations.json');
const data = JSON.parse(fs.readFileSync(src, 'utf8'));

// ─── destination → 親hub の手動マッピング ──────────────────────────────────
const DEST_HUB = {
  // 北海道
  otaru:           'sapporo-t',
  furano:          'asahikawa',
  jozankei:        'sapporo-t',
  biei:            'asahikawa',
  toyako:          'sapporo-t',
  noboribetsu:     'sapporo-t',
  shiretoko:       'kushiro',

  // 東北
  matsushima:      'sendai-t',
  hiraizumi:       'morioka',
  kakunodate:      'morioka',
  aizu:            'sendai-t',
  zaosan:          'yamagata',
  ginzan_onsen:    'yamagata',   // id が ginzan-onsen
  'ginzan-onsen':  'yamagata',
  sakata:          'yamagata',
  hirosaki:        'morioka',
  oirase:          'morioka',
  'miyako-iwate':  'morioka',
  'ouchi-juku':    'sendai-t',
  'nyuto-onsen':   'morioka',
  'naruko-onsen':  'sendai-t',
  akita:           'morioka',

  // 関東
  kamakura:        'tokyo-o',
  atami:           'tokyo-o',
  nikko:           'tokyo-o',
  karuizawa:       'tokyo-o',
  fujikawaguchiko: 'tokyo-o',
  hakone:          'tokyo-o',
  shuzenji:        'tokyo-o',
  'kusatsu-onsen': 'tokyo-o',
  shimoda:         'tokyo-o',
  'izu-oshima':    'tokyo-o',
  kouzushima:      'tokyo-o',
  takao:           'tokyo-o',
  'tateyama-chiba':'tokyo-o',
  mashiko:         'tokyo-o',
  'minakami-onsen':'tokyo-o',
  'shima-onsen':   'tokyo-o',

  // 甲信越
  hakuba:          'matsumoto-n',
  'nozawa-onsen':  'matsumoto-n',
  obuse:           'matsumoto-n',
  'bessho-onsen':  'matsumoto-n',
  kamikochi:       'matsumoto-n',
  kiso:            'matsumoto-n',

  // 北陸
  'tateyama-kurobe':'kanazawa-t',
  wajima:          'kanazawa-t',
  'kaga-onsen':    'kanazawa-t',
  'wakura-onsen':  'kanazawa-t',
  himi:            'kanazawa-t',

  // 中部/東海
  ise:             'nagoya-t',
  toba:            'nagoya-t',
  inuyama:         'nagoya-t',
  'gero-onsen':    'nagoya-t',
  tsumago:         'nagoya-t',
  magome:          'nagoya-t',

  // 中部/岐阜
  'takayama-o':    'gifu',
  'shirakawago-t': 'gifu',
  gokayama:        'kanazawa-t',

  // 近畿
  nara:            'osaka-t',
  'arima-onsen':   'kobe',
  'kinosaki-onsen':'osaka-t',
  'shirahama-o':   'osaka-t',
  'ryujin-onsen':  'osaka-t',
  koyasan:         'osaka-t',
  nagahama:        'osaka-t',
  hikone:          'osaka-t',
  miyama:          'kyoto-t',
  amanohashidate:  'osaka-t',
  ine:             'osaka-t',
  izushi:          'osaka-t',
  awaji:           'kobe',

  // 中国
  onomichi:        'hiroshima-t',
  'kurashiki-o':   'okayama-o',
  mihonoseki:      'matsue',
  hagi:            'hiroshima-t',
  shimonoseki:     'hiroshima-t',
  naoshima:        'okayama-o',
  tottori:         'matsue',
  'misasa-onsen':  'matsue',
  'oku-izumo':     'matsue',
  tsuwano:         'hiroshima-t',
  takehara:        'hiroshima-t',
  'yuda-onsen':    'hiroshima-t',

  // 四国
  kotohira:        'takamatsu',
  uwajima:         'matsuyama',
  uchiko:          'matsuyama',
  oboke:           'takamatsu',
  iya:             'takamatsu',
  ashizuri:        'kochi',
  muroto:          'kochi',
  shodoshima:      'takamatsu',
  miyajima:        'hiroshima-t',

  // 九州
  beppu:           'fukuoka-t',
  yufuin:          'fukuoka-t',
  'kurokawa-k':    'kumamoto',
  aso:             'kumamoto',
  amakusa:         'kumamoto',
  takachiho:       'miyazaki',
  ibusuki:         'kagoshima',
  sasebo:          'nagasaki',
  hirado:          'nagasaki',
  unzen:           'nagasaki',
  'ureshino-onsen':'saga',
  hitoyoshi:       'kumamoto',
  obi:             'miyazaki',
  'minami-aso':    'kumamoto',

  // 南西諸島・沖縄
  ishigaki:        'naha',
  'tokashiki-jima':'naha',
  kumejima:        'naha',
  miyakojima:      'naha',
  amami:           'kagoshima',
  goto:            'nagasaki',
  yakushima:       'kagoshima',
};

// ─── accessオブジェクトを正規化（不要フィールド削除）──────────────────────────
function cleanAccess(a) {
  if (!a) return null;
  return {
    railGateway:   a.railGateway   ?? null,
    railNote:      a.railNote      ?? null,
    airportGateway:a.airportGateway?? null,
    ferryGateway:  a.ferryGateway  ?? null,
  };
}

// ─── 変換 ─────────────────────────────────────────────────────────────────────
let hubCount = 0, destCount = 0, spotCount = 0;
let unmappedDest = [];

const result = data.map(function(d) {
  // ── hub ──
  if (d.type === 'hub') {
    hubCount++;
    return {
      id:              d.id,
      name:            d.name,
      type:            'hub',
      region:          d.region,
      // 運用フィールド
      hubCity:        d.hubCity ?? d.name,
      stayAllowed:     d.stayAllowed     ?? [],
      departures:      d.departures      ?? [],
      weight:          d.weight          ?? 0.35,
      access:          cleanAccess(d.access),
      ...(d.portHubs ? { portHubs: d.portHubs } : {}),
      description:     d.description     ?? '',
      tags:            d.tags ?? d.themes ?? [],
      spots:           d.spots            ?? [],
      shinkansenAccess:d.shinkansenAccess ?? false,
      needsCar:        d.needsCar         ?? false,
      ...(d.isIsland ? { isIsland: true } : {}),
    };
  }

  // ── destination ──
  if (d.type === 'destination') {
    destCount++;
    const hub = DEST_HUB[d.id];
    if (!hub) unmappedDest.push(d.id);
    return {
      id:              d.id,
      name:            d.name,
      type:            'destination',
      region:          d.region,
      hub:             hub ?? null,
      hubCity:        d.hubCity ?? d.name,
      // 運用フィールド
      stayAllowed:     d.stayAllowed     ?? [],
      departures:      d.departures      ?? [],
      weight:          d.weight          ?? 1.2,
      access:          cleanAccess(d.access),
      ...(d.portHubs ? { portHubs: d.portHubs } : {}),
      description:     d.description     ?? '',
      tags:            d.tags ?? d.themes ?? [],
      spots:           d.spots            ?? [],
      shinkansenAccess:d.shinkansenAccess ?? false,
      needsCar:        d.needsCar         ?? false,
      ...(d.isIsland ? { isIsland: true } : {}),
    };
  }

  // ── spot ──
  if (d.type === 'spot') {
    spotCount++;
    return {
      id:          d.id,
      name:        d.name,
      type:        'spot',
      destination: d.parentDestination ?? null,
    };
  }

  return d;
});

// ─── 書き出し ──────────────────────────────────────────────────────────────────
fs.writeFileSync(src, JSON.stringify(result, null, 2), 'utf8');

// ─── 結果出力 ─────────────────────────────────────────────────────────────────
console.log('=== スキーマ正規化完了 ===');
console.log(`hub数        : ${hubCount}`);
console.log(`destination数: ${destCount}`);
console.log(`spot数       : ${spotCount}`);

if (unmappedDest.length > 0) {
  console.log(`\n⚠ hub未マッピングのdestination: ${unmappedDest.length}件`);
  unmappedDest.forEach(function(id) { console.log('  ' + id); });
} else {
  console.log('\n✓ 全destinationにhub割当済み');
}

// 整合性チェック
const final = JSON.parse(fs.readFileSync(src, 'utf8'));
const allIds = new Set(final.map(function(x){return x.id;}));

const spotNoParent = final.filter(function(x){
  return x.type === 'spot' && !allIds.has(x.destination);
});
console.log('spot.destination未解決:', spotNoParent.length, '件');

const destNoHub = final.filter(function(x){
  return x.type === 'destination' && (!x.hub || !allIds.has(x.hub));
});
console.log('destination.hub未解決 :', destNoHub.length, '件',
  destNoHub.length > 0 ? destNoHub.map(function(x){return x.id+'=>'+x.hub;}).join(', ') : '');

console.log('\n--- 削除したフィールド ---');
console.log('atmosphere, image, jr_region, mapDestination, parentHub,');
console.log('transport, airportAccess, jalanUrl, rakutenUrl, accessFromHub,');
console.log('access_city, hubCity, port, access.railBookingProvider');
console.log('spot: nearCity, stayMinutes, region, shinkansenAccess, stayAllowed');
console.log('\n--- リネームしたフィールド ---');
console.log('themes → tags (hub/destination)');
console.log('parentDestination → destination (spot)');
console.log('\n--- 新規追加フィールド ---');
console.log('destination.hub (親hubのid)');
