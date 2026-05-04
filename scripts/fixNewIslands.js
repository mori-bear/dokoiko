import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const destFile = path.join(__dirname, '../src/data/destinations.json');
const data = JSON.parse(fs.readFileSync(destFile, 'utf8'));

// Valid destTypes: city, sight, onsen, island, remote, mountain, peninsula
const ISLAND_DATA = {
  // ── tokyo-o hub ──
  'mikurajima': {
    ferry: ['御蔵島港'], accessStation: '御蔵島港', mapPoint: '御蔵島港',
    travelTime: { tokyo: 300, osaka: 500, nagoya: 515, fukuoka: 650, takamatsu: 600 },
    stayRecommendation: '1night', onsenLevel: 0, destType: 'island',
    spots: ['御蔵島港', 'イルカウォッチング', 'ハイキングコース'],
    stayDescription: '民宿のみ。予約は必須で定員が少ないため早めに確保を。',
  },
  'akiyamago': {
    rail: ['津南駅'], accessStation: '津南駅', mapPoint: '切明温泉',
    travelTime: { tokyo: 210, osaka: 400, nagoya: 350, fukuoka: 560, takamatsu: 510 },
    stayRecommendation: '1night', onsenLevel: 1, destType: 'remote',
    spots: ['秋山郷温泉', '切明温泉', '小赤沢温泉'],
    stayDescription: '温泉宿が数軒。冬季は道路閉鎖あり、訪問前に要確認。',
  },

  // ── hiroshima-t hub ──
  'hiburi': {
    ferry: ['宇和島港'], accessStation: '宇和島港', mapPoint: '日振島港',
    travelTime: { tokyo: 335, osaka: 195, nagoya: 250, fukuoka: 185, takamatsu: 205 },
    stayRecommendation: '1night', onsenLevel: 0, destType: 'island',
    spots: ['日振島港', 'ダイビングスポット', '漁村集落'],
    stayDescription: '民宿のみ。宇和島港からフェリーで約1時間。',
  },
  'toshima-uwajima': {
    ferry: ['宇和島港'], accessStation: '宇和島港', mapPoint: '戸島港',
    travelTime: { tokyo: 335, osaka: 195, nagoya: 250, fukuoka: 185, takamatsu: 205 },
    stayRecommendation: '1night', onsenLevel: 0, destType: 'island',
    spots: ['戸島港', 'カキ養殖場', '展望台'],
    stayDescription: '民宿のみ。カキシーズンは予約が取りにくい。',
  },
  'ukujima': {
    ferry: ['佐世保港'], accessStation: '佐世保港', mapPoint: '宇久平港',
    travelTime: { tokyo: 390, osaka: 250, nagoya: 305, fukuoka: 190, takamatsu: 310 },
    stayRecommendation: '1night', onsenLevel: 0, destType: 'island',
    spots: ['宇久平港', '宇久神社', '観光農園'],
    stayDescription: '民宿・ゲストハウスが中心。佐世保港から高速船約2時間。',
  },
  'okinoshima-kochi': {
    ferry: ['宿毛港'], accessStation: '宿毛港', mapPoint: '沖ノ島港',
    travelTime: { tokyo: 415, osaka: 275, nagoya: 330, fukuoka: 265, takamatsu: 285 },
    stayRecommendation: '1night', onsenLevel: 0, destType: 'island',
    spots: ['沖ノ島港', '弘法大師像', '遊歩道'],
    stayDescription: '民宿のみ。定期船は1日数便。天候により欠航あり。',
  },
  'kasadojima': {
    rail: ['光駅'], accessStation: '光駅', mapPoint: '長浜海水浴場',
    travelTime: { tokyo: 315, osaka: 175, nagoya: 230, fukuoka: 165, takamatsu: 185 },
    stayRecommendation: 'daytrip', onsenLevel: 0, destType: 'sight',
    isIslandOverride: false,
    spots: ['長浜海水浴場', '笠戸大橋', '笠戸島公園'],
    stayDescription: '日帰り向き。橋で陸続きのため車が便利。',
  },

  // ── naha hub ──
  'tonaki': {
    ferry: ['那覇泊港'], accessStation: '那覇泊港', mapPoint: '渡名喜港',
    travelTime: { tokyo: 180, osaka: 180, nagoya: 215, fukuoka: 180, takamatsu: 270 },
    stayRecommendation: '1night', onsenLevel: 0, destType: 'island',
    spots: ['渡名喜港', 'ハテノ浜', '渡名喜集落'],
    stayDescription: '民宿のみ。那覇から高速船約2時間半。週3便程度。',
  },
  'minamidaitojima': {
    airport: ['南大東空港'], accessStation: '南大東空港', mapPoint: '南大東島',
    travelTime: { tokyo: 180, osaka: 180, nagoya: 215, fukuoka: 180, takamatsu: 270 },
    stayRecommendation: '1night', onsenLevel: 0, destType: 'island',
    spots: ['南大東空港', 'ボスウェルスタジアム', 'バリハイ農場'],
    stayDescription: '民宿・ホテルあり。那覇から飛行機約55分。便数が少ない。',
  },
  'kitadaitojima': {
    airport: ['北大東空港'], accessStation: '北大東空港', mapPoint: '北大東島',
    travelTime: { tokyo: 180, osaka: 180, nagoya: 215, fukuoka: 180, takamatsu: 270 },
    stayRecommendation: '1night', onsenLevel: 0, destType: 'island',
    spots: ['北大東空港', '燐鉱石貯蔵庫跡', 'ジャネーガマ'],
    stayDescription: '民宿のみ。那覇から飛行機約1時間。便数が極めて少ない。',
  },

  // ── kagoshima hub ──
  'yorojima': {
    ferry: ['鹿児島港'], accessStation: '与論港', mapPoint: '与論港',
    travelTime: { tokyo: 180, osaka: 180, nagoya: 215, fukuoka: 180, takamatsu: 270 },
    stayRecommendation: '1night', onsenLevel: 0, destType: 'island',
    spots: ['百合ヶ浜', 'ケンタウロスビーチ', '与論城跡'],
    stayDescription: 'ホテル・民宿あり。鹿児島港からフェリーで約12時間。',
  },
  'kuchinoerabu': {
    ferry: ['枕崎港'], accessStation: '枕崎港', mapPoint: '口永良部島港',
    travelTime: { tokyo: 180, osaka: 180, nagoya: 215, fukuoka: 180, takamatsu: 270 },
    stayRecommendation: '1night', onsenLevel: 1, destType: 'island',
    spots: ['口永良部島港', '新岳', '湯向温泉'],
    stayDescription: '民宿のみ。活火山があり入島制限あり。要事前確認。',
  },

  // ── osaka-t hub ──
  'nishinoshima': {
    ferry: ['七類港'], accessStation: '七類港', mapPoint: '国賀海岸',
    travelTime: { tokyo: 420, osaka: 280, nagoya: 335, fukuoka: 270, takamatsu: 290 },
    stayRecommendation: '1night', onsenLevel: 0, destType: 'island',
    spots: ['別府港', '焼火神社', '国賀海岸'],
    stayDescription: 'ホテル・旅館あり。七類港からフェリーで約3時間。',
  },
  'nushima': {
    ferry: ['土生港'], accessStation: '土生港', mapPoint: '沼島港',
    travelTime: { tokyo: 255, osaka: 115, nagoya: 170, fukuoka: 265, takamatsu: 165 },
    stayRecommendation: 'daytrip', onsenLevel: 0, destType: 'island',
    spots: ['沼島港', '沼島八幡神社', '亀石'],
    stayDescription: '日帰り向き。土生港から定期船で約10分。',
  },

  // ── nagoya-t hub ──
  'sakushima': {
    ferry: ['師崎港'], accessStation: '師崎港', mapPoint: '大浦港',
    travelTime: { tokyo: 235, osaka: 205, nagoya: 150, fukuoka: 355, takamatsu: 305 },
    stayRecommendation: 'daytrip', onsenLevel: 0, destType: 'island',
    spots: ['大浦港', 'アート作品群', '佐久島弁天'],
    stayDescription: '日帰り向き。師崎港からフェリー約20分。',
  },
  'shinojima': {
    ferry: ['師崎港'], accessStation: '師崎港', mapPoint: '篠島港',
    travelTime: { tokyo: 225, osaka: 195, nagoya: 140, fukuoka: 345, takamatsu: 295 },
    stayRecommendation: 'daytrip', onsenLevel: 0, destType: 'island',
    spots: ['篠島港', '篠島神社', '海水浴場'],
    stayDescription: '日帰り向き。師崎港からフェリー約15分。',
  },
  'himakajima': {
    ferry: ['師崎港'], accessStation: '師崎港', mapPoint: '日間賀島港',
    travelTime: { tokyo: 225, osaka: 195, nagoya: 140, fukuoka: 345, takamatsu: 295 },
    stayRecommendation: 'daytrip', onsenLevel: 0, destType: 'island',
    spots: ['日間賀島港', 'タコ料理', 'フグ料理'],
    stayDescription: '宿泊も可。師崎港からフェリー約15分。タコ・フグが名物。',
  },
  'sugari': {
    rail: ['尾鷲駅'], accessStation: '尾鷲駅', mapPoint: '須賀利港',
    travelTime: { tokyo: 285, osaka: 255, nagoya: 200, fukuoka: 405, takamatsu: 355 },
    stayRecommendation: 'daytrip', onsenLevel: 0, destType: 'sight',
    spots: ['須賀利港', '須賀利の大クス', '漁村集落'],
    stayDescription: '日帰り向き。尾鷲からバスで約30分。',
  },
  'kuki': {
    rail: ['尾鷲駅'], accessStation: '尾鷲駅', mapPoint: '九鬼港',
    travelTime: { tokyo: 285, osaka: 255, nagoya: 200, fukuoka: 405, takamatsu: 355 },
    stayRecommendation: 'daytrip', onsenLevel: 0, destType: 'sight',
    spots: ['九鬼港', '九鬼城跡', '漁村散策'],
    stayDescription: '日帰り向き。尾鷲からバス・船でアクセス。',
  },
  'tateyamasaki': {
    rail: ['尾鷲駅'], accessStation: '尾鷲駅', mapPoint: '楯ヶ崎',
    travelTime: { tokyo: 285, osaka: 255, nagoya: 200, fukuoka: 405, takamatsu: 355 },
    stayRecommendation: 'daytrip', onsenLevel: 0, destType: 'sight',
    spots: ['楯ヶ崎', '海岸遊歩道', '漁港'],
    stayDescription: '日帰り向き。遊覧船でのアクセスが一般的。',
  },
  'furukawa-mie': {
    rail: ['松阪駅'], accessStation: '松阪駅', mapPoint: '古和浦港',
    travelTime: { tokyo: 255, osaka: 225, nagoya: 170, fukuoka: 375, takamatsu: 325 },
    stayRecommendation: 'daytrip', onsenLevel: 0, destType: 'sight',
    spots: ['古和浦港', 'カキ養殖場', '漁村風景'],
    stayDescription: '日帰り向き。カキ養殖が盛んな漁村。',
  },

  // ── sendai-t hub ──
  'hotokegaura': {
    rail: ['下北駅'], accessStation: '下北駅', mapPoint: '仏ヶ浦海岸',
    travelTime: { tokyo: 235, osaka: 375, nagoya: 320, fukuoka: 525, takamatsu: 475 },
    stayRecommendation: '1night', onsenLevel: 0, destType: 'sight',
    spots: ['仏ヶ浦海岸', '佐井港', '白い岩礁'],
    stayDescription: '下北半島に宿泊して翌日訪問が一般的。遊覧船でのアクセスが便利。',
  },
  'osorezan-area': {
    rail: ['下北駅'], accessStation: '下北駅', mapPoint: '恐山大師堂',
    travelTime: { tokyo: 225, osaka: 365, nagoya: 310, fukuoka: 515, takamatsu: 465 },
    stayRecommendation: '1night', onsenLevel: 2, destType: 'sight',
    spots: ['恐山大師堂', '宇曽利湖', '恐山温泉'],
    stayDescription: '恐山内の宿坊に宿泊可。冬季（11〜4月）閉山。',
  },
  'okitama': {
    rail: ['米沢駅'], accessStation: '米沢駅', mapPoint: '上杉神社',
    travelTime: { tokyo: 195, osaka: 335, nagoya: 280, fukuoka: 485, takamatsu: 435 },
    stayRecommendation: '1night', onsenLevel: 1, destType: 'sight',
    spots: ['米沢城跡', '上杉神社', '小野川温泉'],
    stayDescription: '米沢市内にホテル・旅館多数。小野川温泉も近い。',
  },

  // ── fukuoka-t hub ──
  'shiibamura': {
    rail: ['延岡駅'], accessStation: '延岡駅', mapPoint: '鶴富屋敷',
    travelTime: { tokyo: 510, osaka: 370, nagoya: 425, fukuoka: 220, takamatsu: 380 },
    stayRecommendation: '1night', onsenLevel: 0, destType: 'remote',
    spots: ['椎葉村役場', '鶴富屋敷', '山岳集落'],
    stayDescription: '民宿あり。延岡からバスで約2時間。山深い秘境集落。',
  },
  'noko-island': {
    ferry: ['姪浜渡船場'], accessStation: '姪浜渡船場', mapPoint: '能古渡船場',
    travelTime: { tokyo: 450, osaka: 310, nagoya: 365, fukuoka: 160, takamatsu: 320 },
    stayRecommendation: 'daytrip', onsenLevel: 0, destType: 'island',
    spots: ['能古渡船場', '能古島アイランドパーク', '花畑'],
    stayDescription: '日帰り向き。姪浜渡船場から船約10分。',
  },
};

