'use strict';
const fs = require('fs');
const path = require('path');

const src = path.join(__dirname, '../src/data/destinations.json');
const data = JSON.parse(fs.readFileSync(src, 'utf8'));

// ─── name → id lookup ────────────────────────────────────────────────────────
const nameToId = {};
data.forEach(d => { nameToId[d.name] = d.id; });

// ─── spot parent overrides (hotelHub name doesn't = correct parent) ───────────
// Values = destination/hub id
const SPOT_PARENT = {
  // 北海道: nearCity が正しい
  'spot-aoi-ike':         'biei',           // 青い池 → 美瑛
  'spot-farm-tomita':     'furano',          // ファーム富田 → 富良野
  'spot-sounkyo':         'asahikawa',       // 層雲峡 → 旭川(hub)
  // 東北
  'spot-towada-ko':       'oirase',          // 十和田湖 → 奥入瀬
  'spot-tsutanuma':       'oirase',          // 蔦沼 → 奥入瀬
  'spot-tazawa-ko':       'nyuto-onsen',     // 田沢湖 → 乳頭温泉
  // 中部
  'spot-kurobe-dam':      'tateyama-kurobe', // 黒部ダム → 立山黒部
  'spot-tateyama-murodo': 'tateyama-kurobe', // 立山室堂 → 立山黒部
  'spot-inuyama-jo':      'inuyama',         // 犬山城 → 犬山
  // 中国
  'spot-itsukushima':     'miyajima',        // 厳島神社 → 宮島
  'spot-adachi-museum':   'matsue',          // 足立美術館 → 松江
  'spot-izumo-taisha':    'matsue',          // 出雲大社 → 松江
  // 四国
  'spot-iya-kazurabashi': 'iya',             // 祖谷かずら橋 → 祖谷
  'spot-oboke-kyo':       'oboke',           // 大歩危峡 → 大歩危
  'spot-chichihogahama':  'takamatsu',       // 父母ヶ浜 → 高松
  // 新規hubへのマッピング（hotelHub が欠落していた都市）
  'spot-fukuroda-falls':  'mito',
  'spot-ryujin-bridge':   'mito',
  'spot-kairakuen':       'mito',
  'spot-shosenkyo':       'kofu',
  'spot-miho-matsubara':  'shizuoka',
  'spot-sumatagoro':      'shizuoka',
  'spot-tenryu-kyo':      'iida',
};

