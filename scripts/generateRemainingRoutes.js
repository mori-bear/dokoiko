/**
 * generateRemainingRoutes.js
 * 残り27都市発ルートJSON生成（テンプレートから差分を生成）
 * 実行: node scripts/generateRemainingRoutes.js
 *
 * 対象: 札幌,函館,旭川,仙台,盛岡,横浜,千葉,大宮,宇都宮,長野,静岡,名古屋,金沢,富山,
 *       京都,神戸,奈良,広島,岡山,松江,松山,高知,徳島,熊本,鹿児島,長崎,宮崎
 */
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));
const root = join(__dir, '..');

const destinations = JSON.parse(readFileSync(join(root, 'src/data/destinations.json'), 'utf8'));

function s(type, from, to, line) {
  const o = { type };
  if (from) o.from = from;
  o.to = to;
  o.line = line;
  return o;
}

/* ── 共通ハブステップ ── */
const OKAYAMA   = s('rail', null, '岡山', '');         // from は後で設定
const HIROSHIMA = s('rail', null, '広島', '');
const SHIN_OSAKA= s('rail', null, '新大阪', '');
const TOKYO_SHN = s('rail', null, '東京', '');
const HAKATA    = s('rail', null, '博多', '');
const KAGOSHIMA = s('rail', null, '鹿児島中央', '');
const KUMAMOTO  = s('rail', null, '熊本', '');
const NAGOYA    = s('rail', null, '名古屋', '');
const NIIGATA   = s('rail', null, '新潟', '');
const SENDAI    = s('rail', null, '仙台', '');
const MORIOKA   = s('rail', null, '盛岡', '');
const SHIN_AOMORI=s('rail', null, '新青森', '');
const HACHINOHE = s('rail', null, '八戸', '');
const AKITA     = s('rail', null, '秋田', '');
const KANAZAWA  = s('rail', null, '金沢', '');
const TOYAMA    = s('rail', null, '富山', '');
const FUKUI     = s('rail', null, '福井', '');
const TSURUGA   = s('rail', null, '敦賀', '');
const NAGANO_SHN= s('rail', null, '長野', '');

/* 出発地ごとのハブ接続を定義する関数 */
function hub(type, from, to, line) { return s(type, from, to, line); }

/* ── 標準ルートビルダー ──
 * tokyoRoutes / osakaRoutes / hakataRoutes をベースに
 * 出発地に合わせた最初のステップを差し替える
 */

// 東京ベースのルートをロード
const tokyoData  = JSON.parse(readFileSync(join(root, 'src/data/routes/東京.json'), 'utf8'))['東京'];
const osakaData  = JSON.parse(readFileSync(join(root, 'src/data/routes/大阪.json'), 'utf8'))['大阪'];
const hakataData = JSON.parse(readFileSync(join(root, 'src/data/routes/福岡.json'), 'utf8'))['福岡'];
const takamatsuData = JSON.parse(readFileSync(join(root, 'src/data/routes/高松.json'), 'utf8'))['高松'];

/**
 * ルートの先頭を差し替えてコピーを作成
 * @param {object} base - 元ルート
 * @param {Array} prefix - 先頭に追加するステップ列
 * @param {number} skip - ベースの先頭から何ステップ省くか
 */
function rebase(base, prefix, skip = 0) {
  const mainSteps = [...prefix, ...base.main.slice(skip)];
  return {
    main: mainSteps,
    last: base.last,
    gateway: base.gateway,
  };
}

/**
 * ルートを直接上書き
 */
function override(main, last, gateway) {
  return { main, last, gateway };
}

/* ── 各都市の設定 ──
 * strategy: 基本戦略
 *   'tokyo-based'  : 東京データを流用（先頭に東京への接続を追加）
 *   'osaka-based'  : 大阪データを流用
 *   'hakata-based' : 福岡データを流用
 *   'takamatsu-based': 高松データを流用
 *   'custom'       : 完全カスタム
 *
 * prefix: [step, ...] 先頭に追加するステップ
 * skip: ベースデータの先頭から省くステップ数
 */

