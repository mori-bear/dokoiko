/**
 * generateOsakaRoutes.js
 * 大阪発 全299件ルートJSON生成
 * 実行: node scripts/generateOsakaRoutes.js
 */
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));
const root = join(__dir, '..');

const destinations = JSON.parse(readFileSync(join(root, 'src/data/destinations.json'), 'utf8'));

/* ── ルート部品 ── */
function s(type, from, to, line) {
  const obj = { type, to, line };
  if (from) obj.from = from;
  // reorder: type, from, to, line
  const o = { type };
  if (from) o.from = from;
  o.to = to;
  o.line = line;
  return o;
}

const OKAYAMA = s('rail', '新大阪', '岡山', '山陽新幹線');
const HIROSHIMA = s('rail', '新大阪', '広島', '山陽新幹線');
const SHIN_YAMAGUCHI = s('rail', '新大阪', '新山口', '山陽新幹線');
const FUKUYAMA = s('rail', '新大阪', '福山', '山陽新幹線');
const HAKATA = s('rail', '新大阪', '博多', '山陽・九州新幹線');
const KAGOSHIMA = s('rail', '新大阪', '鹿児島中央', '山陽・九州新幹線');
const TOKYO = s('rail', '新大阪', '東京', '東海道新幹線');
const NAGOYA = s('rail', '新大阪', '名古屋', '東海道新幹線');
const TSURUGA = s('rail', '大阪', '敦賀', '特急サンダーバード');
const KANAZAWA = s('rail', '敦賀', '金沢', '北陸新幹線');
const TOYAMA = s('rail', '敦賀', '富山', '北陸新幹線');
const NAGANO = s('rail', '敦賀', '長野', '北陸新幹線');
const ITAMI = s('bus', '大阪', '伊丹空港', 'リムジンバス');
const KANSAI = s('bus', '大阪', '関西国際空港', 'リムジンバス');
const FLIGHT_CHITOSE = s('flight', '伊丹空港', '新千歳空港', '直行便');
const FLIGHT_ASAHIKAWA = s('flight', '伊丹空港', '旭川空港', '直行便');
const FLIGHT_KUSHIRO = s('flight', '伊丹空港', '釧路空港', '直行便');
const FLIGHT_MEMANBETSU = s('flight', '伊丹空港', '女満別空港', '直行便');
const FLIGHT_HAKODATE = s('flight', '伊丹空港', '函館空港', '直行便');
const FLIGHT_OBIHIRO = s('flight', '伊丹空港', '帯広空港', '直行便');
const FLIGHT_NAHA = s('flight', '関西国際空港', '那覇空港', '直行便');
const FLIGHT_ISHIGAKI = s('flight', '関西国際空港', '石垣空港', '直行便');
const FLIGHT_MIYAKO = s('flight', '関西国際空港', '宮古空港', '直行便');
const FLIGHT_KUMEJIMA = s('flight', '関西国際空港', '久米島空港', '直行便');
const MARINE_LINER = s('rail', '岡山', '高松', '快速マリンライナー');
const THUNDERBIRD = [TSURUGA, KANAZAWA];
const THUNDERBIRD_TOYAMA = [TSURUGA, TOYAMA];
const THUNDERBIRD_NAGANO = [TSURUGA, NAGANO];
const HOKURIKU_VIA_KANAZAWA = [...THUNDERBIRD];

/* ── 中継ルート定義 ── */
const VIA_OKAYAMA = [OKAYAMA];
const VIA_HIROSHIMA = [HIROSHIMA];
const VIA_SHIN_YAMAGUCHI = [SHIN_YAMAGUCHI];
const VIA_HAKATA = [HAKATA];
const VIA_KAGOSHIMA = [KAGOSHIMA];
const VIA_TOKYO = [TOKYO];
const VIA_NAGOYA = [NAGOYA];
const VIA_KANAZAWA = [...THUNDERBIRD];
const VIA_TOYAMA = [...THUNDERBIRD_TOYAMA];
const VIA_NAGANO = [...THUNDERBIRD_NAGANO];
const VIA_TAKAMATSU = [OKAYAMA, MARINE_LINER];
const VIA_ITAMI_CHITOSE = [ITAMI, FLIGHT_CHITOSE];
const VIA_ITAMI_ASAHIKAWA = [ITAMI, FLIGHT_ASAHIKAWA];
const VIA_ITAMI_KUSHIRO = [ITAMI, FLIGHT_KUSHIRO];
const VIA_ITAMI_MEMANBETSU = [ITAMI, FLIGHT_MEMANBETSU];
const VIA_ITAMI_HAKODATE = [ITAMI, FLIGHT_HAKODATE];
const VIA_ITAMI_OBIHIRO = [ITAMI, FLIGHT_OBIHIRO];
const VIA_KANSAI_NAHA = [KANSAI, FLIGHT_NAHA];
const VIA_KANSAI_ISHIGAKI = [KANSAI, FLIGHT_ISHIGAKI];
const VIA_KANSAI_MIYAKO = [KANSAI, FLIGHT_MIYAKO];
const VIA_KANSAI_KUMEJIMA = [KANSAI, FLIGHT_KUMEJIMA];

