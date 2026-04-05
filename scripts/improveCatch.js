/**
 * catch コピー改善 + stayDescription 全件追加
 *
 * 方針：
 * - 「説明文」→「感情を動かすひとこと」に書き換え
 * - stayDescription: 滞在のリアルな1行イメージを追加
 * - 30〜60文字、体験の核心を一言で
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const destPath = path.resolve(__dirname, '../src/data/destinations.json');
const data = JSON.parse(fs.readFileSync(destPath, 'utf8'));

/* ─────────────────────────────────────────
   手書きオーバーライド（主要目的地50件）
───────────────────────────────────────── */
const CATCH_OVERRIDES = {
  // 関東
  'kamakura':         '石畳を歩くたびに、時代がひとつずつ遡っていく。',
  'nikko':            '東照宮の金と華厳の滝の轟音。どちらも人を黙らせる。',
  'karuizawa':        '白樺の木漏れ日の下で、ただ何もしない時間を買いに来た。',
  'enoshima':         '橋を渡り、島の頂から海を見下ろす。それだけで違う世界。',
  'oze':              '木道の先に水芭蕉の湿原。東京からこれほど遠くへ来られる。',
  'chichibu':         '山の神社と秩父夜祭。静かな山里に、熱が残っていた。',
  'kinugawa-onsen':   '渓谷の真上に建つ旅館で、川の音を聞きながら眠った。',

  // 中部・北陸
  'hakone':           '箱根の山に入ると、富士山が向こうから近づいてきた。',
  'atami':            '昭和の海岸線に温泉が湧く。夜の湯けむりが懐かしかった。',
  'ito':              '伊豆の海を眺めながら湯に浸かれる場所がある。',
  'shimoda':          '黒船が来た港の街で、海の風を受けながら歩いた。',
  'shuzenji':         '竹林と川と温泉。修善寺の朝は静かすぎて困るくらいだった。',
  'fujikawaguchiko':  '湖面に映る逆さ富士を見た瞬間、ため息が出た。',
  'kamikochi':        '河童橋から穂高を見上げた。それだけで来た甲斐があった。',
  'hakuba':           '白馬の峰々が窓の外に広がる。山と雪と温泉だけの時間。',
  'karuizawa':        '白樺の木漏れ日の下で、何もしない贅沢を買いに来た。',
  'kusatsu-onsen':    '湯畑の湯けむりを見た瞬間、やっと来られたと思った。',
  'shibu-onsen':      '9つの外湯を浴衣で巡る。温泉街の夜は長い。',
  'nozawa-onsen':     '急斜面のゲレンデと村の外湯。スキーと温泉の両方を手に入れた。',
  'takayama-o':       '古い町並みに足を踏み入れると、江戸の空気が残っていた。',
  'shirakawago-t':    '雪に包まれた合掌造りの集落。言葉より先に写真を撮った。',
  'gero-onsen':       '飛騨の山々に囲まれて、川のそばで湯に沈む夜があった。',
  'gokayama':         '合掌造りの村に宿を取った。夜は囲炉裏の煙と静寂だけ。',
  'kanazawa-t':       '兼六園の雪吊りとひがし茶屋街の灯り。日本は美しかった。',

  // 近畿
  'arashiyama':       '竹林の中に入ると、京都の喧騒が急に消えた。',
  'fushimi':          '千本鳥居をくぐりながら、願いでもかけてみようと思った。',
  'arima-onsen':      '大阪から1時間で、山の奥の温泉街にいる感覚が好きだ。',
  'kinosaki-onsen':   '浴衣で外湯をはしごする。それだけで旅の価値がある。',
  'nara':             '大仏の前では、自分が小さいと思い知らされた。',
  'yoshino':          '千本桜の中を歩いた。日本に生まれてよかったと感じた。',
  'koyasan':          '朝の奥之院に霧が流れていた。生と死の境があいまいな場所。',
  'shirahama-o':      '白浜の海と温泉を1泊でどちらも楽しめる場所がある。',
  'kumano-hongu':     '深い山の中の熊野本宮。ここに来ると、洗い流される感覚がある。',

  // 中国・四国
  'miyajima':         '満潮の夕暮れに鳥居が水面に浮かんだ。その光景が忘れられない。',
  'onomichi':         '坂の途中で振り返ると、瀬戸内の海があった。',
  'kurashiki-o':      '白壁の川沿いを歩くと、江戸の商人の気配が漂っていた。',
  'tomonoura':        '瀬戸内の漁港の朝は、静かで美しかった。',
  'naoshima':         'アートと島の時間が混ざり合っている場所。何かが変わった気がした。',
  'akiyoshidai':      '日本最大のカルスト台地に立つと、地球の底が見える気がした。',
  'dogo-onsen':       '日本最古の温泉に入る。少し特別な気分がした。',
  'iya':              '祖谷のかずら橋を渡りながら、秘境という言葉を実感した。',

  // 九州
  'beppu':            '湯けむりの街で地獄めぐりをして、夜は静かな露天風呂に沈んだ。',
  'yufuin':           '霧の朝の盆地に温泉街が浮かんでいた。非現実的に美しかった。',
  'kurokawa-k':       '山の奥の小さな宿で、露天風呂と夜空だけがあった。',
  'aso':              '火口の縁に立つと、地球がまだ動いていると分かった。',
  'takachiho':        '高千穂峡の緑色の川に、滝が落ちていた。神話の景色だった。',
  'kirishima':        '霧島の噴煙を見ながら温泉に浸かる。日本の原風景がここにある。',
  'ibusuki':          '砂の中に埋まって、じわじわと温まっていく。不思議な心地よさ。',
  'amakusa':          '海と教会が共存する天草は、日本の中の別世界だった。',
  'yakushima':        '縄文杉の根元に立って、人間が客であることを知った。',

  // 東北
  'matsushima':       '松の島々が霞む中、遊覧船に揺られながら牡蠣を食べた。',
  'hiraizumi':        '金色堂の前で立ち止まって、何か大切なことを考えた。',
  'ginzan-onsen':     'ガス灯の灯りと大正ロマンの宿。現実から離れる一夜がある。',
  'oirase':           '渓流に沿って歩いていたら、何も考えなくなった。',
  'towada-lake':      '原生林に囲まれた湖は、静かすぎて逆に不安になるほどだった。',
  'kakunodate':       '武家屋敷の桜並木に、息をのんだ。',
  'nyuto-onsen':      '秘湯の露天風呂に入って、ここまで来てよかったと思った。',
  'dewa-sanzan':      '羽黒山の杉並木を歩いて、何かが浄化された気がした。',
  'tono':             'ここに来ると、民話が本当のことのように思えてくる。',

  // 北海道
  'hokkaido-hakodate':'夜景のために来たのに、朝市の海丼でそれを超えてしまった。',
  'biei':             '丘の上からの景色が、もうポスターだった。',
  'furano':           'ラベンダーの香りが風に乗ってきた瞬間、旅が始まった。',
  'niseko':           '粉雪を滑った後、温泉に沈む。冬の北海道の正解がここにある。',
  'daisetsuzan':      '北海道の屋根を歩くと、果てしなさに目眩がした。',
  'shiretoko':        'ヒグマと流氷と原生林。地球の端っこを自分の足で歩いた。',
  'otaru':            '夜の運河に灯りが映る。この景色は北の港町だけのものだ。',
  'akan':             '霧の湖面にマリモが眠る。北海道の奥地の深い静寂。',
  'noboribetsu':      '地獄谷の噴煙と濃厚な温泉。体の奥まで温まる場所がある。',

  // 沖縄・離島
  'ishigaki':         'その海の色が、本当にターコイズブルーだった。',
  'miyakojima':       '砂浜に裸足で立った瞬間、全ての予定がどうでもよくなった。',
  'taketomi-island':  '水牛に揺られながら、赤瓦の路地をゆっくりと過ぎた。',
  'iriomote':         'ジャングルの奥で、時計が止まった気がした。',
  'tokashiki-jima':   '那覇から1時間で、この透明な海に来られることに驚いた。',
  'kumejima':         '畳石と白砂浜。沖縄の原型がこの島に残っていた。',
  'zamami-island':    '海の透明度がおかしいくらい高くて、魚が宙に浮いて見えた。',
  'yonaguni-island':  '日本の最西端の島。水平線の向こうに台湾がある。',
  'naoshima':         'アート作品の前で立ち止まって、気づいたら2時間が過ぎていた。',

  // 修正が必要な島（トランジット情報など）
  'izu-oshima':       '東京から行ける離島に、火山と温泉と海がある。',
  'rebun-island':     '礼文島の花と岬。ここまで来た人だけが見られる景色。',
  'sado-island':      '広い島に金山跡と能楽と海が残る。本州とは違う時間が流れる。',
  'ie-island':        '伊江島タッチューの頂から、沖縄の海が一望できた。',
  'kohama-island':    'サトウキビ畑の向こうに、コバルトブルーの海が広がっていた。',
  'himeshima':        '鬼が上陸したという伝説と、豊かな漁港の島。',
};

