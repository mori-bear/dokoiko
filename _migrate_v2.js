/**
 * destinations_v2.json 生成スクリプト
 *
 * - hubStation / accessStation / city フィールドを全 destination に追加
 * - tags を標準候補（温泉/海/山/自然/歴史/城/街歩き/寺社/渓谷/滝/離島/秘境）に統一
 * - 広域エリア 三陸 → 宮古/釜石/大船渡/久慈 に分割
 * - 広域エリア 能登 → 珠洲 に置換
 * - GoogleMaps origin = 出発地代表駅, destination = accessStation
 * - travelTime は departure → hubStation で算出（既存フィールド維持）
 */

'use strict';
const fs = require('fs');

const src  = JSON.parse(fs.readFileSync('./src/data/destinations.json', 'utf8'));

/* ══════════════════════════════════════════════════════
   タグ正規化
   標準タグ: 温泉 海 山 自然 歴史 城 街歩き 寺社 渓谷 滝 離島 秘境
══════════════════════════════════════════════════════ */
const TAG_MAP = {
  // 温泉
  '温泉':'温泉','湯':'温泉','スパ':'温泉','銭湯':'温泉',
  // 海
  '海':'海','ビーチ':'海','珊瑚礁':'海','海岸':'海','サンゴ':'海','ダイビング':'海','シュノーケル':'海','釣り':'海','漁師':'海','港':'海',
  // 山
  '山':'山','高原':'山','スキー':'山','登山':'山','アルプス':'山','トレッキング':'山','ハイキング':'山','火山':'山','峠':'山','雪':'山',
  // 自然
  '自然':'自然','湖':'自然','草原':'自然','ラベンダー':'自然','農場':'自然','原生林':'自然','森':'自然','野生':'自然','花':'自然','花畑':'自然','田園':'自然','里山':'自然','田舎':'自然',
  // 歴史
  '歴史':'歴史','古都':'歴史','城下町':'歴史','武家屋敷':'歴史','宿場町':'歴史','遺跡':'歴史','重文':'歴史','史跡':'歴史','古民家':'歴史','文化財':'歴史','古墳':'歴史','民話':'歴史','伝統':'歴史','工芸':'歴史','漆':'歴史','焼物':'歴史','陶器':'歴史','朝市':'歴史','商家':'歴史',
  // 城
  '城':'城','天守':'城','お城':'城',
  // 街歩き
  '街歩き':'街歩き','町並み':'街歩き','レトロ':'街歩き','カフェ':'街歩き','グルメ':'街歩き','食':'街歩き','市場':'街歩き','老舗':'街歩き',
  // 寺社
  '寺社':'寺社','神社':'寺社','仏閣':'寺社','寺':'寺社','霊場':'寺社','巡礼':'寺社','修道':'寺社','御朱印':'寺社','大仏':'寺社','参道':'寺社','鳥居':'寺社',
  // 渓谷
  '渓谷':'渓谷','峡谷':'渓谷','ゴルジュ':'渓谷',
  // 滝
  '滝':'滝',
  // 離島
  '離島':'離島','島':'離島',
  // 秘境
  '秘境':'秘境','隠れ':'秘境','奥地':'秘境','辺境':'秘境',
};

const STANDARD_TAGS = new Set(['温泉','海','山','自然','歴史','城','街歩き','寺社','渓谷','滝','離島','秘境']);

function normalizeTags(dest) {
  const result = new Set();
  // destType による自動付与
  if (dest.destType === 'onsen') result.add('温泉');
  if (dest.isIsland || dest.destType === 'island') result.add('離島');
  // 既存タグ → 正規化
  for (const tag of (dest.tags || [])) {
    if (STANDARD_TAGS.has(tag)) { result.add(tag); continue; }
    for (const [kw, std] of Object.entries(TAG_MAP)) {
      if (tag.includes(kw)) { result.add(std); break; }
    }
  }
  // description からの推定
  const desc = (dest.description || '') + ' ' + (dest.spots || []).join(' ');
  for (const [kw, std] of Object.entries(TAG_MAP)) {
    if (desc.includes(kw)) result.add(std);
  }
  return [...result].filter(t => STANDARD_TAGS.has(t));
}

