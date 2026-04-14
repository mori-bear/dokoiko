/**
 * enrichDestinations.js — generated.json を自動エンリッチして UI で使える品質に昇格
 *
 * 入力: src/data/destinations/generated.json
 * 出力: src/data/destinations/enriched.json
 *
 * 自動生成する項目:
 *   - stayDescription（destType別テンプレ）
 *   - finalAccess（representativeCity + destType別手段）
 *   - transportHubs（最寄り駅推定：prefectureの代表駅）
 *   - tags / primary（destType別固定セット）
 *   - weight（destType別優先度）
 *   - railProvider（jrAreaから自動推定）
 *   - stayPriority（destTypeから推定）
 *
 * 使い方:
 *   node scripts/enrichDestinations.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..');
const INPUT_FILE  = path.join(PROJECT_ROOT, 'src/data/destinations/generated.json');
const OUTPUT_FILE = path.join(PROJECT_ROOT, 'src/data/destinations/enriched.json');
const PORTS_FILE  = path.join(PROJECT_ROOT, 'src/data/ports.json');

/* 既存ports.jsonで定義済みの港だけを有効フェリーゲートウェイとする */
const VALID_PORTS = new Set(
  JSON.parse(fs.readFileSync(PORTS_FILE, 'utf8')).map(p => p.port)
);

/* travelTime 5地域キー（qa.jsと同期） */
const TRAVEL_REF_KEYS = ['tokyo', 'nagoya', 'osaka', 'takamatsu', 'fukuoka'];
const TRAVEL_REF_COORDS = {
  tokyo:     { lat: 35.68, lng: 139.77 },
  nagoya:    { lat: 35.17, lng: 136.91 },
  osaka:     { lat: 34.69, lng: 135.50 },
  takamatsu: { lat: 34.34, lng: 134.05 },
  fukuoka:   { lat: 33.59, lng: 130.40 },
};