/* ── ルート定義（目的地名 → {main, last, gateway}） ── */
const ROUTES = {

  /* ────── 関東 ────── */
  '鎌倉':      { main: [...VIA_TOKYO, s('rail','東京','鎌倉','JR横須賀線')], last: [], gateway: {main:'鎌倉',final:'鎌倉'} },
  '日光':      { main: [...VIA_TOKYO, s('rail','東京','日光','東武日光線')], last: [], gateway: {main:'日光',final:'日光'} },
  '箱根':      { main: [...VIA_TOKYO, s('rail','東京','箱根湯本','小田急ロマンスカー')], last: [], gateway: {main:'箱根湯本',final:'箱根湯本'} },
  '草津温泉':  { main: [...VIA_TOKYO, s('rail','東京','長野原草津口','JR吾妻線')], last: [s('bus','長野原草津口','草津温泉','バス')], gateway: {main:'長野原草津口',final:'草津温泉'} },
  '高尾山':    { main: [...VIA_TOKYO, s('rail','東京','高尾山口','JR中央線＋京王高尾線')], last: [], gateway: {main:'高尾山口',final:'高尾山口'} },
  '館山':      { main: [...VIA_TOKYO, s('rail','東京','館山','JR内房線')], last: [], gateway: {main:'館山',final:'館山'} },
  '四万温泉':  { main: [...VIA_TOKYO, s('rail','東京','中之条','JR吾妻線')], last: [s('bus','中之条','四万温泉','バス')], gateway: {main:'中之条',final:'四万温泉'} },
  '益子':      { main: [...VIA_TOKYO, s('rail','東京','益子','東北新幹線＋真岡鉄道')], last: [], gateway: {main:'益子',final:'益子'} },
  '水上温泉':  { main: [...VIA_TOKYO, s('rail','東京','水上','JR上越線')], last: [], gateway: {main:'水上',final:'水上'} },
  '川越':      { main: [...VIA_TOKYO, s('rail','東京','川越','JR川越線')], last: [], gateway: {main:'川越',final:'川越'} },
  '那須':      { main: [...VIA_TOKYO, s('rail','東京','那須塩原','東北新幹線')], last: [s('bus','那須塩原','那須','バス')], gateway: {main:'那須塩原',final:'那須'} },
  '銚子':      { main: [...VIA_TOKYO, s('rail','東京','銚子','JR総武本線')], last: [], gateway: {main:'銚子',final:'銚子'} },
  '足利':      { main: [...VIA_TOKYO, s('rail','東京','足利','JR両毛線')], last: [], gateway: {main:'足利',final:'足利'} },
  '塩原温泉':  { main: [...VIA_TOKYO, s('rail','東京','那須塩原','東北新幹線')], last: [s('bus','那須塩原','塩原温泉','バス')], gateway: {main:'那須塩原',final:'塩原温泉'} },
  '伊香保温泉':{ main: [...VIA_TOKYO, s('rail','東京','渋川','JR上越線')], last: [s('bus','渋川','伊香保温泉','バス')], gateway: {main:'渋川',final:'伊香保温泉'} },
  '江の島':    { main: [...VIA_TOKYO, s('rail','東京','片瀬江ノ島','小田急江ノ島線')], last: [], gateway: {main:'片瀬江ノ島',final:'片瀬江ノ島'} },
  '秩父':      { main: [...VIA_TOKYO, s('rail','東京','秩父','西武秩父線')], last: [], gateway: {main:'秩父',final:'秩父'} },
  '大洗':      { main: [...VIA_TOKYO, s('rail','東京','大洗','鹿島臨海鉄道')], last: [], gateway: {main:'大洗',final:'大洗'} },
  '佐野':      { main: [...VIA_TOKYO, s('rail','東京','佐野','JR両毛線')], last: [], gateway: {main:'佐野',final:'佐野'} },
  '鬼怒川温泉':{ main: [...VIA_TOKYO, s('rail','東京','鬼怒川温泉','東武鬼怒川線')], last: [], gateway: {main:'鬼怒川温泉',final:'鬼怒川温泉'} },
  '尾瀬':      { main: [...VIA_TOKYO, s('rail','東京','沼田','JR上越線')], last: [s('bus','沼田','鳩待峠','バス')], gateway: {main:'沼田',final:'鳩待峠'} },
  '筑波':      { main: [...VIA_TOKYO, s('rail','東京','つくば','つくばエクスプレス')], last: [], gateway: {main:'つくば',final:'つくば'} },
  '笠間':      { main: [...VIA_TOKYO, s('rail','東京','笠間','JR水戸線')], last: [], gateway: {main:'笠間',final:'笠間'} },
  '成田':      { main: [...VIA_TOKYO, s('rail','東京','成田','JR成田線')], last: [], gateway: {main:'成田',final:'成田'} },
  '九十九里':  { main: [...VIA_TOKYO, s('rail','東京','東金','JR東金線')], last: [s('bus','東金','九十九里海岸','バス')], gateway: {main:'東金',final:'九十九里海岸'} },
  '三浦':      { main: [...VIA_TOKYO, s('rail','東京','三崎口','京急')], last: [], gateway: {main:'三崎口',final:'三崎口'} },
  '奥多摩':    { main: [...VIA_TOKYO, s('rail','東京','奥多摩','JR青梅線')], last: [], gateway: {main:'奥多摩',final:'奥多摩'} },

  /* ────── 東北 ────── */
  '松島':      { main: [...VIA_TOKYO, s('rail','東京','仙台','東北新幹線'), s('rail','仙台','松島海岸','JR仙石線')], last: [], gateway: {main:'仙台',final:'松島海岸'} },
  '平泉':      { main: [...VIA_TOKYO, s('rail','東京','一ノ関','東北新幹線'), s('rail','一ノ関','平泉','JR東北本線')], last: [], gateway: {main:'一ノ関',final:'平泉'} },
  '角館':      { main: [...VIA_TOKYO, s('rail','東京','角館','秋田新幹線')], last: [], gateway: {main:'角館',final:'角館'} },
  '会津若松':  { main: [...VIA_TOKYO, s('rail','東京','郡山','東北新幹線'), s('rail','郡山','会津若松','JR磐越西線')], last: [], gateway: {main:'郡山',final:'会津若松'} },
  '蔵王':      { main: [...VIA_TOKYO, s('rail','東京','山形','山形新幹線'), s('rail','山形','蔵王','JR奥羽本線')], last: [], gateway: {main:'山形',final:'蔵王'} },
  '秋田':      { main: [...VIA_TOKYO, s('rail','東京','秋田','秋田新幹線')], last: [], gateway: {main:'秋田',final:'秋田'} },
  '宮古':      { main: [...VIA_TOKYO, s('rail','東京','盛岡','東北新幹線'), s('rail','盛岡','宮古','JR山田線')], last: [], gateway: {main:'盛岡',final:'宮古'} },
  '酒田':      { main: [...VIA_TOKYO, s('rail','東京','新潟','上越新幹線'), s('rail','新潟','酒田','特急いなほ')], last: [], gateway: {main:'新潟',final:'酒田'} },
  '乳頭温泉':  { main: [...VIA_TOKYO, s('rail','東京','角館','秋田新幹線')], last: [s('bus','角館','乳頭温泉','バス')], gateway: {main:'角館',final:'乳頭温泉'} },
  '銀山温泉':  { main: [...VIA_TOKYO, s('rail','東京','大石田','山形新幹線')], last: [s('bus','大石田','銀山温泉','バス')], gateway: {main:'大石田',final:'銀山温泉'} },
  '大内宿':    { main: [...VIA_TOKYO, s('rail','東京','郡山','東北新幹線'), s('rail','郡山','会津若松','JR磐越西線')], last: [s('bus','会津若松','大内宿','バス')], gateway: {main:'会津若松',final:'大内宿'} },
  '鳴子温泉':  { main: [...VIA_TOKYO, s('rail','東京','鳴子温泉','東北新幹線＋陸羽東線')], last: [], gateway: {main:'鳴子温泉',final:'鳴子温泉'} },
  '弘前':      { main: [...VIA_TOKYO, s('rail','東京','新青森','東北新幹線'), s('rail','新青森','弘前','JR奥羽本線')], last: [], gateway: {main:'新青森',final:'弘前'} },
  '奥入瀬':    { main: [...VIA_TOKYO, s('rail','東京','八戸','東北新幹線')], last: [s('bus','八戸','奥入瀬渓流','バス')], gateway: {main:'八戸',final:'奥入瀬渓流'} },
  '遠野':      { main: [...VIA_TOKYO, s('rail','東京','新花巻','東北新幹線'), s('rail','新花巻','遠野','JR釜石線')], last: [], gateway: {main:'新花巻',final:'遠野'} },
  '男鹿':      { main: [...VIA_TOKYO, s('rail','東京','秋田','秋田新幹線'), s('rail','秋田','男鹿','JR男鹿線')], last: [], gateway: {main:'秋田',final:'男鹿'} },
  '米沢':      { main: [...VIA_TOKYO, s('rail','東京','米沢','山形新幹線')], last: [], gateway: {main:'米沢',final:'米沢'} },
  '出羽三山':  { main: [...VIA_TOKYO, s('rail','東京','新潟','上越新幹線'), s('rail','新潟','鶴岡','特急いなほ')], last: [s('bus','鶴岡','羽黒山','バス')], gateway: {main:'鶴岡',final:'羽黒山'} },
  '秋保温泉':  { main: [...VIA_TOKYO, s('rail','東京','仙台','東北新幹線')], last: [s('bus','仙台','秋保温泉','バス')], gateway: {main:'仙台',final:'秋保温泉'} },
  '五所川原':  { main: [...VIA_TOKYO, s('rail','東京','新青森','東北新幹線'), s('rail','新青森','五所川原','JR五能線')], last: [], gateway: {main:'新青森',final:'五所川原'} },
  '釜石':      { main: [...VIA_TOKYO, s('rail','東京','新花巻','東北新幹線'), s('rail','新花巻','釜石','JR釜石線')], last: [], gateway: {main:'新花巻',final:'釜石'} },
  '大船渡':    { main: [...VIA_TOKYO, s('rail','東京','一ノ関','東北新幹線')], last: [s('bus','一ノ関','大船渡','バス')], gateway: {main:'一ノ関',final:'大船渡'} },
  '久慈':      { main: [...VIA_TOKYO, s('rail','東京','八戸','東北新幹線'), s('rail','八戸','久慈','JR八戸線')], last: [], gateway: {main:'八戸',final:'久慈'} },
  '花巻':      { main: [...VIA_TOKYO, s('rail','東京','新花巻','東北新幹線')], last: [], gateway: {main:'新花巻',final:'新花巻'} },
  '八幡平':    { main: [...VIA_TOKYO, s('rail','東京','盛岡','東北新幹線')], last: [s('bus','盛岡','八幡平頂上','バス')], gateway: {main:'盛岡',final:'八幡平'} },
  '田沢湖':    { main: [...VIA_TOKYO, s('rail','東京','田沢湖','秋田新幹線')], last: [], gateway: {main:'田沢湖',final:'田沢湖'} },
  '山寺':      { main: [...VIA_TOKYO, s('rail','東京','山寺','山形新幹線')], last: [], gateway: {main:'山寺',final:'山寺'} },
  '気仙沼':    { main: [...VIA_TOKYO, s('rail','東京','一ノ関','東北新幹線'), s('bus','一ノ関','気仙沼','BRT')], last: [], gateway: {main:'一ノ関',final:'気仙沼'} },
  '十和田':    { main: [...VIA_TOKYO, s('rail','東京','八戸','東北新幹線')], last: [s('bus','八戸','十和田湖','バス')], gateway: {main:'八戸',final:'十和田湖'} },
  '恐山':      { main: [...VIA_TOKYO, s('rail','東京','新青森','東北新幹線'), s('rail','新青森','下北','JR大湊線')], last: [s('bus','下北','恐山','バス')], gateway: {main:'下北',final:'恐山'} },
  '裏磐梯':    { main: [...VIA_TOKYO, s('rail','東京','郡山','東北新幹線'), s('rail','郡山','猪苗代','JR磐越西線')], last: [s('bus','猪苗代','五色沼','バス')], gateway: {main:'猪苗代',final:'五色沼'} },
  '南三陸':    { main: [...VIA_TOKYO, s('rail','東京','気仙沼','東北新幹線＋BRT')], last: [], gateway: {main:'気仙沼',final:'南三陸'} },
  '北上':      { main: [...VIA_TOKYO, s('rail','東京','北上','東北新幹線')], last: [], gateway: {main:'北上',final:'北上'} },

  /* ────── 北海道 ────── */
  '小樽':      { main: [...VIA_ITAMI_CHITOSE, s('rail','新千歳空港','小樽','JR快速エアポート')], last: [], gateway: {main:'新千歳空港',final:'小樽'} },
  '富良野':    { main: [...VIA_ITAMI_ASAHIKAWA, s('rail','旭川','富良野','JR富良野線')], last: [], gateway: {main:'旭川空港',final:'富良野'} },
  '洞爺湖':    { main: [...VIA_ITAMI_CHITOSE, s('rail','新千歳空港','洞爺','JR室蘭本線')], last: [s('bus','洞爺','洞爺湖温泉','バス')], gateway: {main:'新千歳空港',final:'洞爺湖温泉'} },
  '登別':      { main: [...VIA_ITAMI_CHITOSE, s('rail','新千歳空港','登別','JR室蘭本線')], last: [], gateway: {main:'新千歳空港',final:'登別'} },
  '知床':      { main: [...VIA_ITAMI_MEMANBETSU, s('rail','網走','知床斜里','JR釧網本線')], last: [s('bus','知床斜里','知床','バス')], gateway: {main:'女満別空港',final:'知床'} },
  '定山渓':    { main: [...VIA_ITAMI_CHITOSE, s('rail','新千歳空港','札幌','JR快速エアポート')], last: [s('bus','札幌','定山渓','バス')], gateway: {main:'札幌',final:'定山渓'} },
  '美瑛':      { main: [...VIA_ITAMI_ASAHIKAWA, s('rail','旭川','美瑛','JR富良野線')], last: [], gateway: {main:'旭川空港',final:'美瑛'} },
  '積丹':      { main: [...VIA_ITAMI_CHITOSE, s('rail','新千歳空港','小樽','JR快速エアポート')], last: [s('bus','小樽','積丹','バス')], gateway: {main:'小樽',final:'積丹'} },
  '層雲峡':    { main: [...VIA_ITAMI_ASAHIKAWA, s('rail','旭川','上川','JR石北本線')], last: [s('bus','上川','層雲峡','バス')], gateway: {main:'旭川空港',final:'層雲峡'} },
  '礼文島':    { main: [...VIA_ITAMI_CHITOSE, s('rail','新千歳空港','稚内','JR宗谷本線')], last: [s('ferry','稚内港','香深港','ハートランドフェリー')], gateway: {main:'稚内',final:'香深港'} },
  '利尻島':    { main: [...VIA_ITAMI_CHITOSE, s('rail','新千歳空港','稚内','JR宗谷本線')], last: [s('ferry','稚内港','鴛泊港','ハートランドフェリー')], gateway: {main:'稚内',final:'鴛泊港'} },
  '阿寒湖':    { main: [...VIA_ITAMI_KUSHIRO, s('bus','釧路空港','阿寒湖','バス')], last: [], gateway: {main:'釧路空港',final:'阿寒湖'} },
  '網走':      { main: [...VIA_ITAMI_MEMANBETSU, s('rail','網走','網走','JR釧網本線')], last: [], gateway: {main:'女満別空港',final:'網走'} },
  '支笏湖':    { main: [...VIA_ITAMI_CHITOSE], last: [s('bus','新千歳空港','支笏湖','バス')], gateway: {main:'新千歳空港',final:'支笏湖'} },
  '稚内':      { main: [...VIA_ITAMI_CHITOSE, s('rail','新千歳空港','稚内','JR宗谷本線')], last: [], gateway: {main:'新千歳空港',final:'稚内'} },
  '帯広':      { main: [...VIA_ITAMI_OBIHIRO], last: [], gateway: {main:'帯広空港',final:'帯広'} },
  '羅臼':      { main: [...VIA_ITAMI_MEMANBETSU, s('rail','網走','知床斜里','JR釧網本線')], last: [s('bus','知床斜里','羅臼','バス')], gateway: {main:'女満別空港',final:'羅臼'} },
  '江差':      { main: [...VIA_ITAMI_HAKODATE], last: [s('bus','函館空港','江差','バス')], gateway: {main:'函館空港',final:'江差'} },
  'ニセコ':    { main: [...VIA_ITAMI_CHITOSE, s('rail','新千歳空港','倶知安','JR函館本線')], last: [], gateway: {main:'新千歳空港',final:'倶知安'} },
  '大雪山':    { main: [...VIA_ITAMI_ASAHIKAWA], last: [s('bus','旭川空港','旭岳温泉','バス')], gateway: {main:'旭川空港',final:'旭岳温泉'} },
  '白老':      { main: [...VIA_ITAMI_CHITOSE, s('rail','新千歳空港','白老','JR室蘭本線')], last: [], gateway: {main:'新千歳空港',final:'白老'} },
  'トマム':    { main: [...VIA_ITAMI_CHITOSE, s('rail','新千歳空港','トマム','JR石勝線')], last: [], gateway: {main:'新千歳空港',final:'トマム'} },

  /* ────── 中部 ────── */
  '熱海':      { main: [...VIA_TOKYO, s('rail','東京','熱海','JR東海道線')], last: [], gateway: {main:'熱海',final:'熱海'} },
  '軽井沢':    { main: [...VIA_TOKYO, s('rail','東京','軽井沢','北陸新幹線')], last: [], gateway: {main:'軽井沢',final:'軽井沢'} },
  '富士河口湖':{ main: [...VIA_NAGOYA, s('rail','名古屋','河口湖','JR身延線＋富士急行')], last: [], gateway: {main:'名古屋',final:'河口湖'} },
  '伊勢':      { main: [s('rail','大阪','伊勢市','近鉄特急')], last: [], gateway: {main:'伊勢市',final:'伊勢市'} },
  '修善寺':    { main: [...VIA_TOKYO, s('rail','東京','修善寺','特急踊り子')], last: [], gateway: {main:'修善寺',final:'修善寺'} },
  '下田':      { main: [...VIA_TOKYO, s('rail','東京','伊豆急下田','特急踊り子')], last: [], gateway: {main:'伊豆急下田',final:'伊豆急下田'} },
  '白川郷':    { main: [...VIA_KANAZAWA, s('bus','金沢','白川郷','高速バス')], last: [], gateway: {main:'金沢',final:'白川郷'} },
  '高山':      { main: [...VIA_NAGOYA, s('rail','名古屋','高山','特急ひだ')], last: [], gateway: {main:'高山',final:'高山'} },
  '鳥羽':      { main: [s('rail','大阪','鳥羽','近鉄特急')], last: [], gateway: {main:'鳥羽',final:'鳥羽'} },
  '輪島':      { main: [...VIA_KANAZAWA, s('bus','金沢','輪島','バス')], last: [], gateway: {main:'金沢',final:'輪島バスターミナル'} },
  '加賀温泉郷':{ main: [...THUNDERBIRD, s('rail','金沢','加賀温泉','北陸新幹線')], last: [], gateway: {main:'加賀温泉',final:'加賀温泉'} },
  '白馬':      { main: [...THUNDERBIRD_NAGANO, s('rail','長野','白馬','JR大糸線')], last: [], gateway: {main:'長野',final:'白馬'} },
  '五箇山':    { main: [...VIA_KANAZAWA, s('bus','金沢','五箇山','バス')], last: [], gateway: {main:'金沢',final:'五箇山'} },
  '犬山':      { main: [...VIA_NAGOYA, s('rail','名古屋','犬山','名鉄犬山線')], last: [], gateway: {main:'名古屋',final:'犬山'} },
  '木曽':      { main: [...VIA_NAGOYA, s('rail','名古屋','南木曽','JR中央本線')], last: [], gateway: {main:'南木曽',final:'南木曽'} },
  '立山黒部':  { main: [...VIA_TOYAMA, s('rail','富山','立山','富山地方鉄道')], last: [], gateway: {main:'富山',final:'立山'} },
  '氷見':      { main: [...VIA_TOYAMA, s('rail','富山','氷見','JR氷見線')], last: [], gateway: {main:'富山',final:'氷見'} },
  '小布施':    { main: [...THUNDERBIRD_NAGANO, s('rail','長野','小布施','長野電鉄')], last: [], gateway: {main:'長野',final:'小布施'} },
  '野沢温泉':  { main: [...THUNDERBIRD_NAGANO, s('rail','長野','飯山','北陸新幹線')], last: [s('bus','飯山','野沢温泉','バス')], gateway: {main:'飯山',final:'野沢温泉'} },
  '妻籠':      { main: [...VIA_NAGOYA, s('rail','名古屋','南木曽','JR中央本線')], last: [], gateway: {main:'南木曽',final:'南木曽'} },
  '馬籠':      { main: [...VIA_NAGOYA, s('rail','名古屋','中津川','JR中央本線')], last: [s('bus','中津川','馬籠','バス')], gateway: {main:'中津川',final:'馬籠'} },
  '下呂温泉':  { main: [...VIA_NAGOYA, s('rail','名古屋','下呂','特急ひだ')], last: [], gateway: {main:'下呂',final:'下呂'} },
  '別所温泉':  { main: [...THUNDERBIRD_NAGANO, s('rail','長野','上田','北陸新幹線'), s('rail','上田','別所温泉','上田電鉄')], last: [], gateway: {main:'上田',final:'別所温泉'} },
  '和倉温泉':  { main: [...VIA_KANAZAWA, s('rail','金沢','和倉温泉','JR七尾線')], last: [], gateway: {main:'金沢',final:'和倉温泉'} },
  '上高地':    { main: [s('rail','大阪','松本','特急しなの'), s('bus','松本','上高地','バス')], last: [], gateway: {main:'松本',final:'上高地バスターミナル'} },
  '珠洲':      { main: [...VIA_KANAZAWA, s('bus','金沢','珠洲','バス')], last: [], gateway: {main:'金沢',final:'珠洲バスターミナル'} },
  '飛騨古川':  { main: [...VIA_NAGOYA, s('rail','名古屋','飛騨古川','特急ひだ')], last: [], gateway: {main:'飛騨古川',final:'飛騨古川'} },
  '伊豆高原':  { main: [...VIA_TOKYO, s('rail','東京','伊豆高原','特急踊り子')], last: [], gateway: {main:'伊豆高原',final:'伊豆高原'} },
  '敦賀':      { main: [TSURUGA], last: [], gateway: {main:'敦賀',final:'敦賀'} },
  '佐渡島':    { main: [...VIA_TOKYO, s('rail','東京','新潟','上越新幹線'), s('ferry','新潟港','両津港','佐渡汽船')], last: [], gateway: {main:'新潟',final:'両津港'} },
  '清里':      { main: [...VIA_TOKYO, s('rail','東京','小淵沢','JR中央本線'), s('rail','小淵沢','清里','JR小海線')], last: [], gateway: {main:'小淵沢',final:'清里'} },
  '天竜峡':    { main: [...VIA_NAGOYA, s('rail','名古屋','天竜峡','JR飯田線')], last: [], gateway: {main:'天竜峡',final:'天竜峡'} },
  '諏訪':      { main: [s('rail','大阪','上諏訪','特急しなの')], last: [], gateway: {main:'上諏訪',final:'上諏訪'} },
  '永平寺':    { main: [TSURUGA, s('rail','敦賀','福井','北陸新幹線'), s('rail','福井','永平寺口','えちぜん鉄道')], last: [], gateway: {main:'福井',final:'永平寺口'} },
  '若狭小浜':  { main: [TSURUGA, s('rail','敦賀','小浜','JR小浜線')], last: [], gateway: {main:'敦賀',final:'小浜'} },
  '奥飛騨温泉郷':{ main: [...VIA_NAGOYA, s('rail','名古屋','高山','特急ひだ')], last: [s('bus','高山','平湯温泉','バス')], gateway: {main:'高山',final:'平湯温泉'} },
  '南伊豆':    { main: [...VIA_TOKYO, s('rail','東京','伊豆急下田','特急踊り子')], last: [], gateway: {main:'伊豆急下田',final:'伊豆急下田'} },
  '越前市':    { main: [TSURUGA, s('rail','敦賀','武生','JR北陸本線')], last: [], gateway: {main:'敦賀',final:'武生'} },
  '伊東':      { main: [...VIA_TOKYO, s('rail','東京','伊東','JR伊東線')], last: [], gateway: {main:'伊東',final:'伊東'} },
  '松代':      { main: [...THUNDERBIRD_NAGANO], last: [], gateway: {main:'長野',final:'長野'} },
  '飯山':      { main: [...THUNDERBIRD_NAGANO, s('rail','長野','飯山','北陸新幹線')], last: [], gateway: {main:'飯山',final:'飯山'} },
  '郡上八幡':  { main: [...VIA_NAGOYA, s('rail','名古屋','郡上八幡','長良川鉄道')], last: [], gateway: {main:'名古屋',final:'郡上八幡'} },
  '奈良井宿':  { main: [s('rail','大阪','奈良井','特急しなの')], last: [], gateway: {main:'奈良井',final:'奈良井'} },
  '糸魚川':    { main: [...THUNDERBIRD_NAGANO, s('rail','長野','糸魚川','北陸新幹線')], last: [], gateway: {main:'糸魚川',final:'糸魚川'} },
  '村上':      { main: [...VIA_TOKYO, s('rail','東京','新潟','上越新幹線'), s('rail','新潟','村上','JR羽越本線')], last: [], gateway: {main:'新潟',final:'村上'} },
  '志摩':      { main: [s('rail','大阪','賢島','近鉄特急')], last: [], gateway: {main:'賢島',final:'賢島'} },
  '大垣':      { main: [s('rail','大阪','大垣','JR東海道線新快速')], last: [], gateway: {main:'大垣',final:'大垣'} },
  '越前海岸':  { main: [TSURUGA, s('rail','敦賀','武生','JR北陸本線')], last: [s('bus','武生','越前海岸','バス')], gateway: {main:'武生',final:'越前海岸'} },
  '妙高高原':  { main: [...THUNDERBIRD_NAGANO, s('rail','長野','妙高高原','えちごトキめき鉄道')], last: [], gateway: {main:'長野',final:'妙高高原'} },
  '長岡':      { main: [...VIA_TOKYO, s('rail','東京','長岡','上越新幹線')], last: [], gateway: {main:'長岡',final:'長岡'} },
  '地獄谷野猿公苑':{ main: [...THUNDERBIRD_NAGANO, s('rail','長野','湯田中','長野電鉄')], last: [s('bus','湯田中','地獄谷野猿公苑','バス')], gateway: {main:'湯田中',final:'地獄谷野猿公苑'} },
  '蓼科':      { main: [s('rail','大阪','茅野','特急しなの')], last: [s('bus','茅野','蓼科','バス')], gateway: {main:'茅野',final:'蓼科'} },
  '越後湯沢':  { main: [...VIA_TOKYO, s('rail','東京','越後湯沢','上越新幹線')], last: [], gateway: {main:'越後湯沢',final:'越後湯沢'} },
  '富士宮':    { main: [...VIA_NAGOYA, s('rail','名古屋','富士宮','JR身延線')], last: [], gateway: {main:'富士宮',final:'富士宮'} },
  '乗鞍':      { main: [s('rail','大阪','松本','特急しなの')], last: [s('bus','松本','畳平','バス')], gateway: {main:'松本',final:'畳平'} },
  '常滑':      { main: [...VIA_NAGOYA, s('rail','名古屋','常滑','名鉄常滑線')], last: [], gateway: {main:'名古屋',final:'常滑'} },
  '香嵐渓':    { main: [...VIA_NAGOYA, s('rail','名古屋','豊田市','名鉄')], last: [s('bus','豊田市','香嵐渓','バス')], gateway: {main:'豊田市',final:'香嵐渓'} },
  '南知多':    { main: [...VIA_NAGOYA, s('rail','名古屋','内海','名鉄知多新線')], last: [], gateway: {main:'名古屋',final:'内海'} },

  /* ────── 近畿 ────── */
  '奈良':      { main: [s('rail','大阪','奈良','JR大和路線')], last: [], gateway: {main:'奈良',final:'奈良'} },
  '龍神温泉':  { main: [s('rail','大阪','紀伊田辺','特急くろしお')], last: [s('bus','紀伊田辺','龍神温泉','バス')], gateway: {main:'紀伊田辺',final:'龍神温泉'} },
  '有馬温泉':  { main: [s('rail','大阪','三宮','JR東海道・山陽線'), s('rail','三宮','有馬温泉','神戸電鉄')], last: [], gateway: {main:'三宮',final:'有馬温泉'} },
  '城崎温泉':  { main: [s('rail','大阪','城崎温泉','特急こうのとり')], last: [], gateway: {main:'城崎温泉',final:'城崎温泉'} },
  '白浜':      { main: [s('rail','大阪','白浜','特急くろしお')], last: [], gateway: {main:'白浜',final:'白浜'} },
  '天橋立':    { main: [s('rail','大阪','天橋立','特急はしだて')], last: [], gateway: {main:'天橋立',final:'天橋立'} },
  '伊根':      { main: [s('rail','大阪','天橋立','特急はしだて')], last: [s('bus','天橋立','伊根港','バス')], gateway: {main:'天橋立',final:'伊根港'} },
  '淡路島':    { main: [s('rail','大阪','三宮','JR東海道・山陽線')], last: [s('bus','三宮','淡路島','高速バス')], gateway: {main:'三宮',final:'淡路島'} },
  '美山':      { main: [s('rail','大阪','園部','JR嵯峨野線')], last: [s('bus','園部','美山','バス')], gateway: {main:'園部',final:'美山'} },
  '長浜':      { main: [s('rail','大阪','長浜','JR琵琶湖線新快速')], last: [], gateway: {main:'長浜',final:'長浜'} },
  '彦根':      { main: [s('rail','大阪','彦根','JR琵琶湖線新快速')], last: [], gateway: {main:'彦根',final:'彦根'} },
  '高野山':    { main: [s('rail','大阪','高野山','南海高野線')], last: [], gateway: {main:'高野山',final:'高野山'} },
  '出石':      { main: [s('rail','大阪','豊岡','特急こうのとり')], last: [s('bus','豊岡','出石','バス')], gateway: {main:'豊岡',final:'出石'} },
  '吉野':      { main: [s('rail','大阪','吉野','近鉄吉野線')], last: [], gateway: {main:'吉野',final:'吉野'} },
  '熊野':      { main: [s('rail','大阪','新宮','特急くろしお')], last: [], gateway: {main:'新宮',final:'新宮'} },
  '田辺':      { main: [s('rail','大阪','紀伊田辺','特急くろしお')], last: [], gateway: {main:'紀伊田辺',final:'紀伊田辺'} },
  '伊賀':      { main: [s('rail','大阪','上野市','JR大和路線＋近鉄伊賀鉄道')], last: [], gateway: {main:'上野市',final:'上野市'} },
  '橿原':      { main: [s('rail','大阪','橿原神宮前','近鉄')], last: [], gateway: {main:'橿原神宮前',final:'橿原神宮前'} },
  '十津川':    { main: [s('rail','大阪','五条','JR和歌山線')], last: [s('bus','五条','十津川','バス')], gateway: {main:'五条',final:'十津川'} },
  '舞鶴':      { main: [s('rail','大阪','東舞鶴','特急まいづる')], last: [], gateway: {main:'東舞鶴',final:'東舞鶴'} },
  '飛鳥':      { main: [s('rail','大阪','飛鳥','近鉄吉野線')], last: [], gateway: {main:'飛鳥',final:'飛鳥'} },
  '丹波篠山':  { main: [s('rail','大阪','篠山口','JR福知山線')], last: [], gateway: {main:'篠山口',final:'篠山口'} },
  '那智勝浦':  { main: [s('rail','大阪','紀伊勝浦','特急くろしお')], last: [], gateway: {main:'紀伊勝浦',final:'紀伊勝浦'} },
  '熊野本宮':  { main: [s('rail','大阪','新宮','特急くろしお')], last: [s('bus','新宮','本宮大社前','バス')], gateway: {main:'新宮',final:'本宮大社前'} },
  '赤穂':      { main: [s('rail','大阪','赤穂','新快速')], last: [], gateway: {main:'赤穂',final:'赤穂'} },
  '伏見':      { main: [s('rail','大阪','伏見稲荷','JR奈良線')], last: [], gateway: {main:'伏見稲荷',final:'伏見稲荷'} },
  '嵐山':      { main: [s('rail','大阪','嵐山','JR嵯峨野線')], last: [], gateway: {main:'嵐山',final:'嵐山'} },
  '信楽':      { main: [s('rail','大阪','貴生川','JR草津線'), s('rail','貴生川','信楽','信楽高原鉄道')], last: [], gateway: {main:'貴生川',final:'信楽'} },
  '洞川温泉':  { main: [s('rail','大阪','下市口','近鉄吉野線')], last: [s('bus','下市口','洞川温泉','バス')], gateway: {main:'下市口',final:'洞川温泉'} },
  '松阪':      { main: [s('rail','大阪','松阪','近鉄特急')], last: [], gateway: {main:'松阪',final:'松阪'} },
  '堺':        { main: [s('rail','大阪','堺東','南海高野線')], last: [], gateway: {main:'堺東',final:'堺東'} },

  /* ────── 中国 ────── */
  '宮島':      { main: [...VIA_HIROSHIMA, s('rail','広島','宮島口','JR山陽本線')], last: [s('ferry','宮島口港','宮島','JR西日本フェリー')], gateway: {main:'宮島口',final:'宮島'} },
  '尾道':      { main: [OKAYAMA, s('rail','岡山','尾道','JR山陽本線')], last: [], gateway: {main:'尾道',final:'尾道'} },
  '美保関':    { main: [s('rail','大阪','鳥取','特急スーパーはくと'), s('rail','鳥取','境港','JR境線')], last: [], gateway: {main:'境港',final:'境港'} },
  '倉敷':      { main: [OKAYAMA, s('rail','岡山','倉敷','JR山陽本線')], last: [], gateway: {main:'岡山',final:'倉敷'} },
  '萩':        { main: [...VIA_SHIN_YAMAGUCHI, s('bus','新山口','萩','バス')], last: [], gateway: {main:'新山口',final:'萩'} },
  '下関':      { main: [...VIA_HAKATA, s('rail','博多','下関','JR山陽本線')], last: [], gateway: {main:'博多',final:'下関'} },
  '鳥取':      { main: [s('rail','大阪','鳥取','特急スーパーはくと')], last: [], gateway: {main:'鳥取',final:'鳥取'} },
  '津和野':    { main: [...VIA_SHIN_YAMAGUCHI, s('rail','新山口','津和野','JR山口線')], last: [], gateway: {main:'新山口',final:'津和野'} },
  '湯田温泉':  { main: [...VIA_SHIN_YAMAGUCHI, s('rail','新山口','湯田温泉','JR山陽本線')], last: [], gateway: {main:'新山口',final:'湯田温泉'} },
  '奥出雲':    { main: [OKAYAMA, s('rail','岡山','出雲市','特急やくも'), s('rail','出雲市','木次','JR木次線')], last: [], gateway: {main:'出雲市',final:'木次'} },
  '竹原':      { main: [...VIA_HIROSHIMA, s('rail','広島','竹原','JR呉線')], last: [], gateway: {main:'広島',final:'竹原'} },
  '三朝温泉':  { main: [s('rail','大阪','倉吉','特急スーパーはくと')], last: [s('bus','倉吉','三朝温泉','バス')], gateway: {main:'倉吉',final:'三朝温泉'} },
  '出雲':      { main: [OKAYAMA, s('rail','岡山','出雲市','特急やくも')], last: [], gateway: {main:'出雲市',final:'出雲市'} },
  '高梁':      { main: [OKAYAMA, s('rail','岡山','備中高梁','JR伯備線')], last: [], gateway: {main:'岡山',final:'備中高梁'} },
  '大山':      { main: [OKAYAMA, s('rail','岡山','米子','特急やくも')], last: [s('bus','米子','大山','バス')], gateway: {main:'米子',final:'大山'} },
  '温泉津':    { main: [OKAYAMA, s('rail','岡山','温泉津','特急やくも＋山陰本線')], last: [], gateway: {main:'岡山',final:'温泉津'} },
  '石見銀山':  { main: [OKAYAMA, s('rail','岡山','大田市','特急やくも＋山陰本線')], last: [], gateway: {main:'岡山',final:'大田市'} },
  '岩国':      { main: [...VIA_HIROSHIMA, s('rail','広島','岩国','JR山陽本線')], last: [], gateway: {main:'広島',final:'岩国'} },
  '倉吉':      { main: [s('rail','大阪','倉吉','特急スーパーはくと')], last: [], gateway: {main:'倉吉',final:'倉吉'} },
  '周防大島':  { main: [...VIA_HIROSHIMA, s('rail','広島','大畠','JR山陽本線')], last: [s('bus','大畠','周防大島','バス')], gateway: {main:'大畠',final:'周防大島'} },
  '矢掛':      { main: [OKAYAMA, s('rail','岡山','矢掛','JR伯備線')], last: [], gateway: {main:'岡山',final:'矢掛'} },
  '津山':      { main: [OKAYAMA, s('rail','岡山','津山','JR津山線')], last: [], gateway: {main:'岡山',final:'津山'} },
  '鞆の浦':    { main: [FUKUYAMA, s('bus','福山','鞆の浦','バス')], last: [], gateway: {main:'福山',final:'鞆の浦'} },
  '境港':      { main: [s('rail','大阪','鳥取','特急スーパーはくと'), s('rail','鳥取','境港','JR境線')], last: [], gateway: {main:'鳥取',final:'境港'} },
  '牛窓':      { main: [OKAYAMA, s('rail','岡山','邑久','JR赤穂線')], last: [s('bus','邑久','牛窓','バス')], gateway: {main:'邑久',final:'牛窓'} },
  '笠岡':      { main: [OKAYAMA, s('rail','岡山','笠岡','JR山陽本線')], last: [], gateway: {main:'岡山',final:'笠岡'} },
  '角島':      { main: [...VIA_SHIN_YAMAGUCHI, s('rail','新山口','特牛','JR山陰本線')], last: [s('bus','特牛','角島大橋','バス')], gateway: {main:'新山口',final:'角島大橋'} },
  '海士町':    { main: [OKAYAMA, s('rail','岡山','松江','特急やくも'), s('bus','松江','七類港','一畑バス')], last: [s('ferry','七類港','菱浦港','隠岐汽船')], gateway: {main:'松江',final:'菱浦港'} },
  '秋吉台':    { main: [...VIA_SHIN_YAMAGUCHI, s('bus','新山口','秋吉台','バス')], last: [], gateway: {main:'新山口',final:'秋吉台'} },
  '柳井':      { main: [...VIA_HIROSHIMA, s('rail','広島','柳井','JR山陽本線')], last: [], gateway: {main:'広島',final:'柳井'} },
  '隠岐の島':  { main: [s('rail','大阪','鳥取','特急スーパーはくと'), s('rail','鳥取','境港','JR境線'), s('ferry','境港','西郷港','隠岐汽船')], last: [], gateway: {main:'境港',final:'西郷港'} },
  '犬島':      { main: [OKAYAMA, s('bus','岡山','宝伝','バス'), s('ferry','宝伝港','犬島港','犬島行き船')], last: [], gateway: {main:'宝伝',final:'犬島港'} },
  '豊島':      { main: [OKAYAMA, s('rail','岡山','宇野','JR宇野線'), s('ferry','宇野港','家浦港','豊島フェリー')], last: [], gateway: {main:'宇野',final:'家浦港'} },

  /* ────── 四国 ────── */
  '小豆島':    { main: [OKAYAMA, MARINE_LINER], last: [s('ferry','高松港','池田港','小豆島フェリー')], gateway: {main:'高松',final:'小豆島'} },
  '直島':      { main: [OKAYAMA, s('rail','岡山','宇野','JR宇野線')], last: [s('ferry','宇野港','宮浦港','直島フェリー')], gateway: {main:'宇野',final:'直島'} },
  '琴平':      { main: [OKAYAMA, MARINE_LINER, s('rail','高松','琴電琴平','琴電琴平線')], last: [], gateway: {main:'高松',final:'琴電琴平'} },
  '宇和島':    { main: [OKAYAMA, MARINE_LINER, s('rail','高松','宇和島','特急宇和海')], last: [], gateway: {main:'高松',final:'宇和島'} },
  '足摺岬':    { main: [OKAYAMA, MARINE_LINER, s('rail','高松','高知','特急南風')], last: [s('bus','高知','足摺岬','バス')], gateway: {main:'高知',final:'足摺岬'} },
  '大歩危':    { main: [OKAYAMA, MARINE_LINER, s('rail','高松','大歩危','特急南風')], last: [], gateway: {main:'大歩危',final:'大歩危'} },
  '内子':      { main: [OKAYAMA, MARINE_LINER, s('rail','高松','松山','特急しおかぜ'), s('rail','松山','内子','JR予讃線')], last: [], gateway: {main:'松山',final:'内子'} },
  '室戸':      { main: [OKAYAMA, MARINE_LINER, s('rail','高松','高知','特急南風')], last: [s('bus','高知','室戸','バス')], gateway: {main:'高知',final:'室戸'} },
  '祖谷':      { main: [OKAYAMA, MARINE_LINER, s('rail','高松','阿波池田','特急南風')], last: [s('bus','阿波池田','祖谷','バス')], gateway: {main:'阿波池田',final:'祖谷'} },
  '今治':      { main: [OKAYAMA, MARINE_LINER, s('rail','高松','今治','特急しおかぜ')], last: [], gateway: {main:'高松',final:'今治'} },
  '大洲':      { main: [OKAYAMA, MARINE_LINER, s('rail','高松','伊予大洲','特急しおかぜ')], last: [], gateway: {main:'高松',final:'伊予大洲'} },
  '土佐清水':  { main: [OKAYAMA, MARINE_LINER, s('rail','高松','高知','特急南風'), s('rail','高知','中村','特急あしずり')], last: [s('bus','中村','土佐清水','バス')], gateway: {main:'高知',final:'土佐清水'} },
  '志々島':    { main: [OKAYAMA, MARINE_LINER, s('rail','高松','詫間','JR予讃線')], last: [s('ferry','詫間港','志々島','フェリー')], gateway: {main:'詫間',final:'志々島'} },
  '四万十':    { main: [OKAYAMA, MARINE_LINER, s('rail','高松','高知','特急南風'), s('rail','高知','江川崎','JR予土線')], last: [], gateway: {main:'高知',final:'江川崎'} },
  '柏島':      { main: [OKAYAMA, MARINE_LINER, s('rail','高松','宿毛','特急南風＋土佐くろしお鉄道')], last: [s('bus','宿毛','柏島','バス')], gateway: {main:'宿毛',final:'柏島'} },
  '西条':      { main: [OKAYAMA, MARINE_LINER, s('rail','高松','伊予西条','特急しおかぜ')], last: [], gateway: {main:'高松',final:'伊予西条'} },
  '愛南':      { main: [OKAYAMA, MARINE_LINER, s('rail','高松','宇和島','特急宇和海')], last: [s('bus','宇和島','愛南','バス')], gateway: {main:'宇和島',final:'愛南'} },
  '剣山':      { main: [OKAYAMA, MARINE_LINER, s('rail','高松','貞光','JR高徳線＋徳島線')], last: [s('bus','貞光','剣山','バス')], gateway: {main:'高松',final:'剣山'} },
  '四万十町':  { main: [OKAYAMA, MARINE_LINER, s('rail','高松','高知','特急南風'), s('rail','高知','土佐大正','JR予土線')], last: [], gateway: {main:'高知',final:'土佐大正'} },
  '道後温泉':  { main: [OKAYAMA, MARINE_LINER, s('rail','高松','松山','特急しおかぜ')], last: [s('rail','松山','道後温泉','伊予鉄道')], gateway: {main:'松山',final:'道後温泉'} },
  '丸亀':      { main: [OKAYAMA, MARINE_LINER, s('rail','高松','丸亀','JR予讃線')], last: [], gateway: {main:'高松',final:'丸亀'} },
  '三崎（佐田岬）':{ main: [OKAYAMA, MARINE_LINER, s('rail','高松','八幡浜','特急しおかぜ')], last: [s('ferry','三崎港','臼杵港','フェリー')], gateway: {main:'八幡浜',final:'三崎港'} },
  '仁淀川':    { main: [OKAYAMA, MARINE_LINER, s('rail','高松','高知','特急南風')], last: [s('bus','高知','仁淀川','バス')], gateway: {main:'高知',final:'仁淀川'} },
  '梼原':      { main: [OKAYAMA, MARINE_LINER, s('rail','高松','須崎','特急南風')], last: [s('bus','須崎','梼原','バス')], gateway: {main:'須崎',final:'梼原'} },
  '阿南':      { main: [OKAYAMA, MARINE_LINER, s('rail','高松','徳島','特急うずしお'), s('rail','徳島','阿南','JR牟岐線')], last: [], gateway: {main:'徳島',final:'阿南'} },
  '四国カルスト':{ main: [OKAYAMA, MARINE_LINER, s('rail','高松','松山','特急しおかぜ')], last: [s('bus','松山','四国カルスト','バス')], gateway: {main:'松山',final:'四国カルスト'} },

  /* ────── 九州 ────── */
  '別府':      { main: [...VIA_HAKATA, s('rail','博多','別府','特急ソニック')], last: [], gateway: {main:'博多',final:'別府'} },
  '湯布院':    { main: [...VIA_HAKATA, s('rail','博多','由布院','特急ゆふいんの森')], last: [], gateway: {main:'博多',final:'由布院'} },
  '黒川温泉':  { main: [...VIA_HAKATA, s('rail','博多','熊本','九州新幹線')], last: [s('bus','熊本','黒川温泉','バス')], gateway: {main:'熊本',final:'黒川温泉'} },
  '阿蘇':      { main: [...VIA_HAKATA, s('rail','博多','熊本','九州新幹線'), s('rail','熊本','阿蘇','JR豊肥本線')], last: [], gateway: {main:'熊本',final:'阿蘇'} },
  '屋久島':    { main: [...VIA_KAGOSHIMA, s('ferry','鹿児島港','屋久島','種子島・屋久島フェリー')], last: [], gateway: {main:'鹿児島中央',final:'屋久島'} },
  '天草':      { main: [...VIA_HAKATA, s('rail','博多','熊本','九州新幹線')], last: [s('bus','熊本','天草','バス')], gateway: {main:'熊本',final:'天草'} },
  '指宿':      { main: [...VIA_KAGOSHIMA, s('rail','鹿児島中央','指宿','JR指宿枕崎線')], last: [], gateway: {main:'鹿児島中央',final:'指宿'} },
  '佐世保':    { main: [...VIA_HAKATA, s('rail','博多','佐世保','JR佐世保線')], last: [], gateway: {main:'博多',final:'佐世保'} },
  '平戸':      { main: [...VIA_HAKATA, s('rail','博多','佐世保','特急みどり'), s('rail','佐世保','平戸口','JR松浦鉄道')], last: [s('bus','平戸口','平戸','バス')], gateway: {main:'佐世保',final:'平戸'} },
  '高千穂':    { main: [...VIA_HAKATA, s('rail','博多','熊本','九州新幹線')], last: [s('bus','熊本','高千穂','バス')], gateway: {main:'熊本',final:'高千穂'} },
  '奄美大島':  { main: [...VIA_KAGOSHIMA, s('ferry','鹿児島港','名瀬港','マルエーフェリー')], last: [], gateway: {main:'鹿児島中央',final:'名瀬港'} },
  '五島列島':  { main: [...VIA_HAKATA, s('ferry','博多港','福江港','野母商船')], last: [], gateway: {main:'博多',final:'福江港'} },
  '雲仙':      { main: [...VIA_HAKATA, s('rail','博多','諫早','JR長崎本線')], last: [s('bus','諫早','雲仙','バス')], gateway: {main:'諫早',final:'雲仙'} },
  '嬉野温泉':  { main: [...VIA_HAKATA, s('rail','博多','嬉野温泉','西九州新幹線')], last: [], gateway: {main:'嬉野温泉',final:'嬉野温泉'} },
  '飫肥':      { main: [...VIA_HAKATA, s('rail','博多','延岡','JR日豊本線特急にちりん'), s('rail','延岡','飫肥','JR日南線')], last: [], gateway: {main:'延岡',final:'飫肥'} },
  '人吉':      { main: [...VIA_HAKATA, s('rail','博多','熊本','九州新幹線'), s('rail','熊本','人吉','JR肥薩線')], last: [], gateway: {main:'熊本',final:'人吉'} },
  '南阿蘇':    { main: [...VIA_HAKATA, s('rail','博多','熊本','九州新幹線')], last: [s('bus','熊本','南阿蘇','バス')], gateway: {main:'熊本',final:'南阿蘇'} },
  '豊後高田':  { main: [...VIA_HAKATA, s('rail','博多','宇佐','JR日豊本線')], last: [s('bus','宇佐','豊後高田','バス')], gateway: {main:'宇佐',final:'豊後高田'} },
  '日南':      { main: [...VIA_HAKATA, s('rail','博多','宮崎','JR日豊本線特急にちりん'), s('rail','宮崎','日南','JR日南線')], last: [], gateway: {main:'宮崎',final:'日南'} },
  '門司港':    { main: [...VIA_HAKATA, s('rail','博多','門司港','JR鹿児島本線')], last: [], gateway: {main:'博多',final:'門司港'} },
  '糸島':      { main: [...VIA_HAKATA, s('rail','博多','筑前前原','JR筑肥線')], last: [], gateway: {main:'博多',final:'筑前前原'} },
  '島原':      { main: [...VIA_HAKATA, s('rail','博多','諫早','JR長崎本線'), s('rail','諫早','島原','島原鉄道')], last: [], gateway: {main:'諫早',final:'島原'} },
  '竹田':      { main: [...VIA_HAKATA, s('rail','博多','熊本','九州新幹線'), s('rail','熊本','豊後竹田','JR豊肥本線')], last: [], gateway: {main:'熊本',final:'豊後竹田'} },
  '臼杵':      { main: [...VIA_HAKATA, s('rail','博多','臼杵','JR日豊本線')], last: [], gateway: {main:'博多',final:'臼杵'} },
  '日田':      { main: [...VIA_HAKATA, s('rail','博多','日田','特急ゆふ')], last: [], gateway: {main:'博多',final:'日田'} },
  '波佐見':    { main: [...VIA_HAKATA, s('rail','博多','川棚温泉','JR大村線')], last: [s('bus','川棚温泉','波佐見','バス')], gateway: {main:'川棚温泉',final:'波佐見'} },
  '武雄温泉':  { main: [...VIA_HAKATA, s('rail','博多','武雄温泉','西九州新幹線')], last: [], gateway: {main:'武雄温泉',final:'武雄温泉'} },
  '杵築':      { main: [...VIA_HAKATA, s('rail','博多','杵築','JR日豊本線')], last: [], gateway: {main:'博多',final:'杵築'} },
  '対馬':      { main: [...VIA_HAKATA, s('ferry','博多港','対馬','九州郵船')], last: [], gateway: {main:'博多',final:'対馬港'} },
  '壱岐':      { main: [...VIA_HAKATA, s('ferry','博多港','郷ノ浦港','九州郵船')], last: [], gateway: {main:'博多',final:'郷ノ浦港'} },
  '種子島':    { main: [...VIA_KAGOSHIMA, s('ferry','鹿児島港','西之表港','種子島・屋久島フェリー')], last: [], gateway: {main:'鹿児島中央',final:'西之表港'} },
  '菊池':      { main: [...VIA_HAKATA, s('rail','博多','熊本','九州新幹線')], last: [s('bus','熊本','菊池温泉','バス')], gateway: {main:'熊本',final:'菊池温泉'} },
  '延岡':      { main: [...VIA_HAKATA, s('rail','博多','延岡','JR日豊本線特急にちりん')], last: [], gateway: {main:'博多',final:'延岡'} },
  '柳川':      { main: [...VIA_HAKATA, s('rail','博多','西鉄柳川','西鉄天神大牟田線')], last: [], gateway: {main:'博多',final:'西鉄柳川'} },
  '日向':      { main: [...VIA_HAKATA, s('rail','博多','宮崎','JR日豊本線特急にちりん'), s('rail','宮崎','日向市','JR日豊本線')], last: [], gateway: {main:'宮崎',final:'日向市'} },
  '甑島':      { main: [...VIA_KAGOSHIMA, s('rail','鹿児島中央','川内','JR鹿児島本線'), s('ferry','川内港','里港','甑島商船')], last: [], gateway: {main:'川内',final:'里港'} },
  '霧島':      { main: [...VIA_KAGOSHIMA, s('rail','鹿児島中央','霧島神宮','JR日豊本線')], last: [], gateway: {main:'鹿児島中央',final:'霧島神宮'} },
  'えびの高原':{ main: [...VIA_KAGOSHIMA], last: [s('bus','鹿児島中央','えびの高原','バス')], gateway: {main:'鹿児島中央',final:'えびの高原'} },
  '青島':      { main: [...VIA_HAKATA, s('rail','博多','宮崎','JR日豊本線特急にちりん'), s('rail','宮崎','青島','JR日南線')], last: [], gateway: {main:'宮崎',final:'青島'} },
  '山鹿':      { main: [...VIA_HAKATA, s('rail','博多','熊本','九州新幹線')], last: [s('bus','熊本','山鹿温泉','バス')], gateway: {main:'熊本',final:'山鹿温泉'} },
  '吉野ヶ里':  { main: [...VIA_HAKATA, s('rail','博多','吉野ヶ里公園','JR長崎本線')], last: [], gateway: {main:'博多',final:'吉野ヶ里公園'} },
  '国東':      { main: [...VIA_HAKATA, s('rail','博多','宇佐','JR日豊本線')], last: [s('bus','宇佐','国東','バス')], gateway: {main:'宇佐',final:'国東'} },
  '知覧':      { main: [...VIA_KAGOSHIMA], last: [s('bus','鹿児島中央','知覧','バス')], gateway: {main:'鹿児島中央',final:'知覧'} },
  '小値賀島':  { main: [...VIA_HAKATA, s('rail','博多','佐世保','特急みどり'), s('ferry','佐世保港','小値賀港','九州商船')], last: [], gateway: {main:'佐世保',final:'小値賀港'} },

  /* ────── 沖縄 ────── */
  '石垣島':    { main: [...VIA_KANSAI_ISHIGAKI], last: [s('bus','石垣空港','石垣港','路線バス')], gateway: {main:'石垣空港',final:'石垣港'} },
  '渡嘉敷島':  { main: [...VIA_KANSAI_NAHA], last: [s('ferry','泊港','渡嘉敷港','フェリーとかしき')], gateway: {main:'那覇空港',final:'渡嘉敷港'} },
  '久米島':    { main: [...VIA_KANSAI_KUMEJIMA], last: [], gateway: {main:'久米島空港',final:'久米島'} },
  '宮古島':    { main: [...VIA_KANSAI_MIYAKO], last: [], gateway: {main:'宮古空港',final:'宮古島'} },
  '西表島':    { main: [...VIA_KANSAI_ISHIGAKI, s('ferry','石垣港','大原港','安栄観光')], last: [], gateway: {main:'石垣空港',final:'大原港'} },
  '竹富島':    { main: [...VIA_KANSAI_ISHIGAKI, s('ferry','石垣港','竹富港','安栄観光')], last: [], gateway: {main:'石垣空港',final:'竹富港'} },
  '与那国島':  { main: [...VIA_KANSAI_ISHIGAKI, s('flight','石垣空港','与那国空港','RAC')], last: [], gateway: {main:'石垣空港',final:'与那国空港'} },
  '今帰仁':    { main: [...VIA_KANSAI_NAHA], last: [s('bus','那覇バスターミナル','今帰仁','高速バス')], gateway: {main:'那覇空港',final:'今帰仁'} },
  '本部':      { main: [...VIA_KANSAI_NAHA, s('ferry','本部港','伊江港','伊江島フェリー')], last: [], gateway: {main:'那覇空港',final:'本部港'} },
  '座間味島':  { main: [...VIA_KANSAI_NAHA, s('ferry','泊港','座間味港','マリンライナーとまりん')], last: [], gateway: {main:'那覇空港',final:'座間味港'} },
  '伊江島':    { main: [...VIA_KANSAI_NAHA, s('bus','那覇空港','本部港','バス'), s('ferry','本部港','伊江港','伊江村営フェリー')], last: [], gateway: {main:'那覇空港',final:'伊江港'} },
  '小浜島':    { main: [...VIA_KANSAI_ISHIGAKI, s('ferry','石垣港','小浜港','安栄観光')], last: [], gateway: {main:'石垣空港',final:'小浜港'} },
  '恩納村':    { main: [...VIA_KANSAI_NAHA], last: [s('bus','那覇空港','恩納村','バス')], gateway: {main:'那覇空港',final:'恩納村'} },
  '名護':      { main: [...VIA_KANSAI_NAHA], last: [s('bus','那覇バスターミナル','名護','高速バス')], gateway: {main:'那覇空港',final:'名護'} },
  '読谷村':    { main: [...VIA_KANSAI_NAHA], last: [s('bus','那覇空港','読谷村','バス')], gateway: {main:'那覇空港',final:'読谷村'} },
  '伊良部島':  { main: [...VIA_KANSAI_MIYAKO], last: [s('bus','宮古空港','伊良部島','バス')], gateway: {main:'宮古空港',final:'伊良部島'} },
  '粟国島':    { main: [...VIA_KANSAI_NAHA, s('ferry','泊港','粟国港','琉球海運')], last: [], gateway: {main:'那覇空港',final:'粟国港'} },
  '糸満':      { main: [...VIA_KANSAI_NAHA], last: [s('bus','那覇空港','糸満','バス')], gateway: {main:'那覇空港',final:'糸満'} },
  '喜如嘉':    { main: [...VIA_KANSAI_NAHA], last: [s('bus','那覇バスターミナル','喜如嘉','バス')], gateway: {main:'那覇空港',final:'喜如嘉'} },

  /* ────── 伊豆諸島 ────── */
  '神津島':    { main: [...VIA_TOKYO, s('bus','東京','竹芝客船ターミナル','徒歩・バス'), s('ferry','竹芝客船ターミナル','神津島港','東海汽船')], last: [], gateway: {main:'竹芝',final:'神津島港'} },
  '伊豆大島':  { main: [...VIA_TOKYO, s('bus','東京','竹芝客船ターミナル','徒歩・バス'), s('ferry','竹芝客船ターミナル','元町港','東海汽船')], last: [], gateway: {main:'竹芝',final:'元町港'} },
  '三宅島':    { main: [...VIA_TOKYO, s('bus','東京','竹芝桟橋','徒歩・バス'), s('ferry','竹芝桟橋','三宅島港','東海汽船')], last: [], gateway: {main:'竹芝',final:'三宅島港'} },
  '八丈島':    { main: [...VIA_TOKYO, s('bus','東京','竹芝桟橋','徒歩・バス'), s('ferry','竹芝桟橋','八丈島','東海汽船')], last: [], gateway: {main:'竹芝',final:'八丈島'} },
  '新島':      { main: [...VIA_TOKYO, s('bus','東京','竹芝桟橋','徒歩・バス'), s('ferry','竹芝桟橋','新島港','東海汽船')], last: [], gateway: {main:'竹芝',final:'新島港'} },
  '式根島':    { main: [...VIA_TOKYO, s('bus','東京','竹芝桟橋','徒歩・バス'), s('ferry','竹芝桟橋','式根島港','東海汽船')], last: [], gateway: {main:'竹芝',final:'式根島港'} },
};

/* ── 出力生成 ── */
const output = { '大阪': {} };

for (const dest of destinations) {
  const route = ROUTES[dest.name];
  if (route) {
    output['大阪'][dest.name] = {
      main: route.main,
      last: route.last,
      gateway: route.gateway,
    };
  } else {
    console.warn(`⚠️ ルート未定義: ${dest.name}`);
  }
}

const defined = Object.keys(output['大阪']).length;
console.log(`✓ 大阪発ルート: ${defined} / ${destinations.length} 件`);

mkdirSync(join(root, 'src/data/routes'), { recursive: true });
writeFileSync(
  join(root, 'src/data/routes/大阪.json'),
  JSON.stringify(output, null, 2) + '\n',
  'utf8'
);
console.log('→ src/data/routes/大阪.json に保存しました');