/* ══════════════════════════════════════════════════════
   hubStation / accessStation / city ルックアップ
   形式: id → { hubStation, accessStation, city }

   hubStation  = 新幹線・特急停車の主要乗換駅
   accessStation = 実際の到着駅・港・バスターミナル
   city          = 行政上の市区町村名
══════════════════════════════════════════════════════ */
const STATION_LOOKUP = {
  // ── 北海道 ──
  'otaru':           { hub:'新千歳空港',       access:'小樽駅',           city:'小樽市' },
  'furano':          { hub:'旭川駅',            access:'富良野駅',          city:'富良野市' },
  'biei':            { hub:'旭川駅',            access:'美瑛駅',            city:'美瑛町' },
  'toyako':          { hub:'洞爺駅',            access:'洞爺駅',            city:'洞爺湖町' },
  'noboribetsu':     { hub:'登別駅',            access:'登別駅',            city:'登別市' },
  'jozankei':        { hub:'札幌駅',            access:'札幌駅',            city:'札幌市' },
  'shiretoko':       { hub:'知床斜里駅',         access:'知床斜里駅',         city:'斜里町' },
  'akan':            { hub:'釧路駅',            access:'釧路駅',            city:'釧路市' },
  'sounkyo':         { hub:'上川駅',            access:'層雲峡バスターミナル', city:'上川町' },
  'rebun':           { hub:'稚内駅',            access:'香深港',            city:'礼文町' },
  'rishiri':         { hub:'稚内駅',            access:'鴛泊港',            city:'利尻富士町' },
  'shikotsu':        { hub:'千歳駅',            access:'支笏湖バス停',        city:'千歳市' },
  'abashiri':        { hub:'網走駅',            access:'網走駅',            city:'網走市' },
  'shakotan':        { hub:'小樽駅',            access:'積丹バスターミナル',   city:'積丹町' },
  // ── 東北 ──
  'matsushima':      { hub:'仙台駅',            access:'松島海岸駅',         city:'松島町' },
  'hiraizumi':       { hub:'一ノ関駅',           access:'平泉駅',            city:'平泉町' },
  'kakunodate':      { hub:'盛岡駅',            access:'角館駅',            city:'仙北市' },
  'aizuwakamatsu':   { hub:'郡山駅',            access:'会津若松駅',         city:'会津若松市' },
  'zao':             { hub:'山形駅',            access:'蔵王駅',            city:'蔵王町' },
  'towada-oirase':   { hub:'八戸駅',            access:'奥入瀬渓流バス停',    city:'十和田市' },
  'tono':            { hub:'新花巻駅',           access:'遠野駅',            city:'遠野市' },
  'oga':             { hub:'秋田駅',            access:'男鹿駅',            city:'男鹿市' },
  'yonezawa':        { hub:'米沢駅',            access:'米沢駅',            city:'米沢市' },
  'dewa-sanzan':     { hub:'鶴岡駅',            access:'鶴岡駅',            city:'鶴岡市' },
  'akiu-onsen':      { hub:'仙台駅',            access:'仙台駅',            city:'仙台市' },
  'goshogawara':     { hub:'青森駅',            access:'五所川原駅',         city:'五所川原市' },
  'hirosaki':        { hub:'新青森駅',           access:'弘前駅',            city:'弘前市' },
  'ginzan-onsen':    { hub:'大石田駅',           access:'大石田駅',           city:'尾花沢市' },
  'naruko-onsen':    { hub:'古川駅',            access:'鳴子温泉駅',         city:'大崎市' },
  'sakata':          { hub:'新庄駅',            access:'酒田駅',            city:'酒田市' },
  // 三陸（既存エントリ）
  'miyako-iwate':    { hub:'盛岡駅',            access:'宮古駅',            city:'宮古市' },
  // ── 関東 ──
  'kamakura':        { hub:'東京駅',            access:'鎌倉駅',            city:'鎌倉市' },
  'atami':           { hub:'熱海駅',            access:'熱海駅',            city:'熱海市' },
  'nikko':           { hub:'宇都宮駅',           access:'日光駅',            city:'日光市' },
  'karuizawa':       { hub:'軽井沢駅',           access:'軽井沢駅',           city:'軽井沢町' },
  'kawaguchiko':     { hub:'大月駅',            access:'河口湖駅',           city:'富士河口湖町' },
  'hakone':          { hub:'小田原駅',           access:'箱根湯本駅',         city:'箱根町' },
  'shuzenji':        { hub:'三島駅',            access:'修善寺駅',           city:'伊豆市' },
  'kusatsu-onsen':   { hub:'長野原草津口駅',      access:'草津温泉バスターミナル', city:'草津町' },
  'shimoda':         { hub:'熱海駅',            access:'伊豆急下田駅',        city:'下田市' },
  'takaosam':        { hub:'八王子駅',           access:'高尾山口駅',         city:'八王子市' },
  'tateyama':        { hub:'千葉駅',            access:'館山駅',            city:'館山市' },
  'nasu':            { hub:'那須塩原駅',          access:'那須塩原駅',         city:'那須町' },
  'shiobara-onsen':  { hub:'那須塩原駅',          access:'那須塩原駅',         city:'那須塩原市' },
  'mashiko':         { hub:'宇都宮駅',           access:'益子駅',            city:'益子町' },
  'kawagoe':         { hub:'大宮駅',            access:'川越駅',            city:'川越市' },
  'choshi':          { hub:'千葉駅',            access:'銚子駅',            city:'銚子市' },
  'ashikaga':        { hub:'小山駅',            access:'足利駅',            city:'足利市' },
  'kiyosato':        { hub:'小淵沢駅',           access:'清里駅',            city:'北杜市' },
  'tenryu-kyo':      { hub:'飯田駅',            access:'天竜峡駅',           city:'飯田市' },
  'suwa':            { hub:'塩尻駅',            access:'上諏訪駅',           city:'諏訪市' },
  'ito':             { hub:'熱海駅',            access:'伊東駅',            city:'伊東市' },
  'izu-kogen':       { hub:'熱海駅',            access:'伊豆高原駅',         city:'伊東市' },
  'minami-izu':      { hub:'下田駅',            access:'下田駅',            city:'南伊豆町' },
  // ── 中部 ──
  'takayama':        { hub:'名古屋駅',           access:'高山駅',            city:'高山市' },
  'shirakawago':     { hub:'金沢駅',            access:'白川郷バスターミナル',  city:'白川村' },
  'gokayama':        { hub:'金沢駅',            access:'五箇山バス停',         city:'南砺市' },
  'kamikochi':       { hub:'松本駅',            access:'上高地バスターミナル',  city:'松本市' },
  'hakuba':          { hub:'長野駅',            access:'白馬駅',            city:'白馬村' },
  'tateyama-kurobe': { hub:'富山駅',            access:'立山駅',            city:'立山町' },
  'obuse':           { hub:'長野駅',            access:'小布施駅',           city:'小布施町' },
  'matsushiro':      { hub:'長野駅',            access:'長野駅',            city:'長野市' },
  'iiyama':          { hub:'飯山駅',            access:'飯山駅',            city:'飯山市' },
  'nozawa-onsen':    { hub:'飯山駅',            access:'飯山駅',            city:'野沢温泉村' },
  'bessho-onsen':    { hub:'上田駅',            access:'別所温泉駅',         city:'上田市' },
  'wajima':          { hub:'金沢駅',            access:'輪島バスターミナル',   city:'輪島市' },
  'kaga-onsen':      { hub:'加賀温泉駅',          access:'加賀温泉駅',         city:'加賀市' },
  'wakura-onsen':    { hub:'和倉温泉駅',          access:'和倉温泉駅',         city:'七尾市' },
  'noto':            { hub:'金沢駅',            access:'珠洲バスターミナル',   city:'珠洲市' }, // → 珠洲
  'himi':            { hub:'高岡駅',            access:'氷見駅',            city:'氷見市' },
  'okuhida-onsen':   { hub:'高山駅',            access:'平湯温泉バスターミナル', city:'高山市' },
  'gero-onsen':      { hub:'下呂駅',            access:'下呂駅',            city:'下呂市' },
  'kiso':            { hub:'名古屋駅',           access:'南木曽駅',           city:'木曽町' },
  'magome':          { hub:'名古屋駅',           access:'中津川駅',           city:'中津川市' },
  'tsumago':         { hub:'名古屋駅',           access:'南木曽駅',           city:'木曽町' },
  'inuyama':         { hub:'名古屋駅',           access:'犬山駅',            city:'犬山市' },
  'mino':            { hub:'名古屋駅',           access:'美濃市駅',           city:'美濃市' },
  'kiyomigahara':    { hub:'名古屋駅',           access:'可児川駅',           city:'可児市' },
  // ── 近畿 ──
  'nara':            { hub:'京都駅',            access:'奈良駅',            city:'奈良市' },
  'ise':             { hub:'名古屋駅',           access:'伊勢市駅',           city:'伊勢市' },
  'toba':            { hub:'名古屋駅',           access:'鳥羽駅',            city:'鳥羽市' },
  'arima-onsen':     { hub:'三ノ宮駅',           access:'有馬温泉駅',         city:'神戸市' },
  'kinosaki-onsen':  { hub:'城崎温泉駅',          access:'城崎温泉駅',         city:'豊岡市' },
  'amanohashidate':  { hub:'福知山駅',           access:'天橋立駅',           city:'宮津市' },
  'ine':             { hub:'天橋立駅',           access:'伊根港バス停',         city:'伊根町' },
  'yoshino':         { hub:'橿原神宮前駅',         access:'吉野駅',            city:'吉野町' },
  'asuka':           { hub:'橿原神宮前駅',         access:'飛鳥駅',            city:'明日香村' },
  'kashihara':       { hub:'大阪駅',            access:'橿原神宮前駅',         city:'橿原市' },
  'koyasan':         { hub:'橋本駅',            access:'高野山駅',           city:'高野町' },
  'kumano':          { hub:'新宮駅',            access:'新宮駅',            city:'熊野市' },
  'tanabe':          { hub:'紀伊田辺駅',          access:'紀伊田辺駅',         city:'田辺市' },
  'shirahama':       { hub:'紀伊田辺駅',          access:'白浜駅',            city:'白浜町' },
  'yunomineonsen':   { hub:'新宮駅',            access:'新宮駅',            city:'田辺市' },
  'totsukawa':       { hub:'五条駅',            access:'五条駅',            city:'十津川村' },
  'miyama':          { hub:'園部駅',            access:'園部駅',            city:'南丹市' },
  'maizuru':         { hub:'東舞鶴駅',           access:'東舞鶴駅',           city:'舞鶴市' },
  'awajishima':      { hub:'三ノ宮駅',           access:'三ノ宮駅',           city:'淡路市' },
  'izushi':          { hub:'豊岡駅',            access:'豊岡駅',            city:'豊岡市' },
  'eiheiji':         { hub:'福井駅',            access:'永平寺口駅',         city:'永平寺町' },
  'wakasa-obama':    { hub:'敦賀駅',            access:'小浜駅',            city:'小浜市' },
  'echizen':         { hub:'福井駅',            access:'武生駅',            city:'越前市' },
  'tsuruga':         { hub:'敦賀駅',            access:'敦賀駅',            city:'敦賀市' },
  'nagahama':        { hub:'米原駅',            access:'長浜駅',            city:'長浜市' },
  'hikone':          { hub:'米原駅',            access:'彦根駅',            city:'彦根市' },
  'ryujin-onsen':    { hub:'紀伊田辺駅',          access:'紀伊田辺駅',         city:'田辺市' },
  // ── 中国 ──
  'onomichi':        { hub:'福山駅',            access:'尾道駅',            city:'尾道市' },
  'kurashiki':       { hub:'岡山駅',            access:'倉敷駅',            city:'倉敷市' },
  'mihonoseki':      { hub:'松江駅',            access:'境港駅',            city:'松江市' },
  'izumo':           { hub:'松江駅',            access:'出雲市駅',           city:'出雲市' },
  'okukumo':         { hub:'松江駅',            access:'木次駅',            city:'雲南市' },
  'tsuwano':         { hub:'新山口駅',           access:'津和野駅',           city:'津和野町' },
  'iwakuni':         { hub:'広島駅',            access:'岩国駅',            city:'岩国市' },
  'hagi':            { hub:'新山口駅',           access:'萩駅',             city:'萩市' },
  'shimonoseki':     { hub:'博多駅',            access:'下関駅',            city:'下関市' },
  'takehara':        { hub:'広島駅',            access:'竹原駅',            city:'竹原市' },
  'misasa-onsen':    { hub:'倉吉駅',            access:'倉吉駅',            city:'三朝町' },
  'daisen':          { hub:'米子駅',            access:'米子駅',            city:'大山町' },
  'tottori':         { hub:'鳥取駅',            access:'鳥取駅',            city:'鳥取市' },
  'kurayoshi':       { hub:'倉吉駅',            access:'倉吉駅',            city:'倉吉市' },
  'iwami-ginzan':    { hub:'大田市駅',           access:'大田市駅',           city:'大田市' },
  'yunotsu-onsen':   { hub:'大田市駅',           access:'温泉津駅',           city:'大田市' },
  'takahashi':       { hub:'岡山駅',            access:'備中高梁駅',         city:'高梁市' },
  'tsuyama':         { hub:'岡山駅',            access:'津山駅',            city:'津山市' },
  'yakage':          { hub:'岡山駅',            access:'矢掛駅',            city:'矢掛町' },
  'suo-oshima':      { hub:'広島駅',            access:'大畠駅',            city:'周防大島町' },
  'moji-ko':         { hub:'博多駅',            access:'門司港駅',           city:'北九州市' },
  'itoshima':        { hub:'博多駅',            access:'筑前前原駅',         city:'糸島市' },
  // ── 四国 ──
  'kotohira':        { hub:'高松駅',            access:'琴電琴平駅',         city:'琴平町' },
  'oboke':           { hub:'高松駅',            access:'大歩危駅',           city:'三好市' },
  'iya':             { hub:'阿波池田駅',          access:'阿波池田駅',         city:'三好市' },
  'uwajima':         { hub:'松山駅',            access:'宇和島駅',           city:'宇和島市' },
  'uchiko':          { hub:'松山駅',            access:'内子駅',            city:'内子町' },
  'imabari':         { hub:'松山駅',            access:'今治駅',            city:'今治市' },
  'ozu':             { hub:'松山駅',            access:'伊予大洲駅',         city:'大洲市' },
  'nishiiyo':        { hub:'松山駅',            access:'宇和島駅',           city:'西予市' },
  'tobe':            { hub:'松山駅',            access:'松山駅',            city:'砥部町' },
  'ashizuri':        { hub:'高知駅',            access:'宿毛駅',            city:'土佐清水市' },
  'muroto':          { hub:'高知駅',            access:'高知駅',            city:'室戸市' },
  'tosashimizu':     { hub:'高知駅',            access:'中村駅',            city:'土佐清水市' },
  'kashiwajima':     { hub:'宿毛駅',            access:'宿毛駅',            city:'大月町' },
  'shimanto':        { hub:'高知駅',            access:'江川崎駅',           city:'四万十市' },
  'tsurugi':         { hub:'阿波池田駅',          access:'貞光駅',            city:'つるぎ町' },
  'saijo':           { hub:'松山駅',            access:'伊予西条駅',         city:'西条市' },
  // ── 九州 ──
  'beppu':           { hub:'大分駅',            access:'別府駅',            city:'別府市' },
  'yufuin':          { hub:'大分駅',            access:'由布院駅',           city:'由布市' },
  'kurokawa-onsen':  { hub:'熊本駅',            access:'熊本駅',            city:'南小国町' },
  'aso':             { hub:'熊本駅',            access:'阿蘇駅',            city:'阿蘇市' },
  'minami-aso':      { hub:'熊本駅',            access:'熊本駅',            city:'南阿蘇村' },
  'amakusa':         { hub:'熊本駅',            access:'熊本駅',            city:'天草市' },
  'takachiho':       { hub:'熊本駅',            access:'熊本駅',            city:'高千穂町' },
  'ibusuki':         { hub:'鹿児島中央駅',        access:'指宿駅',            city:'指宿市' },
  'hitoyoshi':       { hub:'熊本駅',            access:'人吉駅',            city:'人吉市' },
  'unzen':           { hub:'諫早駅',            access:'諫早駅',            city:'雲仙市' },
  'sasebo':          { hub:'博多駅',            access:'佐世保駅',           city:'佐世保市' },
  'hirado':          { hub:'佐世保駅',           access:'佐世保駅',           city:'平戸市' },
  'shimabara':       { hub:'諫早駅',            access:'島原駅',            city:'島原市' },
  'takeo-onsen':     { hub:'武雄温泉駅',          access:'武雄温泉駅',         city:'武雄市' },
  'ureshino-onsen':  { hub:'嬉野温泉駅',          access:'嬉野温泉駅',         city:'嬉野市' },
  'hasami':          { hub:'川棚温泉駅',          access:'川棚温泉駅',         city:'波佐見町' },
  'kitsuki':         { hub:'杵築駅',            access:'杵築駅',            city:'杵築市' },
  'taketa':          { hub:'豊後竹田駅',          access:'豊後竹田駅',         city:'竹田市' },
  'hita':            { hub:'久留米駅',           access:'日田駅',            city:'日田市' },
  'usuki':           { hub:'大分駅',            access:'臼杵駅',            city:'臼杵市' },
  'bungo-takada':    { hub:'宇佐駅',            access:'宇佐駅',            city:'豊後高田市' },
  'kikuchi':         { hub:'熊本駅',            access:'熊本駅',            city:'菊池市' },
  'nobeoka':         { hub:'宮崎駅',            access:'延岡駅',            city:'延岡市' },
  'nichinan':        { hub:'宮崎駅',            access:'日南駅',            city:'日南市' },
  'obi':             { hub:'宮崎駅',            access:'飫肥駅',            city:'日南市' },
  'saga-sefuri':     { hub:'武雄温泉駅',          access:'武雄温泉駅',         city:'武雄市' },
  // ── 離島（九州） ──
  'yakushima':       { hub:'鹿児島港',           access:'安房港',            city:'屋久島町' },
  'tanegashima':     { hub:'鹿児島空港',          access:'西之表港',           city:'西之表市' },
  'goto':            { hub:'長崎港',            access:'福江港',            city:'五島市' },
  'tsushima':        { hub:'福岡空港',           access:'対馬空港',           city:'対馬市' },
  'iki':             { hub:'博多港',            access:'印通寺港',           city:'壱岐市' },
  'amami-oshima':    { hub:'鹿児島空港',          access:'奄美空港',           city:'奄美市' },
  // ── 離島（瀬戸内） ──
  'naoshima':        { hub:'高松駅',            access:'宮浦港',            city:'直島町' },
  'shodoshima':      { hub:'高松駅',            access:'池田港',            city:'小豆島町' },
  'shishijima':      { hub:'詫間駅',            access:'志々島港',           city:'三豊市' },
  'oshima-iyo':      { hub:'今治駅',            access:'小島港',            city:'今治市' },
  // ── 離島（伊豆） ──
  'izu-oshima':      { hub:'東京竹芝',           access:'元町港',            city:'大島町' },
  'kozushima':       { hub:'東京竹芝',           access:'前浜港',            city:'神津島村' },
  // ── 離島（沖縄） ──
  'ishigaki':        { hub:'那覇空港',           access:'石垣空港',           city:'石垣市' },
  'iriomote':        { hub:'石垣港',            access:'大原港',            city:'竹富町' },
  'taketomi':        { hub:'石垣港',            access:'竹富港',            city:'竹富町' },
  'yonaguni-island': { hub:'那覇空港',           access:'与那国空港',         city:'与那国町' },
  'nakijin':         { hub:'那覇空港',           access:'那覇バスターミナル',   city:'今帰仁村' },
  'motobu':          { hub:'那覇空港',           access:'那覇バスターミナル',   city:'本部町' },
  'zamami':          { hub:'那覇港',            access:'座間味港',           city:'座間味村' },
  'ie-jima':         { hub:'本部港',            access:'伊江島港',           city:'伊江村' },
  'kohama':          { hub:'石垣港',            access:'小浜港',            city:'竹富町' },
  'tokashiki':       { hub:'那覇港',            access:'渡嘉敷港',           city:'渡嘉敷村' },
  'kumejima':        { hub:'那覇空港',           access:'久米島空港',         city:'久米島町' },
  'miyakojima':      { hub:'那覇空港',           access:'宮古空港',           city:'宮古島市' },
  // ── 宮島 ──
  'miyajima':        { hub:'広島駅',            access:'宮島口港',           city:'廿日市市' },
  // ── 近畿（追加） ──
  'nachi-katsuura':  { hub:'新宮駅',            access:'紀伊勝浦駅',         city:'那智勝浦町' },
  // ── 山陰 ──
  'matsue-castle':   { hub:'松江駅',            access:'松江駅',            city:'松江市' },
  // ── その他 ──
  'sado':            { hub:'新潟駅',            access:'両津港',            city:'佐渡市' },
};