const CITY_CONFIGS = {

  /* ── 北海道 ── */
  '札幌': {
    // 東京データの「羽田→新千歳→...」を「新千歳→...」に変換
    // 北海道内は直接アクセス
    // 本州方面は新千歳空港から
    customBuilder: (destName, destData) => {
      const base = tokyoData[destName];
      if (!base) return null;

      // 北海道内の目的地: 札幌駅からJR
      const hokkaidoInternalMap = {
        '小樽':    override([hub('rail','札幌','小樽','JR函館本線')], [], {main:'小樽',final:'小樽'}),
        '富良野':  override([hub('rail','札幌','旭川','JR函館本線'), hub('rail','旭川','富良野','JR富良野線')], [], {main:'旭川',final:'富良野'}),
        '洞爺湖':  override([hub('rail','札幌','洞爺','JR室蘭本線')], [s('bus','洞爺','洞爺湖温泉','バス')], {main:'洞爺',final:'洞爺湖温泉'}),
        '登別':    override([hub('rail','札幌','登別','JR室蘭本線')], [], {main:'登別',final:'登別'}),
        '知床':    override([hub('rail','札幌','旭川','JR函館本線'), hub('rail','旭川','網走','JR石北本線'), hub('rail','網走','知床斜里','JR釧網本線')], [s('bus','知床斜里','知床','バス')], {main:'網走',final:'知床'}),
        '定山渓':  override([],                [s('bus','札幌','定山渓','バス')], {main:'札幌',final:'定山渓'}),
        '美瑛':    override([hub('rail','札幌','旭川','JR函館本線'), hub('rail','旭川','美瑛','JR富良野線')], [], {main:'旭川',final:'美瑛'}),
        '積丹':    override([hub('rail','札幌','小樽','JR函館本線')], [s('bus','小樽','積丹','バス')], {main:'小樽',final:'積丹'}),
        '層雲峡':  override([hub('rail','札幌','旭川','JR函館本線'), hub('rail','旭川','上川','JR石北本線')], [s('bus','上川','層雲峡','バス')], {main:'旭川',final:'層雲峡'}),
        '礼文島':  override([hub('rail','札幌','稚内','JR宗谷本線'), s('ferry','稚内港','香深港','ハートランドフェリー')], [], {main:'稚内',final:'香深港'}),
        '利尻島':  override([hub('rail','札幌','稚内','JR宗谷本線'), s('ferry','稚内港','鴛泊港','ハートランドフェリー')], [], {main:'稚内',final:'鴛泊港'}),
        '阿寒湖':  override([hub('rail','札幌','釧路','JR特急おおぞら')], [s('bus','釧路','阿寒湖','バス')], {main:'釧路',final:'阿寒湖'}),
        '網走':    override([hub('rail','札幌','旭川','JR函館本線'), hub('rail','旭川','網走','JR石北本線')], [], {main:'網走',final:'網走'}),
        '支笏湖':  override([hub('rail','札幌','千歳','JR千歳線')], [s('bus','千歳','支笏湖','バス')], {main:'千歳',final:'支笏湖'}),
        '稚内':    override([hub('rail','札幌','稚内','JR宗谷本線')], [], {main:'稚内',final:'稚内'}),
        '帯広':    override([hub('rail','札幌','帯広','JR特急おおぞら')], [], {main:'帯広',final:'帯広'}),
        '羅臼':    override([hub('rail','札幌','旭川','JR函館本線'), hub('rail','旭川','網走','JR石北本線'), hub('rail','網走','知床斜里','JR釧網本線')], [s('bus','知床斜里','羅臼','バス')], {main:'網走',final:'羅臼'}),
        '江差':    override([hub('rail','札幌','函館','JR函館本線特急北斗')], [s('bus','函館','江差','バス')], {main:'函館',final:'江差'}),
        'ニセコ':  override([hub('rail','札幌','倶知安','JR函館本線')], [], {main:'倶知安',final:'倶知安'}),
        '大雪山':  override([hub('rail','札幌','旭川','JR函館本線')], [s('bus','旭川','旭岳温泉','バス')], {main:'旭川',final:'旭岳温泉'}),
        '白老':    override([hub('rail','札幌','白老','JR室蘭本線')], [], {main:'白老',final:'白老'}),
        'トマム':  override([hub('rail','札幌','トマム','JR石勝線')], [], {main:'トマム',final:'トマム'}),
      };
      if (hokkaidoInternalMap[destName]) return hokkaidoInternalMap[destName];

      // 本州以南: 新千歳から飛行機
      // 東京データの羽田（2ステップ）をスキップし、新千歳直接から
      const CHITOSE_TO_TOKYO = hub('flight','新千歳空港','羽田空港','直行便');
      // 東京の行き先データで mainが[羽田,飛行機,...]の場合は飛行機前提
      // mainが[東京系]の場合は新千歳→羽田→東京と付け替え
      const isHokkaidoFlight = base.main[0]?.to === '羽田空港' || base.main[0]?.line?.includes('モノレール');
      if (isHokkaidoFlight) {
        // 沖縄など: 既に飛行機ルート → 新千歳→羽田→那覇 etc
        const afterFlight = base.main.slice(2); // skip [羽田, 那覇]
        return rebase(base, [CHITOSE_TO_TOKYO, hub('rail','羽田空港','東京','モノレール')], 2);
      }
      // 鉄道ルート: 新千歳→羽田→東京→各地
      return rebase(base, [CHITOSE_TO_TOKYO, hub('rail','羽田空港','東京','モノレール')]);
    }
  },

  '函館': {
    customBuilder: (destName) => {
      const hokkaidoMap = {
        '小樽':    override([hub('rail','函館','札幌','JR特急北斗'), hub('rail','札幌','小樽','JR函館本線')], [], {main:'札幌',final:'小樽'}),
        '富良野':  override([hub('rail','函館','旭川','JR特急北斗＋函館本線'), hub('rail','旭川','富良野','JR富良野線')], [], {main:'旭川',final:'富良野'}),
        '洞爺湖':  override([hub('rail','函館','洞爺','JR室蘭本線')], [s('bus','洞爺','洞爺湖温泉','バス')], {main:'洞爺',final:'洞爺湖温泉'}),
        '登別':    override([hub('rail','函館','登別','JR室蘭本線')], [], {main:'登別',final:'登別'}),
        '知床':    override([hub('rail','函館','旭川','JR函館本線特急'), hub('rail','旭川','網走','JR石北本線'), hub('rail','網走','知床斜里','JR釧網本線')], [s('bus','知床斜里','知床','バス')], {main:'網走',final:'知床'}),
        '定山渓':  override([hub('rail','函館','札幌','JR特急北斗')], [s('bus','札幌','定山渓','バス')], {main:'札幌',final:'定山渓'}),
        '美瑛':    override([hub('rail','函館','旭川','JR特急カムイ'), hub('rail','旭川','美瑛','JR富良野線')], [], {main:'旭川',final:'美瑛'}),
        '積丹':    override([hub('rail','函館','小樽','JR函館本線'), s('bus','小樽','積丹','バス')], [], {main:'小樽',final:'積丹'}),
        '層雲峡':  override([hub('rail','函館','旭川','JR函館本線'), hub('rail','旭川','上川','JR石北本線')], [s('bus','上川','層雲峡','バス')], {main:'旭川',final:'層雲峡'}),
        '礼文島':  override([hub('rail','函館','稚内','JR函館本線＋宗谷本線'), s('ferry','稚内港','香深港','ハートランドフェリー')], [], {main:'稚内',final:'香深港'}),
        '利尻島':  override([hub('rail','函館','稚内','JR函館本線＋宗谷本線'), s('ferry','稚内港','鴛泊港','ハートランドフェリー')], [], {main:'稚内',final:'鴛泊港'}),
        '阿寒湖':  override([hub('rail','函館','釧路','JR特急北斗＋おおぞら')], [s('bus','釧路','阿寒湖','バス')], {main:'釧路',final:'阿寒湖'}),
        '網走':    override([hub('rail','函館','旭川','JR函館本線'), hub('rail','旭川','網走','JR石北本線')], [], {main:'網走',final:'網走'}),
        '支笏湖':  override([hub('rail','函館','千歳','JR室蘭本線')], [s('bus','千歳','支笏湖','バス')], {main:'千歳',final:'支笏湖'}),
        '稚内':    override([hub('rail','函館','旭川','JR函館本線'), hub('rail','旭川','稚内','JR宗谷本線')], [], {main:'旭川',final:'稚内'}),
        '帯広':    override([hub('rail','函館','帯広','JR特急北斗＋おおぞら')], [], {main:'帯広',final:'帯広'}),
        '羅臼':    override([hub('rail','函館','旭川','JR函館本線'), hub('rail','旭川','網走','JR石北本線'), hub('rail','網走','知床斜里','JR釧網本線')], [s('bus','知床斜里','羅臼','バス')], {main:'網走',final:'羅臼'}),
        '江差':    override([s('bus','函館','江差','バス')], [], {main:'函館',final:'江差'}),
        'ニセコ':  override([hub('rail','函館','倶知安','JR函館本線')], [], {main:'倶知安',final:'倶知安'}),
        '大雪山':  override([hub('rail','函館','旭川','JR函館本線'), s('bus','旭川','旭岳温泉','バス')], [], {main:'旭川',final:'旭岳温泉'}),
        '白老':    override([hub('rail','函館','白老','JR室蘭本線')], [], {main:'白老',final:'白老'}),
        'トマム':  override([hub('rail','函館','トマム','JR石勝線')], [], {main:'トマム',final:'トマム'}),
      };
      if (hokkaidoMap[destName]) return hokkaidoMap[destName];
      // 本州以南: 函館空港→羽田→各地（東京データ流用）
      const base = tokyoData[destName];
      if (!base) return null;
      return rebase(base, [hub('flight','函館空港','羽田空港','直行便'), hub('rail','羽田空港','東京','モノレール')]);
    }
  },

  '旭川': {
    customBuilder: (destName) => {
      const hokkaidoMap = {
        '小樽':    override([hub('rail','旭川','小樽','JR函館本線')], [], {main:'小樽',final:'小樽'}),
        '富良野':  override([hub('rail','旭川','富良野','JR富良野線')], [], {main:'富良野',final:'富良野'}),
        '洞爺湖':  override([hub('rail','旭川','洞爺','JR函館本線＋室蘭本線')], [s('bus','洞爺','洞爺湖温泉','バス')], {main:'洞爺',final:'洞爺湖温泉'}),
        '登別':    override([hub('rail','旭川','登別','JR室蘭本線')], [], {main:'登別',final:'登別'}),
        '知床':    override([hub('rail','旭川','網走','JR石北本線'), hub('rail','網走','知床斜里','JR釧網本線')], [s('bus','知床斜里','知床','バス')], {main:'網走',final:'知床'}),
        '定山渓':  override([hub('rail','旭川','札幌','JR函館本線')], [s('bus','札幌','定山渓','バス')], {main:'札幌',final:'定山渓'}),
        '美瑛':    override([hub('rail','旭川','美瑛','JR富良野線')], [], {main:'美瑛',final:'美瑛'}),
        '積丹':    override([hub('rail','旭川','小樽','JR函館本線')], [s('bus','小樽','積丹','バス')], {main:'小樽',final:'積丹'}),
        '層雲峡':  override([hub('rail','旭川','上川','JR石北本線')], [s('bus','上川','層雲峡','バス')], {main:'上川',final:'層雲峡'}),
        '礼文島':  override([hub('rail','旭川','稚内','JR宗谷本線'), s('ferry','稚内港','香深港','ハートランドフェリー')], [], {main:'稚内',final:'香深港'}),
        '利尻島':  override([hub('rail','旭川','稚内','JR宗谷本線'), s('ferry','稚内港','鴛泊港','ハートランドフェリー')], [], {main:'稚内',final:'鴛泊港'}),
        '阿寒湖':  override([hub('rail','旭川','釧路','JR石北本線＋釧網本線')], [s('bus','釧路','阿寒湖','バス')], {main:'釧路',final:'阿寒湖'}),
        '網走':    override([hub('rail','旭川','網走','JR石北本線')], [], {main:'網走',final:'網走'}),
        '支笏湖':  override([hub('rail','旭川','千歳','JR函館本線')], [s('bus','千歳','支笏湖','バス')], {main:'千歳',final:'支笏湖'}),
        '稚内':    override([hub('rail','旭川','稚内','JR宗谷本線')], [], {main:'稚内',final:'稚内'}),
        '帯広':    override([hub('rail','旭川','帯広','JR石北本線＋おおぞら')], [], {main:'帯広',final:'帯広'}),
        '羅臼':    override([hub('rail','旭川','網走','JR石北本線'), hub('rail','網走','知床斜里','JR釧網本線')], [s('bus','知床斜里','羅臼','バス')], {main:'網走',final:'羅臼'}),
        '江差':    override([hub('rail','旭川','函館','JR函館本線')], [s('bus','函館','江差','バス')], {main:'函館',final:'江差'}),
        'ニセコ':  override([hub('rail','旭川','倶知安','JR函館本線')], [], {main:'倶知安',final:'倶知安'}),
        '大雪山':  override([s('bus','旭川','旭岳温泉','バス')], [], {main:'旭川',final:'旭岳温泉'}),
        '白老':    override([hub('rail','旭川','白老','JR室蘭本線')], [], {main:'白老',final:'白老'}),
        'トマム':  override([hub('rail','旭川','トマム','JR石勝線')], [], {main:'トマム',final:'トマム'}),
      };
      if (hokkaidoMap[destName]) return hokkaidoMap[destName];
      const base = tokyoData[destName];
      if (!base) return null;
      return rebase(base, [hub('flight','旭川空港','羽田空港','直行便'), hub('rail','羽田空港','東京','モノレール')]);
    }
  },
};