/** Haversine距離 */
function haversineKm(a, b) {
  const R = 6371;
  const dLat = (b.lat - a.lat) * Math.PI / 180;
  const dLng = (b.lng - a.lng) * Math.PI / 180;
  const h = Math.sin(dLat / 2) ** 2
    + Math.cos(a.lat * Math.PI / 180) * Math.cos(b.lat * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** 5地域それぞれへの推定移動時間（分） */
function computeTravelTime(dest) {
  const result = {};
  for (const key of TRAVEL_REF_KEYS) {
    const km = haversineKm(TRAVEL_REF_COORDS[key], dest);
    // 推定: 100km/h + 60分バッファ（乗換・最終アクセス）
    result[key] = Math.max(60, Math.round((km / 100) * 60 + 60));
  }
  return result;
}

/* ── 都道府県別 代表駅・railProvider ── */
const PREF_TO_STATION = {
  '北海道': { station: '札幌駅',         provider: 'ekinet',    area: 'east'   },
  '青森県': { station: '新青森駅',       provider: 'ekinet',    area: 'east'   },
  '岩手県': { station: '盛岡駅',         provider: 'ekinet',    area: 'east'   },
  '宮城県': { station: '仙台駅',         provider: 'ekinet',    area: 'east'   },
  '秋田県': { station: '秋田駅',         provider: 'ekinet',    area: 'east'   },
  '山形県': { station: '山形駅',         provider: 'ekinet',    area: 'east'   },
  '福島県': { station: '福島駅',         provider: 'ekinet',    area: 'east'   },
  '茨城県': { station: '水戸駅',         provider: 'ekinet',    area: 'east'   },
  '栃木県': { station: '宇都宮駅',       provider: 'ekinet',    area: 'east'   },
  '群馬県': { station: '高崎駅',         provider: 'ekinet',    area: 'east'   },
  '埼玉県': { station: '大宮駅',         provider: 'ekinet',    area: 'east'   },
  '千葉県': { station: '千葉駅',         provider: 'ekinet',    area: 'east'   },
  '東京都': { station: '東京駅',         provider: 'ekinet',    area: 'east'   },
  '神奈川県': { station: '横浜駅',       provider: 'ekinet',    area: 'east'   },
  '新潟県': { station: '新潟駅',         provider: 'ekinet',    area: 'east'   },
  '富山県': { station: '富山駅',         provider: 'e5489',     area: 'west'   },
  '石川県': { station: '金沢駅',         provider: 'e5489',     area: 'west'   },
  '福井県': { station: '福井駅',         provider: 'e5489',     area: 'west'   },
  '山梨県': { station: '甲府駅',         provider: 'ekinet',    area: 'east'   },
  '長野県': { station: '長野駅',         provider: 'ekinet',    area: 'east'   },
  '岐阜県': { station: '岐阜駅',         provider: 'e5489',     area: 'west'   },
  '静岡県': { station: '静岡駅',         provider: 'e5489',     area: 'west'   },
  '愛知県': { station: '名古屋駅',       provider: 'e5489',     area: 'west'   },
  '三重県': { station: '津駅',           provider: 'e5489',     area: 'west'   },
  '滋賀県': { station: '大津駅',         provider: 'e5489',     area: 'west'   },
  '京都府': { station: '京都駅',         provider: 'e5489',     area: 'west'   },
  '大阪府': { station: '大阪駅',         provider: 'e5489',     area: 'west'   },
  '兵庫県': { station: '三ノ宮駅',       provider: 'e5489',     area: 'west'   },
  '奈良県': { station: '奈良駅',         provider: 'e5489',     area: 'west'   },
  '和歌山県': { station: '和歌山駅',     provider: 'e5489',     area: 'west'   },
  '鳥取県': { station: '鳥取駅',         provider: 'e5489',     area: 'west'   },
  '島根県': { station: '松江駅',         provider: 'e5489',     area: 'west'   },
  '岡山県': { station: '岡山駅',         provider: 'e5489',     area: 'west'   },
  '広島県': { station: '広島駅',         provider: 'e5489',     area: 'west'   },
  '山口県': { station: '新山口駅',       provider: 'e5489',     area: 'west'   },
  '徳島県': { station: '徳島駅',         provider: 'e5489',     area: 'west'   },
  '香川県': { station: '高松駅',         provider: 'e5489',     area: 'west'   },
  '愛媛県': { station: '松山駅',         provider: 'e5489',     area: 'west'   },
  '高知県': { station: '高知駅',         provider: 'e5489',     area: 'west'   },
  '福岡県': { station: '博多駅',         provider: 'jrkyushu',  area: 'kyushu' },
  '佐賀県': { station: '佐賀駅',         provider: 'jrkyushu',  area: 'kyushu' },
  '長崎県': { station: '長崎駅',         provider: 'jrkyushu',  area: 'kyushu' },
  '熊本県': { station: '熊本駅',         provider: 'jrkyushu',  area: 'kyushu' },
  '大分県': { station: '大分駅',         provider: 'jrkyushu',  area: 'kyushu' },
  '宮崎県': { station: '宮崎駅',         provider: 'jrkyushu',  area: 'kyushu' },
  '鹿児島県': { station: '鹿児島中央駅', provider: 'jrkyushu',  area: 'kyushu' },
  '沖縄県': { station: '那覇空港',       provider: null,        area: null     },
};

/* ── destType別 固定テンプレ ── */
const TEMPLATES = {
  onsen: {
    stayDescription: '温泉に2回入って、部屋でゆっくりして寝る',
    tags:     ['温泉', '自然', '街歩き'],
    primary:  ['温泉'],
    secondary:['自然', '街歩き'],
    weight:   1.5,
    stayPriority: 'high',
    finalAccessMode: 'train',
    finalAccessLabel: 'バス',
    onsenLevel: 3,  // destType=onsen に相応しい値（qa.js [8o]要件）
  },
  island: {
    stayDescription: '昼と夕方で景色が変わるから、1泊して全部楽しむ',
    tags:     ['離島', '海', '自然'],
    primary:  ['離島', '海'],
    secondary:['自然'],
    weight:   1.3,
    stayPriority: 'medium',
    finalAccessMode: 'ferry',
    finalAccessLabel: 'フェリー',
    onsenLevel: 0,
  },
  mountain: {
    stayDescription: '朝の空気と景色が別物、泊まらないと味わえない',
    tags:     ['山', '自然', '絶景'],
    primary:  ['山', '自然'],
    secondary:['絶景'],
    weight:   1.2,
    stayPriority: 'low',
    finalAccessMode: 'bus',
    finalAccessLabel: 'バス',
    onsenLevel: 0,
  },
  sight: {
    stayDescription: '見どころが多く、1泊してゆっくり巡る',
    tags:     ['観光', '自然'],
    primary:  ['観光'],
    secondary:['自然'],
    weight:   1.0,
    stayPriority: 'medium',
    finalAccessMode: 'bus',
    finalAccessLabel: 'バス',
    onsenLevel: 0,
  },
};

/* ── 出発地（主要hub）リスト ── */
const MAIN_DEPARTURES = [
  '札幌', '仙台', '東京', '名古屋', '大阪', '広島', '福岡',
];

/* ── ヘルパー ── */

function truncate(text, max) {
  if (!text) return text;
  return text.length <= max ? text : text.slice(0, max - 1) + '…';
}

/* ── エンリッチ処理 ── */

function enrich(dest) {
  // island: 有効な port がない場合は sight に降格（QA整合性のため）
  let destType = dest.destType;
  if (destType === 'island') {
    const candidatePort = dest.name + '港';
    if (!VALID_PORTS.has(candidatePort)) {
      destType = 'sight';
    }
  }

  const tpl = TEMPLATES[destType] ?? TEMPLATES.sight;
  const prefInfo = PREF_TO_STATION[dest.prefecture] ?? {};
  const hubCity = dest.hubCity || prefInfo.station?.replace(/駅$/, '') || '東京';
  const travelTime = computeTravelTime(dest);
  const stayRec = destType === 'mountain' || destType === 'remote' || destType === 'island'
    ? '1night' : destType === 'onsen' ? '1night' : '1night';

  return {
    ...dest,
    destType,  // island → sight に降格される場合あり

    // ── テンプレから ──
    stayDescription: tpl.stayDescription,
    tags:      tpl.tags,
    primary:   tpl.primary,
    secondary: tpl.secondary,
    weight:    tpl.weight,
    stayPriority: tpl.stayPriority,
    onsenLevel: tpl.onsenLevel,

    // ── prefecture由来 ──
    accessStation: prefInfo.station ?? null,
    representativeStation: prefInfo.station ?? null,
    railProvider: prefInfo.provider ?? null,
    jrArea: prefInfo.area ?? null,

    // ── finalAccess（構造化）──
    finalAccess: {
      type: tpl.finalAccessMode,
      line: tpl.finalAccessMode === 'train' ? '在来線' : null,
      to: dest.name,
    },

    // ── 交通ハブ ──
    transportHubs: {
      rail: prefInfo.station ?? null,
      city: hubCity,
    },
    // gateway: accessStationと別の経由駅を指す。重複回避のためnull（手動で個別設定可）
    gateway: null,

    // ── 出発地リスト（全主要都市対応）──
    departures: MAIN_DEPARTURES,

    // ── 離島フラグ（降格後のdestTypeで判定） ──
    isIsland: destType === 'island',

    // ── その他必須フィールドのデフォルト ──
    hub: hubCity,
    stayAllowed: true,
    spots: [dest.name],
    description: tpl.stayDescription,
    catch: truncate(`${dest.name}で${tpl.stayDescription}`, 30),
    requiresCar: destType === 'mountain' || destType === 'remote',
    type: 'destination',
    subType: destType,
    city: hubCity,
    hubStation: prefInfo.station ?? null,
    hotelArea: dest.prefecture,
    hotelSearch: dest.name,
    hotelKeyword: dest.name,
    travelTime,
    stayRecommendation: stayRec,
    secondaryTransport: tpl.finalAccessMode === 'ferry' ? 'ferry' : 'bus',
    stayBias: tpl.stayPriority === 'high' ? 'destination' : 'hub',
    airportHub: null,
    situations: ['solo', 'couple', 'friends'],
    mapPoint: dest.name,
    railGateway: prefInfo.station ?? null,
    railNote: tpl.finalAccessMode === 'ferry' ? 'フェリー' : 'バス',
    hasDirectFlight: false,
    airportGateway: null,
    busGateway: null,
    // ferryGateway は ports.json で検証できない限り null（QA整合性のため）
    ferryGateway: null,

    // 空構造体（必須フィールド埋め）
    gateways: [],
    access: { steps: [] },
    localAccess: null,

    // エンリッチフラグ
    _enriched: true,
  };
}

/* ── メイン処理 ── */

function main() {
  console.log('[enrich] 開始');

  if (!fs.existsSync(INPUT_FILE)) {
    console.error(`[FATAL] ${INPUT_FILE} が見つかりません。先に generateDestinations.js を実行してください。`);
    process.exit(1);
  }

  const generated = JSON.parse(fs.readFileSync(INPUT_FILE, 'utf8'));
  console.log(`[enrich] 入力: ${generated.length} 件`);

  const enriched = generated.map(enrich);

  /* QA */
  const noStayDesc = enriched.filter(d => !d.stayDescription).length;
  const noFinalAccess = enriched.filter(d => !d.finalAccess).length;
  const noHubs = enriched.filter(d => !d.transportHubs).length;
  const noTags = enriched.filter(d => !d.tags?.length).length;
  const noWeight = enriched.filter(d => !d.weight).length;

  console.log('\n[QA]');
  console.log(`  stayDescription欠損: ${noStayDesc}`);
  console.log(`  finalAccess欠損: ${noFinalAccess}`);
  console.log(`  transportHubs欠損: ${noHubs}`);
  console.log(`  tags欠損: ${noTags}`);
  console.log(`  weight欠損: ${noWeight}`);

  if (noStayDesc + noFinalAccess + noHubs + noTags + noWeight > 0) {
    console.error('\n[FAIL] 必須フィールド欠損あり');
    process.exit(1);
  }

  /* 出力 */
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(enriched, null, 2));
  console.log(`\n[enrich] 出力: ${OUTPUT_FILE} (${enriched.length}件)`);

  /* destType分布 */
  const byType = {};
  for (const d of enriched) byType[d.destType] = (byType[d.destType] ?? 0) + 1;
  console.log('\n[destType分布]');
  Object.entries(byType).sort((a, b) => b[1] - a[1]).forEach(([t, n]) => {
    console.log(`  ${t}: ${n}件`);
  });

  console.log('\n[next] マージ時は src/data/destinations.json に追加 → node scripts/qa.js');
}

main();