/* ─────────────────────────────────────────
   stayDescription テンプレート
───────────────────────────────────────── */
function buildStayDescription(dest) {
  const type    = dest.destType;
  const sub     = dest.subType;
  const tags    = dest.primary ?? [];
  const name    = dest.name;
  const spot    = dest.spots?.[0] ?? dest.mapPoint ?? name;

  if (type === 'island') {
    if (tags.includes('ダイビング') || tags.includes('海水浴')) {
      return `昼はシュノーケルで海に入って、夜は島の食堂で海鮮を食べる旅。`;
    }
    return `昼間の海と夕暮れ、夜の島の静けさを1泊で全部味わう。`;
  }

  if (type === 'onsen' || tags.includes('温泉')) {
    if (sub === 'sea') return `海を眺めながら温泉に浸かって、新鮮な魚料理で夜を締める。`;
    if (sub === 'mountain') return `山の宿で温泉に2回入って、部屋から星を見ながら眠る。`;
    return `温泉でゆっくりして、夜は地元の料理と地酒を楽しむ一泊。`;
  }

  if (type === 'mountain' || sub === 'mountain') {
    return `朝靄の中を歩いて、昼に絶景を踏んで、夜は宿でぐっすり眠る。`;
  }

  if (type === 'remote' || sub === 'remote') {
    return `スマホを鞄に入れたまま、山の時間に身を委ねる旅。`;
  }

  if (sub === 'sea' || tags.includes('海')) {
    return `昼間は海岸を歩いて、夜は港町の食堂で地元の魚を食べる。`;
  }

  if (tags.includes('城') || tags.includes('歴史') || tags.includes('寺社')) {
    return `${spot}を歩いて、夜は古い街の宿にこもる。歴史が体に入ってくる旅。`;
  }

  if (tags.includes('グルメ')) {
    return `食べることが旅の目的になる場所。昼も夜も食べ続けたい。`;
  }

  return `${name}の空気を吸いながら、ゆっくり歩いて食べて泊まる旅。`;
}