/* ── テンプレートベース都市設定（simpler版）── */
// 各都市の設定: [base, prefix, skip]
const TEMPLATE_CITIES = {
  // 関東グループ - 東京データほぼそのまま（微修正）
  '横浜': { base: 'tokyo', prefix: [], skip: 0,
    overrides: {
      '鎌倉': override([hub('rail','横浜','鎌倉','JR横須賀線')], [], {main:'鎌倉',final:'鎌倉'}),
      '江の島': override([hub('rail','横浜','片瀬江ノ島','小田急江ノ島線')], [], {main:'片瀬江ノ島',final:'片瀬江ノ島'}),
      '三浦': override([hub('rail','横浜','三崎口','京急')], [], {main:'三崎口',final:'三崎口'}),
      '高尾山': override([hub('rail','横浜','高尾山口','京王高尾線')], [], {main:'高尾山口',final:'高尾山口'}),
      '奥多摩': override([hub('rail','横浜','奥多摩','JR横浜線＋青梅線')], [], {main:'奥多摩',final:'奥多摩'}),
      '箱根': override([hub('rail','横浜','箱根湯本','小田急ロマンスカー')], [], {main:'箱根湯本',final:'箱根湯本'}),
    },
    // 東京を経由するルートの先頭から東京→各地 へ
    transform: (destName, base) => {
      // 東京データでmainが[東京系]の場合、横浜から直接その目的地へ付け替え
      // ただし新幹線系は横浜→新横浜→で代替
      const m = base.main;
      if (!m || m.length === 0) return base;
      const firstTo = m[0]?.to;
      // 新幹線ハブなら新横浜を使う
      const shinkansen = ['名古屋','新大阪','博多','鹿児島中央','岡山','広島','新山口','福山',
        '仙台','盛岡','新青森','八戸','秋田','山形','新潟','長野','富山','金沢','北陸新幹線'];
      const isShinkansen = shinkansen.some(h => firstTo?.includes(h));
      if (isShinkansen) {
        return rebase(base, [hub('rail','横浜','新横浜','JR横浜線')]);
      }
      // 東北・山形など新幹線: 新横浜で乗り換え
      if (['一ノ関','郡山','大石田','米沢','山寺','角館','田沢湖','秋田','北上','花巻',
           '新花巻','盛岡','八戸','新青森'].some(h => firstTo === h)) {
        return rebase(base, [hub('rail','横浜','新横浜','JR横浜線')]);
      }
      // 羽田空港: 横浜→京急→羽田
      if (firstTo === '羽田空港') {
        return rebase(base, [hub('rail','横浜','羽田空港','京急')], 1);
      }
      return base;
    }
  },

  '千葉': { base: 'tokyo',
    transform: (destName, base) => {
      const m = base.main;
      if (!m || m.length === 0) return base;
      const firstTo = m[0]?.to;
      const shinkansen = ['名古屋','新大阪','博多','鹿児島中央','岡山','広島','新山口','福山'];
      if (shinkansen.some(h => firstTo === h) || firstTo === '東京') {
        return rebase(base, [hub('rail','千葉','東京','JR総武快速線')]);
      }
      if (firstTo === '羽田空港') {
        return rebase(base, [hub('rail','千葉','東京','JR総武快速線'), hub('rail','東京','羽田空港','モノレール')], 1);
      }
      return rebase(base, [hub('rail','千葉','東京','JR総武快速線')]);
    }
  },

  '大宮': { base: 'tokyo',
    transform: (destName, base) => {
      const m = base.main;
      if (!m || m.length === 0) return base;
      const firstTo = m[0]?.to;
      // 新幹線系: 大宮から直接
      const shinkansens = {
        '仙台': 'JR東北新幹線', '盛岡': 'JR東北新幹線', '新青森': 'JR東北新幹線',
        '八戸': 'JR東北新幹線', '秋田': 'JR秋田新幹線', '山形': 'JR山形新幹線',
        '一ノ関': 'JR東北新幹線', '郡山': 'JR東北新幹線', '北上': 'JR東北新幹線',
        '新花巻': 'JR東北新幹線', '角館': 'JR秋田新幹線', '田沢湖': 'JR秋田新幹線',
        '米沢': 'JR山形新幹線', '大石田': 'JR山形新幹線', '山寺': 'JR山形新幹線',
        '新潟': 'JR上越新幹線', '長岡': 'JR上越新幹線', '越後湯沢': 'JR上越新幹線',
        '長野': 'JR北陸新幹線', '飯山': 'JR北陸新幹線', '軽井沢': 'JR北陸新幹線',
        '上田': 'JR北陸新幹線', '糸魚川': 'JR北陸新幹線', '富山': 'JR北陸新幹線',
        '金沢': 'JR北陸新幹線', '敦賀': 'JR北陸新幹線', '福井': 'JR北陸新幹線',
        '名古屋': '東海道新幹線', '新大阪': '東海道新幹線', '博多': '東海道・山陽新幹線',
        '岡山': '東海道・山陽新幹線', '広島': '東海道・山陽新幹線',
        '鹿児島中央': '東海道・山陽・九州新幹線', '熊本': '東海道・山陽・九州新幹線',
      };
      if (shinkansens[firstTo]) {
        // 大宮から直接その新幹線
        return { main: [hub('rail','大宮',firstTo,shinkansens[firstTo]), ...m.slice(1)], last: base.last, gateway: base.gateway };
      }
      if (firstTo === '羽田空港') {
        return rebase(base, [hub('rail','大宮','東京','JR'), hub('rail','東京','羽田空港','モノレール')], 1);
      }
      return rebase(base, [hub('rail','大宮','東京','JR湘南新宿ライン')]);
    }
  },

  '宇都宮': { base: 'tokyo',
    transform: (destName, base) => {
      const m = base.main;
      if (!m || m.length === 0) return base;
      const firstTo = m[0]?.to;
      const shinkansen = ['名古屋','新大阪','博多','鹿児島中央','岡山','広島','新山口','福山',
        '新潟','長野','富山','金沢','敦賀','福井'];
      if (shinkansen.some(h => firstTo === h)) {
        return rebase(base, [hub('rail','宇都宮','東京','JR宇都宮線')]);
      }
      // 東北新幹線: 宇都宮から直接
      const tohokuShin = {
        '仙台':'東北新幹線','盛岡':'東北新幹線','新青森':'東北新幹線',
        '八戸':'東北新幹線','一ノ関':'東北新幹線','郡山':'東北新幹線',
        '北上':'東北新幹線','新花巻':'東北新幹線','秋田':'秋田新幹線',
        '角館':'秋田新幹線','田沢湖':'秋田新幹線','山形':'山形新幹線',
        '米沢':'山形新幹線','大石田':'山形新幹線','山寺':'山形新幹線',
      };
      if (tohokuShin[firstTo]) {
        return { main: [hub('rail','宇都宮',firstTo,tohokuShin[firstTo]), ...m.slice(1)], last: base.last, gateway: base.gateway };
      }
      if (firstTo === '羽田空港') {
        return rebase(base, [hub('rail','宇都宮','東京','JR宇都宮線'), hub('rail','東京','羽田空港','モノレール')], 1);
      }
      return rebase(base, [hub('rail','宇都宮','東京','JR宇都宮線')]);
    }
  },

  // 東北グループ
  '仙台': { base: 'tokyo',
    transform: (destName, base) => {
      const m = base.main;
      if (!m || m.length === 0) return base;
      const firstTo = m[0]?.to;
      // 東北内: 仙台から直接
      const localMap = {
        '松島':    override([hub('rail','仙台','松島海岸','JR仙石線')], [], {main:'松島海岸',final:'松島海岸'}),
        '鳴子温泉':override([hub('rail','仙台','鳴子温泉','JR陸羽東線')], [], {main:'鳴子温泉',final:'鳴子温泉'}),
        '秋保温泉':override([], [s('bus','仙台','秋保温泉','バス')], {main:'仙台',final:'秋保温泉'}),
        '南三陸':  override([s('bus','仙台','気仙沼','バスBRT'), s('bus','気仙沼','南三陸','BRT')], [], {main:'仙台',final:'南三陸'}),
      };
      if (localMap[destName]) return localMap[destName];
      // 東北新幹線系: 仙台から北へ
      const tohokuNorth = {
        '平泉': [hub('rail','仙台','一ノ関','東北新幹線'), hub('rail','一ノ関','平泉','JR東北本線')],
        '一ノ関': [hub('rail','仙台','一ノ関','東北新幹線')],
        '盛岡': [hub('rail','仙台','盛岡','東北新幹線')],
        '宮古': [hub('rail','仙台','盛岡','東北新幹線'), hub('rail','盛岡','宮古','JR山田線')],
        '角館': [hub('rail','仙台','盛岡','東北新幹線'), hub('rail','盛岡','角館','秋田新幹線')],
        '秋田': [hub('rail','仙台','秋田','秋田新幹線')],
        '田沢湖': [hub('rail','仙台','盛岡','東北新幹線'), hub('rail','盛岡','田沢湖','秋田新幹線')],
        '乳頭温泉': null, // handled below
        '釜石': [hub('rail','仙台','新花巻','東北新幹線'), hub('rail','新花巻','釜石','JR釜石線')],
        '花巻': [hub('rail','仙台','新花巻','東北新幹線')],
        '八幡平': [hub('rail','仙台','盛岡','東北新幹線')],
        '北上': [hub('rail','仙台','北上','東北新幹線')],
        '大船渡': [hub('rail','仙台','一ノ関','東北新幹線')],
        '遠野': [hub('rail','仙台','新花巻','東北新幹線'), hub('rail','新花巻','遠野','JR釜石線')],
        '気仙沼': [hub('rail','仙台','一ノ関','東北新幹線'), s('bus','一ノ関','気仙沼','BRT')],
        '弘前': [hub('rail','仙台','新青森','東北新幹線'), hub('rail','新青森','弘前','JR奥羽本線')],
        '奥入瀬': [hub('rail','仙台','八戸','東北新幹線')],
        '十和田': [hub('rail','仙台','八戸','東北新幹線')],
        '久慈': [hub('rail','仙台','八戸','東北新幹線'), hub('rail','八戸','久慈','JR八戸線')],
        '五所川原': [hub('rail','仙台','新青森','東北新幹線'), hub('rail','新青森','五所川原','JR五能線')],
        '恐山': [hub('rail','仙台','新青森','東北新幹線'), hub('rail','新青森','下北','JR大湊線')],
      };
      if (tohokuNorth[destName]) {
        const steps = tohokuNorth[destName];
        const base2 = tokyoData[destName];
        if (!base2) return null;
        // lastステップはbaseから引用
        const mainIdx = base2.main.findIndex(s2 => steps.length > 0 && s2.to === steps[steps.length-1].to);
        return { main: steps, last: base2.last, gateway: base2.gateway };
      }
      // 会津若松: 仙台→郡山
      if (firstTo === '郡山' || destName === '会津若松' || destName === '大内宿' || destName === '裏磐梯') {
        return rebase(base, [hub('rail','仙台','郡山','東北新幹線')], 1);
      }
      if (firstTo === '山形' || firstTo === '大石田' || firstTo === '米沢' || firstTo === '山寺') {
        return { main: [hub('rail','仙台',firstTo,m[0].line || '山形新幹線'), ...m.slice(1)], last: base.last, gateway: base.gateway };
      }
      // 酒田・出羽三山: 仙台→新潟
      if (firstTo === '新潟') {
        return rebase(base, [hub('rail','仙台','新潟','JR特急いなほ系')], 1);
      }
      // 本州以西: 東京経由
      return rebase(base, [hub('rail','仙台','東京','東北新幹線')]);
    }
  },

  '盛岡': { base: 'tokyo',
    transform: (destName, base) => {
      const localMap = {
        '宮古': override([hub('rail','盛岡','宮古','JR山田線')], [], {main:'宮古',final:'宮古'}),
        '八幡平': override([], [s('bus','盛岡','八幡平頂上','バス')], {main:'盛岡',final:'八幡平'}),
        '北上': override([hub('rail','盛岡','北上','JR東北本線')], [], {main:'北上',final:'北上'}),
        '釜石': override([hub('rail','盛岡','新花巻','JR'), hub('rail','新花巻','釜石','JR釜石線')], [], {main:'新花巻',final:'釜石'}),
        '遠野': override([hub('rail','盛岡','新花巻','JR'), hub('rail','新花巻','遠野','JR釜石線')], [], {main:'新花巻',final:'遠野'}),
        '花巻': override([hub('rail','盛岡','新花巻','JR東北本線')], [], {main:'新花巻',final:'新花巻'}),
        '角館': override([hub('rail','盛岡','角館','秋田新幹線')], [], {main:'角館',final:'角館'}),
        '乳頭温泉': override([hub('rail','盛岡','角館','秋田新幹線')], [s('bus','角館','乳頭温泉','バス')], {main:'角館',final:'乳頭温泉'}),
        '田沢湖': override([hub('rail','盛岡','田沢湖','秋田新幹線')], [], {main:'田沢湖',final:'田沢湖'}),
        '秋田': override([hub('rail','盛岡','秋田','秋田新幹線')], [], {main:'秋田',final:'秋田'}),
        '男鹿': override([hub('rail','盛岡','秋田','秋田新幹線'), hub('rail','秋田','男鹿','JR男鹿線')], [], {main:'秋田',final:'男鹿'}),
      };
      if (localMap[destName]) return localMap[destName];
      const m = base.main;
      const firstTo = m?.[0]?.to;
      // 東北新幹線北方向: 盛岡から北
      if (['新青森','八戸'].includes(firstTo)) {
        return { main: [hub('rail','盛岡',firstTo,'東北新幹線'), ...m.slice(1)], last: base.last, gateway: base.gateway };
      }
      // 仙台方向: 盛岡→仙台→東京
      return rebase(base, [hub('rail','盛岡','仙台','東北新幹線'), hub('rail','仙台','東京','東北新幹線')], 1);
    }
  },

  // 中部グループ
  '長野': { base: 'tokyo',
    transform: (destName, base) => {
      const localMap = {
        '小布施': override([hub('rail','長野','小布施','長野電鉄')], [], {main:'小布施',final:'小布施'}),
        '別所温泉': override([hub('rail','長野','上田','JR北陸新幹線'), hub('rail','上田','別所温泉','上田電鉄')], [], {main:'上田',final:'別所温泉'}),
        '野沢温泉': override([hub('rail','長野','飯山','JR北陸新幹線')], [s('bus','飯山','野沢温泉','バス')], {main:'飯山',final:'野沢温泉'}),
        '飯山': override([hub('rail','長野','飯山','JR北陸新幹線')], [], {main:'飯山',final:'飯山'}),
        '白馬': override([hub('rail','長野','白馬','JR大糸線')], [], {main:'白馬',final:'白馬'}),
        '松代': override([], [], {main:'長野',final:'長野'}),
        '地獄谷野猿公苑': override([hub('rail','長野','湯田中','長野電鉄')], [s('bus','湯田中','地獄谷野猿公苑','バス')], {main:'湯田中',final:'地獄谷野猿公苑'}),
        '妙高高原': override([hub('rail','長野','妙高高原','えちごトキめき鉄道')], [], {main:'妙高高原',final:'妙高高原'}),
        '糸魚川': override([hub('rail','長野','糸魚川','JR北陸新幹線')], [], {main:'糸魚川',final:'糸魚川'}),
      };
      if (localMap[destName]) return localMap[destName];
      const m = base.main;
      const firstTo = m?.[0]?.to;
      // 東京経由系: 長野→東京（北陸新幹線）
      return rebase(base, [hub('rail','長野','東京','JR北陸新幹線')]);
    }
  },

  '静岡': { base: 'tokyo',
    transform: (destName, base) => {
      const localMap = {
        '熱海': override([hub('rail','静岡','熱海','JR東海道線')], [], {main:'熱海',final:'熱海'}),
        '修善寺': override([hub('rail','静岡','三島','JR東海道線'), hub('rail','三島','修善寺','伊豆箱根鉄道')], [], {main:'三島',final:'修善寺'}),
        '下田': override([hub('rail','静岡','熱海','JR東海道線'), hub('rail','熱海','伊豆急下田','伊豆急行')], [], {main:'熱海',final:'伊豆急下田'}),
        '伊豆高原': override([hub('rail','静岡','熱海','JR東海道線'), hub('rail','熱海','伊豆高原','伊豆急行')], [], {main:'熱海',final:'伊豆高原'}),
        '南伊豆': override([hub('rail','静岡','熱海','JR東海道線'), hub('rail','熱海','伊豆急下田','伊豆急行')], [], {main:'熱海',final:'伊豆急下田'}),
        '伊東': override([hub('rail','静岡','熱海','JR東海道線'), hub('rail','熱海','伊東','JR伊東線')], [], {main:'熱海',final:'伊東'}),
        '富士宮': override([hub('rail','静岡','富士宮','JR身延線')], [], {main:'富士宮',final:'富士宮'}),
        '富士河口湖': override([hub('rail','静岡','富士宮','JR身延線'), s('bus','富士宮','河口湖','バス')], [], {main:'富士宮',final:'河口湖'}),
      };
      if (localMap[destName]) return localMap[destName];
      const m = base.main;
      const firstTo = m?.[0]?.to;
      // 東京方向
      if (['東京','軽井沢','長野','金沢','富山','敦賀','福井','新潟','仙台','盛岡','新青森',
           '八戸','秋田','山形','越後湯沢','長岡','糸魚川'].includes(firstTo)) {
        return rebase(base, [hub('rail','静岡','東京','JR東海道新幹線')]);
      }
      // 名古屋方向
      if (['名古屋','新大阪','博多','鹿児島中央','岡山','広島','新山口','福山','熊本'].includes(firstTo)) {
        return rebase(base, [hub('rail','静岡','名古屋','JR東海道新幹線')]);
      }
      // 羽田: 静岡から飛行機
      if (firstTo === '羽田空港') {
        return { main: [hub('flight','静岡空港',m[1]?.to || '羽田空港','直行便'), ...m.slice(2)], last: base.last, gateway: base.gateway };
      }
      return rebase(base, [hub('rail','静岡','東京','JR東海道新幹線')]);
    }
  },

  '名古屋': { base: 'osaka',
    transform: (destName, base) => {
      const localMap = {
        '伊勢': override([hub('rail','名古屋','伊勢市','近鉄特急')], [], {main:'伊勢市',final:'伊勢市'}),
        '鳥羽': override([hub('rail','名古屋','鳥羽','近鉄特急')], [], {main:'鳥羽',final:'鳥羽'}),
        '志摩': override([hub('rail','名古屋','賢島','近鉄特急')], [], {main:'賢島',final:'賢島'}),
        '犬山': override([hub('rail','名古屋','犬山','名鉄犬山線')], [], {main:'犬山',final:'犬山'}),
        '高山': override([hub('rail','名古屋','高山','特急ひだ')], [], {main:'高山',final:'高山'}),
        '下呂温泉': override([hub('rail','名古屋','下呂','特急ひだ')], [], {main:'下呂',final:'下呂'}),
        '飛騨古川': override([hub('rail','名古屋','飛騨古川','特急ひだ')], [], {main:'飛騨古川',final:'飛騨古川'}),
        '奥飛騨温泉郷': override([hub('rail','名古屋','高山','特急ひだ')], [s('bus','高山','平湯温泉','バス')], {main:'高山',final:'平湯温泉'}),
        '木曽': override([hub('rail','名古屋','南木曽','JR中央本線')], [], {main:'南木曽',final:'南木曽'}),
        '妻籠': override([hub('rail','名古屋','南木曽','JR中央本線')], [], {main:'南木曽',final:'南木曽'}),
        '馬籠': override([hub('rail','名古屋','中津川','JR中央本線')], [s('bus','中津川','馬籠','バス')], {main:'中津川',final:'馬籠'}),
        '郡上八幡': override([hub('rail','名古屋','郡上八幡','長良川鉄道')], [], {main:'郡上八幡',final:'郡上八幡'}),
        '大垣': override([hub('rail','名古屋','大垣','JR東海道線')], [], {main:'大垣',final:'大垣'}),
        '常滑': override([hub('rail','名古屋','常滑','名鉄常滑線')], [], {main:'常滑',final:'常滑'}),
        '香嵐渓': override([hub('rail','名古屋','豊田市','名鉄')], [s('bus','豊田市','香嵐渓','バス')], {main:'豊田市',final:'香嵐渓'}),
        '南知多': override([hub('rail','名古屋','内海','名鉄知多新線')], [], {main:'内海',final:'内海'}),
        '松阪': override([hub('rail','名古屋','松阪','近鉄特急')], [], {main:'松阪',final:'松阪'}),
        '諏訪': override([hub('rail','名古屋','上諏訪','特急しなの')], [], {main:'上諏訪',final:'上諏訪'}),
        '上高地': override([hub('rail','名古屋','松本','特急しなの'), s('bus','松本','上高地','バス')], [], {main:'松本',final:'上高地バスターミナル'}),
        '乗鞍': override([hub('rail','名古屋','松本','特急しなの')], [s('bus','松本','畳平','バス')], {main:'松本',final:'畳平'}),
        '奈良井宿': override([hub('rail','名古屋','奈良井','JR中央本線')], [], {main:'奈良井',final:'奈良井'}),
        '蓼科': override([hub('rail','名古屋','茅野','JR中央本線')], [s('bus','茅野','蓼科','バス')], {main:'茅野',final:'蓼科'}),
        '天竜峡': override([hub('rail','名古屋','天竜峡','JR飯田線')], [], {main:'天竜峡',final:'天竜峡'}),
        '富士宮': override([hub('rail','名古屋','富士宮','JR身延線')], [], {main:'富士宮',final:'富士宮'}),
        '富士河口湖': override([hub('rail','名古屋','甲府','JR中央本線'), hub('rail','甲府','河口湖','JR身延線＋富士急行')], [], {main:'甲府',final:'河口湖'}),
        '伊賀': override([hub('rail','名古屋','上野市','JR関西本線＋近鉄')], [], {main:'上野市',final:'上野市'}),
      };
      if (localMap[destName]) return localMap[destName];
      const m = base.main;
      const firstTo = m?.[0]?.to;
      // 大阪発のルートを名古屋から使える形に変換
      // 大阪から新大阪経由: 名古屋→新大阪
      if (firstTo === '新大阪' || firstTo === '岡山' || firstTo === '広島' || firstTo === '博多' ||
          firstTo === '新山口' || firstTo === '福山' || firstTo === '鹿児島中央') {
        return rebase(base, [hub('rail','名古屋',firstTo,'東海道・山陽新幹線')], 1);
      }
      // 大阪から東京経由: 名古屋→東京
      if (firstTo === '東京') {
        return rebase(base, [hub('rail','名古屋','東京','東海道新幹線')], 1);
      }
      // 近畿直通: 名古屋から
      if (['奈良','伊勢市','橿原神宮前','吉野','飛鳥','伏見稲荷','嵐山','高野山','信楽'].includes(base.gateway?.final) ||
          ['大阪','奈良','大和路線','近鉄','南海'].some(k => m[0]?.line?.includes(k))) {
        return rebase(base, [hub('rail','名古屋','新大阪','東海道新幹線')]);
      }
      // 北陸: 名古屋→敦賀（特急しらさぎ）→北陸新幹線
      if (['敦賀','金沢','富山','長野','飯山','糸魚川'].includes(firstTo)) {
        return rebase(base, [hub('rail','名古屋','敦賀','特急しらさぎ')], 1);
      }
      // 羽田: 名古屋→伊丹 or セントレア→各地
      if (firstTo === '伊丹空港') {
        const afterBus = m.slice(1); // 伊丹以降
        return { main: [hub('rail','名古屋','セントレア','名鉄'), ...afterBus.map(st => ({...st, from: st.from === '伊丹空港' ? 'セントレア' : st.from}))], last: base.last, gateway: base.gateway };
      }
      return rebase(base, [hub('rail','名古屋','新大阪','東海道新幹線')]);
    }
  },

  '金沢': { base: 'osaka',
    transform: (destName, base) => {
      const localMap = {
        '輪島': override([s('bus','金沢','輪島','バス')], [], {main:'金沢',final:'輪島バスターミナル'}),
        '白川郷': override([s('bus','金沢','白川郷','高速バス')], [], {main:'金沢',final:'白川郷'}),
        '珠洲': override([s('bus','金沢','珠洲','バス')], [], {main:'金沢',final:'珠洲バスターミナル'}),
        '和倉温泉': override([hub('rail','金沢','和倉温泉','JR七尾線')], [], {main:'和倉温泉',final:'和倉温泉'}),
        '加賀温泉郷': override([hub('rail','金沢','加賀温泉','JR北陸新幹線')], [], {main:'加賀温泉',final:'加賀温泉'}),
        '五箇山': override([s('bus','金沢','五箇山','高速バス')], [], {main:'五箇山',final:'五箇山'}),
        '富山': override([hub('rail','金沢','富山','JR北陸新幹線')], [], {main:'富山',final:'富山'}),
        '立山黒部': override([hub('rail','金沢','富山','JR北陸新幹線'), hub('rail','富山','立山','富山地方鉄道')], [], {main:'富山',final:'立山'}),
        '氷見': override([hub('rail','金沢','富山','JR北陸新幹線'), hub('rail','富山','氷見','JR氷見線')], [], {main:'富山',final:'氷見'}),
        '高山': override([s('bus','金沢','高山','バス')], [], {main:'高山',final:'高山'}),
        '敦賀': override([hub('rail','金沢','敦賀','JR北陸新幹線')], [], {main:'敦賀',final:'敦賀'}),
        '永平寺': override([hub('rail','金沢','福井','JR北陸新幹線'), hub('rail','福井','永平寺口','えちぜん鉄道')], [], {main:'福井',final:'永平寺口'}),
        '越前市': override([hub('rail','金沢','武生','JR北陸新幹線')], [], {main:'武生',final:'武生'}),
        '若狭小浜': override([hub('rail','金沢','敦賀','JR北陸新幹線'), hub('rail','敦賀','小浜','JR小浜線')], [], {main:'敦賀',final:'小浜'}),
        '越前海岸': override([hub('rail','金沢','武生','JR北陸新幹線')], [s('bus','武生','越前海岸','バス')], {main:'武生',final:'越前海岸'}),
        '白馬': override([hub('rail','金沢','長野','JR北陸新幹線'), hub('rail','長野','白馬','JR大糸線')], [], {main:'長野',final:'白馬'}),
        '小布施': override([hub('rail','金沢','長野','JR北陸新幹線'), hub('rail','長野','小布施','長野電鉄')], [], {main:'長野',final:'小布施'}),
        '野沢温泉': override([hub('rail','金沢','長野','JR北陸新幹線'), hub('rail','長野','飯山','JR北陸新幹線')], [s('bus','飯山','野沢温泉','バス')], {main:'飯山',final:'野沢温泉'}),
        '妙高高原': override([hub('rail','金沢','長野','JR北陸新幹線'), hub('rail','長野','妙高高原','えちごトキめき鉄道')], [], {main:'長野',final:'妙高高原'}),
        '糸魚川': override([hub('rail','金沢','糸魚川','JR北陸新幹線')], [], {main:'糸魚川',final:'糸魚川'}),
        '松代': override([hub('rail','金沢','長野','JR北陸新幹線')], [], {main:'長野',final:'長野'}),
        '飯山': override([hub('rail','金沢','飯山','JR北陸新幹線')], [], {main:'飯山',final:'飯山'}),
        '地獄谷野猿公苑': override([hub('rail','金沢','長野','JR北陸新幹線'), hub('rail','長野','湯田中','長野電鉄')], [s('bus','湯田中','地獄谷野猿公苑','バス')], {main:'湯田中',final:'地獄谷野猿公苑'}),
        '別所温泉': override([hub('rail','金沢','長野','JR北陸新幹線'), hub('rail','長野','上田','JR北陸新幹線'), hub('rail','上田','別所温泉','上田電鉄')], [], {main:'上田',final:'別所温泉'}),
      };
      if (localMap[destName]) return localMap[destName];
      const m = base.main;
      const firstTo = m?.[0]?.to;
      // 大阪発のサンダーバード経由をスキップ: 金沢→直接
      if (firstTo === '大阪' && m[0]?.line?.includes('サンダーバード')) {
        return rebase(base, [], 2);
      }
      if (firstTo === '敦賀') {
        return rebase(base, [], 1);
      }
      // 東方向: 東京経由
      const tokyoBound = ['東京','東北','山形','秋田','新潟','仙台','軽井沢','越後湯沢','長岡'];
      if (tokyoBound.some(k => firstTo?.includes(k))) {
        return rebase(base, [hub('rail','金沢','東京','JR北陸新幹線')]);
      }
      // 西方向: 大阪経由
      return rebase(base, [hub('rail','金沢','敦賀','JR北陸新幹線'), hub('rail','敦賀','新大阪','特急サンダーバード')]);
    }
  },

  '富山': { base: 'osaka',
    transform: (destName, base) => {
      const localMap = {
        '立山黒部': override([hub('rail','富山','立山','富山地方鉄道')], [], {main:'立山',final:'立山'}),
        '氷見': override([hub('rail','富山','氷見','JR氷見線')], [], {main:'氷見',final:'氷見'}),
        '白川郷': override([s('bus','富山','白川郷','バス')], [], {main:'富山',final:'白川郷'}),
        '五箇山': override([s('bus','富山','五箇山','バス')], [], {main:'富山',final:'五箇山'}),
        '高山': override([hub('rail','富山','高山','JR高山本線')], [], {main:'高山',final:'高山'}),
        '奥飛騨温泉郷': override([hub('rail','富山','高山','JR高山本線')], [s('bus','高山','平湯温泉','バス')], {main:'高山',final:'平湯温泉'}),
        '和倉温泉': override([hub('rail','富山','金沢','JR北陸新幹線'), hub('rail','金沢','和倉温泉','JR七尾線')], [], {main:'金沢',final:'和倉温泉'}),
        '輪島': override([hub('rail','富山','金沢','JR北陸新幹線'), s('bus','金沢','輪島','バス')], [], {main:'金沢',final:'輪島バスターミナル'}),
        '珠洲': override([hub('rail','富山','金沢','JR北陸新幹線'), s('bus','金沢','珠洲','バス')], [], {main:'金沢',final:'珠洲バスターミナル'}),
      };
      if (localMap[destName]) return localMap[destName];
      const m = base.main;
      const firstTo = m?.[0]?.to;
      if (firstTo === '敦賀') return rebase(base, [hub('rail','富山','敦賀','JR北陸新幹線')], 1);
      // 西方向: 富山→敦賀→大阪
      const westBound = ['大阪','新大阪','岡山','広島','博多','鹿児島中央','新山口','福山'];
      if (westBound.some(h => firstTo === h)) {
        return rebase(base, [hub('rail','富山','敦賀','JR北陸新幹線'), hub('rail','敦賀','新大阪','特急サンダーバード')]);
      }
      // 東方向
      return rebase(base, [hub('rail','富山','東京','JR北陸新幹線')]);
    }
  },

  // 近畿グループ
  '京都': { base: 'osaka',
    transform: (destName, base) => {
      const localMap = {
        '奈良': override([hub('rail','京都','奈良','JR奈良線')], [], {main:'奈良',final:'奈良'}),
        '嵐山': override([hub('rail','京都','嵐山','JR嵯峨野線')], [], {main:'嵐山',final:'嵐山'}),
        '伏見': override([hub('rail','京都','伏見稲荷','JR奈良線')], [], {main:'伏見稲荷',final:'伏見稲荷'}),
        '飛鳥': override([hub('rail','京都','飛鳥','近鉄京都線')], [], {main:'飛鳥',final:'飛鳥'}),
        '橿原': override([hub('rail','京都','橿原神宮前','近鉄京都線')], [], {main:'橿原神宮前',final:'橿原神宮前'}),
        '吉野': override([hub('rail','京都','吉野','近鉄京都線')], [], {main:'吉野',final:'吉野'}),
        '信楽': override([hub('rail','京都','貴生川','JR草津線'), hub('rail','貴生川','信楽','信楽高原鉄道')], [], {main:'貴生川',final:'信楽'}),
        '美山': override([hub('rail','京都','園部','JR嵯峨野線')], [s('bus','園部','美山','バス')], {main:'園部',final:'美山'}),
        '天橋立': override([hub('rail','京都','天橋立','特急はしだて')], [], {main:'天橋立',final:'天橋立'}),
        '伊根': override([hub('rail','京都','天橋立','特急はしだて')], [s('bus','天橋立','伊根港','バス')], {main:'天橋立',final:'伊根港'}),
        '城崎温泉': override([hub('rail','京都','城崎温泉','特急こうのとり')], [], {main:'城崎温泉',final:'城崎温泉'}),
        '舞鶴': override([hub('rail','京都','東舞鶴','特急まいづる')], [], {main:'東舞鶴',final:'東舞鶴'}),
        '彦根': override([hub('rail','京都','彦根','JR琵琶湖線')], [], {main:'彦根',final:'彦根'}),
        '長浜': override([hub('rail','京都','長浜','JR琵琶湖線')], [], {main:'長浜',final:'長浜'}),
        '丹波篠山': override([hub('rail','京都','篠山口','JR福知山線')], [], {main:'篠山口',final:'篠山口'}),
        '洞川温泉': override([hub('rail','京都','下市口','近鉄吉野線')], [s('bus','下市口','洞川温泉','バス')], {main:'下市口',final:'洞川温泉'}),
        '伊賀': override([hub('rail','京都','上野市','近鉄京都線')], [], {main:'上野市',final:'上野市'}),
        '伊勢': override([hub('rail','京都','伊勢市','近鉄特急')], [], {main:'伊勢市',final:'伊勢市'}),
        '鳥羽': override([hub('rail','京都','鳥羽','近鉄特急')], [], {main:'鳥羽',final:'鳥羽'}),
        '志摩': override([hub('rail','京都','賢島','近鉄特急')], [], {main:'賢島',final:'賢島'}),
        '松阪': override([hub('rail','京都','松阪','近鉄特急')], [], {main:'松阪',final:'松阪'}),
      };
      if (localMap[destName]) return localMap[destName];
      const m = base.main;
      const firstTo = m?.[0]?.to;
      // 大阪から（新大阪）: 京都→新大阪でOK
      if (['新大阪','岡山','広島','博多','鹿児島中央','新山口','福山'].includes(firstTo)) {
        return rebase(base, [hub('rail','京都','新大阪','JR東海道線')]);
      }
      if (['大阪','JR大和路線','南海','近鉄'].some(k => m[0]?.from === '大阪' || m[0]?.line?.includes(k))) {
        return { main: m.map(st => ({...st, from: st.from === '大阪' ? '京都' : st.from})), last: base.last, gateway: base.gateway };
      }
      return rebase(base, [hub('rail','京都','新大阪','JR東海道線')]);
    }
  },

  '神戸': { base: 'osaka',
    transform: (destName, base) => {
      const localMap = {
        '有馬温泉': override([hub('rail','三宮','有馬温泉','神戸電鉄')], [], {main:'三宮',final:'有馬温泉'}),
        '淡路島': override([s('bus','三宮','淡路島','高速バス')], [], {main:'三宮',final:'淡路島'}),
        '姫路': override([hub('rail','三宮','姫路','JR新快速')], [], {main:'姫路',final:'姫路'}),
      };
      if (localMap[destName]) return localMap[destName];
      const m = base.main;
      const firstTo = m?.[0]?.to;
      if (['新大阪','岡山','広島','博多','鹿児島中央'].includes(firstTo)) {
        return rebase(base, [hub('rail','三宮','新神戸','JR')]);
      }
      return rebase(base, [hub('rail','三宮','新大阪','JR')]);
    }
  },

  '奈良': { base: 'osaka',
    transform: (destName, base) => {
      const localMap = {
        '橿原': override([hub('rail','奈良','橿原神宮前','近鉄')], [], {main:'橿原神宮前',final:'橿原神宮前'}),
        '飛鳥': override([hub('rail','奈良','飛鳥','近鉄')], [], {main:'飛鳥',final:'飛鳥'}),
        '吉野': override([hub('rail','奈良','吉野','近鉄吉野線')], [], {main:'吉野',final:'吉野'}),
        '洞川温泉': override([hub('rail','奈良','下市口','近鉄')], [s('bus','下市口','洞川温泉','バス')], {main:'下市口',final:'洞川温泉'}),
        '伊賀': override([hub('rail','奈良','上野市','近鉄')], [], {main:'上野市',final:'上野市'}),
      };
      if (localMap[destName]) return localMap[destName];
      const m = base.main;
      return rebase(base, [hub('rail','奈良','新大阪','JR大和路線')]);
    }
  },

  // 中国グループ
  '広島': { base: 'osaka',
    transform: (destName, base) => {
      const localMap = {
        '宮島': override([hub('rail','広島','宮島口','JR山陽本線')], [s('ferry','宮島口港','宮島','JR西日本フェリー')], {main:'宮島口',final:'宮島'}),
        '尾道': override([hub('rail','広島','尾道','JR山陽本線')], [], {main:'尾道',final:'尾道'}),
        '竹原': override([hub('rail','広島','竹原','JR呉線')], [], {main:'竹原',final:'竹原'}),
        '岩国': override([hub('rail','広島','岩国','JR山陽本線')], [], {main:'岩国',final:'岩国'}),
        '柳井': override([hub('rail','広島','柳井','JR山陽本線')], [], {main:'柳井',final:'柳井'}),
        '周防大島': override([hub('rail','広島','大畠','JR山陽本線')], [s('bus','大畠','周防大島','バス')], {main:'大畠',final:'周防大島'}),
        '鞆の浦': override([hub('rail','広島','福山','山陽新幹線')], [s('bus','福山','鞆の浦','バス')], {main:'福山',final:'鞆の浦'}),
        '倉敷': override([hub('rail','広島','岡山','山陽新幹線'), hub('rail','岡山','倉敷','JR山陽本線')], [], {main:'岡山',final:'倉敷'}),
        '津山': override([hub('rail','広島','岡山','山陽新幹線'), hub('rail','岡山','津山','JR津山線')], [], {main:'岡山',final:'津山'}),
        '下関': override([hub('rail','広島','新山口','山陽新幹線'), hub('rail','新山口','下関','JR山陽本線')], [], {main:'新山口',final:'下関'}),
        '津和野': override([hub('rail','広島','新山口','山陽新幹線'), hub('rail','新山口','津和野','JR山口線')], [], {main:'新山口',final:'津和野'}),
        '萩': override([hub('rail','広島','新山口','山陽新幹線'), s('bus','新山口','萩','バス')], [], {main:'新山口',final:'萩'}),
        '湯田温泉': override([hub('rail','広島','新山口','山陽新幹線'), hub('rail','新山口','湯田温泉','JR山陽本線')], [], {main:'新山口',final:'湯田温泉'}),
        '角島': override([hub('rail','広島','新山口','山陽新幹線'), hub('rail','新山口','特牛','JR山陰本線')], [s('bus','特牛','角島大橋','バス')], {main:'新山口',final:'角島大橋'}),
        '秋吉台': override([hub('rail','広島','新山口','山陽新幹線'), s('bus','新山口','秋吉台','バス')], [], {main:'新山口',final:'秋吉台'}),
      };
      if (localMap[destName]) return localMap[destName];
      const m = base.main;
      const firstTo = m?.[0]?.to;
      // 大阪発の「新大阪→...」を広島から
      if (firstTo === '新大阪') {
        return rebase(base, [hub('rail','広島','新大阪','山陽新幹線')], 1);
      }
      if (firstTo === '岡山') {
        return rebase(base, [hub('rail','広島','岡山','山陽新幹線')], 1);
      }
      if (firstTo === '博多') {
        return rebase(base, [hub('rail','広島','博多','山陽・九州新幹線')], 1);
      }
      if (firstTo === '敦賀') {
        return rebase(base, [hub('rail','広島','新大阪','山陽新幹線'), hub('rail','新大阪','敦賀','特急サンダーバード')], 1);
      }
      return rebase(base, [hub('rail','広島','新大阪','山陽新幹線')]);
    }
  },

  '岡山': { base: 'osaka',
    transform: (destName, base) => {
      const localMap = {
        '倉敷': override([hub('rail','岡山','倉敷','JR山陽本線')], [], {main:'倉敷',final:'倉敷'}),
        '高梁': override([hub('rail','岡山','備中高梁','JR伯備線')], [], {main:'備中高梁',final:'備中高梁'}),
        '出雲': override([hub('rail','岡山','出雲市','特急やくも')], [], {main:'出雲市',final:'出雲市'}),
        '松江': override([hub('rail','岡山','松江','特急やくも')], [], {main:'松江',final:'松江'}),
        '大山': override([hub('rail','岡山','米子','特急やくも')], [s('bus','米子','大山','バス')], {main:'米子',final:'大山'}),
        '境港': override([hub('rail','岡山','米子','特急やくも'), hub('rail','米子','境港','JR境線')], [], {main:'米子',final:'境港'}),
        '鳥取': override([hub('rail','岡山','鳥取','特急スーパーいなば')], [], {main:'鳥取',final:'鳥取'}),
        '倉吉': override([hub('rail','岡山','倉吉','特急スーパーいなば')], [], {main:'倉吉',final:'倉吉'}),
        '三朝温泉': override([hub('rail','岡山','倉吉','特急スーパーいなば')], [s('bus','倉吉','三朝温泉','バス')], {main:'倉吉',final:'三朝温泉'}),
        '美保関': override([hub('rail','岡山','境港','特急やくも＋境線')], [], {main:'境港',final:'境港'}),
        '津山': override([hub('rail','岡山','津山','JR津山線')], [], {main:'津山',final:'津山'}),
        '矢掛': override([hub('rail','岡山','矢掛','JR伯備線')], [], {main:'矢掛',final:'矢掛'}),
        '牛窓': override([hub('rail','岡山','邑久','JR赤穂線')], [s('bus','邑久','牛窓','バス')], {main:'邑久',final:'牛窓'}),
        '笠岡': override([hub('rail','岡山','笠岡','JR山陽本線')], [], {main:'笠岡',final:'笠岡'}),
        '尾道': override([hub('rail','岡山','尾道','JR山陽本線')], [], {main:'尾道',final:'尾道'}),
        '竹原': override([hub('rail','岡山','広島','山陽新幹線'), hub('rail','広島','竹原','JR呉線')], [], {main:'広島',final:'竹原'}),
        '宮島': override([hub('rail','岡山','広島','山陽新幹線'), hub('rail','広島','宮島口','JR山陽本線')], [s('ferry','宮島口港','宮島','JR西日本フェリー')], {main:'宮島口',final:'宮島'}),
        '小豆島': override([hub('rail','岡山','高松','快速マリンライナー'), s('ferry','高松港','池田港','小豆島フェリー')], [], {main:'高松',final:'小豆島'}),
        '直島': override([hub('rail','岡山','宇野','JR宇野線'), s('ferry','宇野港','宮浦港','直島フェリー')], [], {main:'宇野',final:'直島'}),
        '豊島': override([hub('rail','岡山','宇野','JR宇野線'), s('ferry','宇野港','家浦港','豊島フェリー')], [], {main:'宇野',final:'家浦港'}),
        '犬島': override([s('bus','岡山','宝伝','バス'), s('ferry','宝伝港','犬島港','犬島行き船')], [], {main:'宝伝',final:'犬島港'}),
        '奥出雲': override([hub('rail','岡山','出雲市','特急やくも'), hub('rail','出雲市','木次','JR木次線')], [], {main:'出雲市',final:'木次'}),
        '石見銀山': override([hub('rail','岡山','大田市','特急やくも＋山陰本線')], [], {main:'岡山',final:'大田市'}),
        '温泉津': override([hub('rail','岡山','温泉津','特急やくも＋山陰本線')], [], {main:'岡山',final:'温泉津'}),
        '海士町': override([hub('rail','岡山','松江','特急やくも'), s('bus','松江','七類港','一畑バス'), s('ferry','七類港','菱浦港','隠岐汽船')], [], {main:'松江',final:'菱浦港'}),
        '隠岐の島': override([hub('rail','岡山','境港','特急やくも＋境線'), s('ferry','境港','西郷港','隠岐汽船')], [], {main:'境港',final:'西郷港'}),
      };
      if (localMap[destName]) return localMap[destName];
      const m = base.main;
      const firstTo = m?.[0]?.to;
      if (firstTo === '新大阪') return rebase(base, [hub('rail','岡山','新大阪','山陽新幹線')], 1);
      if (firstTo === '博多') return rebase(base, [hub('rail','岡山','博多','山陽・九州新幹線')], 1);
      if (firstTo === '敦賀') return rebase(base, [hub('rail','岡山','新大阪','山陽新幹線'), hub('rail','新大阪','敦賀','特急サンダーバード')], 1);
      return rebase(base, [hub('rail','岡山','新大阪','山陽新幹線')]);
    }
  },

  '松江': { base: 'osaka',
    transform: (destName, base) => {
      const localMap = {
        '海士町': override([s('bus','松江','七類港','一畑バス'), s('ferry','七類港','菱浦港','隠岐汽船')], [], {main:'七類港',final:'菱浦港'}),
        '隠岐の島': override([hub('rail','松江','境港','JR山陰本線'), s('ferry','境港','西郷港','隠岐汽船')], [], {main:'境港',final:'西郷港'}),
        '出雲': override([hub('rail','松江','出雲市','JR山陰本線')], [], {main:'出雲市',final:'出雲市'}),
        '奥出雲': override([hub('rail','松江','出雲市','JR山陰本線'), hub('rail','出雲市','木次','JR木次線')], [], {main:'出雲市',final:'木次'}),
        '美保関': override([hub('rail','松江','境港','JR境線')], [], {main:'境港',final:'境港'}),
        '境港': override([hub('rail','松江','境港','JR境線')], [], {main:'境港',final:'境港'}),
        '大山': override([hub('rail','松江','米子','JR山陰本線')], [s('bus','米子','大山','バス')], {main:'米子',final:'大山'}),
        '倉吉': override([hub('rail','松江','倉吉','JR山陰本線')], [], {main:'倉吉',final:'倉吉'}),
        '三朝温泉': override([hub('rail','松江','倉吉','JR山陰本線')], [s('bus','倉吉','三朝温泉','バス')], {main:'倉吉',final:'三朝温泉'}),
        '鳥取': override([hub('rail','松江','鳥取','JR山陰本線')], [], {main:'鳥取',final:'鳥取'}),
        '温泉津': override([hub('rail','松江','温泉津','JR山陰本線')], [], {main:'温泉津',final:'温泉津'}),
        '石見銀山': override([hub('rail','松江','大田市','JR山陰本線')], [], {main:'大田市',final:'大田市'}),
      };
      if (localMap[destName]) return localMap[destName];
      const m = base.main;
      const firstTo = m?.[0]?.to;
      // 岡山経由: 松江→岡山（特急やくも）
      if (['新大阪','岡山','広島','博多','鹿児島中央'].includes(firstTo) ||
          base.main.some(st => st.to === '岡山')) {
        return rebase(base, [hub('rail','松江','岡山','特急やくも')]);
      }
      return rebase(base, [hub('rail','松江','岡山','特急やくも')]);
    }
  },

  // 四国グループ
  '松山': { base: 'takamatsu',
    transform: (destName, base) => {
      const localMap = {
        '道後温泉': override([hub('rail','松山','道後温泉','伊予鉄道')], [], {main:'道後温泉',final:'道後温泉'}),
        '内子': override([hub('rail','松山','内子','JR予讃線')], [], {main:'内子',final:'内子'}),
        '大洲': override([hub('rail','松山','伊予大洲','JR予讃線')], [], {main:'伊予大洲',final:'伊予大洲'}),
        '西条': override([hub('rail','松山','伊予西条','JR予讃線')], [], {main:'伊予西条',final:'伊予西条'}),
        '今治': override([hub('rail','松山','今治','JR予讃線')], [], {main:'今治',final:'今治'}),
        '宇和島': override([hub('rail','松山','宇和島','JR予讃線')], [], {main:'宇和島',final:'宇和島'}),
        '愛南': override([hub('rail','松山','宇和島','JR予讃線')], [s('bus','宇和島','愛南','バス')], {main:'宇和島',final:'愛南'}),
        '三崎（佐田岬）': override([hub('rail','松山','八幡浜','JR予讃線')], [s('ferry','三崎港','臼杵港','フェリー')], {main:'八幡浜',final:'三崎港'}),
        '四国カルスト': override([], [s('bus','松山','四国カルスト','バス')], {main:'松山',final:'四国カルスト'}),
        '高松': override([hub('rail','松山','高松','特急しおかぜ')], [], {main:'高松',final:'高松'}),
        '丸亀': override([hub('rail','松山','丸亀','JR予讃線')], [], {main:'丸亀',final:'丸亀'}),
        '琴平': override([hub('rail','松山','高松','特急しおかぜ'), hub('rail','高松','琴電琴平','琴電琴平線')], [], {main:'高松',final:'琴電琴平'}),
      };
      if (localMap[destName]) return localMap[destName];
      const m = base.main;
      const firstTo = m?.[0]?.to;
      // 高松ベースで先頭に「マリンライナー」がある場合 → 松山→高松
      if (firstTo === '岡山') {
        // 松山→岡山（直接）
        return rebase(base, [hub('rail','松山','岡山','特急しおかぜ')], 1);
      }
      // 高松行き: 松山→高松
      const VIA_HIGH = hub('rail','松山','高松','特急しおかぜ');
      return rebase(base, [VIA_HIGH]);
    }
  },

  '高知': { base: 'takamatsu',
    transform: (destName, base) => {
      const localMap = {
        '室戸': override([s('bus','高知','室戸','バス')], [], {main:'高知',final:'室戸'}),
        '仁淀川': override([s('bus','高知','仁淀川','バス')], [], {main:'高知',final:'仁淀川'}),
        '足摺岬': override([hub('rail','高知','中村','特急あしずり'), s('bus','中村','足摺岬','バス')], [], {main:'中村',final:'足摺岬'}),
        '四万十': override([hub('rail','高知','江川崎','JR予土線')], [], {main:'高知',final:'江川崎'}),
        '土佐清水': override([hub('rail','高知','中村','特急あしずり'), s('bus','中村','土佐清水','バス')], [], {main:'中村',final:'土佐清水'}),
        '四万十町': override([hub('rail','高知','土佐大正','JR予土線')], [], {main:'高知',final:'土佐大正'}),
        '梼原': override([hub('rail','高知','須崎','JR土讃線')], [s('bus','須崎','梼原','バス')], {main:'須崎',final:'梼原'}),
        '大歩危': override([hub('rail','高知','大歩危','JR土讃線')], [], {main:'大歩危',final:'大歩危'}),
        '祖谷': override([hub('rail','高知','阿波池田','JR土讃線')], [s('bus','阿波池田','祖谷','バス')], {main:'阿波池田',final:'祖谷'}),
        '柏島': override([hub('rail','高知','宿毛','土佐くろしお鉄道')], [s('bus','宿毛','柏島','バス')], {main:'宿毛',final:'柏島'}),
      };
      if (localMap[destName]) return localMap[destName];
      const m = base.main;
      // 高松ベース → 高知→高松で付け替え
      if (m[0]?.to === '岡山') {
        return rebase(base, [hub('rail','高知','岡山','特急南風')], 1);
      }
      return rebase(base, [hub('rail','高知','高松','特急南風')]);
    }
  },

  '徳島': { base: 'takamatsu',
    transform: (destName, base) => {
      const localMap = {
        '阿南': override([hub('rail','徳島','阿南','JR牟岐線')], [], {main:'阿南',final:'阿南'}),
        '剣山': override([hub('rail','徳島','貞光','JR徳島線')], [s('bus','貞光','剣山','バス')], {main:'貞光',final:'剣山'}),
        '祖谷': override([hub('rail','徳島','阿波池田','JR徳島線'), s('bus','阿波池田','祖谷','バス')], [], {main:'阿波池田',final:'祖谷'}),
        '大歩危': override([hub('rail','徳島','阿波池田','JR徳島線'), hub('rail','阿波池田','大歩危','JR土讃線')], [], {main:'阿波池田',final:'大歩危'}),
      };
      if (localMap[destName]) return localMap[destName];
      const m = base.main;
      if (m[0]?.to === '岡山') {
        return rebase(base, [hub('rail','徳島','岡山','特急うずしお＋マリンライナー')], 1);
      }
      return rebase(base, [hub('rail','徳島','高松','特急うずしお')]);
    }
  },

  // 九州グループ
  '熊本': { base: 'hakata',
    transform: (destName, base) => {
      const localMap = {
        '阿蘇': override([hub('rail','熊本','阿蘇','JR豊肥本線')], [], {main:'阿蘇',final:'阿蘇'}),
        '天草': override([], [s('bus','熊本','天草','バス')], {main:'熊本',final:'天草'}),
        '高千穂': override([], [s('bus','熊本','高千穂','バス')], {main:'熊本',final:'高千穂'}),
        '黒川温泉': override([], [s('bus','熊本','黒川温泉','バス')], {main:'熊本',final:'黒川温泉'}),
        '南阿蘇': override([], [s('bus','熊本','南阿蘇','バス')], {main:'熊本',final:'南阿蘇'}),
        '山鹿': override([], [s('bus','熊本','山鹿温泉','バス')], {main:'熊本',final:'山鹿温泉'}),
        '菊池': override([], [s('bus','熊本','菊池温泉','バス')], {main:'熊本',final:'菊池温泉'}),
        '竹田': override([hub('rail','熊本','豊後竹田','JR豊肥本線')], [], {main:'豊後竹田',final:'豊後竹田'}),
        '人吉': override([hub('rail','熊本','人吉','JR肥薩線')], [], {main:'人吉',final:'人吉'}),
        '種子島': override([hub('rail','熊本','鹿児島中央','JR九州新幹線'), s('ferry','鹿児島港','西之表港','種子島・屋久島フェリー')], [], {main:'鹿児島中央',final:'西之表港'}),
        '屋久島': override([hub('rail','熊本','鹿児島中央','JR九州新幹線'), s('ferry','鹿児島港','屋久島','種子島・屋久島フェリー')], [], {main:'鹿児島中央',final:'屋久島'}),
        '指宿': override([hub('rail','熊本','鹿児島中央','JR九州新幹線'), hub('rail','鹿児島中央','指宿','JR指宿枕崎線')], [], {main:'鹿児島中央',final:'指宿'}),
        '霧島': override([hub('rail','熊本','鹿児島中央','JR九州新幹線'), hub('rail','鹿児島中央','霧島神宮','JR日豊本線')], [], {main:'鹿児島中央',final:'霧島神宮'}),
        '知覧': override([hub('rail','熊本','鹿児島中央','JR九州新幹線')], [s('bus','鹿児島中央','知覧','バス')], {main:'鹿児島中央',final:'知覧'}),
        'えびの高原': override([hub('rail','熊本','鹿児島中央','JR九州新幹線')], [s('bus','鹿児島中央','えびの高原','バス')], {main:'鹿児島中央',final:'えびの高原'}),
        '甑島': override([hub('rail','熊本','川内','JR九州新幹線'), s('ferry','川内港','里港','甑島商船')], [], {main:'川内',final:'里港'}),
        '奄美大島': override([hub('rail','熊本','鹿児島中央','JR九州新幹線'), s('ferry','鹿児島港','名瀬港','マルエーフェリー')], [], {main:'鹿児島中央',final:'名瀬港'}),
      };
      if (localMap[destName]) return localMap[destName];
      const m = base.main;
      const firstTo = m?.[0]?.to;
      if (firstTo === '博多') return rebase(base, [hub('rail','熊本','博多','JR九州新幹線')], 1);
      if (firstTo === '鹿児島中央') return rebase(base, [hub('rail','熊本','鹿児島中央','JR九州新幹線')], 1);
      // その他: 熊本→博多経由
      return rebase(base, [hub('rail','熊本','博多','JR九州新幹線')]);
    }
  },

  '鹿児島': { base: 'hakata',
    transform: (destName, base) => {
      const localMap = {
        '指宿': override([hub('rail','鹿児島中央','指宿','JR指宿枕崎線')], [], {main:'指宿',final:'指宿'}),
        '屋久島': override([s('ferry','鹿児島港','屋久島','種子島・屋久島フェリー')], [], {main:'鹿児島中央',final:'屋久島'}),
        '種子島': override([s('ferry','鹿児島港','西之表港','種子島・屋久島フェリー')], [], {main:'鹿児島中央',final:'西之表港'}),
        '奄美大島': override([s('ferry','鹿児島港','名瀬港','マルエーフェリー')], [], {main:'鹿児島中央',final:'名瀬港'}),
        '霧島': override([hub('rail','鹿児島中央','霧島神宮','JR日豊本線')], [], {main:'霧島神宮',final:'霧島神宮'}),
        '知覧': override([], [s('bus','鹿児島中央','知覧','バス')], {main:'鹿児島中央',final:'知覧'}),
        'えびの高原': override([], [s('bus','鹿児島中央','えびの高原','バス')], {main:'鹿児島中央',final:'えびの高原'}),
        '甑島': override([hub('rail','鹿児島中央','川内','JR鹿児島本線'), s('ferry','川内港','里港','甑島商船')], [], {main:'川内',final:'里港'}),
        '高千穂': override([hub('rail','鹿児島中央','熊本','JR九州新幹線')], [s('bus','熊本','高千穂','バス')], {main:'熊本',final:'高千穂'}),
        '天草': override([hub('rail','鹿児島中央','熊本','JR九州新幹線')], [s('bus','熊本','天草','バス')], {main:'熊本',final:'天草'}),
      };
      if (localMap[destName]) return localMap[destName];
      const m = base.main;
      const firstTo = m?.[0]?.to;
      if (firstTo === '博多') return rebase(base, [hub('rail','鹿児島中央','博多','JR九州新幹線')], 1);
      return rebase(base, [hub('rail','鹿児島中央','博多','JR九州新幹線')]);
    }
  },

  '長崎': { base: 'hakata',
    transform: (destName, base) => {
      const localMap = {
        '佐世保': override([hub('rail','長崎','佐世保','JR大村線')], [], {main:'佐世保',final:'佐世保'}),
        '平戸': override([hub('rail','長崎','佐世保','JR大村線'), hub('rail','佐世保','平戸口','JR松浦鉄道')], [s('bus','平戸口','平戸','バス')], {main:'佐世保',final:'平戸'}),
        '雲仙': override([hub('rail','長崎','諫早','JR長崎本線')], [s('bus','諫早','雲仙','バス')], {main:'諫早',final:'雲仙'}),
        '島原': override([hub('rail','長崎','諫早','JR長崎本線'), hub('rail','諫早','島原','島原鉄道')], [], {main:'諫早',final:'島原'}),
        '嬉野温泉': override([hub('rail','長崎','嬉野温泉','西九州新幹線')], [], {main:'嬉野温泉',final:'嬉野温泉'}),
        '武雄温泉': override([hub('rail','長崎','武雄温泉','西九州新幹線')], [], {main:'武雄温泉',final:'武雄温泉'}),
        '波佐見': override([hub('rail','長崎','川棚温泉','JR大村線')], [s('bus','川棚温泉','波佐見','バス')], {main:'川棚温泉',final:'波佐見'}),
        '五島列島': override([s('ferry','長崎港','福江港','九州商船')], [], {main:'長崎',final:'福江港'}),
        '小値賀島': override([hub('rail','長崎','佐世保','JR大村線'), s('ferry','佐世保港','小値賀港','九州商船')], [], {main:'佐世保',final:'小値賀港'}),
      };
      if (localMap[destName]) return localMap[destName];
      const m = base.main;
      const firstTo = m?.[0]?.to;
      if (firstTo === '博多') return rebase(base, [hub('rail','長崎','博多','JR長崎本線＋西九州新幹線')], 1);
      return rebase(base, [hub('rail','長崎','博多','JR長崎本線＋西九州新幹線')]);
    }
  },

  '宮崎': { base: 'hakata',
    transform: (destName, base) => {
      const localMap = {
        '青島': override([hub('rail','宮崎','青島','JR日南線')], [], {main:'青島',final:'青島'}),
        '日南': override([hub('rail','宮崎','日南','JR日南線')], [], {main:'日南',final:'日南'}),
        '飫肥': override([hub('rail','宮崎','飫肥','JR日南線')], [], {main:'飫肥',final:'飫肥'}),
        '日向': override([hub('rail','宮崎','日向市','JR日豊本線')], [], {main:'日向市',final:'日向市'}),
        '高千穂': override([], [s('bus','宮崎','高千穂','バス')], {main:'宮崎',final:'高千穂'}),
        'えびの高原': override([], [s('bus','宮崎','えびの高原','バス')], {main:'宮崎',final:'えびの高原'}),
        '延岡': override([hub('rail','宮崎','延岡','JR日豊本線')], [], {main:'延岡',final:'延岡'}),
      };
      if (localMap[destName]) return localMap[destName];
      const m = base.main;
      const firstTo = m?.[0]?.to;
      if (firstTo === '博多') return rebase(base, [hub('rail','宮崎','博多','JR日豊本線特急にちりん')], 1);
      return rebase(base, [hub('rail','宮崎','博多','JR日豊本線特急にちりん')]);
    }
  },
};