/* ══════════════════════════════════════════════════════
   三陸 分割データ（宮古は既存 miyako-iwate を流用、新規3件を追加）
══════════════════════════════════════════════════════ */
const SANRIKU_CITIES = [
  {
    id: 'kamaishi',
    name: '釜石',
    type: 'destination',
    region: '東北',
    prefecture: '岩手県',
    destType: 'city',
    hub: 'morioka',
    hotelHub: '釜石',
    stayAllowed: ['1night'],
    weight: 1.2,
    description: '製鉄の街から観光の街へ。根浜海岸と鉄の歴史が共存するリアスの港。',
    tags: ['海', '歴史', '自然'],
    spots: ['根浜海岸', '橋野鉄鉱山', '釜石大観音'],
    railGateway: '釜石駅',
    secondaryTransport: null,
    needsCar: false,
    hubStation: '新花巻駅',
    accessStation: '釜石駅',
    city: '釜石市',
    lat: 39.2760, lng: 141.8859,
    travelTime: { tokyo: 240, osaka: 450, nagoya: 420, fukuoka: 510, takamatsu: 480 },
    stayRecommendation: '1night',
    hotelSearch: '釜石',
  },
  {
    id: 'ofunato',
    name: '大船渡',
    type: 'destination',
    region: '東北',
    prefecture: '岩手県',
    destType: 'city',
    hub: 'ichinoseki',
    hotelHub: '大船渡',
    stayAllowed: ['1night'],
    weight: 1.2,
    description: '穏やかな湾に抱かれた漁師町。三陸さんまと碁石海岸が旅人を迎える。',
    tags: ['海', '自然', '歴史'],
    spots: ['碁石海岸', '大船渡魚市場', '三陸花火'],
    railGateway: '大船渡駅',
    secondaryTransport: null,
    needsCar: false,
    hubStation: '一ノ関駅',
    accessStation: '大船渡駅',
    city: '大船渡市',
    lat: 39.0823, lng: 141.7147,
    travelTime: { tokyo: 220, osaka: 430, nagoya: 400, fukuoka: 490, takamatsu: 460 },
    stayRecommendation: '1night',
    hotelSearch: '大船渡',
  },
  {
    id: 'kuji',
    name: '久慈',
    type: 'destination',
    region: '東北',
    prefecture: '岩手県',
    destType: 'city',
    hub: 'hachinohe',
    hotelHub: '久慈',
    stayAllowed: ['1night'],
    weight: 1.2,
    description: '琥珀の里として知られる北三陸の玄関口。あまちゃんのロケ地としても有名。',
    tags: ['海', '歴史', '自然'],
    spots: ['久慈琥珀博物館', '小袖海岸', '久慈駅'],
    railGateway: '久慈駅',
    secondaryTransport: null,
    needsCar: false,
    hubStation: '八戸駅',
    accessStation: '久慈駅',
    city: '久慈市',
    lat: 40.1906, lng: 141.7747,
    travelTime: { tokyo: 210, osaka: 420, nagoya: 390, fukuoka: 480, takamatsu: 450 },
    stayRecommendation: '1night',
    hotelSearch: '久慈',
  },
];

