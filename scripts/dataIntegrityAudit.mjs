// STEP4 データ整合性
// - prefecture が VALID か
// - hubCity が destinations 内に存在するか
// - stayAllowed と access の矛盾
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(process.cwd());
const SRC = '/Users/moririn/MORI-LAB/projects/dokoiko-site/src/data/destinations.json';
const PUB = path.join(ROOT, 'data/destinations.json');
const dests = JSON.parse(fs.readFileSync(SRC, 'utf-8'));
const idMap = new Map(dests.map(d => [d.id, d]));
const nameMap = new Map();
for (const d of dests) {
  if (!nameMap.has(d.name)) nameMap.set(d.name, []);
  nameMap.get(d.name).push(d);
}

const VALID_PREFS = new Set([
  '北海道','青森県','岩手県','宮城県','秋田県','山形県','福島県',
  '茨城県','栃木県','群馬県','埼玉県','千葉県','東京都','神奈川県',
  '新潟県','富山県','石川県','福井県','山梨県','長野県',
  '岐阜県','静岡県','愛知県','三重県',
  '滋賀県','京都府','大阪府','兵庫県','奈良県','和歌山県',
  '鳥取県','島根県','岡山県','広島県','山口県',
  '徳島県','香川県','愛媛県','高知県',
  '福岡県','佐賀県','長崎県','熊本県','大分県','宮崎県','鹿児島県','沖縄県',
]);

const HONSHU = new Set([
  '青森県','岩手県','宮城県','秋田県','山形県','福島県',
  '茨城県','栃木県','群馬県','埼玉県','千葉県','東京都','神奈川県',
  '新潟県','富山県','石川県','福井県','山梨県','長野県',
  '岐阜県','静岡県','愛知県','三重県',
  '滋賀県','京都府','大阪府','兵庫県','奈良県','和歌山県',
  '鳥取県','島根県','岡山県','広島県','山口県',
]);

// 主要 hub 都市は destinations にない場合もあるので例外リスト
const KNOWN_HUB_CITIES = new Set(['東京','大阪','札幌','福岡','名古屋','京都','神戸','横浜','広島','仙台','金沢','那覇','鹿児島','熊本','長崎','静岡','岡山','高松','松山','函館','旭川','釧路','帯広','青森','盛岡','秋田','山形','福島','水戸','宇都宮','前橋','さいたま','千葉','新潟','富山','福井','甲府','長野','岐阜','津','大津','奈良','和歌山','鳥取','松江','山口','徳島','高知','佐賀','大分','宮崎']);

const issues = {
  invalidPrefecture: [],
  hubCityMissing: [],
  islandButRailOnly: [],
  honshuButFlightOnly: [],
  daytripWithFerryOnly: [],
  duplicateName: [],
};

// duplicate names
for (const [name, arr] of nameMap) {
  if (arr.length > 1) issues.duplicateName.push({ name, ids: arr.map(d => d.id) });
}

for (const d of dests) {
  // prefecture validity (複数県 destination は最初の県で確認)
  const prefHead = (d.prefecture || '').split(/[・,／\/]/)[0].trim();
  if (!d.prefecture || !VALID_PREFS.has(prefHead)) {
    issues.invalidPrefecture.push({ id: d.id, name: d.name, prefecture: d.prefecture });
  }
  // hubCity validity (destinations 内に存在 or 主要都市)
  const hub = d.hubCity || '';
  if (hub && hub !== d.name) {
    const hasInDests = nameMap.has(hub);
    const isKnown = KNOWN_HUB_CITIES.has(hub);
    if (!hasInDests && !isKnown) {
      issues.hubCityMissing.push({ id: d.id, name: d.name, hubCity: hub });
    }
  }
  // stayAllowed と access の矛盾
  const steps = d.access?.steps || [];
  const stepTypes = new Set(steps.map(s => s.type));
  const island = d.destType === 'island' || d.subType === 'island' || !!d.isIsland;
  const honshu = HONSHU.has(prefHead);
  if (island && !stepTypes.has('flight') && !stepTypes.has('ferry')
      && !(d.gateways?.airport || []).length && !(d.gateways?.ferry || []).length) {
    issues.islandButRailOnly.push({ id: d.id, name: d.name, prefecture: d.prefecture });
  }
  if (honshu && !island && steps[0]?.type === 'flight') {
    issues.honshuButFlightOnly.push({ id: d.id, name: d.name, prefecture: d.prefecture });
  }
  // daytrip だけなのに access に ferry/flight 必須は矛盾
  if (Array.isArray(d.stayAllowed) && d.stayAllowed.length === 1 && d.stayAllowed[0] === 'daytrip'
      && (stepTypes.has('flight') || stepTypes.has('ferry'))) {
    issues.daytripWithFerryOnly.push({ id: d.id, name: d.name, stayAllowed: d.stayAllowed, stepTypes: [...stepTypes] });
  }
}

const summary = {
  total: dests.length,
  invalidPrefecture: issues.invalidPrefecture.length,
  hubCityMissing: issues.hubCityMissing.length,
  islandButRailOnly: issues.islandButRailOnly.length,
  honshuButFlightOnly: issues.honshuButFlightOnly.length,
  daytripWithFerryOnly: issues.daytripWithFerryOnly.length,
  duplicateName: issues.duplicateName.length,
};
console.log('STEP4 data integrity:', summary);
fs.writeFileSync(path.join(ROOT, 'logs/dataIntegrity.json'), JSON.stringify({ summary, issues }, null, 2));