/* ── メイン処理 ── */

const BASE_DATA = {
  'tokyo': tokyoData,
  'osaka': osakaData,
  'hakata': hakataData,
  'takamatsu': takamatsuData,
};

// CUSTOM_CITIES: 完全カスタムビルダーを持つ都市
const CUSTOM_CITIES_LIST = Object.keys(CITY_CONFIGS);

// TEMPLATE_CITIES_LIST
const TEMPLATE_CITIES_LIST = Object.keys(TEMPLATE_CITIES);

// 全対象都市
const ALL_CITIES = [...CUSTOM_CITIES_LIST, ...TEMPLATE_CITIES_LIST];
console.log(`対象都市数: ${ALL_CITIES.length}`);

mkdirSync(join(root, 'src/data/routes'), { recursive: true });

for (const city of ALL_CITIES) {
  const output = { [city]: {} };
  let defined = 0;
  let missing = 0;

  for (const dest of destinations) {
    const destName = dest.name;
    let route = null;

    // CUSTOM_CITIES
    if (CITY_CONFIGS[city]) {
      route = CITY_CONFIGS[city].customBuilder(destName);
    }
    // TEMPLATE_CITIES
    else if (TEMPLATE_CITIES[city]) {
      const cfg = TEMPLATE_CITIES[city];
      const baseData = BASE_DATA[cfg.base];
      const base = baseData?.[destName];
      if (!base) { missing++; continue; }

      // overrides
      if (cfg.overrides?.[destName]) {
        route = cfg.overrides[destName];
      } else if (cfg.transform) {
        route = cfg.transform(destName, JSON.parse(JSON.stringify(base)));
      } else {
        route = base;
      }
    }

    if (route) {
      output[city][destName] = {
        main: route.main,
        last: route.last,
        gateway: route.gateway,
      };
      defined++;
    } else {
      missing++;
    }
  }

  const filePath = join(root, `src/data/routes/${city}.json`);
  writeFileSync(filePath, JSON.stringify(output, null, 2) + '\n', 'utf8');
  console.log(`✓ ${city}: ${defined}件 (未定義:${missing}) → src/data/routes/${city}.json`);
}

console.log('\n完了!');