/* ══════════════════════════════════════════════════════
   能登 → 珠洲 置換データ
══════════════════════════════════════════════════════ */
const SUZU_ENTRY = {
  id: 'suzu',
  name: '珠洲',
  type: 'destination',
  region: '中部',
  prefecture: '石川県',
  destType: 'sight',
  hub: 'kanazawa-t',
  hotelHub: '珠洲',
  stayAllowed: ['1night', '2night'],
  weight: 1.2,
  description: '能登半島の最先端。禄剛崎の灯台、塩田、揚げ浜塩など奥能登の原風景が残る秘境の地。',
  tags: ['海', '自然', '歴史', '秘境'],
  spots: ['禄剛崎灯台', '珠洲岬', '揚げ浜式塩田'],
  railGateway: '金沢駅',
  secondaryTransport: 'bus',
  needsCar: true,
  gatewayHub: '金沢',
  hubStation: '金沢駅',
  accessStation: '珠洲バスターミナル',
  city: '珠洲市',
  lat: 37.4290, lng: 137.2648,
  travelTime: { tokyo: 300, osaka: 240, nagoya: 210, fukuoka: 360, takamatsu: 300 },
  stayRecommendation: '1night',
  hotelSearch: '珠洲 能登',
  gateways: { rail: ['金沢駅'], airport: [], bus: [], ferry: [] },
};