let fixed = 0;
data.forEach(dest => {
  const patch = ISLAND_DATA[dest.id];
  if (!patch) return;

  // gateways
  if (!dest.gateways) dest.gateways = { rail: [], airport: [], bus: [], ferry: [] };
  if (patch.ferry && dest.gateways.ferry.length === 0) dest.gateways.ferry = patch.ferry;
  if (patch.rail && dest.gateways.rail.length === 0) dest.gateways.rail = patch.rail;
  if (patch.airport && (!dest.gateways.airport || dest.gateways.airport.length === 0)) {
    dest.gateways.airport = patch.airport;
  }

  // destType
  if (!dest.destType || !['city','sight','onsen','island','remote','mountain','peninsula'].includes(dest.destType)) {
    dest.destType = patch.destType;
  } else if (patch.isIslandOverride === false) {
    // kasadojimaは橋付き島: islandチェックから外す
    dest.destType = patch.destType;
    dest.isIsland = false;
  }

  // kasadojima専用: destType強制上書き
  if (dest.id === 'kasadojima') {
    dest.destType = 'sight';
    dest.isIsland = false;
  }

  // accessStation
  if (!dest.accessStation) dest.accessStation = patch.accessStation;

  // mapPoint
  if (!dest.mapPoint) dest.mapPoint = patch.mapPoint;

  // hubCity（既存パターン: 目的地名）
  if (!dest.hubCity) dest.hubCity = dest.name;

  // travelTime（5キー必須）
  if (!dest.travelTime || Object.values(dest.travelTime).every(v => v === null || v === undefined)) {
    dest.travelTime = { ...patch.travelTime };
  }

  // stayRecommendation
  if (!dest.stayRecommendation) dest.stayRecommendation = patch.stayRecommendation;

  // onsenLevel
  if (dest.onsenLevel === undefined || dest.onsenLevel === null) {
    dest.onsenLevel = patch.onsenLevel;
  }

  // spots（タグライン問題解消）
  if (!dest.spots || dest.spots.length === 0) dest.spots = patch.spots;

  // stayDescription
  if (!dest.stayDescription) dest.stayDescription = patch.stayDescription;

  fixed++;
  console.log(`✅ ${dest.name} (${dest.id}) 修正完了`);
});

// kiso / shikotsu の catch 短縮（31 → 30文字以内）
const catchFixes = {
  'kiso':     '江戸の旅人も嗅いだ檜の香り。妻籠、馬籠——静寂の街道。',
  'shikotsu': '凍らない湖が、静かにこちらを映している。北の冬の青。',
};
data.forEach(dest => {
  if (catchFixes[dest.id]) {
    console.log(`✂️  ${dest.name} catch: ${dest.catch.length}文字 → ${catchFixes[dest.id].length}文字`);
    dest.catch = catchFixes[dest.id];
    fixed++;
  }
});

fs.writeFileSync(destFile, JSON.stringify(data, null, 2), 'utf8');
console.log(`\n📊 ${fixed}件修正完了`);