// ─── 不足していたhubエントリ（7都市） ─────────────────────────────────────────
const NEW_HUBS = [
  {
    id: 'mito',
    name: '水戸',
    type: 'hub',
    region: '関東',
    mapDestination: '水戸駅',
    parentHub: null,
    weight: 0.35,
    stayAllowed: ['daytrip', '1night'],
    departures: ['東京'],
    access: { railGateway: '水戸駅', railNote: null, railBookingProvider: null, airportGateway: null, ferryGateway: null },
    transport: { main: 'jr', railGateway: '水戸駅' },
    atmosphere: ['常磐線特急で東京から約1時間30分。水戸駅が観光の起点。', '偕楽園・弘道館・袋田の滝', '梅の名所と水戸黄門の城下町、訪れてみない？'],
    themes: ['梅', '庭園', '歴史'],
    spots: ['偕楽園', '袋田の滝', '弘道館'],
    needsCar: false,
    description: '日本三名園の一つ偕楽園と水戸黄門ゆかりの史跡が点在する茨城の中心都市。梅の季節には特に見ごたえがある。',
    tags: ['梅', '庭園', '歴史'],
    jr_region: 'east',
    image: null,
    shinkansenAccess: false,
    hotelHub: '水戸',
  },
  {
    id: 'kofu',
    name: '甲府',
    type: 'hub',
    region: '中部',
    mapDestination: '甲府駅',
    parentHub: null,
    weight: 0.35,
    stayAllowed: ['daytrip', '1night'],
    departures: ['東京'],
    access: { railGateway: '甲府駅', railNote: null, railBookingProvider: null, airportGateway: '甲府空港', ferryGateway: null },
    transport: { main: 'jr', railGateway: '甲府駅' },
    atmosphere: ['特急あずさで新宿から約1時間30分。甲府駅が観光の起点。', '昇仙峡・武田神社・ほうとう', '甲州ワインと山の幸、訪れてみない？'],
    themes: ['渓谷', '武田', 'ワイン'],
    spots: ['昇仙峡', '武田神社', '甲州ワイン'],
    needsCar: false,
    description: '武田信玄ゆかりの史跡と甲州ワインが楽しめる盆地の街。花崗岩の奇岩が織りなす昇仙峡は国の特別名勝。',
    tags: ['渓谷', '武田', 'ワイン'],
    jr_region: 'east',
    image: null,
    shinkansenAccess: false,
    hotelHub: '甲府',
  },
  {
    id: 'shizuoka',
    name: '静岡',
    type: 'hub',
    region: '中部',
    mapDestination: '静岡駅',
    parentHub: null,
    weight: 0.35,
    stayAllowed: ['daytrip', '1night'],
    departures: ['東京', '名古屋', '大阪'],
    access: { railGateway: '静岡駅', railNote: null, railBookingProvider: null, airportGateway: '静岡空港', ferryGateway: null },
    transport: { main: 'jr', railGateway: '静岡駅' },
    atmosphere: ['新幹線で東京から約1時間。静岡駅が観光の起点。', '三保の松原・久能山東照宮・さわやかハンバーグ', '富士山と駿河湾、訪れてみない？'],
    themes: ['富士山', '海', 'お茶'],
    spots: ['三保の松原', '久能山東照宮', '日本平'],
    needsCar: false,
    description: '富士山を望む駿河湾と茶畑の街。世界遺産の三保の松原と新鮮な桜えびが魅力。',
    tags: ['富士山', '海', 'お茶'],
    jr_region: 'east',
    image: null,
    shinkansenAccess: true,
    hotelHub: '静岡',
  },
  {
    id: 'iida',
    name: '飯田',
    type: 'hub',
    region: '中部',
    mapDestination: '飯田駅',
    parentHub: null,
    weight: 0.35,
    stayAllowed: ['daytrip', '1night'],
    departures: ['名古屋', '東京'],
    access: { railGateway: '飯田駅', railNote: null, railBookingProvider: null, airportGateway: null, ferryGateway: null },
    transport: { main: 'jr', railGateway: '飯田駅' },
    atmosphere: ['名古屋から高速バスで約2時間。飯田駅が観光の起点。', '天竜峡・りんご並木・南アルプス', '南信州の山と川、訪れてみない？'],
    themes: ['渓谷', '果樹園', '山'],
    spots: ['天竜峡', 'りんご並木', '元善光寺'],
    needsCar: true,
    description: '天竜峡の断崖と南アルプスに囲まれた南信州の中心地。りんごや梨の果樹園が広がる山里。',
    tags: ['渓谷', '果樹園', '山'],
    jr_region: 'east',
    image: null,
    shinkansenAccess: false,
    hotelHub: '飯田',
  },
  {
    id: 'matsue',
    name: '松江',
    type: 'hub',
    region: '中国',
    mapDestination: '松江駅',
    parentHub: null,
    weight: 0.35,
    stayAllowed: ['1night'],
    departures: ['大阪', '広島', '東京'],
    access: { railGateway: '松江駅', railNote: null, railBookingProvider: null, airportGateway: '出雲空港', ferryGateway: null },
    transport: { main: 'jr', railGateway: '松江駅' },
    atmosphere: ['岡山から特急やくもで約2時間。松江駅が観光の起点。', '松江城・宍道湖・出雲大社', '山陰の水都と神話の地、訪れてみない？'],
    themes: ['城', '湖', '神社'],
    spots: ['松江城', '宍道湖', '出雲大社'],
    needsCar: false,
    description: '宍道湖の夕日と国宝松江城が美しい山陰の水都。出雲大社への拠点として、神話の息吹を感じる旅に。',
    tags: ['城', '湖', '神社'],
    jr_region: 'west',
    image: null,
    shinkansenAccess: false,
    hotelHub: '松江',
  },
  {
    id: 'takamatsu',
    name: '高松',
    type: 'hub',
    region: '四国',
    mapDestination: '高松駅',
    parentHub: null,
    weight: 0.35,
    stayAllowed: ['1night'],
    departures: ['大阪', '東京', '岡山'],
    access: { railGateway: '高松駅', railNote: null, railBookingProvider: null, airportGateway: '高松空港', ferryGateway: null },
    transport: { main: 'jr', railGateway: '高松駅' },
    atmosphere: ['岡山から快速マリンライナーで約1時間。高松駅が観光の起点。', '栗林公園・讃岐うどん・直島', '瀬戸内の玄関口、訪れてみない？'],
    themes: ['庭園', 'うどん', '島'],
    spots: ['栗林公園', '讃岐うどん', '瀬戸内アート'],
    needsCar: false,
    description: '栗林公園と讃岐うどんで知られる瀬戸内の玄関都市。直島など島めぐりの拠点にもなる。',
    tags: ['庭園', 'うどん', '島'],
    jr_region: 'west',
    image: null,
    shinkansenAccess: false,
    hotelHub: '高松',
  },
];

// ─── 変換処理 ─────────────────────────────────────────────────────────────────
let hubCount = 0, destCount = 0, spotCount = 0;
let typeChanges = 0, parentAdded = 0;

const result = data.map(d => {
  if (d.type === 'urban' || d.type === 'hub') {
    if (d.type === 'urban') typeChanges++;
    hubCount++;
    return { ...d, type: 'hub' };
  }
  if (d.type === 'local' || d.type === 'island') {
    if (d.type === 'island') typeChanges++;
    if (d.type === 'local') typeChanges++;
    destCount++;
    return { ...d, type: 'destination' };
  }
  if (d.type === 'spot') {
    const parentId = SPOT_PARENT[d.id] || nameToId[d.hotelHub] || d.hotelHub;
    parentAdded++;
    spotCount++;
    const { hotelHub, ...rest } = d;
    return { ...rest, type: 'spot', parentDestination: parentId };
  }
  return d;
});

// 新規hubを追加
NEW_HUBS.forEach(h => {
  result.push(h);
  hubCount++;
});

// ─── 出力 ─────────────────────────────────────────────────────────────────────
fs.writeFileSync(src, JSON.stringify(result, null, 2), 'utf8');

console.log('=== 変換完了 ===');
console.log(`hub数        : ${hubCount}`);
console.log(`destination数: ${destCount}`);
console.log(`spot数       : ${spotCount}`);
console.log(`---`);
console.log(`型変更       : urban/local/island → hub/destination (${typeChanges}件)`);
console.log(`parentDestination追加: ${parentAdded}件`);
console.log(`新規hub追加  : ${NEW_HUBS.length}件 (${NEW_HUBS.map(h=>h.name).join(', ')})`);

// 未解決チェック
const final = JSON.parse(fs.readFileSync(src, 'utf8'));
const finalIds = new Set(final.map(x => x.id));
const orphans = final.filter(x => x.type === 'spot' && !finalIds.has(x.parentDestination));
if (orphans.length > 0) {
  console.log(`\n⚠ 未解決parentDestination: ${orphans.length}件`);
  orphans.forEach(o => console.log(`  ${o.id} → "${o.parentDestination}"`));
} else {
  console.log(`\n✓ 全spot.parentDestination解決済み`);
}