/* ══════════════════════════════════════════════════════
   メイン変換
══════════════════════════════════════════════════════ */
let result = [];

for (const d of src) {
  // 広域エリア: 三陸 → 削除（宮古は既存 miyako-iwate で残す、釜石/大船渡/久慈を後で追加）
  if (d.id === 'sanriku') continue;
  // 広域エリア: 能登 → 珠洲
  if (d.id === 'noto') {
    result.push(SUZU_ENTRY);
    continue;
  }

  // lookupからhubStation/accessStation/cityを取得
  const lk = STATION_LOOKUP[d.id] || {};
  const hub    = lk.hub    || d.railGateway || d.name + '駅';
  const access = lk.access || d.railGateway || d.name + '駅';
  const city   = lk.city   || d.prefecture?.replace(/[都道府県]$/, '') + d.name;

  // secondaryTransportを文字列に正規化
  let st = d.secondaryTransport;
  if (st && typeof st === 'object') st = st.type || 'bus';

  // hubStation/accessStation の論理
  // secondaryTransportがある = railGateway は乗換駅
  const hubStation    = hub;
  const accessStation = access;

  // タグ正規化
  const tags = normalizeTags(d);
  // destTypeがcityなら街歩きを追加
  if (d.destType === 'city' && !tags.includes('街歩き') && !tags.includes('歴史') && !tags.includes('温泉')) {
    tags.unshift('街歩き');
  }
  // tagsが空の場合 destType から補完
  if (tags.length === 0) {
    if (d.destType === 'onsen') tags.push('温泉');
    else if (d.destType === 'sight') tags.push('自然');
    else if (d.destType === 'city') tags.push('街歩き');
    else if (d.destType === 'island') tags.push('離島');
  }

  result.push({
    ...d,
    secondaryTransport: st || null,
    city,
    hubStation,
    accessStation,
    tags,
  });
}