/* ─────────────────────────────────────────
   キャッチコピー テンプレート（手書きなし）
───────────────────────────────────────── */
const BAD_PATTERNS = [
  '海と自然に囲まれた離島の旅',
  '港からフェリーで',
  'から高速船で',
  'NHKドラマ',
  'ターミナルから',
  'バスターミナルから',
];

function needsCatchUpdate(dest) {
  const c = dest.catch ?? '';
  return BAD_PATTERNS.some(p => c.includes(p));
}

function generateCatch(dest) {
  const tags = dest.primary ?? [];
  const type = dest.destType;
  const sub  = dest.subType;
  const name = dest.name;

  if (type === 'island') {
    if (tags.includes('アート'))    return `アートが島を美術館にした。${name}の時間は特別だ。`;
    if (tags.includes('ダイビング')) return `海の透明度が、すべての説明より雄弁だった。`;
    if (tags.includes('歴史'))       return `海と歴史が同居する島。${name}でしか見られない景色がある。`;
    return `橋か船でしか来られない場所に、特別な何かが残っている。`;
  }

  if (type === 'remote') {
    return `地図の端っこで、本当の静けさを見つけた。`;
  }

  if (type === 'mountain' || sub === 'mountain') {
    if (tags.includes('温泉')) return `山の奥に来た分だけ、湯が特別な味になる。`;
    return `雲の上に出た瞬間、全部どうでもよくなった。`;
  }

  if (tags.includes('温泉') && sub === 'sea') {
    return `海を眺めながら湯に浸かれる場所がある。`;
  }
  if (tags.includes('温泉')) {
    return `温泉の湯けむりの中で、日常が溶けていった。`;
  }

  if (sub === 'sea') {
    if (tags.includes('グルメ') || tags.includes('漁港')) return `海の幸と港の空気。鮮度が旅の主役だった。`;
    return `あの色の海を、自分の目で見るために来た。`;
  }

  if (tags.includes('歴史') || tags.includes('城')) {
    return `石畳の路地に、何百年分の時間が染み込んでいた。`;
  }

  if (tags.includes('自然') || tags.includes('絶景')) {
    return `その景色を見るために、また来ようと思った。`;
  }

  return `${name}でしか味わえない時間が、ここにある。`;
}

/* ─────────────────────────────────────────
   実行
───────────────────────────────────────── */
let catchUpdated = 0;
let stayAdded = 0;
let catchManual = 0;

for (const dest of data) {
  // catch コピー
  if (CATCH_OVERRIDES[dest.id]) {
    dest.catch = CATCH_OVERRIDES[dest.id];
    catchManual++;
    catchUpdated++;
  } else if (needsCatchUpdate(dest)) {
    dest.catch = generateCatch(dest);
    catchUpdated++;
  }

  // stayDescription
  if (!dest.stayDescription) {
    dest.stayDescription = buildStayDescription(dest);
    stayAdded++;
  }
}

fs.writeFileSync(destPath, JSON.stringify(data, null, 2), 'utf8');

console.log(`catch更新: ${catchUpdated}件（手書き: ${catchManual}件）`);
console.log(`stayDescription追加: ${stayAdded}件`);