// 三陸4都市を追加
result.push(...SANRIKU_CITIES);

// hub.jsonとのtype整合: destinations のみ（hub=falseのもの）
// destinations.json には type:'destination' のみ含まれているので変更なし

console.log('変換完了:', result.length, '件');

// 検証
const ids = result.map(r => r.id);
const dupIds = ids.filter((id, i) => ids.indexOf(id) !== i);
if (dupIds.length) console.warn('重複ID:', dupIds);

const noHub    = result.filter(r => !r.hubStation);
const noAccess = result.filter(r => !r.accessStation);
const noCity   = result.filter(r => !r.city);
const noTags   = result.filter(r => !r.tags || r.tags.length === 0);
console.log('hubStation欠落:', noHub.length, noHub.map(r=>r.name).join(','));
console.log('accessStation欠落:', noAccess.length, noAccess.map(r=>r.name).join(','));
console.log('city欠落:', noCity.length, noCity.map(r=>r.name).join(','));
console.log('tags空:', noTags.length, noTags.map(r=>r.name).join(','));

// サンプル表示
console.log('\n── サンプル ──');
['tono','kamakura','ishigaki','suzu','miyako-iwate','kamaishi'].forEach(id => {
  const d = result.find(r=>r.id===id);
  if (d) console.log(JSON.stringify({id:d.id,name:d.name,city:d.city,hubStation:d.hubStation,accessStation:d.accessStation,tags:d.tags}));
});

fs.writeFileSync('./src/data/destinations_v2.json', JSON.stringify(result, null, 2), 'utf8');
console.log('\n✓ src/data/destinations_v2.json 書き出し完了');
