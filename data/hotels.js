/**
 * 宿泊リンクDB — 完全データ駆動
 *
 * キー: destination.id
 * sections[]: セクション配列
 *   label   {string|null}  見出し（null = "この街に泊まるなら"）
 *   rakuten {string}       楽天トラベル 固定URL（/yado/ 実在ページのみ）
 *   jalan   {string}       じゃらん 固定URL（LRG エリアページ or 都道府県ページ）
 *
 * ルール:
 *   - URL に ? を含めない
 *   - URL に %XX エンコードを含めない
 *   - 楽天は /yado/PREF/AREA.html 実在ページのみ
 *   - じゃらんは https://www.jalan.net/PP0000/ または LRG_XXXXXX/ 静的ページ
 */
export const HOTELS = {

  // ─── 北海道 ───────────────────────────────────────────────────

  'sapporo': {
    solo:    { name: 'ダイワロイネットホテル札幌中央', reason: '札幌駅徒歩3分・シングルプランが充実で安い', rakutenUrl: 'https://travel.rakuten.co.jp/yado/hokkaido/sapporo.html', jalanUrl: 'https://www.jalan.net/010000/LRG_010200/' },
    couple:  { name: 'ジャスマックプラザホテル', reason: 'すすきの至近・夜景と北海道料理を堪能できる', rakutenUrl: 'https://travel.rakuten.co.jp/yado/hokkaido/sapporo.html', jalanUrl: 'https://www.jalan.net/010000/LRG_010200/' },
    friends: { name: 'ホテルモントレエーデルホフ札幌', reason: '広い和洋室でグループ利用に最適・コスパ良好', rakutenUrl: 'https://travel.rakuten.co.jp/yado/hokkaido/sapporo.html', jalanUrl: 'https://www.jalan.net/010000/LRG_010200/' },
  },

  'otaru': {
    solo:    { name: 'ホテルノルド小樽', reason: '小樽駅徒歩2分・リーズナブルなシングルプラン', rakutenUrl: 'https://travel.rakuten.co.jp/yado/hokkaido/otaru.html', jalanUrl: 'https://www.jalan.net/010000/LRG_010800/' },
    couple:  { name: 'ドーミーイン小樽', reason: '運河ビューの客室・天然温泉でロマンチックな滞在', rakutenUrl: 'https://travel.rakuten.co.jp/yado/hokkaido/otaru.html', jalanUrl: 'https://www.jalan.net/010000/LRG_010800/' },
    friends: { name: 'グランドパーク小樽', reason: '広めの客室・グループ人数割引で賑やかに滞在', rakutenUrl: 'https://travel.rakuten.co.jp/yado/hokkaido/otaru.html', jalanUrl: 'https://www.jalan.net/010000/LRG_010800/' },
  },

  'furano': {
    solo:    { name: 'ホテルナトゥールヴァルト富良野', reason: '富良野駅近・素泊まりプランで格安に拠点確保', rakutenUrl: 'https://travel.rakuten.co.jp/yado/hokkaido/furano.html', jalanUrl: 'https://www.jalan.net/010000/LRG_011700/' },
    couple:  { name: 'フラノ寶亭留', reason: 'ラベンダー畑を望む客室・贅沢な夕食付きプラン', rakutenUrl: 'https://travel.rakuten.co.jp/yado/hokkaido/furano.html', jalanUrl: 'https://www.jalan.net/010000/LRG_011700/' },
    friends: { name: '富良野プリンスホテル', reason: '広い客室と多人数対応プラン・スキーにも便利', rakutenUrl: 'https://travel.rakuten.co.jp/yado/hokkaido/furano.html', jalanUrl: 'https://www.jalan.net/010000/LRG_011700/' },
  },

  'toyako': {
    solo:    { name: '洞爺観光ホテル', reason: '洞爺駅からアクセス良好・素泊まりプランが手頃', rakutenUrl: 'https://travel.rakuten.co.jp/yado/hokkaido/toyako.html', jalanUrl: 'https://www.jalan.net/010000/LRG_011100/' },
    couple:  { name: 'ザ・レイクスイート湖の栖', reason: '露天風呂付き客室から洞爺湖の絶景を独占', rakutenUrl: 'https://travel.rakuten.co.jp/yado/hokkaido/toyako.html', jalanUrl: 'https://www.jalan.net/010000/LRG_011100/' },
    friends: { name: 'ホテル洞爺サンパレス', reason: '大広間・バイキング付きでグループ旅行に最適', rakutenUrl: 'https://travel.rakuten.co.jp/yado/hokkaido/toyako.html', jalanUrl: 'https://www.jalan.net/010000/LRG_011100/' },
  },

  'noboribetsu': {
    solo:    { name: '登別グランドホテル', reason: '登別温泉バス停近・素泊まりプランでリーズナブル', rakutenUrl: 'https://travel.rakuten.co.jp/yado/hokkaido/noboribetsu.html', jalanUrl: 'https://www.jalan.net/010000/LRG_012300/' },
    couple:  { name: '第一滝本館', reason: '混浴露天風呂と個室風呂で特別な温泉体験', rakutenUrl: 'https://travel.rakuten.co.jp/yado/hokkaido/noboribetsu.html', jalanUrl: 'https://www.jalan.net/010000/LRG_012300/' },
    friends: { name: '登別パークホテル雅亭', reason: '大浴場と広い宴会スペース・グループ割引あり', rakutenUrl: 'https://travel.rakuten.co.jp/yado/hokkaido/noboribetsu.html', jalanUrl: 'https://www.jalan.net/010000/LRG_012300/' },
  },

  'shiretoko': {
    solo:    { name: '知床グランドホテル北こぶし', reason: '素泊まりプランで知床を格安に拠点にできる', rakutenUrl: 'https://travel.rakuten.co.jp/yado/hokkaido/shiretoko.html', jalanUrl: 'https://www.jalan.net/010000/LRG_013200/' },
    couple:  { name: '知床ノーブルホテル', reason: 'オホーツク海の絶景と流氷・二人だけの秘境体験', rakutenUrl: 'https://travel.rakuten.co.jp/yado/hokkaido/shiretoko.html', jalanUrl: 'https://www.jalan.net/010000/LRG_013200/' },
    friends: { name: '知床プリンスホテル風景画', reason: '大人数対応の広い客室・自然体験プランが充実', rakutenUrl: 'https://travel.rakuten.co.jp/yado/hokkaido/shiretoko.html', jalanUrl: 'https://www.jalan.net/010000/LRG_013200/' },
  },

  'jozankei': {
    solo:    { name: '定山渓グランドホテル東館', reason: '定山渓温泉バス停徒歩圏内・素泊まりが格安', rakutenUrl: 'https://travel.rakuten.co.jp/yado/hokkaido/jozankei.html', jalanUrl: 'https://www.jalan.net/010000/LRG_012900/' },
    couple:  { name: 'ぬくもりの宿ふる川', reason: '露天風呂付き客室・大自然の中でロマンチックな夜', rakutenUrl: 'https://travel.rakuten.co.jp/yado/hokkaido/jozankei.html', jalanUrl: 'https://www.jalan.net/010000/LRG_012900/' },
    friends: { name: '定山渓ビューホテル', reason: '広い大浴場と多人数対応客室・グループに人気', rakutenUrl: 'https://travel.rakuten.co.jp/yado/hokkaido/jozankei.html', jalanUrl: 'https://www.jalan.net/010000/LRG_012900/' },
  },

  'biei': {
    solo:    { name: 'ホテルラヴニール美瑛', reason: '美瑛駅徒歩5分・リーズナブルな素泊まりプラン', rakutenUrl: 'https://travel.rakuten.co.jp/yado/hokkaido/biei.html', jalanUrl: 'https://www.jalan.net/010000/LRG_012100/' },
    couple:  { name: 'ファームイン美宙', reason: '丘の絶景と満天の星空・カップルに人気の隠れ家', rakutenUrl: 'https://travel.rakuten.co.jp/yado/hokkaido/biei.html', jalanUrl: 'https://www.jalan.net/010000/LRG_012100/' },
    friends: { name: '美瑛白金ビルケ', reason: 'コテージ形式で仲間とゆったり滞在・コスパ優秀', rakutenUrl: 'https://travel.rakuten.co.jp/yado/hokkaido/biei.html', jalanUrl: 'https://www.jalan.net/010000/LRG_012100/' },
  },

  'aoi-ike': {
    solo:    { name: 'ホテルベアモンテ白金', reason: '白金温泉近く・リーズナブルな素泊まりシングルプラン', rakutenUrl: 'https://travel.rakuten.co.jp/yado/hokkaido/biei.html', jalanUrl: 'https://www.jalan.net/010000/LRG_012100/' },
    couple:  { name: '白金温泉ホテルパークヒルズ', reason: '十勝岳連峰の絶景と露天風呂・カップルに最適', rakutenUrl: 'https://travel.rakuten.co.jp/yado/hokkaido/biei.html', jalanUrl: 'https://www.jalan.net/010000/LRG_012100/' },
    friends: { name: '白金温泉 美瑛自然の村', reason: 'コテージタイプ・グループでの自然体験に最適', rakutenUrl: 'https://travel.rakuten.co.jp/yado/hokkaido/biei.html', jalanUrl: 'https://www.jalan.net/010000/LRG_012100/' },
  },

  'asahikawa': {
    solo:    { name: 'ドーミーイン旭川', reason: '旭川駅徒歩5分・夜鳴きそば付き格安シングルプラン', rakutenUrl: 'https://travel.rakuten.co.jp/yado/hokkaido/asahikawa.html', jalanUrl: 'https://www.jalan.net/010000/LRG_010500/' },
    couple:  { name: '旭川グランドホテル', reason: '旭山動物園アクセス良好・広めのツインで快適滞在', rakutenUrl: 'https://travel.rakuten.co.jp/yado/hokkaido/asahikawa.html', jalanUrl: 'https://www.jalan.net/010000/LRG_010500/' },
    friends: { name: '旭川ワシントンホテル', reason: 'トリプルルーム対応・グループ料金でリーズナブル', rakutenUrl: 'https://travel.rakuten.co.jp/yado/hokkaido/asahikawa.html', jalanUrl: 'https://www.jalan.net/010000/LRG_010500/' },
  },

  'kushiro': {
    solo:    { name: 'ラビスタ釧路川', reason: '釧路駅近・川沿いのシングルプランが格安', rakutenUrl: 'https://travel.rakuten.co.jp/yado/hokkaido/kushiro.html', jalanUrl: 'https://www.jalan.net/010000/LRG_013500/' },
    couple:  { name: 'ANAクラウンプラザホテル釧路', reason: '釧路湿原の眺望・特別な記念日に最適な上質な宿', rakutenUrl: 'https://travel.rakuten.co.jp/yado/hokkaido/kushiro.html', jalanUrl: 'https://www.jalan.net/010000/LRG_013500/' },
    friends: { name: '釧路センチュリーキャッスルホテル', reason: '広いツイン・トリプルルーム対応でグループに最適', rakutenUrl: 'https://travel.rakuten.co.jp/yado/hokkaido/kushiro.html', jalanUrl: 'https://www.jalan.net/010000/LRG_013500/' },
  },

  'mashu-ko': {
    solo:    { name: '川湯観光ホテル', reason: '川湯温泉駅近・手頃な素泊まりプランで格安旅', rakutenUrl: 'https://travel.rakuten.co.jp/yado/hokkaido/kushiro.html', jalanUrl: 'https://www.jalan.net/010000/LRG_013500/' },
    couple:  { name: '摩周温泉 すみれ', reason: '霧に包まれた摩周湖の静寂・二人で過ごす贅沢な宿', rakutenUrl: 'https://travel.rakuten.co.jp/yado/hokkaido/kushiro.html', jalanUrl: 'https://www.jalan.net/010000/LRG_013500/' },
    friends: { name: '弟子屈プリンスホテル', reason: '広い客室と大浴場・グループでの自然体験の拠点に', rakutenUrl: 'https://travel.rakuten.co.jp/yado/hokkaido/kushiro.html', jalanUrl: 'https://www.jalan.net/010000/LRG_013500/' },
  },

  'hakodate': {
    solo:    { name: 'ドーミーイン函館', reason: '函館駅徒歩5分・朝食付きシングルが格安', rakutenUrl: 'https://travel.rakuten.co.jp/yado/hokkaido/hakodate.html', jalanUrl: 'https://www.jalan.net/010000/' },
    couple:  { name: '湯の浜ホテル', reason: '函館山夜景と温泉・カップルに大人気の旅館', rakutenUrl: 'https://travel.rakuten.co.jp/yado/hokkaido/hakodate.html', jalanUrl: 'https://www.jalan.net/010000/' },
    friends: { name: '函館国際ホテル', reason: '大人数対応・朝市が徒歩圏内でコスパ高い', rakutenUrl: 'https://travel.rakuten.co.jp/yado/hokkaido/hakodate.html', jalanUrl: 'https://www.jalan.net/010000/' },
  },

  // ─── 東北 ────────────────────────────────────────────────────

  'sendai': {
    solo:    { name: 'ドーミーイン仙台', reason: '仙台駅徒歩5分・天然温泉付きで格安シングルプラン', rakutenUrl: 'https://travel.rakuten.co.jp/yado/miyagi/sendai.html', jalanUrl: 'https://www.jalan.net/040000/' },
    couple:  { name: '仙台ロイヤルパークホテル', reason: '緑豊かな庭園と露天風呂・二人だけの特別な滞在', rakutenUrl: 'https://travel.rakuten.co.jp/yado/miyagi/sendai.html', jalanUrl: 'https://www.jalan.net/040000/' },
    friends: { name: '仙台国際ホテル', reason: '広い和洋室・グループ宴会プランが充実', rakutenUrl: 'https://travel.rakuten.co.jp/yado/miyagi/sendai.html', jalanUrl: 'https://www.jalan.net/040000/' },
  },

  'matsushima': {
    solo:    { name: '松島センチュリーホテル', reason: '松島海岸駅近・素泊まりシングルが手頃', rakutenUrl: 'https://travel.rakuten.co.jp/yado/miyagi/matsushima.html', jalanUrl: 'https://www.jalan.net/040000/' },
    couple:  { name: '松島一の坊', reason: '客室から松島の島々を一望・贅沢な懐石料理付き', rakutenUrl: 'https://travel.rakuten.co.jp/yado/miyagi/matsushima.html', jalanUrl: 'https://www.jalan.net/040000/' },
    friends: { name: '松島温泉ホテル海風土', reason: '海の幸バイキングと大浴場・グループでコスパ良好', rakutenUrl: 'https://travel.rakuten.co.jp/yado/miyagi/matsushima.html', jalanUrl: 'https://www.jalan.net/040000/' },
  },

  'hiraizumi': {
    solo:    { name: 'ホテル平泉', reason: '平泉駅徒歩5分・リーズナブルな素泊まりプラン', rakutenUrl: 'https://travel.rakuten.co.jp/yado/iwate/hiraizumi.html', jalanUrl: 'https://www.jalan.net/030000/LRG_030300/' },
    couple:  { name: '平泉悠久の湯 別邸', reason: '世界遺産の地で静かに過ごす温泉付き旅館', rakutenUrl: 'https://travel.rakuten.co.jp/yado/iwate/hiraizumi.html', jalanUrl: 'https://www.jalan.net/030000/LRG_030300/' },
    friends: { name: '東横INN平泉前沢', reason: 'グループ対応の広い客室・朝食無料でコスパ優秀', rakutenUrl: 'https://travel.rakuten.co.jp/yado/iwate/hiraizumi.html', jalanUrl: 'https://www.jalan.net/030000/LRG_030300/' },
  },

  'kakunodate': {
    solo:    { name: 'ホテルフォルクローロ角館', reason: '角館駅直結・シングルプランが格安で便利', rakutenUrl: 'https://travel.rakuten.co.jp/yado/akita/tazawa.html', jalanUrl: 'https://www.jalan.net/050000/LRG_050300/' },
    couple:  { name: '角館山荘侘助', reason: '武家屋敷の町並みを望む和風旅館・温泉付きで優雅', rakutenUrl: 'https://travel.rakuten.co.jp/yado/akita/tazawa.html', jalanUrl: 'https://www.jalan.net/050000/LRG_050300/' },
    friends: { name: '田沢湖高原温泉郷 プラザホテル山麓荘', reason: '広い温泉大浴場と多人数プラン・グループ旅行に最適', rakutenUrl: 'https://travel.rakuten.co.jp/yado/akita/tazawa.html', jalanUrl: 'https://www.jalan.net/050000/LRG_050300/' },
  },

  'aizu': {
    solo:    { name: '東横INN会津若松駅前', reason: '会津若松駅徒歩2分・シングルプランが格安', rakutenUrl: 'https://travel.rakuten.co.jp/yado/fukushima/aizu.html', jalanUrl: 'https://www.jalan.net/070000/' },
    couple:  { name: '東山温泉 くつろぎの宿 千代滝', reason: '東山温泉の渓谷美・個室露天風呂でロマンチックな夜', rakutenUrl: 'https://travel.rakuten.co.jp/yado/fukushima/aizu.html', jalanUrl: 'https://www.jalan.net/070000/' },
    friends: { name: '会津若松ワシントンホテル', reason: 'グループ対応の広い客室・鶴ヶ城観光の拠点に最適', rakutenUrl: 'https://travel.rakuten.co.jp/yado/fukushima/aizu.html', jalanUrl: 'https://www.jalan.net/070000/' },
  },

  'jododaira': {
    solo:    { name: '磐梯山温泉ホテル', reason: '猪苗代駅からアクセス良好・素泊まりプランが手頃', rakutenUrl: 'https://travel.rakuten.co.jp/yado/fukushima/bandai.html', jalanUrl: 'https://www.jalan.net/070000/' },
    couple:  { name: '星野リゾート 磐梯山温泉ホテル', reason: '磐梯山の絶景と温泉・二人旅にぴったりの贅沢宿', rakutenUrl: 'https://travel.rakuten.co.jp/yado/fukushima/bandai.html', jalanUrl: 'https://www.jalan.net/070000/' },
    friends: { name: 'ホテルリステル猪苗代', reason: '広大な敷地でグループアクティビティが充実・コスパ良好', rakutenUrl: 'https://travel.rakuten.co.jp/yado/fukushima/bandai.html', jalanUrl: 'https://www.jalan.net/070000/' },
  },

  'zaosan': {
    solo:    { name: '蔵王国際ホテル', reason: '蔵王温泉バス停近・素泊まりプランでリーズナブル', rakutenUrl: 'https://travel.rakuten.co.jp/yado/yamagata/zaosan.html', jalanUrl: 'https://www.jalan.net/060000/' },
    couple:  { name: '深山荘 高見屋', reason: '蔵王温泉の老舗旅館・樹氷と露天風呂を二人で満喫', rakutenUrl: 'https://travel.rakuten.co.jp/yado/yamagata/zaosan.html', jalanUrl: 'https://www.jalan.net/060000/' },
    friends: { name: '蔵王ロイヤルホテル', reason: 'スキー場に直結・グループ向けの人数割引プランあり', rakutenUrl: 'https://travel.rakuten.co.jp/yado/yamagata/zaosan.html', jalanUrl: 'https://www.jalan.net/060000/' },
  },

  'akita': {
    solo:    { name: 'ドーミーイン秋田', reason: '秋田駅徒歩5分・天然温泉付き格安シングルプラン', rakutenUrl: 'https://travel.rakuten.co.jp/yado/akita/akita.html', jalanUrl: 'https://www.jalan.net/050000/LRG_050200/' },
    couple:  { name: '秋田ビューホテル', reason: '秋田市街の眺望・季節の秋田料理が評判の宿', rakutenUrl: 'https://travel.rakuten.co.jp/yado/akita/akita.html', jalanUrl: 'https://www.jalan.net/050000/LRG_050200/' },
    friends: { name: '秋田キャッスルホテル', reason: '広い客室と宴会場・グループで秋田の幸を満喫', rakutenUrl: 'https://travel.rakuten.co.jp/yado/akita/akita.html', jalanUrl: 'https://www.jalan.net/050000/LRG_050200/' },
  },

  'sakata': {
    solo:    { name: 'ルートイン酒田', reason: '酒田駅近・無料朝食付きシングルプランが格安', rakutenUrl: 'https://travel.rakuten.co.jp/yado/yamagata/sakata.html', jalanUrl: 'https://www.jalan.net/060000/' },
    couple:  { name: '本陣富樫', reason: '庄内平野の景色と老舗旅館の趣・カップルに人気', rakutenUrl: 'https://travel.rakuten.co.jp/yado/yamagata/sakata.html', jalanUrl: 'https://www.jalan.net/060000/' },
    friends: { name: 'ホテルリッチ酒田', reason: '広い客室と充実の朝食バイキング・グループにお得', rakutenUrl: 'https://travel.rakuten.co.jp/yado/yamagata/sakata.html', jalanUrl: 'https://www.jalan.net/060000/' },
  },

  'nyuto-onsen': {
    solo:    { name: '秘湯の宿 つる之湯', reason: '素泊まりプランで乳頭温泉郷を格安で堪能', rakutenUrl: 'https://travel.rakuten.co.jp/yado/akita/tazawa.html', jalanUrl: 'https://www.jalan.net/050000/LRG_050300/' },
    couple:  { name: '乳頭温泉郷 妙乃湯', reason: '混浴露天風呂と渓谷の絶景・カップルに人気の秘湯', rakutenUrl: 'https://travel.rakuten.co.jp/yado/akita/tazawa.html', jalanUrl: 'https://www.jalan.net/050000/LRG_050300/' },
    friends: { name: '乳頭温泉郷 大釜温泉', reason: '茅葺き屋根の雰囲気・グループで乳頭温泉を満喫', rakutenUrl: 'https://travel.rakuten.co.jp/yado/akita/tazawa.html', jalanUrl: 'https://www.jalan.net/050000/LRG_050300/' },
  },

  'ginzan-onsen': {
    solo:    { name: '銀山温泉 藤屋', reason: '銀山温泉の玄関口・素泊まりプランで格安滞在', rakutenUrl: 'https://travel.rakuten.co.jp/yado/yamagata/ginzan.html', jalanUrl: 'https://www.jalan.net/060000/' },
    couple:  { name: '銀山温泉 能登屋旅館', reason: '大正ロマンの街並みと源泉かけ流し・二人旅の名宿', rakutenUrl: 'https://travel.rakuten.co.jp/yado/yamagata/ginzan.html', jalanUrl: 'https://www.jalan.net/060000/' },
    friends: { name: '銀山温泉 古山閣', reason: '広い客室と共同大浴場・グループで銀山の趣を満喫', rakutenUrl: 'https://travel.rakuten.co.jp/yado/yamagata/ginzan.html', jalanUrl: 'https://www.jalan.net/060000/' },
  },

  'ouchi-juku': {
    solo:    { name: 'ホテルJALシティ会津若松', reason: '会津若松市内・素泊まりシングルプランが格安', rakutenUrl: 'https://travel.rakuten.co.jp/yado/fukushima/aizu.html', jalanUrl: 'https://www.jalan.net/070000/' },
    couple:  { name: '大内宿 山形屋', reason: '茅葺き宿場町に泊まる非日常体験・カップルに最適', rakutenUrl: 'https://travel.rakuten.co.jp/yado/fukushima/aizu.html', jalanUrl: 'https://www.jalan.net/070000/' },
    friends: { name: '会津若松ワシントンホテル', reason: '広いツイン・トリプルルーム・会津観光の拠点に最適', rakutenUrl: 'https://travel.rakuten.co.jp/yado/fukushima/aizu.html', jalanUrl: 'https://www.jalan.net/070000/' },
  },

  'naruko-onsen': {
    solo:    { name: 'ホテルサンマリン鳴子', reason: '鳴子温泉駅徒歩圏内・素泊まりプランが格安', rakutenUrl: 'https://travel.rakuten.co.jp/yado/miyagi/naruko.html', jalanUrl: 'https://www.jalan.net/040000/' },
    couple:  { name: '鳴子温泉 姥乃湯旅館', reason: '5種類の源泉と静かな渓谷・二人でゆっくり温泉三昧', rakutenUrl: 'https://travel.rakuten.co.jp/yado/miyagi/naruko.html', jalanUrl: 'https://www.jalan.net/040000/' },
    friends: { name: '鳴子温泉 旅館大沼', reason: '広い客室と多彩な温泉・グループで温泉を満喫', rakutenUrl: 'https://travel.rakuten.co.jp/yado/miyagi/naruko.html', jalanUrl: 'https://www.jalan.net/040000/' },
  },

  'naruko-kyo': {
    solo:    { name: '鳴子温泉 ますや旅館', reason: '鳴子峡最寄り駅近・リーズナブルな素泊まりプラン', rakutenUrl: 'https://travel.rakuten.co.jp/yado/miyagi/naruko.html', jalanUrl: 'https://www.jalan.net/040000/' },
    couple:  { name: '鳴子温泉 旅館すがわら', reason: '紅葉の鳴子峡に隣接・カップルで絶景温泉を堪能', rakutenUrl: 'https://travel.rakuten.co.jp/yado/miyagi/naruko.html', jalanUrl: 'https://www.jalan.net/040000/' },
    friends: { name: '鳴子温泉 東多賀の湯', reason: '広い湯治向け客室・グループで長期滞在もコスパ良好', rakutenUrl: 'https://travel.rakuten.co.jp/yado/miyagi/naruko.html', jalanUrl: 'https://www.jalan.net/040000/' },
  },

  'hirosaki': {
    solo:    { name: 'ドーミーイン弘前', reason: '弘前駅徒歩10分・天然温泉付き格安シングルプラン', rakutenUrl: 'https://travel.rakuten.co.jp/yado/aomori/hirosaki.html', jalanUrl: 'https://www.jalan.net/020000/LRG_020900/' },
    couple:  { name: '弘前パークホテル', reason: '弘前城の桜が見える客室・二人で津軽文化を満喫', rakutenUrl: 'https://travel.rakuten.co.jp/yado/aomori/hirosaki.html', jalanUrl: 'https://www.jalan.net/020000/LRG_020900/' },
    friends: { name: '弘前グランドホテル', reason: '広い和室と充実の朝食・グループ旅行の拠点に最適', rakutenUrl: 'https://travel.rakuten.co.jp/yado/aomori/hirosaki.html', jalanUrl: 'https://www.jalan.net/020000/LRG_020900/' },
  },

  'oirase': {
    solo:    { name: 'ホテルロッジ奥入瀬', reason: '奥入瀬渓流入口近く・リーズナブルな素泊まりプラン', rakutenUrl: 'https://travel.rakuten.co.jp/yado/aomori/oirase.html', jalanUrl: 'https://www.jalan.net/020000/LRG_020800/' },
    couple:  { name: '星野リゾート 奥入瀬渓流ホテル', reason: '渓流沿いの絶景客室・二人で自然の息吹を感じる宿', rakutenUrl: 'https://travel.rakuten.co.jp/yado/aomori/oirase.html', jalanUrl: 'https://www.jalan.net/020000/LRG_020800/' },
    friends: { name: '十和田湖畔温泉 民宿あずまし', reason: '広めの和室・グループで十和田の大自然を満喫', rakutenUrl: 'https://travel.rakuten.co.jp/yado/aomori/oirase.html', jalanUrl: 'https://www.jalan.net/020000/LRG_020800/' },
  },

  'osorezan': {
    solo:    { name: 'むつグランドホテル', reason: 'むつ駅前・シングルプランで格安に拠点確保', rakutenUrl: 'https://travel.rakuten.co.jp/yado/aomori/shimokita.html', jalanUrl: 'https://www.jalan.net/020000/LRG_021700/' },
    couple:  { name: '恐山温泉 いづのや', reason: '霊場恐山の宿坊体験・唯一無二の精神的な旅', rakutenUrl: 'https://travel.rakuten.co.jp/yado/aomori/shimokita.html', jalanUrl: 'https://www.jalan.net/020000/LRG_021700/' },
    friends: { name: '下北半島温泉 ホテルニュー寿', reason: '広い客室・グループで下北の秘境体験を楽しめる', rakutenUrl: 'https://travel.rakuten.co.jp/yado/aomori/shimokita.html', jalanUrl: 'https://www.jalan.net/020000/LRG_021700/' },
  },

  'yamagata': {
    solo:    { name: 'ドーミーイン山形', reason: '山形駅徒歩5分・格安シングルプランで便利に拠点', rakutenUrl: 'https://travel.rakuten.co.jp/yado/yamagata/yamagata.html', jalanUrl: 'https://www.jalan.net/060000/' },
    couple:  { name: '山形国際ホテル', reason: '山形市街の眺望・山形の郷土料理が美しい上質な宿', rakutenUrl: 'https://travel.rakuten.co.jp/yado/yamagata/yamagata.html', jalanUrl: 'https://www.jalan.net/060000/' },
    friends: { name: 'メトロポリタン山形', reason: '山形駅直結・広い客室でグループ旅行に快適', rakutenUrl: 'https://travel.rakuten.co.jp/yado/yamagata/yamagata.html', jalanUrl: 'https://www.jalan.net/060000/' },
  },

  'yamadera': {
    solo:    { name: '山寺ホテル 山楽', reason: '山寺駅徒歩3分・リーズナブルな素泊まりプラン', rakutenUrl: 'https://travel.rakuten.co.jp/yado/yamagata/yamadera.html', jalanUrl: 'https://www.jalan.net/060000/' },
    couple:  { name: '山寺温泉 みちのく山寺', reason: '芭蕉の地で静かな温泉旅・カップルに人気の和の宿', rakutenUrl: 'https://travel.rakuten.co.jp/yado/yamagata/yamadera.html', jalanUrl: 'https://www.jalan.net/060000/' },
    friends: { name: '山寺周辺 旅館さかい', reason: '広い座敷で仲間とわいわい・山形名物で盛り上がれる', rakutenUrl: 'https://travel.rakuten.co.jp/yado/yamagata/yamadera.html', jalanUrl: 'https://www.jalan.net/060000/' },
  },

  'morioka': {
    solo:    { name: 'ドーミーイン盛岡', reason: '盛岡駅徒歩5分・天然温泉付き格安シングルプラン', rakutenUrl: 'https://travel.rakuten.co.jp/yado/iwate/morioka.html', jalanUrl: 'https://www.jalan.net/030000/LRG_030100/' },
    couple:  { name: 'ホテルメトロポリタン盛岡', reason: '盛岡駅直結・岩手の食材を堪能できる上質な宿', rakutenUrl: 'https://travel.rakuten.co.jp/yado/iwate/morioka.html', jalanUrl: 'https://www.jalan.net/030000/LRG_030100/' },
    friends: { name: 'ホテルニューカリーナ盛岡', reason: '広い和室と宴会プラン・グループで盛岡を楽しめる', rakutenUrl: 'https://travel.rakuten.co.jp/yado/iwate/morioka.html', jalanUrl: 'https://www.jalan.net/030000/LRG_030100/' },
  },

  'miyako-iwate': {
    solo:    { name: 'ホテル宮古ヒルズ', reason: '宮古駅徒歩圏内・シングルプランが手頃で便利', rakutenUrl: 'https://travel.rakuten.co.jp/yado/iwate/miyako.html', jalanUrl: 'https://www.jalan.net/030000/LRG_031100/' },
    couple:  { name: '宮古温泉 さんりくの宿', reason: '三陸の海を望む客室・新鮮な海の幸と温泉が自慢', rakutenUrl: 'https://travel.rakuten.co.jp/yado/iwate/miyako.html', jalanUrl: 'https://www.jalan.net/030000/LRG_031100/' },
    friends: { name: '宮古ワシントンホテル', reason: '広い客室とグループ向けプラン・三陸の幸を堪能', rakutenUrl: 'https://travel.rakuten.co.jp/yado/iwate/miyako.html', jalanUrl: 'https://www.jalan.net/030000/LRG_031100/' },
  },

  // ─── 関東 ────────────────────────────────────────────────────

  'yokohama': {
    solo:    { name: 'ドーミーイン横浜', reason: '横浜駅徒歩圏内・格安シングルプランで便利に拠点', rakutenUrl: 'https://travel.rakuten.co.jp/yado/kanagawa/yokohama.html', jalanUrl: 'https://www.jalan.net/140000/LRG_140200/' },
    couple:  { name: 'ヨコハマ グランド インターコンチネンタル', reason: 'みなとみらいの夜景・二人の記念日に最高の宿', rakutenUrl: 'https://travel.rakuten.co.jp/yado/kanagawa/yokohama.html', jalanUrl: 'https://www.jalan.net/140000/LRG_140200/' },
    friends: { name: 'ホテルニューグランド横浜', reason: '広い客室と歴史ある老舗ホテル・グループ旅行に最適', rakutenUrl: 'https://travel.rakuten.co.jp/yado/kanagawa/yokohama.html', jalanUrl: 'https://www.jalan.net/140000/LRG_140200/' },
  },

  'tokyo': {
    solo:    { name: 'ドーミーイン東京', reason: '都心アクセス抜群・格安シングルプランで観光の拠点', rakutenUrl: 'https://travel.rakuten.co.jp/yado/tokyo/shinjuku.html', jalanUrl: 'https://www.jalan.net/130000/' },
    couple:  { name: '東京ステーションホテル', reason: '丸の内の歴史的建築・二人で過ごす特別な都会の夜', rakutenUrl: 'https://travel.rakuten.co.jp/yado/tokyo/shinjuku.html', jalanUrl: 'https://www.jalan.net/130000/' },
    friends: { name: 'ホテルグレイスリー新宿', reason: '新宿駅直結・広い客室でグループ都市観光に最適', rakutenUrl: 'https://travel.rakuten.co.jp/yado/tokyo/shinjuku.html', jalanUrl: 'https://www.jalan.net/130000/' },
  },

  'kamakura': {
    solo:    { name: 'ゲストハウス鎌倉', reason: '鎌倉駅徒歩圏内・格安で観光の拠点にできる宿', rakutenUrl: 'https://travel.rakuten.co.jp/yado/kanagawa/kamakura.html', jalanUrl: 'https://www.jalan.net/140000/LRG_141600/' },
    couple:  { name: '鎌倉プリンスホテル', reason: '稲村ガ崎の海景・二人でゆったり鎌倉の自然を満喫', rakutenUrl: 'https://travel.rakuten.co.jp/yado/kanagawa/kamakura.html', jalanUrl: 'https://www.jalan.net/140000/LRG_141600/' },
    friends: { name: 'ホテルメトロポリタン鎌倉', reason: '鎌倉駅近・広い客室でグループ観光の拠点に最適', rakutenUrl: 'https://travel.rakuten.co.jp/yado/kanagawa/kamakura.html', jalanUrl: 'https://www.jalan.net/140000/LRG_141600/' },
  },

  'nikko': {
    solo:    { name: '日光パークロッジ', reason: '日光駅徒歩圏内・素泊まりシングルプランが格安', rakutenUrl: 'https://travel.rakuten.co.jp/yado/tochigi/nikko.html', jalanUrl: 'https://www.jalan.net/090000/' },
    couple:  { name: '日光金谷ホテル', reason: '日光の老舗クラシックホテル・二人で格調ある滞在', rakutenUrl: 'https://travel.rakuten.co.jp/yado/tochigi/nikko.html', jalanUrl: 'https://www.jalan.net/090000/' },
    friends: { name: '鬼怒川温泉 ホテル鬼怒川館', reason: '広い温泉大浴場・グループで鬼怒川温泉を満喫', rakutenUrl: 'https://travel.rakuten.co.jp/yado/tochigi/nikko.html', jalanUrl: 'https://www.jalan.net/090000/' },
  },

  'kouzushima': {
    solo:    { name: '神津島温泉保養センター', reason: '島内唯一の温泉施設近く・リーズナブルな素泊まり', rakutenUrl: 'https://travel.rakuten.co.jp/yado/tokyo/oshima.html', jalanUrl: 'https://www.jalan.net/130000/' },
    couple:  { name: '神津島 ゲストハウスかのうや', reason: '島の絶景と透明な海・二人でのんびり離島旅を満喫', rakutenUrl: 'https://travel.rakuten.co.jp/yado/tokyo/oshima.html', jalanUrl: 'https://www.jalan.net/130000/' },
    friends: { name: '神津島 民宿はるみ', reason: '大人数対応の和室・島の幸でグループ宴会が楽しい', rakutenUrl: 'https://travel.rakuten.co.jp/yado/tokyo/oshima.html', jalanUrl: 'https://www.jalan.net/130000/' },
  },

  'hakone': {
    solo:    { name: 'ホテルグリーンプラザ箱根', reason: '芦ノ湖近く・格安素泊まりプランで箱根を満喫', rakutenUrl: 'https://travel.rakuten.co.jp/yado/kanagawa/hakone.html', jalanUrl: 'https://www.jalan.net/140000/LRG_140500/' },
    couple:  { name: '箱根高原ホテル', reason: '富士山と芦ノ湖の絶景・露天風呂付き客室でロマンチック', rakutenUrl: 'https://travel.rakuten.co.jp/yado/kanagawa/hakone.html', jalanUrl: 'https://www.jalan.net/140000/LRG_140500/' },
    friends: { name: '箱根小涌園ユネッサン', reason: '温泉プール直結・グループでわいわい楽しめる大型宿', rakutenUrl: 'https://travel.rakuten.co.jp/yado/kanagawa/hakone.html', jalanUrl: 'https://www.jalan.net/140000/LRG_140500/' },
  },

  'kusatsu-onsen': {
    solo:    { name: 'ホテル一井', reason: '草津温泉バス停近・格安素泊まりプランで湯畑へ徒歩圏', rakutenUrl: 'https://travel.rakuten.co.jp/yado/gunma/kusatsu.html', jalanUrl: 'https://www.jalan.net/100000/' },
    couple:  { name: '草津温泉 綿の湯', reason: '源泉かけ流しの貸切風呂・カップルで極上の草津温泉', rakutenUrl: 'https://travel.rakuten.co.jp/yado/gunma/kusatsu.html', jalanUrl: 'https://www.jalan.net/100000/' },
    friends: { name: '草津ナウリゾートホテル', reason: '広い大浴場と多人数対応客室・グループでコスパ良好', rakutenUrl: 'https://travel.rakuten.co.jp/yado/gunma/kusatsu.html', jalanUrl: 'https://www.jalan.net/100000/' },
  },

  'izu-oshima': {
    solo:    { name: '伊豆大島 ホテル白岩', reason: '元町港近く・素泊まりシングルプランが格安', rakutenUrl: 'https://travel.rakuten.co.jp/yado/tokyo/oshima.html', jalanUrl: 'https://www.jalan.net/130000/' },
    couple:  { name: '伊豆大島 椿荘', reason: '椿林に囲まれた宿・三原山と海の絶景でロマンチック', rakutenUrl: 'https://travel.rakuten.co.jp/yado/tokyo/oshima.html', jalanUrl: 'https://www.jalan.net/130000/' },
    friends: { name: '伊豆大島 民宿三宅島', reason: '大人数対応の和室・島の幸でグループ宴会が盛り上がる', rakutenUrl: 'https://travel.rakuten.co.jp/yado/tokyo/oshima.html', jalanUrl: 'https://www.jalan.net/130000/' },
  },

  'takao': {
    solo:    { name: '高尾山口 ゲストハウス', reason: '高尾山口駅徒歩圏内・リーズナブルな素泊まりプラン', rakutenUrl: 'https://travel.rakuten.co.jp/yado/tokyo/hachioji.html', jalanUrl: 'https://www.jalan.net/130000/' },
    couple:  { name: 'うかい鳥山', reason: '高尾の緑に囲まれた情緒ある宿・二人で自然と料理を堪能', rakutenUrl: 'https://travel.rakuten.co.jp/yado/tokyo/hachioji.html', jalanUrl: 'https://www.jalan.net/130000/' },
    friends: { name: 'ホテル高尾山周辺 コテージ', reason: '多人数対応のコテージ・高尾山麓でグループ合宿に最適', rakutenUrl: 'https://travel.rakuten.co.jp/yado/tokyo/hachioji.html', jalanUrl: 'https://www.jalan.net/130000/' },
  },

  'tateyama-chiba': {
    solo:    { name: '館山ビジネスホテル', reason: '館山駅徒歩圏内・格安シングルプランで房総観光の拠点', rakutenUrl: 'https://travel.rakuten.co.jp/yado/chiba/tateyama.html', jalanUrl: 'https://www.jalan.net/120000/' },
    couple:  { name: '館山 海辺の鴨川 清海荘', reason: '東京湾の絶景と新鮮な海の幸・カップルに人気のリゾート', rakutenUrl: 'https://travel.rakuten.co.jp/yado/chiba/tateyama.html', jalanUrl: 'https://www.jalan.net/120000/' },
    friends: { name: '館山シーサイドホテル', reason: '海沿いの大型宿・グループで房総の海を満喫できる', rakutenUrl: 'https://travel.rakuten.co.jp/yado/chiba/tateyama.html', jalanUrl: 'https://www.jalan.net/120000/' },
  },

  'shima-onsen': {
    solo:    { name: '四万温泉 いわゆ旅館', reason: '四万温泉バス停近く・素泊まりプランが格安', rakutenUrl: 'https://travel.rakuten.co.jp/yado/gunma/shima.html', jalanUrl: 'https://www.jalan.net/100000/' },
    couple:  { name: '四万温泉 積善館', reason: '国の登録有形文化財の老舗旅館・カップルで大正浪漫の湯', rakutenUrl: 'https://travel.rakuten.co.jp/yado/gunma/shima.html', jalanUrl: 'https://www.jalan.net/100000/' },
    friends: { name: '四万温泉 山楽荘', reason: '広い大浴場と多人数部屋・グループで源泉かけ流しを堪能', rakutenUrl: 'https://travel.rakuten.co.jp/yado/gunma/shima.html', jalanUrl: 'https://www.jalan.net/100000/' },
  },

  'mashiko': {
    solo:    { name: 'ゲストハウス益子', reason: '益子駅徒歩圏内・リーズナブルな素泊まりプラン', rakutenUrl: 'https://travel.rakuten.co.jp/yado/tochigi/mashiko.html', jalanUrl: 'https://www.jalan.net/090000/' },
    couple:  { name: '益子の宿 花のやど', reason: '陶芸の里の自然に囲まれた宿・二人でゆったり窯元巡り', rakutenUrl: 'https://travel.rakuten.co.jp/yado/tochigi/mashiko.html', jalanUrl: 'https://www.jalan.net/090000/' },
    friends: { name: '益子ホテル ビジネス益子', reason: 'グループ対応の広い客室・益子焼体験の拠点に最適', rakutenUrl: 'https://travel.rakuten.co.jp/yado/tochigi/mashiko.html', jalanUrl: 'https://www.jalan.net/090000/' },
  },

  'minakami-onsen': {
    solo:    { name: '水上温泉 ホテル清風館', reason: '水上駅近・リーズナブルな素泊まりプランで格安', rakutenUrl: 'https://travel.rakuten.co.jp/yado/gunma/minakami.html', jalanUrl: 'https://www.jalan.net/100000/' },
    couple:  { name: '奥利根の湯 ふれあい館', reason: '利根川沿いの絶景と天然温泉・カップルで渓谷美を満喫', rakutenUrl: 'https://travel.rakuten.co.jp/yado/gunma/minakami.html', jalanUrl: 'https://www.jalan.net/100000/' },
    friends: { name: '水上温泉 ホテル旅館 水明館', reason: '広い大浴場と多人数プラン・グループでラフティング後に最適', rakutenUrl: 'https://travel.rakuten.co.jp/yado/gunma/minakami.html', jalanUrl: 'https://www.jalan.net/100000/' },
  },

  'fukuroda-falls': {
    solo:    { name: '袋田温泉 思い出浪漫館', reason: '袋田の滝入口近く・格安素泊まりプランで拠点確保', rakutenUrl: 'https://travel.rakuten.co.jp/yado/ibaraki/fukuroda.html', jalanUrl: 'https://www.jalan.net/080000/' },
    couple:  { name: '袋田温泉 滝味の宿 豊年万作', reason: '滝の音が聞こえる客室・カップルで四季の名瀑を鑑賞', rakutenUrl: 'https://travel.rakuten.co.jp/yado/ibaraki/fukuroda.html', jalanUrl: 'https://www.jalan.net/080000/' },
    friends: { name: '袋田温泉 思い出浪漫館 別館', reason: '広い客室と宴会プラン・グループで茨城の自然を満喫', rakutenUrl: 'https://travel.rakuten.co.jp/yado/ibaraki/fukuroda.html', jalanUrl: 'https://www.jalan.net/080000/' },
  },

  // ─── 中部 ────────────────────────────────────────────────────

  'nagoya': {
    solo:    { name: 'ドーミーイン名古屋', reason: '名古屋駅徒歩圏内・格安シングルプランで観光の拠点', rakutenUrl: 'https://travel.rakuten.co.jp/yado/aichi/nagoya.html', jalanUrl: 'https://www.jalan.net/230000/LRG_230200/' },
    couple:  { name: 'ヒルトン名古屋', reason: '名古屋の夜景を一望・二人で過ごす特別な都市ホテル', rakutenUrl: 'https://travel.rakuten.co.jp/yado/aichi/nagoya.html', jalanUrl: 'https://www.jalan.net/230000/LRG_230200/' },
    friends: { name: 'ホテルサンルート新名古屋', reason: '広い客室と宴会プラン・グループ旅行の拠点に最適', rakutenUrl: 'https://travel.rakuten.co.jp/yado/aichi/nagoya.html', jalanUrl: 'https://www.jalan.net/230000/LRG_230200/' },
  },

  'ise': {
    solo:    { name: 'ホテルルートイン伊勢', reason: '伊勢市駅近・無料朝食付きシングルプランが格安', rakutenUrl: 'https://travel.rakuten.co.jp/yado/mie/ise.html', jalanUrl: 'https://www.jalan.net/240000/' },
    couple:  { name: '伊勢 神宮会館', reason: '内宮の森に隣接・伊勢の精神的な空気に包まれた宿', rakutenUrl: 'https://travel.rakuten.co.jp/yado/mie/ise.html', jalanUrl: 'https://www.jalan.net/240000/' },
    friends: { name: '伊勢シティホテルアネックス', reason: '広い客室とグループ向けプラン・お伊勢参りの拠点に', rakutenUrl: 'https://travel.rakuten.co.jp/yado/mie/ise.html', jalanUrl: 'https://www.jalan.net/240000/' },
  },

  'shirakawago': {
    solo:    { name: '荻町の宿 まんまる', reason: '世界遺産集落内・格安で合掌造りの宿に泊まれる', rakutenUrl: 'https://travel.rakuten.co.jp/yado/gifu/shirakawago.html', jalanUrl: 'https://www.jalan.net/210000/' },
    couple:  { name: '合掌の宿 孫右エ門', reason: '合掌造り古民家での滞在・白川郷の雪景色が絶景', rakutenUrl: 'https://travel.rakuten.co.jp/yado/gifu/shirakawago.html', jalanUrl: 'https://www.jalan.net/210000/' },
    friends: { name: '民宿 白川郷', reason: '大人数対応の合掌造り・グループで世界遺産を体感', rakutenUrl: 'https://travel.rakuten.co.jp/yado/gifu/shirakawago.html', jalanUrl: 'https://www.jalan.net/210000/' },
  },

  'takayama': {
    solo:    { name: 'ホテルアソシア高山', reason: '高山駅徒歩2分・格安シングルプランで古い町並みへ好アクセス', rakutenUrl: 'https://travel.rakuten.co.jp/yado/gifu/takayama.html', jalanUrl: 'https://www.jalan.net/210000/' },
    couple:  { name: '飛騨高山 本陣平野屋 花兆庵', reason: '江戸時代の本陣跡・飛騨の文化と料理を二人で堪能', rakutenUrl: 'https://travel.rakuten.co.jp/yado/gifu/takayama.html', jalanUrl: 'https://www.jalan.net/210000/' },
    friends: { name: '高山グリーンホテル', reason: '広い客室と飛騨の食バイキング・グループ旅行に最適', rakutenUrl: 'https://travel.rakuten.co.jp/yado/gifu/takayama.html', jalanUrl: 'https://www.jalan.net/210000/' },
  },

  'okuhida-onsen': {
    solo:    { name: '奥飛騨温泉郷 山峡の宿 奥飛騨ガーデンホテル焼岳', reason: '奥飛騨温泉バス停近・格安素泊まりプラン', rakutenUrl: 'https://travel.rakuten.co.jp/yado/gifu/okuhida.html', jalanUrl: 'https://www.jalan.net/210000/' },
    couple:  { name: '奥飛騨温泉 山のホテル', reason: '焼岳の絶景と露天風呂・カップルで山岳リゾートを満喫', rakutenUrl: 'https://travel.rakuten.co.jp/yado/gifu/okuhida.html', jalanUrl: 'https://www.jalan.net/210000/' },
    friends: { name: '奥飛騨温泉郷 旅館 奥飛騨の湯宿 今井', reason: '広い大浴場と多人数客室・グループでコスパよく温泉', rakutenUrl: 'https://travel.rakuten.co.jp/yado/gifu/okuhida.html', jalanUrl: 'https://www.jalan.net/210000/' },
  },

  'toba': {
    solo:    { name: 'ホテルルートイン鳥羽', reason: '鳥羽駅近・格安シングルプランで伊勢志摩観光の拠点', rakutenUrl: 'https://travel.rakuten.co.jp/yado/mie/toba.html', jalanUrl: 'https://www.jalan.net/240000/' },
    couple:  { name: '鳥羽国際ホテル', reason: '英虞湾の絶景と新鮮な海の幸・カップルの記念日に', rakutenUrl: 'https://travel.rakuten.co.jp/yado/mie/toba.html', jalanUrl: 'https://www.jalan.net/240000/' },
    friends: { name: '鳥羽シーサイドホテル', reason: '海沿いの大型ホテル・グループで伊勢志摩の海を満喫', rakutenUrl: 'https://travel.rakuten.co.jp/yado/mie/toba.html', jalanUrl: 'https://www.jalan.net/240000/' },
  },

  'inuyama': {
    solo:    { name: 'ルートイン犬山', reason: '犬山駅徒歩圏内・格安シングルプランで城下町へのアクセス良好', rakutenUrl: 'https://travel.rakuten.co.jp/yado/aichi/inuyama.html', jalanUrl: 'https://www.jalan.net/230000/' },
    couple:  { name: '犬山温泉 犬山キャッスルホテル', reason: '木曽川沿いの眺望と温泉・二人で国宝犬山城を望む宿', rakutenUrl: 'https://travel.rakuten.co.jp/yado/aichi/inuyama.html', jalanUrl: 'https://www.jalan.net/230000/' },
    friends: { name: '犬山 ホテルインディゴ名古屋', reason: '広い客室とグループプラン・城下町観光の拠点に最適', rakutenUrl: 'https://travel.rakuten.co.jp/yado/aichi/inuyama.html', jalanUrl: 'https://www.jalan.net/230000/' },
  },

  'kiso': {
    solo:    { name: '木曽路の宿 まつしろや', reason: '木曽福島駅近・格安素泊まりプランで宿場町観光', rakutenUrl: 'https://travel.rakuten.co.jp/yado/nagano/kiso.html', jalanUrl: 'https://www.jalan.net/200000/' },
    couple:  { name: '木曽温泉 旅館 ぬくもりの宿', reason: '木曽川沿いの自然と温泉・二人で木曽路の風情を楽しむ', rakutenUrl: 'https://travel.rakuten.co.jp/yado/nagano/kiso.html', jalanUrl: 'https://www.jalan.net/200000/' },
    friends: { name: 'ホテル木曽温泉センター', reason: '広い大浴場と多人数客室・グループでコスパよく滞在', rakutenUrl: 'https://travel.rakuten.co.jp/yado/nagano/kiso.html', jalanUrl: 'https://www.jalan.net/200000/' },
  },

  'tsumago': {
    solo:    { name: '妻籠宿 梅田屋', reason: '妻籠宿内・格安で宿場町の雰囲気を一人で体感', rakutenUrl: 'https://travel.rakuten.co.jp/yado/nagano/kiso.html', jalanUrl: 'https://www.jalan.net/200000/' },
    couple:  { name: '妻籠宿 いのうえ', reason: '江戸期の面影を残す宿場・カップルで古き日本を満喫', rakutenUrl: 'https://travel.rakuten.co.jp/yado/nagano/kiso.html', jalanUrl: 'https://www.jalan.net/200000/' },
    friends: { name: '妻籠宿 民宿 たちばな', reason: '大人数対応の広間・グループで山里の囲炉裏料理を堪能', rakutenUrl: 'https://travel.rakuten.co.jp/yado/nagano/kiso.html', jalanUrl: 'https://www.jalan.net/200000/' },
  },

  'magome': {
    solo:    { name: '馬籠宿 藤乙', reason: '馬籠宿内・格安素泊まりで島崎藤村の故郷を探訪', rakutenUrl: 'https://travel.rakuten.co.jp/yado/nagano/kiso.html', jalanUrl: 'https://www.jalan.net/200000/' },
    couple:  { name: '馬籠宿 但馬屋老舗', reason: '石畳の宿場に佇む老舗旅館・二人でゆっくり中山道散策', rakutenUrl: 'https://travel.rakuten.co.jp/yado/nagano/kiso.html', jalanUrl: 'https://www.jalan.net/200000/' },
    friends: { name: '馬籠 ゲストハウス はざま', reason: '大人数対応の民宿・グループで木曽路ハイキングに最適', rakutenUrl: 'https://travel.rakuten.co.jp/yado/nagano/kiso.html', jalanUrl: 'https://www.jalan.net/200000/' },
  },

  'gero-onsen': {
    solo:    { name: '下呂温泉 ホテルくさかべアルメリア', reason: '下呂駅徒歩5分・格安シングルプランで天下の名湯を堪能', rakutenUrl: 'https://travel.rakuten.co.jp/yado/gifu/gero.html', jalanUrl: 'https://www.jalan.net/210000/' },
    couple:  { name: '下呂温泉 水明館', reason: '飛騨川沿いの露天風呂と和食・カップルの記念日に最高', rakutenUrl: 'https://travel.rakuten.co.jp/yado/gifu/gero.html', jalanUrl: 'https://www.jalan.net/210000/' },
    friends: { name: '下呂温泉 下呂彩朝楽', reason: '大型旅館の広い大浴場と多人数客室・グループにお得', rakutenUrl: 'https://travel.rakuten.co.jp/yado/gifu/gero.html', jalanUrl: 'https://www.jalan.net/210000/' },
  },

  'kamikochi': {
    solo:    { name: '上高地アルペンホテル', reason: '上高地バスターミナル近・格安プランで高原を満喫', rakutenUrl: 'https://travel.rakuten.co.jp/yado/nagano/kamikochi.html', jalanUrl: 'https://www.jalan.net/200000/' },
    couple:  { name: '上高地帝国ホテル', reason: '穂高連峰の絶景と上高地の森・二人の特別なリゾート滞在', rakutenUrl: 'https://travel.rakuten.co.jp/yado/nagano/kamikochi.html', jalanUrl: 'https://www.jalan.net/200000/' },
    friends: { name: '上高地ルミエスタホテル', reason: '梓川沿いの広いテラス・グループで大自然を満喫できる', rakutenUrl: 'https://travel.rakuten.co.jp/yado/nagano/kamikochi.html', jalanUrl: 'https://www.jalan.net/200000/' },
  },

  'senjojiki': {
    solo:    { name: 'ホテル駒ヶ根ビューホテル', reason: '駒ヶ根駅近・格安シングルプランでロープウェーへのアクセス良好', rakutenUrl: 'https://travel.rakuten.co.jp/yado/nagano/komagane.html', jalanUrl: 'https://www.jalan.net/200000/' },
    couple:  { name: '中央アルプス 駒ヶ根高原ホテル', reason: '千畳敷カールの絶景と温泉・カップルで2900mの絶景を満喫', rakutenUrl: 'https://travel.rakuten.co.jp/yado/nagano/komagane.html', jalanUrl: 'https://www.jalan.net/200000/' },
    friends: { name: '駒ヶ根グランドホテル', reason: '広い客室と充実の食事・グループで南アルプス観光に最適', rakutenUrl: 'https://travel.rakuten.co.jp/yado/nagano/komagane.html', jalanUrl: 'https://www.jalan.net/200000/' },
  },

  'kanazawa': {
    solo:    { name: 'ドーミーイン金沢', reason: '金沢駅徒歩10分・格安シングルプランで兼六園へのアクセス良好', rakutenUrl: 'https://travel.rakuten.co.jp/yado/ishikawa/kanazawa.html', jalanUrl: 'https://www.jalan.net/170000/' },
    couple:  { name: '金沢茶屋', reason: '東茶屋街の風情・北陸の旬の味覚と二人だけの加賀情緒', rakutenUrl: 'https://travel.rakuten.co.jp/yado/ishikawa/kanazawa.html', jalanUrl: 'https://www.jalan.net/170000/' },
    friends: { name: '金沢ニューグランドホテル', reason: '広い客室と宴会プラン・グループで金沢の食文化を満喫', rakutenUrl: 'https://travel.rakuten.co.jp/yado/ishikawa/kanazawa.html', jalanUrl: 'https://www.jalan.net/170000/' },
  },

  'wajima': {
    solo:    { name: 'ホテルルートイン輪島', reason: '輪島駅近・格安シングルプランで朝市観光の拠点に', rakutenUrl: 'https://travel.rakuten.co.jp/yado/ishikawa/noto.html', jalanUrl: 'https://www.jalan.net/170000/' },
    couple:  { name: '輪島温泉 ホテルこうしゅうえん', reason: '日本海の絶景と輪島塗の器・カップルで能登の文化を体感', rakutenUrl: 'https://travel.rakuten.co.jp/yado/ishikawa/noto.html', jalanUrl: 'https://www.jalan.net/170000/' },
    friends: { name: '輪島 休暇村能登千里浜', reason: '大人数対応の客室と海の幸・グループでコスパ良好', rakutenUrl: 'https://travel.rakuten.co.jp/yado/ishikawa/noto.html', jalanUrl: 'https://www.jalan.net/170000/' },
  },

  'kaga-onsen': {
    solo:    { name: '加賀温泉 ホテルアローレ', reason: '加賀温泉駅近・格安素泊まりプランでリーズナブル', rakutenUrl: 'https://travel.rakuten.co.jp/yado/ishikawa/kaga.html', jalanUrl: 'https://www.jalan.net/170000/' },
    couple:  { name: '山代温泉 瑠璃光', reason: '檜の露天風呂と加賀料理・二人で山代温泉を贅沢に満喫', rakutenUrl: 'https://travel.rakuten.co.jp/yado/ishikawa/kaga.html', jalanUrl: 'https://www.jalan.net/170000/' },
    friends: { name: '片山津温泉 浜名湖グループイン', reason: '広い大浴場と多人数プラン・グループで加賀温泉郷を満喫', rakutenUrl: 'https://travel.rakuten.co.jp/yado/ishikawa/kaga.html', jalanUrl: 'https://www.jalan.net/170000/' },
  },

  'gokayama': {
    solo:    { name: '五箇山 民宿 加盟家', reason: '五箇山バス停近・リーズナブルな民宿で世界遺産を体感', rakutenUrl: 'https://travel.rakuten.co.jp/yado/toyama/gokayama.html', jalanUrl: 'https://www.jalan.net/160000/' },
    couple:  { name: '五箇山 合掌の里', reason: '合掌造りの客室・カップルで雪景色の五箇山を独占', rakutenUrl: 'https://travel.rakuten.co.jp/yado/toyama/gokayama.html', jalanUrl: 'https://www.jalan.net/160000/' },
    friends: { name: '五箇山 旅館 五箇山荘', reason: '大人数対応の広間・グループで五箇山の囲炉裏料理を堪能', rakutenUrl: 'https://travel.rakuten.co.jp/yado/toyama/gokayama.html', jalanUrl: 'https://www.jalan.net/160000/' },
  },

  'himi': {
    solo:    { name: 'ホテルルートイン氷見', reason: '氷見駅近・格安シングルプランで能登半島観光の拠点に', rakutenUrl: 'https://travel.rakuten.co.jp/yado/toyama/himi.html', jalanUrl: 'https://www.jalan.net/160000/' },
    couple:  { name: '氷見温泉郷 魚市場食堂 ひみ番屋街', reason: '富山湾越しの立山連峰・新鮮なブリと温泉でカップルに最適', rakutenUrl: 'https://travel.rakuten.co.jp/yado/toyama/himi.html', jalanUrl: 'https://www.jalan.net/160000/' },
    friends: { name: '氷見 民宿 うおや', reason: '大人数対応・グループで氷見の海の幸を思う存分堪能', rakutenUrl: 'https://travel.rakuten.co.jp/yado/toyama/himi.html', jalanUrl: 'https://www.jalan.net/160000/' },
  },

  'wakura-onsen': {
    solo:    { name: '和倉温泉 ホテル清水屋', reason: '和倉温泉駅近・格安素泊まりプランで能登の温泉を堪能', rakutenUrl: 'https://travel.rakuten.co.jp/yado/ishikawa/wakura.html', jalanUrl: 'https://www.jalan.net/170000/' },
    couple:  { name: '和倉温泉 加賀屋', reason: '日本一の旅館との呼び声高い名宿・カップルで至高の滞在', rakutenUrl: 'https://travel.rakuten.co.jp/yado/ishikawa/wakura.html', jalanUrl: 'https://www.jalan.net/170000/' },
    friends: { name: '和倉温泉 白鷺荘 深山菊', reason: '大浴場と多人数プラン・グループで七尾湾の湯を楽しむ', rakutenUrl: 'https://travel.rakuten.co.jp/yado/ishikawa/wakura.html', jalanUrl: 'https://www.jalan.net/170000/' },
  },

  'gifu': {
    solo:    { name: 'ドーミーイン岐阜', reason: '岐阜駅徒歩5分・格安シングルプランで岐阜城へのアクセス良好', rakutenUrl: 'https://travel.rakuten.co.jp/yado/gifu/gifu.html', jalanUrl: 'https://www.jalan.net/210000/' },
    couple:  { name: '長良川温泉 鵜匠の家 すぎ山', reason: '長良川の鵜飼いを望む露天風呂・カップルで伝統文化に浸る', rakutenUrl: 'https://travel.rakuten.co.jp/yado/gifu/gifu.html', jalanUrl: 'https://www.jalan.net/210000/' },
    friends: { name: '岐阜グランドホテル', reason: '広い客室と宴会プラン・グループで岐阜の食文化を満喫', rakutenUrl: 'https://travel.rakuten.co.jp/yado/gifu/gifu.html', jalanUrl: 'https://www.jalan.net/210000/' },
  },

  'niigata': {
    solo:    { name: 'ドーミーイン新潟', reason: '新潟駅徒歩5分・格安シングルプランで新潟観光の拠点に', rakutenUrl: 'https://travel.rakuten.co.jp/yado/niigata/niigata.html', jalanUrl: 'https://www.jalan.net/150000/' },
    couple:  { name: '新潟グランドホテル', reason: '信濃川沿いの眺望・新潟の日本酒と海の幸でカップルに最高', rakutenUrl: 'https://travel.rakuten.co.jp/yado/niigata/niigata.html', jalanUrl: 'https://www.jalan.net/150000/' },
    friends: { name: 'ホテルニューオータニ長岡', reason: '広い客室と宴会プラン・グループでコスパよく新潟を満喫', rakutenUrl: 'https://travel.rakuten.co.jp/yado/niigata/niigata.html', jalanUrl: 'https://www.jalan.net/150000/' },
  },

  'matsumoto': {
    solo:    { name: 'ドーミーイン松本', reason: '松本駅徒歩5分・天然温泉付き格安シングルプラン', rakutenUrl: 'https://travel.rakuten.co.jp/yado/nagano/matsumoto.html', jalanUrl: 'https://www.jalan.net/200000/' },
    couple:  { name: '松本ホテル花月', reason: '松本城を望む客室・二人で国宝城と信州料理を堪能', rakutenUrl: 'https://travel.rakuten.co.jp/yado/nagano/matsumoto.html', jalanUrl: 'https://www.jalan.net/200000/' },
    friends: { name: 'ホテルブエナビスタ', reason: '広い客室と充実のバイキング・グループ旅行に最適', rakutenUrl: 'https://travel.rakuten.co.jp/yado/nagano/matsumoto.html', jalanUrl: 'https://www.jalan.net/200000/' },
  },

  'atami': {
    solo:    { name: '熱海ビジネスホテル スパ&ステイ', reason: '熱海駅近・格安シングルプランで温泉観光の拠点に', rakutenUrl: 'https://travel.rakuten.co.jp/yado/shizuoka/atami.html', jalanUrl: 'https://www.jalan.net/220000/' },
    couple:  { name: '熱海温泉 ホテル大野屋', reason: '相模湾の絶景と露天風呂・カップルの記念日に最高の宿', rakutenUrl: 'https://travel.rakuten.co.jp/yado/shizuoka/atami.html', jalanUrl: 'https://www.jalan.net/220000/' },
    friends: { name: '熱海温泉 ホテルサンミ倶楽部', reason: '広い大浴場と多人数客室・グループで熱海温泉を満喫', rakutenUrl: 'https://travel.rakuten.co.jp/yado/shizuoka/atami.html', jalanUrl: 'https://www.jalan.net/220000/' },
  },

  'karuizawa': {
    solo:    { name: 'ルートイン軽井沢', reason: '軽井沢駅近・格安シングルプランで高原リゾートを格安に', rakutenUrl: 'https://travel.rakuten.co.jp/yado/nagano/karuizawa.html', jalanUrl: 'https://www.jalan.net/200000/' },
    couple:  { name: 'ホテルハーヴェスト旧軽井沢', reason: '白樺の森に佇むリゾートホテル・カップルで軽井沢の自然を満喫', rakutenUrl: 'https://travel.rakuten.co.jp/yado/nagano/karuizawa.html', jalanUrl: 'https://www.jalan.net/200000/' },
    friends: { name: '軽井沢プリンスホテルイースト', reason: '広大なリゾート敷地・グループでアウトドアとショッピングを満喫', rakutenUrl: 'https://travel.rakuten.co.jp/yado/nagano/karuizawa.html', jalanUrl: 'https://www.jalan.net/200000/' },
  },

  'fujikawaguchiko': {
    solo:    { name: 'ホテルルートイン富士吉田', reason: '富士急ハイランド駅近・格安シングルプランで富士山へのアクセス良好', rakutenUrl: 'https://travel.rakuten.co.jp/yado/yamanashi/kawaguchiko.html', jalanUrl: 'https://www.jalan.net/190000/' },
    couple:  { name: '富士吟景 富士山温泉', reason: '富士山を望む露天風呂・カップルで世界遺産の絶景を満喫', rakutenUrl: 'https://travel.rakuten.co.jp/yado/yamanashi/kawaguchiko.html', jalanUrl: 'https://www.jalan.net/190000/' },
    friends: { name: '富士レークホテル', reason: '河口湖畔の大型ホテル・グループで富士五湖観光に最適', rakutenUrl: 'https://travel.rakuten.co.jp/yado/yamanashi/kawaguchiko.html', jalanUrl: 'https://www.jalan.net/190000/' },
  },

  'shuzenji': {
    solo:    { name: '修善寺 あさば', reason: '修善寺温泉バス停近・格安素泊まりプランで伊豆の秘湯へ', rakutenUrl: 'https://travel.rakuten.co.jp/yado/shizuoka/shuzenji.html', jalanUrl: 'https://www.jalan.net/220000/' },
    couple:  { name: '修善寺温泉 福地屋', reason: '竹林と渓流に囲まれた宿・カップルで修善寺の風情を満喫', rakutenUrl: 'https://travel.rakuten.co.jp/yado/shizuoka/shuzenji.html', jalanUrl: 'https://www.jalan.net/220000/' },
    friends: { name: '修善寺温泉 湯回廊 菊屋', reason: '広い大浴場と多人数客室・グループで伊豆の温泉を満喫', rakutenUrl: 'https://travel.rakuten.co.jp/yado/shizuoka/shuzenji.html', jalanUrl: 'https://www.jalan.net/220000/' },
  },

  'shiraito-falls': {
    solo:    { name: 'ホテル富士野', reason: '富士宮駅近・格安シングルプランで白糸の滝観光の拠点に', rakutenUrl: 'https://travel.rakuten.co.jp/yado/shizuoka/fujinomiya.html', jalanUrl: 'https://www.jalan.net/220000/' },
    couple:  { name: '朝霧高原 ふもとっぱらコテージ', reason: '富士山を望む高原リゾート・カップルで雄大な富士を満喫', rakutenUrl: 'https://travel.rakuten.co.jp/yado/shizuoka/fujinomiya.html', jalanUrl: 'https://www.jalan.net/220000/' },
    friends: { name: '富士山ホテル', reason: '広い施設と多人数プラン・グループで富士宮の食を堪能', rakutenUrl: 'https://travel.rakuten.co.jp/yado/shizuoka/fujinomiya.html', jalanUrl: 'https://www.jalan.net/220000/' },
  },

  'shimoda': {
    solo:    { name: 'ホテル黒船', reason: '下田駅近・格安シングルプランで幕末の歴史スポットへ', rakutenUrl: 'https://travel.rakuten.co.jp/yado/shizuoka/shimoda.html', jalanUrl: 'https://www.jalan.net/220000/' },
    couple:  { name: '下田大和館 澪', reason: '海と黒船来航の地・カップルで伊豆最南端のリゾートを満喫', rakutenUrl: 'https://travel.rakuten.co.jp/yado/shizuoka/shimoda.html', jalanUrl: 'https://www.jalan.net/220000/' },
    friends: { name: '下田東急ホテル', reason: '広いリゾートホテル・グループで下田の海と温泉を満喫', rakutenUrl: 'https://travel.rakuten.co.jp/yado/shizuoka/shimoda.html', jalanUrl: 'https://www.jalan.net/220000/' },
  },

  'hakuba': {
    solo:    { name: 'ホテルハンター白馬', reason: 'JR白馬駅近・格安素泊まりプランでスキー・登山の拠点に', rakutenUrl: 'https://travel.rakuten.co.jp/yado/nagano/hakuba.html', jalanUrl: 'https://www.jalan.net/200000/' },
    couple:  { name: '白馬ハイランドホテル', reason: '北アルプスの絶景と天然温泉・カップルで四季の大自然を満喫', rakutenUrl: 'https://travel.rakuten.co.jp/yado/nagano/hakuba.html', jalanUrl: 'https://www.jalan.net/200000/' },
    friends: { name: '白馬ヴィレッジホテル', reason: '広いロッジタイプ・グループでスキーを満喫しコスパ優秀', rakutenUrl: 'https://travel.rakuten.co.jp/yado/nagano/hakuba.html', jalanUrl: 'https://www.jalan.net/200000/' },
  },

  'tateyama-kurobe': {
    solo:    { name: '立山温泉 峰雲荘', reason: '立山駅近・格安素泊まりプランでアルペンルートの拠点に', rakutenUrl: 'https://travel.rakuten.co.jp/yado/toyama/tateyama.html', jalanUrl: 'https://www.jalan.net/160000/' },
    couple:  { name: '立山山麓温泉 らいちょう温泉 雷鳥荘', reason: '標高2350mの絶景と天然温泉・カップルで立山の壮大さを体感', rakutenUrl: 'https://travel.rakuten.co.jp/yado/toyama/tateyama.html', jalanUrl: 'https://www.jalan.net/160000/' },
    friends: { name: '富山 ホテルサンルート富山', reason: '富山駅近の大型ホテル・グループで立山観光の前後に最適', rakutenUrl: 'https://travel.rakuten.co.jp/yado/toyama/tateyama.html', jalanUrl: 'https://www.jalan.net/160000/' },
  },

  'obuse': {
    solo:    { name: 'ホテルおぶせ', reason: '小布施駅徒歩圏内・格安素泊まりで栗の町を気軽に観光', rakutenUrl: 'https://travel.rakuten.co.jp/yado/nagano/obuse.html', jalanUrl: 'https://www.jalan.net/200000/' },
    couple:  { name: '小布施温泉 あけびの湯', reason: '北信の眺望と温泉・カップルで北斎美術館と共に楽しむ', rakutenUrl: 'https://travel.rakuten.co.jp/yado/nagano/obuse.html', jalanUrl: 'https://www.jalan.net/200000/' },
    friends: { name: '小布施温泉 宿 柳 小布施荘', reason: '広い和室と地酒・グループで小布施の食と文化を満喫', rakutenUrl: 'https://travel.rakuten.co.jp/yado/nagano/obuse.html', jalanUrl: 'https://www.jalan.net/200000/' },
  },

  'nozawa-onsen': {
    solo:    { name: 'ビジネスホテル野沢温泉', reason: '野沢温泉バス停近・格安素泊まりプランで共同浴場巡り', rakutenUrl: 'https://travel.rakuten.co.jp/yado/nagano/nozawa.html', jalanUrl: 'https://www.jalan.net/200000/' },
    couple:  { name: '野沢温泉 旅館さかや', reason: '源泉かけ流しの露天風呂と信州料理・カップルで雪国情緒', rakutenUrl: 'https://travel.rakuten.co.jp/yado/nagano/nozawa.html', jalanUrl: 'https://www.jalan.net/200000/' },
    friends: { name: '野沢温泉 ホテルみやた', reason: '広い大浴場とスキー場近接・グループでゲレンデと温泉を満喫', rakutenUrl: 'https://travel.rakuten.co.jp/yado/nagano/nozawa.html', jalanUrl: 'https://www.jalan.net/200000/' },
  },

  'bessho-onsen': {
    solo:    { name: '別所温泉 上松屋旅館', reason: '別所温泉駅徒歩5分・格安素泊まりプランで信州の名湯へ', rakutenUrl: 'https://travel.rakuten.co.jp/yado/nagano/bessho.html', jalanUrl: 'https://www.jalan.net/200000/' },
    couple:  { name: '別所温泉 かしわや本店', reason: '源泉かけ流しの宿・信州最古の温泉でカップルの癒し旅', rakutenUrl: 'https://travel.rakuten.co.jp/yado/nagano/bessho.html', jalanUrl: 'https://www.jalan.net/200000/' },
    friends: { name: '別所温泉 旅館 花屋', reason: '広い客室と大浴場・グループでコスパよく信州の湯を満喫', rakutenUrl: 'https://travel.rakuten.co.jp/yado/nagano/bessho.html', jalanUrl: 'https://www.jalan.net/200000/' },
  },

  // ─── 近畿 ────────────────────────────────────────────────────

  'osaka': {
    solo:    { name: 'ドーミーイン難波', reason: '難波駅徒歩3分・格安シングルプランで大阪グルメの拠点に', rakutenUrl: 'https://travel.rakuten.co.jp/yado/osaka/osaka.html', jalanUrl: 'https://www.jalan.net/270000/' },
    couple:  { name: 'コンラッド大阪', reason: '大阪の高層夜景・二人で過ごす上質な都市ホテル', rakutenUrl: 'https://travel.rakuten.co.jp/yado/osaka/osaka.html', jalanUrl: 'https://www.jalan.net/270000/' },
    friends: { name: 'ホテルモントレラ・スール大阪', reason: '広い客室とグループプラン・道頓堀徒歩圏でコスパ優秀', rakutenUrl: 'https://travel.rakuten.co.jp/yado/osaka/osaka.html', jalanUrl: 'https://www.jalan.net/270000/' },
  },

  'nara': {
    solo:    { name: 'ドーミーイン奈良', reason: '近鉄奈良駅近・格安シングルプランで鹿と古都観光の拠点', rakutenUrl: 'https://travel.rakuten.co.jp/yado/nara/nara.html', jalanUrl: 'https://www.jalan.net/290000/LRG_290200/' },
    couple:  { name: 'ホテル日航奈良', reason: '奈良駅直結・奈良の世界遺産を巡るカップル旅行に最適', rakutenUrl: 'https://travel.rakuten.co.jp/yado/nara/nara.html', jalanUrl: 'https://www.jalan.net/290000/LRG_290200/' },
    friends: { name: '奈良ロイヤルホテル', reason: '広い客室と充実の朝食・グループで世界遺産を巡る拠点に', rakutenUrl: 'https://travel.rakuten.co.jp/yado/nara/nara.html', jalanUrl: 'https://www.jalan.net/290000/LRG_290200/' },
  },

  'yoshino-yama': {
    solo:    { name: '吉野山 桜宿坊', reason: '吉野山バス停近・格安素泊まりで千本桜・紅葉の拠点に', rakutenUrl: 'https://travel.rakuten.co.jp/yado/nara/yoshino.html', jalanUrl: 'https://www.jalan.net/290000/LRG_290500/' },
    couple:  { name: '吉野山 旅館 吉野荘湯川屋', reason: '吉野山の桜・修験の地で二人で静かな旅情を感じる宿', rakutenUrl: 'https://travel.rakuten.co.jp/yado/nara/yoshino.html', jalanUrl: 'https://www.jalan.net/290000/LRG_290500/' },
    friends: { name: '吉野山 民宿 つるや', reason: '大人数対応の広間・グループで山岳信仰の地を満喫', rakutenUrl: 'https://travel.rakuten.co.jp/yado/nara/yoshino.html', jalanUrl: 'https://www.jalan.net/290000/LRG_290500/' },
  },

  'ryujin-onsen': {
    solo:    { name: '龍神温泉 季楽里龍神', reason: '龍神温泉バス停近・格安素泊まりで日本三美人の湯へ', rakutenUrl: 'https://travel.rakuten.co.jp/yado/wakayama/ryujin.html', jalanUrl: 'https://www.jalan.net/300000/' },
    couple:  { name: '龍神温泉 元湯', reason: '日高川沿いの秘湯・カップルで美人の湯に浸かる特別な宿', rakutenUrl: 'https://travel.rakuten.co.jp/yado/wakayama/ryujin.html', jalanUrl: 'https://www.jalan.net/300000/' },
    friends: { name: '龍神温泉 旅館 上御殿', reason: '広い宴会スペースと大浴場・グループで秘境温泉を楽しむ', rakutenUrl: 'https://travel.rakuten.co.jp/yado/wakayama/ryujin.html', jalanUrl: 'https://www.jalan.net/300000/' },
  },

  'arima-onsen': {
    solo:    { name: '有馬温泉 有馬グランドホテル', reason: '有馬温泉駅近・格安素泊まりプランで金の湯・銀の湯へ', rakutenUrl: 'https://travel.rakuten.co.jp/yado/hyogo/kobe.html', jalanUrl: 'https://www.jalan.net/280000/LRG_280200/' },
    couple:  { name: '有馬温泉 兵衛向陽閣', reason: '源泉かけ流しの露天風呂・カップルで天下の名湯を独占', rakutenUrl: 'https://travel.rakuten.co.jp/yado/hyogo/kobe.html', jalanUrl: 'https://www.jalan.net/280000/LRG_280200/' },
    friends: { name: '有馬温泉 中の坊瑞苑', reason: '広い大浴場と多人数客室・グループで有馬温泉をコスパよく', rakutenUrl: 'https://travel.rakuten.co.jp/yado/hyogo/kobe.html', jalanUrl: 'https://www.jalan.net/280000/LRG_280200/' },
  },

  'kinosaki-onsen': {
    solo:    { name: '城崎温泉 旅館 清風荘', reason: '城崎温泉駅徒歩5分・格安素泊まりで外湯巡りに最適', rakutenUrl: 'https://travel.rakuten.co.jp/yado/hyogo/kita.html', jalanUrl: 'https://www.jalan.net/280000/LRG_281700/' },
    couple:  { name: '城崎温泉 つるや', reason: '柳の川沿いを浴衣で散歩・カップルで外湯巡りを楽しむ宿', rakutenUrl: 'https://travel.rakuten.co.jp/yado/hyogo/kita.html', jalanUrl: 'https://www.jalan.net/280000/LRG_281700/' },
    friends: { name: '城崎温泉 ホテル西村屋 招月庭', reason: '広い大浴場と多人数部屋・グループで7つの外湯を制覇', rakutenUrl: 'https://travel.rakuten.co.jp/yado/hyogo/kita.html', jalanUrl: 'https://www.jalan.net/280000/LRG_281700/' },
  },

  'genbudo': {
    solo:    { name: '豊岡ビジネスホテル', reason: '豊岡駅近・格安シングルプランで玄武洞観光の拠点に', rakutenUrl: 'https://travel.rakuten.co.jp/yado/hyogo/kita.html', jalanUrl: 'https://www.jalan.net/280000/LRG_281400/' },
    couple:  { name: '城崎温泉 七宝荘', reason: '玄武岩の奇岩と近隣温泉・カップルで但馬の自然を満喫', rakutenUrl: 'https://travel.rakuten.co.jp/yado/hyogo/kita.html', jalanUrl: 'https://www.jalan.net/280000/LRG_281400/' },
    friends: { name: '豊岡温泉 旅館 小林', reason: '広い客室と宴会プラン・グループで但馬の幸を堪能', rakutenUrl: 'https://travel.rakuten.co.jp/yado/hyogo/kita.html', jalanUrl: 'https://www.jalan.net/280000/LRG_281400/' },
  },

  'shirahama-o': {
    solo:    { name: 'シラハマキーテラスホテルSeasons', reason: '白浜駅バスアクセス・格安シングルプランで観光の拠点に', rakutenUrl: 'https://travel.rakuten.co.jp/yado/wakayama/shirahama.html', jalanUrl: 'https://www.jalan.net/300000/LRG_301000/' },
    couple:  { name: '白浜温泉 旅館 千畳', reason: '白砂の浜と太平洋の絶景・カップルで南紀の夕日を満喫', rakutenUrl: 'https://travel.rakuten.co.jp/yado/wakayama/shirahama.html', jalanUrl: 'https://www.jalan.net/300000/LRG_301000/' },
    friends: { name: '南紀白浜 ホテルシーモア', reason: '広い客室と温泉・グループで白浜アドベンチャーワールドの近くに', rakutenUrl: 'https://travel.rakuten.co.jp/yado/wakayama/shirahama.html', jalanUrl: 'https://www.jalan.net/300000/LRG_301000/' },
  },

  'amanohashidate': {
    solo:    { name: '天橋立ユースホステル', reason: '天橋立駅近・格安素泊まりで日本三景を気軽に観光', rakutenUrl: 'https://travel.rakuten.co.jp/yado/kyoto/amanohashidate.html', jalanUrl: 'https://www.jalan.net/260000/LRG_262300/' },
    couple:  { name: '天橋立温泉 ホテル橋本', reason: '天橋立を望む客室と温泉・カップルで日本三景の絶景を独占', rakutenUrl: 'https://travel.rakuten.co.jp/yado/kyoto/amanohashidate.html', jalanUrl: 'https://www.jalan.net/260000/LRG_262300/' },
    friends: { name: '天橋立 ホテル文珠荘', reason: '広い客室と宴会プラン・グループで日本海の幸を満喫', rakutenUrl: 'https://travel.rakuten.co.jp/yado/kyoto/amanohashidate.html', jalanUrl: 'https://www.jalan.net/260000/LRG_262300/' },
  },

  'awaji': {
    solo:    { name: 'ホテルルートイン南淡路', reason: '淡路島南部・格安シングルプランでドライブ旅行の拠点に', rakutenUrl: 'https://travel.rakuten.co.jp/yado/hyogo/awaji.html', jalanUrl: 'https://www.jalan.net/280000/LRG_280800/' },
    couple:  { name: 'ホテルニューアワジ', reason: '明石海峡の絶景と淡路島の旬の食材・カップルに人気の老舗', rakutenUrl: 'https://travel.rakuten.co.jp/yado/hyogo/awaji.html', jalanUrl: 'https://www.jalan.net/280000/LRG_280800/' },
    friends: { name: '南淡路ロイヤルホテル', reason: '広い客室と宴会プラン・グループで淡路の食と海を満喫', rakutenUrl: 'https://travel.rakuten.co.jp/yado/hyogo/awaji.html', jalanUrl: 'https://www.jalan.net/280000/LRG_280800/' },
  },

  'nagahama': {
    solo:    { name: 'ホテルルートイン長浜', reason: '長浜駅徒歩圏内・格安シングルプランで黒壁スクエア観光', rakutenUrl: 'https://travel.rakuten.co.jp/yado/shiga/nagahama.html', jalanUrl: 'https://www.jalan.net/250000/' },
    couple:  { name: '長浜ロイヤルホテル', reason: '琵琶湖を望む客室と温泉・カップルで近江の歴史を探訪', rakutenUrl: 'https://travel.rakuten.co.jp/yado/shiga/nagahama.html', jalanUrl: 'https://www.jalan.net/250000/' },
    friends: { name: '長浜グランドホテル', reason: '広い客室と宴会場・グループで黒壁スクエアと琵琶湖を楽しむ', rakutenUrl: 'https://travel.rakuten.co.jp/yado/shiga/nagahama.html', jalanUrl: 'https://www.jalan.net/250000/' },
  },

  'hikone': {
    solo:    { name: 'ドーミーイン彦根', reason: '彦根駅徒歩10分・格安シングルプランで彦根城へ徒歩圏', rakutenUrl: 'https://travel.rakuten.co.jp/yado/shiga/hikone.html', jalanUrl: 'https://www.jalan.net/250000/' },
    couple:  { name: '彦根キャッスルリゾート', reason: '彦根城を望む眺望・カップルで琵琶湖と城下町を満喫', rakutenUrl: 'https://travel.rakuten.co.jp/yado/shiga/hikone.html', jalanUrl: 'https://www.jalan.net/250000/' },
    friends: { name: '彦根ビューホテル', reason: '広い客室と充実の施設・グループで近江の食文化を満喫', rakutenUrl: 'https://travel.rakuten.co.jp/yado/shiga/hikone.html', jalanUrl: 'https://www.jalan.net/250000/' },
  },

  'koyasan': {
    solo:    { name: '高野山 宿坊 金剛三昧院', reason: '格安で高野山の宿坊体験・精進料理で精神的な旅', rakutenUrl: 'https://travel.rakuten.co.jp/yado/wakayama/koyasan.html', jalanUrl: 'https://www.jalan.net/300000/LRG_301100/' },
    couple:  { name: '高野山 宿坊 恵光院', reason: '奥の院に最も近い宿坊・二人で空海の精神世界に浸る', rakutenUrl: 'https://travel.rakuten.co.jp/yado/wakayama/koyasan.html', jalanUrl: 'https://www.jalan.net/300000/LRG_301100/' },
    friends: { name: '高野山 宿坊 遍照光院', reason: '大人数対応の宿坊・グループで高野山の神秘的な雰囲気を体感', rakutenUrl: 'https://travel.rakuten.co.jp/yado/wakayama/koyasan.html', jalanUrl: 'https://www.jalan.net/300000/LRG_301100/' },
  },

  'izushi': {
    solo:    { name: '出石観光センター 観月亭', reason: '出石皿そばの町・格安素泊まりで但馬の小京都を観光', rakutenUrl: 'https://travel.rakuten.co.jp/yado/hyogo/kita.html', jalanUrl: 'https://www.jalan.net/280000/LRG_281400/' },
    couple:  { name: '出石温泉 旅館 いわや', reason: '城下町の風情と但馬の温泉・カップルで歴史ある街を散策', rakutenUrl: 'https://travel.rakuten.co.jp/yado/hyogo/kita.html', jalanUrl: 'https://www.jalan.net/280000/LRG_281400/' },
    friends: { name: '豊岡温泉 湯島の宿', reason: '広い客室と宴会スペース・グループで皿そばを食べ歩き', rakutenUrl: 'https://travel.rakuten.co.jp/yado/hyogo/kita.html', jalanUrl: 'https://www.jalan.net/280000/LRG_281400/' },
  },

  'kyoto': {
    solo:    { name: 'ドーミーイン京都', reason: '京都駅徒歩圏内・格安シングルプランで寺社巡りの拠点に', rakutenUrl: 'https://travel.rakuten.co.jp/yado/kyoto/kyoto.html', jalanUrl: 'https://www.jalan.net/260000/LRG_260500/' },
    couple:  { name: 'ザ・リッツ・カールトン京都', reason: '鴨川沿いの絶景と京懐石・カップルで最上級の京都体験', rakutenUrl: 'https://travel.rakuten.co.jp/yado/kyoto/kyoto.html', jalanUrl: 'https://www.jalan.net/260000/LRG_260500/' },
    friends: { name: '京都ブライトンホテル', reason: '広い客室とグループプラン・京都観光の主要スポットへ好アクセス', rakutenUrl: 'https://travel.rakuten.co.jp/yado/kyoto/kyoto.html', jalanUrl: 'https://www.jalan.net/260000/LRG_260500/' },
  },

  'ine': {
    solo:    { name: '伊根温泉 白砂 Ine', reason: '伊根船屋の漁村・格安素泊まりで京都最北端の絶景へ', rakutenUrl: 'https://travel.rakuten.co.jp/yado/kyoto/amanohashidate.html', jalanUrl: 'https://www.jalan.net/260000/LRG_262300/' },
    couple:  { name: '伊根の舟屋 旅館 若狭', reason: '舟屋を改装した宿・カップルで日本海の絶景と船屋の風情を', rakutenUrl: 'https://travel.rakuten.co.jp/yado/kyoto/amanohashidate.html', jalanUrl: 'https://www.jalan.net/260000/LRG_262300/' },
    friends: { name: '伊根 民宿 宮本', reason: '大人数対応の漁村民宿・グループで新鮮な魚介料理を堪能', rakutenUrl: 'https://travel.rakuten.co.jp/yado/kyoto/amanohashidate.html', jalanUrl: 'https://www.jalan.net/260000/LRG_262300/' },
  },

  'miyama': {
    solo:    { name: 'かやぶきの里 民宿 あしびの郷', reason: '美山バス停近・格安素泊まりで茅葺き集落を散策', rakutenUrl: 'https://travel.rakuten.co.jp/yado/kyoto/miyama.html', jalanUrl: 'https://www.jalan.net/260000/LRG_261400/' },
    couple:  { name: '美山荘', reason: '美山の茅葺き宿に泊まる贅沢・カップルで京都の里山を体験', rakutenUrl: 'https://travel.rakuten.co.jp/yado/kyoto/miyama.html', jalanUrl: 'https://www.jalan.net/260000/LRG_261400/' },
    friends: { name: 'かやぶきの里 旅館 いっぷく', reason: '広い和室・グループで美山の囲炉裏料理と自然を満喫', rakutenUrl: 'https://travel.rakuten.co.jp/yado/kyoto/miyama.html', jalanUrl: 'https://www.jalan.net/260000/LRG_261400/' },
  },

  'kobe': {
    solo:    { name: 'ドーミーイン神戸', reason: '三宮駅徒歩圏内・格安シングルプランで神戸観光の拠点に', rakutenUrl: 'https://travel.rakuten.co.jp/yado/hyogo/kobe.html', jalanUrl: 'https://www.jalan.net/280000/LRG_280200/' },
    couple:  { name: 'ザ・カハラ・ホテル横浜', reason: '神戸港の夜景・カップルで過ごす特別な異国情緒の宿', rakutenUrl: 'https://travel.rakuten.co.jp/yado/hyogo/kobe.html', jalanUrl: 'https://www.jalan.net/280000/LRG_280200/' },
    friends: { name: 'ホテル北野プラザ六甲荘', reason: '北野の広い洋館・グループでポートタウン神戸を満喫', rakutenUrl: 'https://travel.rakuten.co.jp/yado/hyogo/kobe.html', jalanUrl: 'https://www.jalan.net/280000/LRG_280200/' },
  },

  'himeji': {
    solo:    { name: 'ドーミーイン姫路', reason: '姫路駅徒歩5分・格安シングルプランで白鷺城へすぐ', rakutenUrl: 'https://travel.rakuten.co.jp/yado/hyogo/nannansei.html', jalanUrl: 'https://www.jalan.net/280000/LRG_280500/' },
    couple:  { name: '姫路城 別邸 花の館', reason: '姫路城の夜景・カップルで世界遺産の城下町を二人占め', rakutenUrl: 'https://travel.rakuten.co.jp/yado/hyogo/nannansei.html', jalanUrl: 'https://www.jalan.net/280000/LRG_280500/' },
    friends: { name: 'ホテルモントレ姫路', reason: '姫路駅直結の大型ホテル・グループで姫路城観光に最適', rakutenUrl: 'https://travel.rakuten.co.jp/yado/hyogo/nannansei.html', jalanUrl: 'https://www.jalan.net/280000/LRG_280500/' },
  },

  'wakayama': {
    solo:    { name: 'ホテルルートイン和歌山', reason: '和歌山駅近・格安シングルプランで城下町観光の拠点に', rakutenUrl: 'https://travel.rakuten.co.jp/yado/wakayama/wakayama.html', jalanUrl: 'https://www.jalan.net/300000/LRG_300200/' },
    couple:  { name: '和歌山 コートホテル', reason: '和歌浦の絶景と新鮮な海の幸・カップルで南紀を満喫', rakutenUrl: 'https://travel.rakuten.co.jp/yado/wakayama/wakayama.html', jalanUrl: 'https://www.jalan.net/300000/LRG_300200/' },
    friends: { name: '和歌山ビッグホテル', reason: '広い客室とグループ向けプラン・和歌山城と観光地への拠点', rakutenUrl: 'https://travel.rakuten.co.jp/yado/wakayama/wakayama.html', jalanUrl: 'https://www.jalan.net/300000/LRG_300200/' },
  },

  'kumano-kodo': {
    solo:    { name: '熊野本宮館', reason: '本宮大社近く・格安素泊まりで熊野古道トレッキングの拠点', rakutenUrl: 'https://travel.rakuten.co.jp/yado/wakayama/kumano.html', jalanUrl: 'https://www.jalan.net/300000/' },
    couple:  { name: '熊野古道 瑞鳳', reason: '熊野の森に囲まれた宿・カップルで世界遺産の霊峰を体感', rakutenUrl: 'https://travel.rakuten.co.jp/yado/wakayama/kumano.html', jalanUrl: 'https://www.jalan.net/300000/' },
    friends: { name: '熊野川温泉 さとの湯', reason: '広い大浴場と多人数客室・グループで熊野古道ハイキングに', rakutenUrl: 'https://travel.rakuten.co.jp/yado/wakayama/kumano.html', jalanUrl: 'https://www.jalan.net/300000/' },
  },

  // ─── 中国 ────────────────────────────────────────────────────

  'hiroshima': {
    solo:    { name: 'ドーミーイン広島', reason: '広島駅徒歩圏内・格安シングルプランで平和公園へのアクセス良好', rakutenUrl: 'https://travel.rakuten.co.jp/yado/hiroshima/hiroshima.html', jalanUrl: 'https://www.jalan.net/340000/LRG_340900/' },
    couple:  { name: 'ホテルグランヴィア広島', reason: '広島駅直結・牡蠣と広島料理・カップルで平和と食を堪能', rakutenUrl: 'https://travel.rakuten.co.jp/yado/hiroshima/hiroshima.html', jalanUrl: 'https://www.jalan.net/340000/LRG_340900/' },
    friends: { name: 'ニューヒロデン', reason: '広い客室と宴会プラン・グループで広島の食文化を満喫', rakutenUrl: 'https://travel.rakuten.co.jp/yado/hiroshima/hiroshima.html', jalanUrl: 'https://www.jalan.net/340000/LRG_340900/' },
  },

  'miyajima': {
    solo:    { name: '宮島 ゲストハウス', reason: '宮島口フェリー乗り場近く・格安素泊まりで厳島神社観光', rakutenUrl: 'https://travel.rakuten.co.jp/yado/hiroshima/miyajima.html', jalanUrl: 'https://www.jalan.net/340000/LRG_340900/' },
    couple:  { name: '宮島 岩惣', reason: '厳島神社を望む老舗旅館・カップルで朱の大鳥居と絶景を独占', rakutenUrl: 'https://travel.rakuten.co.jp/yado/hiroshima/miyajima.html', jalanUrl: 'https://www.jalan.net/340000/LRG_340900/' },
    friends: { name: '宮島 宮島ホテルまこ', reason: '広い客室と宴会プラン・グループで宮島の幸を堪能', rakutenUrl: 'https://travel.rakuten.co.jp/yado/hiroshima/miyajima.html', jalanUrl: 'https://www.jalan.net/340000/LRG_340900/' },
  },

  'onomichi': {
    solo:    { name: 'LOG', reason: '尾道駅近・格安ゲストハウスで坂道の城下町を気軽に観光', rakutenUrl: 'https://travel.rakuten.co.jp/yado/hiroshima/onomichi.html', jalanUrl: 'https://www.jalan.net/340000/LRG_340300/' },
    couple:  { name: '尾道西山別館', reason: '尾道水道を望む客室・カップルでしまなみ海道の絶景を満喫', rakutenUrl: 'https://travel.rakuten.co.jp/yado/hiroshima/onomichi.html', jalanUrl: 'https://www.jalan.net/340000/LRG_340300/' },
    friends: { name: '尾道国際ホテル', reason: '広い客室と宴会場・グループでサイクリングの拠点に最適', rakutenUrl: 'https://travel.rakuten.co.jp/yado/hiroshima/onomichi.html', jalanUrl: 'https://www.jalan.net/340000/LRG_340300/' },
  },

  'mihonoseki': {
    solo:    { name: 'ホテル白鳥', reason: '境港駅近・格安シングルプランで水木しげるロード観光の拠点', rakutenUrl: 'https://travel.rakuten.co.jp/yado/shimane/matsue.html', jalanUrl: 'https://www.jalan.net/320000/' },
    couple:  { name: '美保関温泉 海のホテル清水', reason: '日本海の絶景と新鮮な海の幸・カップルで島根の隠れ里へ', rakutenUrl: 'https://travel.rakuten.co.jp/yado/shimane/matsue.html', jalanUrl: 'https://www.jalan.net/320000/' },
    friends: { name: '松江 松江ニューアーバンホテル', reason: '松江駅近の大型ホテル・グループで出雲・石見銀山観光に', rakutenUrl: 'https://travel.rakuten.co.jp/yado/shimane/matsue.html', jalanUrl: 'https://www.jalan.net/320000/' },
  },

  'kurashiki': {
    solo:    { name: 'ドーミーイン倉敷', reason: '倉敷駅徒歩10分・格安シングルプランで美観地区へ徒歩圏', rakutenUrl: 'https://travel.rakuten.co.jp/yado/okayama/kurashiki.html', jalanUrl: 'https://www.jalan.net/330000/LRG_331100/' },
    couple:  { name: '倉敷アイビースクエア', reason: '明治の紡績工場跡・カップルでレンガ造りの美観地区に宿泊', rakutenUrl: 'https://travel.rakuten.co.jp/yado/okayama/kurashiki.html', jalanUrl: 'https://www.jalan.net/330000/LRG_331100/' },
    friends: { name: '倉敷ステーションホテル', reason: '倉敷駅直結の大型ホテル・グループ旅行の拠点に最適', rakutenUrl: 'https://travel.rakuten.co.jp/yado/okayama/kurashiki.html', jalanUrl: 'https://www.jalan.net/330000/LRG_331100/' },
  },

  'hagi': {
    solo:    { name: 'ルートイン萩', reason: '萩駅近・格安シングルプランで明治維新の遺産を探訪', rakutenUrl: 'https://travel.rakuten.co.jp/yado/yamaguchi/hagi.html', jalanUrl: 'https://www.jalan.net/350000/' },
    couple:  { name: '萩本陣', reason: '指月城跡の眺望と萩の温泉・カップルで幕末の城下町を散策', rakutenUrl: 'https://travel.rakuten.co.jp/yado/yamaguchi/hagi.html', jalanUrl: 'https://www.jalan.net/350000/' },
    friends: { name: '萩ロイヤルインテリジェントホテル', reason: '広い客室とグループ向けプラン・萩焼体験の拠点に最適', rakutenUrl: 'https://travel.rakuten.co.jp/yado/yamaguchi/hagi.html', jalanUrl: 'https://www.jalan.net/350000/' },
  },

  'akiyoshidai': {
    solo:    { name: 'ホテル秋吉荘', reason: '秋吉台入口近く・格安素泊まりプランで鍾乳洞観光の拠点に', rakutenUrl: 'https://travel.rakuten.co.jp/yado/yamaguchi/akiyoshidai.html', jalanUrl: 'https://www.jalan.net/350000/' },
    couple:  { name: '秋吉台温泉 秋芳館', reason: 'カルスト台地の絶景と温泉・カップルで自然の神秘を体感', rakutenUrl: 'https://travel.rakuten.co.jp/yado/yamaguchi/akiyoshidai.html', jalanUrl: 'https://www.jalan.net/350000/' },
    friends: { name: '美祢市 ホスピタルビレッジ秋吉台', reason: '広いコテージ施設・グループで秋吉台ハイキングに最適', rakutenUrl: 'https://travel.rakuten.co.jp/yado/yamaguchi/akiyoshidai.html', jalanUrl: 'https://www.jalan.net/350000/' },
  },

  'shimonoseki': {
    solo:    { name: 'ホテルルートイン下関', reason: '下関駅近・格安シングルプランでふぐと関門海峡観光の拠点', rakutenUrl: 'https://travel.rakuten.co.jp/yado/yamaguchi/shimonoseki.html', jalanUrl: 'https://www.jalan.net/350000/' },
    couple:  { name: '下関グランドホテル', reason: '関門海峡の絶景とふぐ料理・カップルで山口の食文化を満喫', rakutenUrl: 'https://travel.rakuten.co.jp/yado/yamaguchi/shimonoseki.html', jalanUrl: 'https://www.jalan.net/350000/' },
    friends: { name: '海峡ビューしものせき', reason: '関門橋の絶景と広い施設・グループで九州への玄関口を満喫', rakutenUrl: 'https://travel.rakuten.co.jp/yado/yamaguchi/shimonoseki.html', jalanUrl: 'https://www.jalan.net/350000/' },
  },

  'tottori': {
    solo:    { name: 'ドーミーイン鳥取', reason: '鳥取駅徒歩5分・格安シングルプランで砂丘観光の拠点に', rakutenUrl: 'https://travel.rakuten.co.jp/yado/tottori/tottori.html', jalanUrl: 'https://www.jalan.net/310000/' },
    couple:  { name: '鳥取温泉 旅館 湖山荘', reason: '湖畔の絶景と山陰の幸・カップルで砂丘と温泉を満喫', rakutenUrl: 'https://travel.rakuten.co.jp/yado/tottori/tottori.html', jalanUrl: 'https://www.jalan.net/310000/' },
    friends: { name: 'ホテルニューオータニ鳥取', reason: '広い客室と充実の宴会場・グループで山陰を満喫', rakutenUrl: 'https://travel.rakuten.co.jp/yado/tottori/tottori.html', jalanUrl: 'https://www.jalan.net/310000/' },
  },

  'tottori-sakyuu': {
    solo:    { name: 'ホテルモナーク鳥取', reason: '鳥取砂丘入口近く・格安素泊まりプランで砂丘観光の拠点に', rakutenUrl: 'https://travel.rakuten.co.jp/yado/tottori/tottori.html', jalanUrl: 'https://www.jalan.net/310000/' },
    couple:  { name: '砂丘温泉 ふれあい会館', reason: '砂丘を望む客室と温泉・カップルで日本最大級の砂丘を満喫', rakutenUrl: 'https://travel.rakuten.co.jp/yado/tottori/tottori.html', jalanUrl: 'https://www.jalan.net/310000/' },
    friends: { name: 'ハワイアンドリーム砂丘', reason: '砂丘至近の大型宿・グループでラクダと砂丘体験を楽しめる', rakutenUrl: 'https://travel.rakuten.co.jp/yado/tottori/tottori.html', jalanUrl: 'https://www.jalan.net/310000/' },
  },

  'tsuwano': {
    solo:    { name: '津和野ゲストハウス 遊遊', reason: '津和野駅徒歩圏内・格安素泊まりで山陰の小京都を観光', rakutenUrl: 'https://travel.rakuten.co.jp/yado/shimane/tsuwano.html', jalanUrl: 'https://www.jalan.net/320000/' },
    couple:  { name: '津和野温泉 のどか村', reason: '城下町の風情と石見の温泉・カップルで江戸の趣を満喫', rakutenUrl: 'https://travel.rakuten.co.jp/yado/shimane/tsuwano.html', jalanUrl: 'https://www.jalan.net/320000/' },
    friends: { name: '津和野 旅館 萩の屋', reason: '広い和室と囲炉裏料理・グループで錦鯉の泳ぐ城下町を堪能', rakutenUrl: 'https://travel.rakuten.co.jp/yado/shimane/tsuwano.html', jalanUrl: 'https://www.jalan.net/320000/' },
  },

  'yuda-onsen': {
    solo:    { name: 'ホテルルートイン山口湯田温泉', reason: '湯田温泉駅近・格安素泊まりプランで山口市観光の拠点に', rakutenUrl: 'https://travel.rakuten.co.jp/yado/yamaguchi/yuda.html', jalanUrl: 'https://www.jalan.net/350000/' },
    couple:  { name: '湯田温泉 松田屋ホテル', reason: '幕末の志士が愛した老舗温泉・カップルで山口の歴史に浸る', rakutenUrl: 'https://travel.rakuten.co.jp/yado/yamaguchi/yuda.html', jalanUrl: 'https://www.jalan.net/350000/' },
    friends: { name: '湯田温泉 ホテルニュータナカ', reason: '広い大浴場と多人数客室・グループで山口の温泉を満喫', rakutenUrl: 'https://travel.rakuten.co.jp/yado/yamaguchi/yuda.html', jalanUrl: 'https://www.jalan.net/350000/' },
  },

  'oku-izumo': {
    solo:    { name: '奥出雲 荒神谷温泉', reason: '木次線沿い・格安素泊まりで奥出雲のたたら製鉄遺産を探訪', rakutenUrl: 'https://travel.rakuten.co.jp/yado/shimane/izumo.html', jalanUrl: 'https://www.jalan.net/320000/' },
    couple:  { name: '出雲湯村温泉 旅館 千家', reason: '斐伊川源流の静かな温泉・カップルで神話の里を二人で体感', rakutenUrl: 'https://travel.rakuten.co.jp/yado/shimane/izumo.html', jalanUrl: 'https://www.jalan.net/320000/' },
    friends: { name: '奥出雲 やすらぎの郷 宿夢蔵', reason: '広い施設・グループで奥出雲の自然とたたら文化を満喫', rakutenUrl: 'https://travel.rakuten.co.jp/yado/shimane/izumo.html', jalanUrl: 'https://www.jalan.net/320000/' },
  },

  'takehara': {
    solo:    { name: 'ホテル竹原', reason: '竹原駅徒歩圏内・格安素泊まりで安芸の小京都を観光', rakutenUrl: 'https://travel.rakuten.co.jp/yado/hiroshima/takehara.html', jalanUrl: 'https://www.jalan.net/340000/LRG_341100/' },
    couple:  { name: '竹原温泉 旅館 おたふく', reason: '竹鶴酒造の町に泊まる・カップルで江戸の白壁町並みを満喫', rakutenUrl: 'https://travel.rakuten.co.jp/yado/hiroshima/takehara.html', jalanUrl: 'https://www.jalan.net/340000/LRG_341100/' },
    friends: { name: 'ホテル アルファーワン竹原', reason: '広い客室とグループ向けプラン・大久野島観光の拠点に最適', rakutenUrl: 'https://travel.rakuten.co.jp/yado/hiroshima/takehara.html', jalanUrl: 'https://www.jalan.net/340000/LRG_341100/' },
  },

  'tsunoshima-bridge': {
    solo:    { name: 'ホテルルートイン下関豊北', reason: '角島大橋入口近く・格安素泊まりで絶景ドライブの拠点に', rakutenUrl: 'https://travel.rakuten.co.jp/yado/yamaguchi/tsunoshima.html', jalanUrl: 'https://www.jalan.net/350000/' },
    couple:  { name: '角島 民宿 角島荘', reason: 'エメラルドブルーの海と橋の絶景・カップルで日本のハワイを満喫', rakutenUrl: 'https://travel.rakuten.co.jp/yado/yamaguchi/tsunoshima.html', jalanUrl: 'https://www.jalan.net/350000/' },
    friends: { name: '角島温泉 ふくの湯', reason: '広い施設と海の幸・グループで角島の絶景と食を楽しむ', rakutenUrl: 'https://travel.rakuten.co.jp/yado/yamaguchi/tsunoshima.html', jalanUrl: 'https://www.jalan.net/350000/' },
  },

  'okayama': {
    solo:    { name: 'ドーミーイン岡山', reason: '岡山駅徒歩圏内・格安シングルプランで後楽園・城への拠点', rakutenUrl: 'https://travel.rakuten.co.jp/yado/okayama/okayama.html', jalanUrl: 'https://www.jalan.net/330000/LRG_330200/' },
    couple:  { name: 'ホテルグランヴィア岡山', reason: '岡山駅直結・桃太郎の町で二人でゆっくりくつろげる宿', rakutenUrl: 'https://travel.rakuten.co.jp/yado/okayama/okayama.html', jalanUrl: 'https://www.jalan.net/330000/LRG_330200/' },
    friends: { name: 'ホテルメルパルク岡山', reason: '広い客室とグループプラン・岡山観光を満喫できる大型ホテル', rakutenUrl: 'https://travel.rakuten.co.jp/yado/okayama/okayama.html', jalanUrl: 'https://www.jalan.net/330000/LRG_330200/' },
  },

  'misasa-onsen': {
    solo:    { name: '三朝温泉 旅館 木屋', reason: '三朝温泉バス停近・格安素泊まりプランで世界有数のラジウム泉へ', rakutenUrl: 'https://travel.rakuten.co.jp/yado/tottori/misasa.html', jalanUrl: 'https://www.jalan.net/310000/' },
    couple:  { name: '三朝温泉 斉木別館', reason: '三徳川沿いの露天風呂と自家源泉・カップルで秘湯を独占', rakutenUrl: 'https://travel.rakuten.co.jp/yado/tottori/misasa.html', jalanUrl: 'https://www.jalan.net/310000/' },
    friends: { name: '三朝温泉 旅館 大橋', reason: '広い大浴場と多人数プラン・グループでラジウム温泉を満喫', rakutenUrl: 'https://travel.rakuten.co.jp/yado/tottori/misasa.html', jalanUrl: 'https://www.jalan.net/310000/' },
  },

  // ─── 四国 ────────────────────────────────────────────────────

  'matsuyama': {
    solo:    { name: 'ドーミーイン松山', reason: '松山市駅徒歩圏内・格安シングルプランで道後温泉へのアクセス良好', rakutenUrl: 'https://travel.rakuten.co.jp/yado/ehime/matsuyama.html', jalanUrl: 'https://www.jalan.net/380000/LRG_380200/' },
    couple:  { name: '道後温泉 大和屋本店', reason: '道後温泉の老舗旅館・カップルで国内最古の温泉を独占', rakutenUrl: 'https://travel.rakuten.co.jp/yado/ehime/matsuyama.html', jalanUrl: 'https://www.jalan.net/380000/LRG_380200/' },
    friends: { name: '松山全日空ホテル', reason: '広い客室と宴会プラン・グループで松山城と道後温泉を満喫', rakutenUrl: 'https://travel.rakuten.co.jp/yado/ehime/matsuyama.html', jalanUrl: 'https://www.jalan.net/380000/LRG_380200/' },
  },

  'uwajima': {
    solo:    { name: 'ホテルクレメント宇和島', reason: '宇和島駅近・格安シングルプランで闘牛と真珠の町を観光', rakutenUrl: 'https://travel.rakuten.co.jp/yado/ehime/uwajima.html', jalanUrl: 'https://www.jalan.net/380000/LRG_380500/' },
    couple:  { name: '宇和島 旅館 有明荘', reason: '宇和海の絶景と海の幸・カップルで愛媛の漁師町を体感', rakutenUrl: 'https://travel.rakuten.co.jp/yado/ehime/uwajima.html', jalanUrl: 'https://www.jalan.net/380000/LRG_380500/' },
    friends: { name: 'ホテルルートイン宇和島', reason: '広い客室とグループ向けプラン・宇和島の海の幸を満喫', rakutenUrl: 'https://travel.rakuten.co.jp/yado/ehime/uwajima.html', jalanUrl: 'https://www.jalan.net/380000/LRG_380500/' },
  },

  'uchiko': {
    solo:    { name: '内子 ゲストハウスなかの家', reason: '内子駅徒歩圏内・格安素泊まりで江戸の白壁町並みを観光', rakutenUrl: 'https://travel.rakuten.co.jp/yado/ehime/uchiko.html', jalanUrl: 'https://www.jalan.net/380000/' },
    couple:  { name: '内子 旅館 芳我荘', reason: '和蝋燭の町の情緒ある旅館・カップルで江戸の風情を満喫', rakutenUrl: 'https://travel.rakuten.co.jp/yado/ehime/uchiko.html', jalanUrl: 'https://www.jalan.net/380000/' },
    friends: { name: '内子 田舎宿 ルーラル', reason: '広い古民家スタイル・グループで内子座歌舞伎観光に最適', rakutenUrl: 'https://travel.rakuten.co.jp/yado/ehime/uchiko.html', jalanUrl: 'https://www.jalan.net/380000/' },
  },

  'shimonada-eki': {
    solo:    { name: 'ホテル伊予路', reason: '下灘駅近くの格安宿・四国一美しい無人駅の夕日を独り占め', rakutenUrl: 'https://travel.rakuten.co.jp/yado/ehime/matsuyama.html', jalanUrl: 'https://www.jalan.net/380000/LRG_380200/' },
    couple:  { name: '伊予長浜 旅館 松廣荘', reason: '伊予灘の夕日と海の幸・カップルで日本一の鉄道絶景を満喫', rakutenUrl: 'https://travel.rakuten.co.jp/yado/ehime/matsuyama.html', jalanUrl: 'https://www.jalan.net/380000/LRG_380200/' },
    friends: { name: '伊予 道後温泉 ホテルパールシティ松山', reason: '広い客室とグループプラン・夕日スポット巡りに最適な宿', rakutenUrl: 'https://travel.rakuten.co.jp/yado/ehime/matsuyama.html', jalanUrl: 'https://www.jalan.net/380000/LRG_380200/' },
  },

  'tokushima': {
    solo:    { name: 'ドーミーイン徳島', reason: '徳島駅徒歩5分・格安シングルプランで阿波踊り観光の拠点に', rakutenUrl: 'https://travel.rakuten.co.jp/yado/tokushima/tokushima.html', jalanUrl: 'https://www.jalan.net/360000/' },
    couple:  { name: 'アスティとくしまホテル', reason: '眉山を望む客室と阿波の食材・カップルで吉野川の景色を満喫', rakutenUrl: 'https://travel.rakuten.co.jp/yado/tokushima/tokushima.html', jalanUrl: 'https://www.jalan.net/360000/' },
    friends: { name: '徳島グランドホテル', reason: '広い客室と宴会場・グループで阿波踊りの熱気を体感', rakutenUrl: 'https://travel.rakuten.co.jp/yado/tokushima/tokushima.html', jalanUrl: 'https://www.jalan.net/360000/' },
  },

  'kochi': {
    solo:    { name: 'ドーミーイン高知', reason: '高知駅徒歩5分・格安シングルプランでひろめ市場へのアクセス良好', rakutenUrl: 'https://travel.rakuten.co.jp/yado/kochi/kochi.html', jalanUrl: 'https://www.jalan.net/390000/LRG_390200/' },
    couple:  { name: 'ザ クラウンパレス新阪急高知', reason: '高知市街の眺望とかつおのたたき・カップルで坂本龍馬の地を探訪', rakutenUrl: 'https://travel.rakuten.co.jp/yado/kochi/kochi.html', jalanUrl: 'https://www.jalan.net/390000/LRG_390200/' },
    friends: { name: '城西館', reason: '高知城近くの大型旅館・グループで土佐料理と皿鉢を豪快に堪能', rakutenUrl: 'https://travel.rakuten.co.jp/yado/kochi/kochi.html', jalanUrl: 'https://www.jalan.net/390000/LRG_390200/' },
  },

  'ashizuri': {
    solo:    { name: '足摺岬 旅館 足摺テルメ', reason: '足摺岬バスターミナル近・格安素泊まりで最南端の地へ', rakutenUrl: 'https://travel.rakuten.co.jp/yado/kochi/seibu.html', jalanUrl: 'https://www.jalan.net/390000/' },
    couple:  { name: '足摺岬 ホテル足摺', reason: '太平洋の絶景と豊後水道の幸・カップルで四国最南端の宿', rakutenUrl: 'https://travel.rakuten.co.jp/yado/kochi/seibu.html', jalanUrl: 'https://www.jalan.net/390000/' },
    friends: { name: '足摺岬 温泉宿 白樺', reason: '広い客室とグループプラン・土佐の海の幸を心ゆくまで堪能', rakutenUrl: 'https://travel.rakuten.co.jp/yado/kochi/seibu.html', jalanUrl: 'https://www.jalan.net/390000/' },
  },

  'muroto': {
    solo:    { name: '室戸 民宿 かつお食堂', reason: '室戸岬近く・格安素泊まりで空海修行の地を探訪', rakutenUrl: 'https://travel.rakuten.co.jp/yado/kochi/toubu.html', jalanUrl: 'https://www.jalan.net/390000/' },
    couple:  { name: '室戸岬 ホテルむろと', reason: '荒々しい太平洋の眺望と新鮮な海の幸・カップルに最適', rakutenUrl: 'https://travel.rakuten.co.jp/yado/kochi/toubu.html', jalanUrl: 'https://www.jalan.net/390000/' },
    friends: { name: '室戸温泉 ホテル 海里', reason: '広い施設・グループで室戸のジオパークと温泉を満喫', rakutenUrl: 'https://travel.rakuten.co.jp/yado/kochi/toubu.html', jalanUrl: 'https://www.jalan.net/390000/' },
  },

  'ryugado': {
    solo:    { name: 'ホテルアイリス高知', reason: '土佐山田駅近・格安シングルプランで龍河洞観光の拠点に', rakutenUrl: 'https://travel.rakuten.co.jp/yado/kochi/kochi.html', jalanUrl: 'https://www.jalan.net/390000/LRG_390200/' },
    couple:  { name: 'ホテル竜馬', reason: '高知市内の好アクセス・カップルで龍河洞と土佐の食を堪能', rakutenUrl: 'https://travel.rakuten.co.jp/yado/kochi/kochi.html', jalanUrl: 'https://www.jalan.net/390000/LRG_390200/' },
    friends: { name: '高知サンライズホテル', reason: '広い客室と多人数プラン・グループで高知の観光スポットを満喫', rakutenUrl: 'https://travel.rakuten.co.jp/yado/kochi/kochi.html', jalanUrl: 'https://www.jalan.net/390000/LRG_390200/' },
  },

  'shimanto-river': {
    solo:    { name: '四万十 ゲストハウスしまんと', reason: '中村駅近・格安素泊まりで日本最後の清流を独り歩き', rakutenUrl: 'https://travel.rakuten.co.jp/yado/kochi/seibu.html', jalanUrl: 'https://www.jalan.net/390000/' },
    couple:  { name: '四万十 旅館 中村屋', reason: '四万十川沿いの眺望と川魚料理・カップルで清流を独占', rakutenUrl: 'https://travel.rakuten.co.jp/yado/kochi/seibu.html', jalanUrl: 'https://www.jalan.net/390000/' },
    friends: { name: '四万十 ホテル グランコート', reason: '広い客室とグループプラン・カヌー・釣りなどの拠点に最適', rakutenUrl: 'https://travel.rakuten.co.jp/yado/kochi/seibu.html', jalanUrl: 'https://www.jalan.net/390000/' },
  },

  'shodoshima': {
    solo:    { name: '小豆島オリーブビーチホテル', reason: 'フェリー乗り場近く・格安素泊まりでオリーブ島を観光', rakutenUrl: 'https://travel.rakuten.co.jp/yado/kagawa/shodoshima.html', jalanUrl: 'https://www.jalan.net/370000/' },
    couple:  { name: '小豆島 国際ホテル', reason: '瀬戸内海の絶景と素麺料理・カップルでエーゲ海のような島旅', rakutenUrl: 'https://travel.rakuten.co.jp/yado/kagawa/shodoshima.html', jalanUrl: 'https://www.jalan.net/370000/' },
    friends: { name: '小豆島 旅館 亀廣別荘', reason: '広い和室と宴会プラン・グループでオリーブ島の食を満喫', rakutenUrl: 'https://travel.rakuten.co.jp/yado/kagawa/shodoshima.html', jalanUrl: 'https://www.jalan.net/370000/' },
  },

  'naoshima': {
    solo:    { name: '直島 ゲストハウス つつじ荘', reason: 'フェリー乗り場徒歩圏・格安素泊まりで現代アートの島を体験', rakutenUrl: 'https://travel.rakuten.co.jp/yado/kagawa/naoshima.html', jalanUrl: 'https://www.jalan.net/370000/' },
    couple:  { name: '直島 ホテル ベネッセハウス', reason: '世界的アーティストの作品に泊まる・カップルで唯一無二の体験', rakutenUrl: 'https://travel.rakuten.co.jp/yado/kagawa/naoshima.html', jalanUrl: 'https://www.jalan.net/370000/' },
    friends: { name: '直島 民宿 あかりや', reason: '大人数対応の民宿・グループで瀬戸内アートを満喫', rakutenUrl: 'https://travel.rakuten.co.jp/yado/kagawa/naoshima.html', jalanUrl: 'https://www.jalan.net/370000/' },
  },

  'kotohira': {
    solo:    { name: 'ことひら温泉 琴参閣', reason: '琴平駅徒歩圏内・格安素泊まりで金刀比羅宮の参拝拠点に', rakutenUrl: 'https://travel.rakuten.co.jp/yado/kagawa/kotohira.html', jalanUrl: 'https://www.jalan.net/370000/' },
    couple:  { name: 'ことひら温泉 旅館 綿屋', reason: '金刀比羅宮の石段を望む老舗旅館・カップルで讃岐の風情を', rakutenUrl: 'https://travel.rakuten.co.jp/yado/kagawa/kotohira.html', jalanUrl: 'https://www.jalan.net/370000/' },
    friends: { name: 'ホテルかわまんさん', reason: '広い大浴場と宴会場・グループで讃岐うどんと金毘羅を満喫', rakutenUrl: 'https://travel.rakuten.co.jp/yado/kagawa/kotohira.html', jalanUrl: 'https://www.jalan.net/370000/' },
  },

  'oboke': {
    solo:    { name: 'ホテル大歩危峡まんなか', reason: '大歩危駅徒歩圏内・格安素泊まりで剣山・かずら橋観光の拠点', rakutenUrl: 'https://travel.rakuten.co.jp/yado/tokushima/iya.html', jalanUrl: 'https://www.jalan.net/360000/' },
    couple:  { name: '大歩危温泉 阿波乃庄', reason: '吉野川の渓谷美と温泉・カップルで秘境四国を体感', rakutenUrl: 'https://travel.rakuten.co.jp/yado/tokushima/iya.html', jalanUrl: 'https://www.jalan.net/360000/' },
    friends: { name: '大歩危 ラフティングロッジ', reason: '広い施設・グループでラフティングと祖谷の秘境を満喫', rakutenUrl: 'https://travel.rakuten.co.jp/yado/tokushima/iya.html', jalanUrl: 'https://www.jalan.net/360000/' },
  },

  'iya': {
    solo:    { name: '祖谷温泉 ホテル祖谷渓', reason: '祖谷のかずら橋近く・格安素泊まりで日本三大秘境に滞在', rakutenUrl: 'https://travel.rakuten.co.jp/yado/tokushima/iya.html', jalanUrl: 'https://www.jalan.net/360000/' },
    couple:  { name: '祖谷山の里 ホテル 祖谷 花かんざし', reason: '渓谷に張り出した露天風呂・カップルで絶景の秘境温泉', rakutenUrl: 'https://travel.rakuten.co.jp/yado/tokushima/iya.html', jalanUrl: 'https://www.jalan.net/360000/' },
    friends: { name: '祖谷 民宿 天空の里', reason: '大人数対応の古民家・グループで日本三大秘境の夜を楽しむ', rakutenUrl: 'https://travel.rakuten.co.jp/yado/tokushima/iya.html', jalanUrl: 'https://www.jalan.net/360000/' },
  },

  'chichibugahama': {
    solo:    { name: 'ホテルせとうち観光', reason: '詫間駅近・格安素泊まりで天空の鏡を一人で体感', rakutenUrl: 'https://travel.rakuten.co.jp/yado/ehime/chuuyo.html', jalanUrl: 'https://www.jalan.net/380000/LRG_380200/' },
    couple:  { name: '父母ヶ浜 旅館 汐見荘', reason: 'ウユニ塩湖のような夕日の絶景・カップルで二人だけの奇跡の風景', rakutenUrl: 'https://travel.rakuten.co.jp/yado/ehime/chuuyo.html', jalanUrl: 'https://www.jalan.net/380000/LRG_380200/' },
    friends: { name: '三豊 旅館 よしや', reason: '広い客室と讃岐の幸・グループで瀬戸内の天空の鏡を満喫', rakutenUrl: 'https://travel.rakuten.co.jp/yado/ehime/chuuyo.html', jalanUrl: 'https://www.jalan.net/380000/LRG_380200/' },
  },

  'kazurabashi': {
    solo:    { name: '祖谷温泉 旅館 久保', reason: 'かずら橋徒歩圏・格安素泊まりで日本の秘境を体感', rakutenUrl: 'https://travel.rakuten.co.jp/yado/tokushima/iya.html', jalanUrl: 'https://www.jalan.net/360000/' },
    couple:  { name: '西祖谷山 旅館 えびす荘', reason: 'かずら橋の最寄り宿・カップルで吉野川渓谷の絶景と温泉を', rakutenUrl: 'https://travel.rakuten.co.jp/yado/tokushima/iya.html', jalanUrl: 'https://www.jalan.net/360000/' },
    friends: { name: '祖谷温泉 レクリエの森', reason: '広いコテージ・グループでかずら橋と秘境観光を楽しめる', rakutenUrl: 'https://travel.rakuten.co.jp/yado/tokushima/iya.html', jalanUrl: 'https://www.jalan.net/360000/' },
  },

  // ─── 沖縄 ────────────────────────────────────────────────────

  'naha': {
    solo:    { name: 'ドーミーイン那覇', reason: '国際通り徒歩圏内・格安シングルプランで沖縄観光の拠点に', rakutenUrl: 'https://travel.rakuten.co.jp/yado/okinawa/naha.html', jalanUrl: 'https://www.jalan.net/470000/LRG_470200/' },
    couple:  { name: 'ホテルロコアナハ', reason: '首里城近くの高台・カップルで沖縄の歴史と夕日の絶景を満喫', rakutenUrl: 'https://travel.rakuten.co.jp/yado/okinawa/naha.html', jalanUrl: 'https://www.jalan.net/470000/LRG_470200/' },
    friends: { name: 'ダブルツリーbyヒルトン那覇首里城', reason: '広い客室と宴会プラン・グループで琉球文化と美食を満喫', rakutenUrl: 'https://travel.rakuten.co.jp/yado/okinawa/naha.html', jalanUrl: 'https://www.jalan.net/470000/LRG_470200/' },
  },

  'kourijima': {
    solo:    { name: 'ホテルオリオン モトブ リゾート', reason: '今帰仁近く・格安プランで古宇利島の絶景を気軽に体験', rakutenUrl: 'https://travel.rakuten.co.jp/yado/okinawa/okinawa.html', jalanUrl: 'https://www.jalan.net/470000/' },
    couple:  { name: '古宇利島 ヴィラオルカ', reason: '古宇利大橋の夕日とエメラルドの海・カップルで恋島を満喫', rakutenUrl: 'https://travel.rakuten.co.jp/yado/okinawa/okinawa.html', jalanUrl: 'https://www.jalan.net/470000/' },
    friends: { name: '今帰仁 休暇村沖縄恩納岳', reason: '広い施設・グループで古宇利島と北部の自然を満喫', rakutenUrl: 'https://travel.rakuten.co.jp/yado/okinawa/okinawa.html', jalanUrl: 'https://www.jalan.net/470000/' },
  },

  'cape-zanpa': {
    solo:    { name: 'ホテルみやひら', reason: '沖縄中部・格安シングルプランで残波岬観光の拠点に', rakutenUrl: 'https://travel.rakuten.co.jp/yado/okinawa/okinawa.html', jalanUrl: 'https://www.jalan.net/470000/' },
    couple:  { name: 'ザ ブセナテラス', reason: '残波岬近くのビーチリゾート・カップルで沖縄の碧い海を独占', rakutenUrl: 'https://travel.rakuten.co.jp/yado/okinawa/okinawa.html', jalanUrl: 'https://www.jalan.net/470000/' },
    friends: { name: '読谷村 りゅうぐう温泉', reason: '広い施設と沖縄料理・グループでやちむん陶器の里を楽しむ', rakutenUrl: 'https://travel.rakuten.co.jp/yado/okinawa/okinawa.html', jalanUrl: 'https://www.jalan.net/470000/' },
  },

  'ishigaki': {
    solo:    { name: 'アートホテル石垣島', reason: '石垣空港からバスで便利・格安シングルプランで離島観光の拠点', rakutenUrl: 'https://travel.rakuten.co.jp/yado/okinawa/ishigaki.html', jalanUrl: 'https://www.jalan.net/470000/LRG_471100/' },
    couple:  { name: '石垣島ビーチホテルサンシャイン', reason: 'エメラルドの海に面した客室・カップルで竹富島と絶景の海を満喫', rakutenUrl: 'https://travel.rakuten.co.jp/yado/okinawa/ishigaki.html', jalanUrl: 'https://www.jalan.net/470000/LRG_471100/' },
    friends: { name: '東横INN石垣島', reason: '石垣港フェリー乗り場近く・グループでコスパよく離島巡りの拠点に', rakutenUrl: 'https://travel.rakuten.co.jp/yado/okinawa/ishigaki.html', jalanUrl: 'https://www.jalan.net/470000/LRG_471100/' },
  },

  'tokashiki-jima': {
    solo:    { name: '渡嘉敷島 旅館 渡嘉敷', reason: 'フェリー乗り場近く・格安素泊まりでケラマの海を一人で体感', rakutenUrl: 'https://travel.rakuten.co.jp/yado/okinawa/kerama.html', jalanUrl: 'https://www.jalan.net/470000/' },
    couple:  { name: '渡嘉敷村 渡嘉敷島リゾート', reason: 'ケラマブルーの海・カップルで世界最高レベルの珊瑚礁を満喫', rakutenUrl: 'https://travel.rakuten.co.jp/yado/okinawa/kerama.html', jalanUrl: 'https://www.jalan.net/470000/' },
    friends: { name: '渡嘉敷 民宿 三好荘', reason: '大人数対応の民宿・グループでダイビングと沖縄料理を楽しむ', rakutenUrl: 'https://travel.rakuten.co.jp/yado/okinawa/kerama.html', jalanUrl: 'https://www.jalan.net/470000/' },
  },

  'kumejima': {
    solo:    { name: 'ホテルくめじま荘', reason: '久米島空港近く・格安素泊まりプランで島内観光の拠点に', rakutenUrl: 'https://travel.rakuten.co.jp/yado/okinawa/kumejima.html', jalanUrl: 'https://www.jalan.net/470000/LRG_470800/' },
    couple:  { name: '久米島 はての浜リゾート', reason: '日本最美ビーチ「はての浜」を望む・カップルで無人島の絶景を体験', rakutenUrl: 'https://travel.rakuten.co.jp/yado/okinawa/kumejima.html', jalanUrl: 'https://www.jalan.net/470000/LRG_470800/' },
    friends: { name: '久米島リゾートホテル', reason: '広い施設とグループ向けプラン・久米島の自然を仲間でわいわい', rakutenUrl: 'https://travel.rakuten.co.jp/yado/okinawa/kumejima.html', jalanUrl: 'https://www.jalan.net/470000/LRG_470800/' },
  },

  'miyakojima': {
    solo:    { name: 'ホテルアトールエメラルド宮古島', reason: '宮古空港近く・格安シングルプランで宮古ブルーの海を体験', rakutenUrl: 'https://travel.rakuten.co.jp/yado/okinawa/miyako.html', jalanUrl: 'https://www.jalan.net/470000/LRG_471700/' },
    couple:  { name: '宮古島東急ホテル', reason: '宮古ブルーの海・カップルで日本最高峰の透明度の海を満喫', rakutenUrl: 'https://travel.rakuten.co.jp/yado/okinawa/miyako.html', jalanUrl: 'https://www.jalan.net/470000/LRG_471700/' },
    friends: { name: '宮古島リゾートホテルズ', reason: '広い施設とグループプラン・友達とシュノーケリング・ダイビングを満喫', rakutenUrl: 'https://travel.rakuten.co.jp/yado/okinawa/miyako.html', jalanUrl: 'https://www.jalan.net/470000/LRG_471700/' },
  },

  // ─── 九州 ────────────────────────────────────────────────────

  'fukuoka': {
    solo:    { name: 'ドーミーイン博多', reason: '博多駅徒歩5分・天然温泉付き格安シングルプランで観光の拠点', rakutenUrl: 'https://travel.rakuten.co.jp/yado/fukuoka/fukuoka.html', jalanUrl: 'https://www.jalan.net/400000/LRG_400100/' },
    couple:  { name: 'ヒルトン福岡シーホーク', reason: '博多湾の絶景・カップルで九州最大の都市を満喫できる高級宿', rakutenUrl: 'https://travel.rakuten.co.jp/yado/fukuoka/fukuoka.html', jalanUrl: 'https://www.jalan.net/400000/LRG_400100/' },
    friends: { name: 'ホテルモントレラ・スール福岡', reason: '博多駅近の大型ホテル・グループで博多グルメと観光を満喫', rakutenUrl: 'https://travel.rakuten.co.jp/yado/fukuoka/fukuoka.html', jalanUrl: 'https://www.jalan.net/400000/LRG_400100/' },
  },

  'saga': {
    solo:    { name: 'ルートイン佐賀', reason: '佐賀駅近・無料朝食付きシングルプランが格安で吉野ヶ里へのアクセス良好', rakutenUrl: 'https://travel.rakuten.co.jp/yado/saga/saga.html', jalanUrl: 'https://www.jalan.net/410000/' },
    couple:  { name: '佐賀 有明海荘', reason: '有明海のムツゴロウと夕日・カップルで嬉野の温泉と一緒に楽しむ', rakutenUrl: 'https://travel.rakuten.co.jp/yado/saga/saga.html', jalanUrl: 'https://www.jalan.net/410000/' },
    friends: { name: 'ホテルサンルート佐賀', reason: '佐賀駅直結・広い客室とグループプランで呼子イカと伊万里焼を堪能', rakutenUrl: 'https://travel.rakuten.co.jp/yado/saga/saga.html', jalanUrl: 'https://www.jalan.net/410000/' },
  },

  'kumamoto': {
    solo:    { name: 'ドーミーイン熊本', reason: '熊本駅徒歩圏内・格安シングルプランで熊本城観光の拠点に', rakutenUrl: 'https://travel.rakuten.co.jp/yado/kumamoto/kumamoto.html', jalanUrl: 'https://www.jalan.net/430000/' },
    couple:  { name: 'ホテル日航熊本', reason: '熊本城の眺望と馬刺し・カップルで加藤清正の城下町を満喫', rakutenUrl: 'https://travel.rakuten.co.jp/yado/kumamoto/kumamoto.html', jalanUrl: 'https://www.jalan.net/430000/' },
    friends: { name: '熊本ホテルキャッスル', reason: '熊本城至近の大型ホテル・グループでくまモン聖地巡礼に最適', rakutenUrl: 'https://travel.rakuten.co.jp/yado/kumamoto/kumamoto.html', jalanUrl: 'https://www.jalan.net/430000/' },
  },

  'yufuin': {
    solo:    { name: 'ホテルかやとの杜', reason: '由布院駅徒歩圏内・格安素泊まりプランで湯の坪街道を散策', rakutenUrl: 'https://travel.rakuten.co.jp/yado/oita/yufuin.html', jalanUrl: 'https://www.jalan.net/440000/' },
    couple:  { name: '亀の井別荘', reason: '由布岳を望む老舗旅館・カップルで湯布院の雅な温泉旅を', rakutenUrl: 'https://travel.rakuten.co.jp/yado/oita/yufuin.html', jalanUrl: 'https://www.jalan.net/440000/' },
    friends: { name: '由布院温泉 ゆふいん花由', reason: '広い大浴場と多人数客室・グループでコスパよく由布院を満喫', rakutenUrl: 'https://travel.rakuten.co.jp/yado/oita/yufuin.html', jalanUrl: 'https://www.jalan.net/440000/' },
  },

  'kurokawa': {
    solo:    { name: '黒川温泉 やまびこ旅館', reason: '黒川温泉バス停近く・格安素泊まりで入湯手形を使って湯巡り', rakutenUrl: 'https://travel.rakuten.co.jp/yado/kumamoto/kurokawa.html', jalanUrl: 'https://www.jalan.net/430000/' },
    couple:  { name: '黒川温泉 山みず木', reason: '渓流沿いの露天風呂・カップルで日本一の露天風呂の宿に泊まる', rakutenUrl: 'https://travel.rakuten.co.jp/yado/kumamoto/kurokawa.html', jalanUrl: 'https://www.jalan.net/430000/' },
    friends: { name: '黒川温泉 わかば', reason: '多人数対応の広い客室と大浴場・グループで黒川温泉を湯巡り', rakutenUrl: 'https://travel.rakuten.co.jp/yado/kumamoto/kurokawa.html', jalanUrl: 'https://www.jalan.net/430000/' },
  },

  'nabegitaki': {
    solo:    { name: 'ペンション 鍋ヶ滝ロッジ', reason: '鍋ヶ滝バス停近・格安素泊まりで「裏側から見る滝」を一人で体感', rakutenUrl: 'https://travel.rakuten.co.jp/yado/kumamoto/aso.html', jalanUrl: 'https://www.jalan.net/430000/' },
    couple:  { name: 'ホテルやまと 阿蘇の司ビラパークホテル', reason: '阿蘇の大自然と温泉・カップルでカーテン状の滝と絶景を満喫', rakutenUrl: 'https://travel.rakuten.co.jp/yado/kumamoto/aso.html', jalanUrl: 'https://www.jalan.net/430000/' },
    friends: { name: '阿蘇 プレミアホテル ASOくじゅう', reason: '広い施設とグループプラン・阿蘇の大観峰と温泉を仲間で楽しむ', rakutenUrl: 'https://travel.rakuten.co.jp/yado/kumamoto/aso.html', jalanUrl: 'https://www.jalan.net/430000/' },
  },

  'aso': {
    solo:    { name: 'ペンション アソビバ', reason: '阿蘇駅近・格安素泊まりで世界最大規模のカルデラを観光', rakutenUrl: 'https://travel.rakuten.co.jp/yado/kumamoto/aso.html', jalanUrl: 'https://www.jalan.net/430000/' },
    couple:  { name: '阿蘇のホテル緑水亭', reason: '阿蘇山を望む露天風呂・カップルで九重連山と草千里を二人で満喫', rakutenUrl: 'https://travel.rakuten.co.jp/yado/kumamoto/aso.html', jalanUrl: 'https://www.jalan.net/430000/' },
    friends: { name: '阿蘇 熊本 阿蘇内牧温泉 旅館 城山', reason: '広い大浴場と宴会プラン・グループで阿蘇の火山と温泉を堪能', rakutenUrl: 'https://travel.rakuten.co.jp/yado/kumamoto/aso.html', jalanUrl: 'https://www.jalan.net/430000/' },
  },

  'takachiho': {
    solo:    { name: '高千穂 旅館 国民宿舎 高千穂荘', reason: '高千穂バスターミナル近・格安素泊まりで神話の里を探訪', rakutenUrl: 'https://travel.rakuten.co.jp/yado/miyazaki/takachiho.html', jalanUrl: 'https://www.jalan.net/450000/' },
    couple:  { name: '高千穂温泉 旅館 旗山', reason: '高千穂峡の絶景と神話の地・カップルで日本最古の神話を体感', rakutenUrl: 'https://travel.rakuten.co.jp/yado/miyazaki/takachiho.html', jalanUrl: 'https://www.jalan.net/450000/' },
    friends: { name: '高千穂 宿泊センター 高千穂グリーンスポーツホテル', reason: '広い施設・グループで天岩戸神社と夜神楽を楽しむ', rakutenUrl: 'https://travel.rakuten.co.jp/yado/miyazaki/takachiho.html', jalanUrl: 'https://www.jalan.net/450000/' },
  },

  'hitoyoshi': {
    solo:    { name: 'ホテルサンロード人吉', reason: '人吉駅近・格安シングルプランで球磨川くだりの拠点に', rakutenUrl: 'https://travel.rakuten.co.jp/yado/kumamoto/hitoyoshi.html', jalanUrl: 'https://www.jalan.net/430000/' },
    couple:  { name: '人吉旅館', reason: '球磨川沿いの温泉と球磨焼酎・カップルで盆地の城下町を散策', rakutenUrl: 'https://travel.rakuten.co.jp/yado/kumamoto/hitoyoshi.html', jalanUrl: 'https://www.jalan.net/430000/' },
    friends: { name: 'ニュー松屋旅館', reason: '広い和室と宴会プラン・グループで球磨焼酎と人吉の幸を堪能', rakutenUrl: 'https://travel.rakuten.co.jp/yado/kumamoto/hitoyoshi.html', jalanUrl: 'https://www.jalan.net/430000/' },
  },

  'minami-aso': {
    solo:    { name: '南阿蘇 ペンションエルグレコ', reason: '白川水源近く・格安素泊まりで阿蘇の大自然を一人で体感', rakutenUrl: 'https://travel.rakuten.co.jp/yado/kumamoto/aso.html', jalanUrl: 'https://www.jalan.net/430000/' },
    couple:  { name: '南阿蘇 らくだ山荘', reason: '阿蘇外輪山の絶景・カップルで星空と温泉の特別な夜を', rakutenUrl: 'https://travel.rakuten.co.jp/yado/kumamoto/aso.html', jalanUrl: 'https://www.jalan.net/430000/' },
    friends: { name: '阿蘇望の郷くぎの', reason: '広いコテージ施設・グループでBBQと阿蘇の大自然を楽しむ', rakutenUrl: 'https://travel.rakuten.co.jp/yado/kumamoto/aso.html', jalanUrl: 'https://www.jalan.net/430000/' },
  },

  'nagasaki': {
    solo:    { name: 'ドーミーイン長崎', reason: '長崎駅徒歩圏内・格安シングルプランでグラバー園・眼鏡橋観光', rakutenUrl: 'https://travel.rakuten.co.jp/yado/nagasaki/nagasaki.html', jalanUrl: 'https://www.jalan.net/420000/LRG_420200/' },
    couple:  { name: 'ホテル モンテ エルマーナ長崎', reason: '稲佐山から見る夜景・カップルで世界新三大夜景を独占', rakutenUrl: 'https://travel.rakuten.co.jp/yado/nagasaki/nagasaki.html', jalanUrl: 'https://www.jalan.net/420000/LRG_420200/' },
    friends: { name: '長崎全日空ホテルグラバーヒル', reason: '広い客室と宴会プラン・グループでちゃんぽんとカステラを満喫', rakutenUrl: 'https://travel.rakuten.co.jp/yado/nagasaki/nagasaki.html', jalanUrl: 'https://www.jalan.net/420000/LRG_420200/' },
  },

  'sasebo': {
    solo:    { name: 'ホテルルートイン佐世保', reason: '佐世保駅近・格安シングルプランでハウステンボス観光の拠点に', rakutenUrl: 'https://travel.rakuten.co.jp/yado/nagasaki/sasebo.html', jalanUrl: 'https://www.jalan.net/420000/LRG_420500/' },
    couple:  { name: 'ホテルフォルツァ佐世保', reason: '九十九島の絶景・カップルでハウステンボスと共に楽しむ宿', rakutenUrl: 'https://travel.rakuten.co.jp/yado/nagasaki/sasebo.html', jalanUrl: 'https://www.jalan.net/420000/LRG_420500/' },
    friends: { name: '佐世保ワシントンホテル', reason: '広い客室とグループプラン・佐世保バーガーと弓張岳の眺望を満喫', rakutenUrl: 'https://travel.rakuten.co.jp/yado/nagasaki/sasebo.html', jalanUrl: 'https://www.jalan.net/420000/LRG_420500/' },
  },

  'hirado': {
    solo:    { name: 'ホテルニューフジ', reason: '平戸桟橋近く・格安素泊まりで平戸城下町の歴史を探訪', rakutenUrl: 'https://travel.rakuten.co.jp/yado/nagasaki/hirado.html', jalanUrl: 'https://www.jalan.net/420000/' },
    couple:  { name: '平戸温泉 蘭風', reason: '平戸海峡の絶景と鎖国時代の歴史・カップルで南蛮の香り漂う宿', rakutenUrl: 'https://travel.rakuten.co.jp/yado/nagasaki/hirado.html', jalanUrl: 'https://www.jalan.net/420000/' },
    friends: { name: '平戸 旅館 萩','reason': '広い客室と宴会場・グループで平戸の海の幸を豪快に堪能', rakutenUrl: 'https://travel.rakuten.co.jp/yado/nagasaki/hirado.html', jalanUrl: 'https://www.jalan.net/420000/' },
  },

  'goto': {
    solo:    { name: '五島 ゲストハウス旅するビーチ', reason: '福江港近く・格安素泊まりでキリシタン文化と絶景を体感', rakutenUrl: 'https://travel.rakuten.co.jp/yado/nagasaki/goto.html', jalanUrl: 'https://www.jalan.net/420000/LRG_421100/' },
    couple:  { name: '五島温泉 ホテル マルゲリータ', reason: '五島の海と夕日・カップルで世界遺産の教会群と温泉を満喫', rakutenUrl: 'https://travel.rakuten.co.jp/yado/nagasaki/goto.html', jalanUrl: 'https://www.jalan.net/420000/LRG_421100/' },
    friends: { name: '五島観光ホテル', reason: '広い客室とグループプラン・五島うどんと海の幸を友達と堪能', rakutenUrl: 'https://travel.rakuten.co.jp/yado/nagasaki/goto.html', jalanUrl: 'https://www.jalan.net/420000/LRG_421100/' },
  },

  'unzen': {
    solo:    { name: '雲仙温泉 ホテルウジャグチ', reason: '雲仙温泉バス停近・格安素泊まりプランで地獄めぐりの拠点に', rakutenUrl: 'https://travel.rakuten.co.jp/yado/nagasaki/unzen.html', jalanUrl: 'https://www.jalan.net/420000/LRG_421400/' },
    couple:  { name: '雲仙温泉 青雲荘', reason: '硫黄の香り漂う雲仙地獄と温泉・カップルで非日常の景色を体感', rakutenUrl: 'https://travel.rakuten.co.jp/yado/nagasaki/unzen.html', jalanUrl: 'https://www.jalan.net/420000/LRG_421400/' },
    friends: { name: '雲仙温泉 富貴屋', reason: '広い大浴場と多人数客室・グループで島原半島の温泉を満喫', rakutenUrl: 'https://travel.rakuten.co.jp/yado/nagasaki/unzen.html', jalanUrl: 'https://www.jalan.net/420000/LRG_421400/' },
  },

  'ureshino-onsen': {
    solo:    { name: 'ホテルニュー一陽', reason: '嬉野温泉バス停近・格安素泊まりで日本三大美肌の湯を独り占め', rakutenUrl: 'https://travel.rakuten.co.jp/yado/saga/ureshino.html', jalanUrl: 'https://www.jalan.net/410000/LRG_411100/' },
    couple:  { name: '嬉野温泉 和多屋別荘', reason: '茅乃舎の料理と美肌の湯・カップルで九州屈指の温泉宿に', rakutenUrl: 'https://travel.rakuten.co.jp/yado/saga/ureshino.html', jalanUrl: 'https://www.jalan.net/410000/LRG_411100/' },
    friends: { name: '嬉野温泉 旅館 大村屋', reason: '広い大浴場と多人数客室・グループでお茶と温泉を楽しめる', rakutenUrl: 'https://travel.rakuten.co.jp/yado/saga/ureshino.html', jalanUrl: 'https://www.jalan.net/410000/LRG_411100/' },
  },

  'kagoshima': {
    solo:    { name: 'ドーミーイン鹿児島', reason: '鹿児島中央駅徒歩圏内・格安シングルプランで天文館観光の拠点に', rakutenUrl: 'https://travel.rakuten.co.jp/yado/kagoshima/kagoshima.html', jalanUrl: 'https://www.jalan.net/460000/LRG_460200/' },
    couple:  { name: 'ホテルウェルビュー鹿児島', reason: '桜島の絶景・カップルで黒豚料理と温泉を楽しめる上質な宿', rakutenUrl: 'https://travel.rakuten.co.jp/yado/kagoshima/kagoshima.html', jalanUrl: 'https://www.jalan.net/460000/LRG_460200/' },
    friends: { name: 'かごしま緑と花の杜ホテル', reason: '広い客室と宴会プラン・グループで薩摩の食文化と桜島を満喫', rakutenUrl: 'https://travel.rakuten.co.jp/yado/kagoshima/kagoshima.html', jalanUrl: 'https://www.jalan.net/460000/LRG_460200/' },
  },

  'yakushima': {
    solo:    { name: '屋久島 ホスピタルビレッジ', reason: '宮之浦港近く・格安素泊まりで世界遺産の縄文杉へのトレッキング拠点', rakutenUrl: 'https://travel.rakuten.co.jp/yado/kagoshima/yakushima.html', jalanUrl: 'https://www.jalan.net/460000/LRG_461700/' },
    couple:  { name: '屋久島いわさきホテル', reason: '屋久島の自然と温泉・カップルで太古の森と海の絶景を体感', rakutenUrl: 'https://travel.rakuten.co.jp/yado/kagoshima/yakushima.html', jalanUrl: 'https://www.jalan.net/460000/LRG_461700/' },
    friends: { name: '屋久島グリーンホテル', reason: '広い客室とグループ向けプラン・縄文杉ツアーの拠点に最適', rakutenUrl: 'https://travel.rakuten.co.jp/yado/kagoshima/yakushima.html', jalanUrl: 'https://www.jalan.net/460000/LRG_461700/' },
  },

  'ibusuki': {
    solo:    { name: 'ホテル吟松', reason: '指宿駅近・格安素泊まりプランで砂むし温泉を体験', rakutenUrl: 'https://travel.rakuten.co.jp/yado/kagoshima/ibusuki.html', jalanUrl: 'https://www.jalan.net/460000/LRG_460200/' },
    couple:  { name: '指宿温泉 指宿白水館', reason: '千人風呂の絶景と砂むし・カップルで日本最南の名湯を独占', rakutenUrl: 'https://travel.rakuten.co.jp/yado/kagoshima/ibusuki.html', jalanUrl: 'https://www.jalan.net/460000/LRG_460200/' },
    friends: { name: '指宿温泉 かんぽの宿 指宿', reason: '広い大浴場と多人数プラン・グループで砂むし温泉を楽しむ', rakutenUrl: 'https://travel.rakuten.co.jp/yado/kagoshima/ibusuki.html', jalanUrl: 'https://www.jalan.net/460000/LRG_460200/' },
  },

  'amami': {
    solo:    { name: 'ホテルウエストコート奄美', reason: '奄美空港近く・格安シングルプランで南の島を気軽に体験', rakutenUrl: 'https://travel.rakuten.co.jp/yado/kagoshima/amami.html', jalanUrl: 'https://www.jalan.net/460000/' },
    couple:  { name: '奄美大島 ネイティブシー奄美', reason: '奄美の碧い海とビーチ・カップルで亜熱帯の自然を二人占め', rakutenUrl: 'https://travel.rakuten.co.jp/yado/kagoshima/amami.html', jalanUrl: 'https://www.jalan.net/460000/' },
    friends: { name: '奄美大島ビーチホテルサンシャイン', reason: '広い施設とグループプラン・奄美のシュノーケリングと食を満喫', rakutenUrl: 'https://travel.rakuten.co.jp/yado/kagoshima/amami.html', jalanUrl: 'https://www.jalan.net/460000/' },
  },

  'obi': {
    solo:    { name: 'ホテルルートイン飫肥', reason: '飫肥駅近く・格安素泊まりで九州の小京都を一人で散策', rakutenUrl: 'https://travel.rakuten.co.jp/yado/miyazaki/obi.html', jalanUrl: 'https://www.jalan.net/450000/' },
    couple:  { name: '飫肥 旅館 松月', reason: '城下町の風情ある旅館・カップルで維新の志士ゆかりの地を体験', rakutenUrl: 'https://travel.rakuten.co.jp/yado/miyazaki/obi.html', jalanUrl: 'https://www.jalan.net/450000/' },
    friends: { name: '日南 ホテル シーホース', reason: '広い客室と宴会プラン・グループで飫肥城跡と鬼の洗濯板を満喫', rakutenUrl: 'https://travel.rakuten.co.jp/yado/miyazaki/obi.html', jalanUrl: 'https://www.jalan.net/450000/' },
  },

  'sakurajima': {
    solo:    { name: '桜島 旅館 桜島ステーション', reason: 'フェリー乗り場近く・格安素泊まりで活火山の絶景を独り占め', rakutenUrl: 'https://travel.rakuten.co.jp/yado/kagoshima/kagoshima.html', jalanUrl: 'https://www.jalan.net/460000/LRG_460200/' },
    couple:  { name: '桜島 溶岩なぎさホテル', reason: '桜島溶岩温泉と薩摩湾の絶景・カップルで火山と海の景色を体感', rakutenUrl: 'https://travel.rakuten.co.jp/yado/kagoshima/kagoshima.html', jalanUrl: 'https://www.jalan.net/460000/LRG_460200/' },
    friends: { name: '桜島 シーサイドホテル', reason: '広い施設・グループで桜島大根・黒豚グルメと温泉を楽しむ', rakutenUrl: 'https://travel.rakuten.co.jp/yado/kagoshima/kagoshima.html', jalanUrl: 'https://www.jalan.net/460000/LRG_460200/' },
  },

  'kirishima': {
    solo:    { name: '霧島温泉 旅館 霧の宿', reason: '霧島温泉駅バス停近・格安素泊まりで天孫降臨の神話の地へ', rakutenUrl: 'https://travel.rakuten.co.jp/yado/kagoshima/kirishima.html', jalanUrl: 'https://www.jalan.net/460000/LRG_461100/' },
    couple:  { name: '霧島温泉 みやまコンセール', reason: '霧島連山の絶景と源泉かけ流し・カップルで神話の地の温泉を', rakutenUrl: 'https://travel.rakuten.co.jp/yado/kagoshima/kirishima.html', jalanUrl: 'https://www.jalan.net/460000/LRG_461100/' },
    friends: { name: '霧島温泉 霧島ホテル', reason: '広い大浴場と多人数客室・グループで霧島の硫黄泉と高原を満喫', rakutenUrl: 'https://travel.rakuten.co.jp/yado/kagoshima/kirishima.html', jalanUrl: 'https://www.jalan.net/460000/LRG_461100/' },
  },

  'miyazaki': {
    solo:    { name: 'ドーミーイン宮崎', reason: '宮崎駅徒歩5分・格安シングルプランで地鶏と日向路観光の拠点', rakutenUrl: 'https://travel.rakuten.co.jp/yado/miyazaki/miyazaki.html', jalanUrl: 'https://www.jalan.net/450000/' },
    couple:  { name: 'シーガイア シェラトン グランデ オーシャン リゾート', reason: '太平洋の絶景・カップルで日向路の青い海とリゾートを満喫', rakutenUrl: 'https://travel.rakuten.co.jp/yado/miyazaki/miyazaki.html', jalanUrl: 'https://www.jalan.net/450000/' },
    friends: { name: 'ホテルメリージュ宮崎', reason: '広い客室と宴会プラン・グループで宮崎牛と地鶏を豪快に堪能', rakutenUrl: 'https://travel.rakuten.co.jp/yado/miyazaki/miyazaki.html', jalanUrl: 'https://www.jalan.net/450000/' },
  },

  'beppu': {
    solo:    { name: 'ドーミーイン別府', reason: '別府駅徒歩圏内・格安シングルプランで地獄めぐりの拠点に', rakutenUrl: 'https://travel.rakuten.co.jp/yado/oita/beppu.html', jalanUrl: 'https://www.jalan.net/440000/' },
    couple:  { name: '別府温泉 杉乃井ホテル', reason: '棚湯の絶景と別府湾の夜景・カップルで温泉天国を贅沢に体験', rakutenUrl: 'https://travel.rakuten.co.jp/yado/oita/beppu.html', jalanUrl: 'https://www.jalan.net/440000/' },
    friends: { name: '別府温泉 ホテル白菊', reason: '広い大浴場と多人数プラン・グループで大分温泉と地獄を満喫', rakutenUrl: 'https://travel.rakuten.co.jp/yado/oita/beppu.html', jalanUrl: 'https://www.jalan.net/440000/' },
  },

  'amakusa': {
    solo:    { name: 'ホテルアマクサ', reason: '本渡フェリーターミナル近く・格安素泊まりでキリシタンの島へ', rakutenUrl: 'https://travel.rakuten.co.jp/yado/kumamoto/amakusa.html', jalanUrl: 'https://www.jalan.net/430000/' },
    couple:  { name: '天草 旅館 いにしえ', reason: '天草の海と夕日・カップルでドルフィンウォッチングと教会群を体感', rakutenUrl: 'https://travel.rakuten.co.jp/yado/kumamoto/amakusa.html', jalanUrl: 'https://www.jalan.net/430000/' },
    friends: { name: '天草 休暇村天草', reason: '広い施設とグループプラン・天草灘の海の幸と世界遺産を楽しむ', rakutenUrl: 'https://travel.rakuten.co.jp/yado/kumamoto/amakusa.html', jalanUrl: 'https://www.jalan.net/430000/' },
  },

  // ─── 旧データ ─────────────────────────────────────────────────

  'tenryu-gorge': {
    solo:    { name: 'ホテルルートイン浜松', reason: '浜松駅近・格安シングルプランで天竜峡観光の拠点に', rakutenUrl: 'https://travel.rakuten.co.jp/yado/shizuoka/hamamatsu.html', jalanUrl: 'https://www.jalan.net/220000/' },
    couple:  { name: '天竜峡温泉 旅館 橋倉屋', reason: '天竜峡の渓谷美と温泉・カップルで舟下りと絶景を楽しむ', rakutenUrl: 'https://travel.rakuten.co.jp/yado/shizuoka/hamamatsu.html', jalanUrl: 'https://www.jalan.net/220000/' },
    friends: { name: '浜松 ガーデンホテル', reason: '広い客室とグループプラン・浜松餃子と遠州の食を堪能', rakutenUrl: 'https://travel.rakuten.co.jp/yado/shizuoka/hamamatsu.html', jalanUrl: 'https://www.jalan.net/220000/' },
  },

  'shikoku-karst': {
    solo:    { name: 'ペンション 四国カルスト', reason: '四国カルスト入口近・格安素泊まりで日本三大カルストを体験', rakutenUrl: 'https://travel.rakuten.co.jp/yado/ehime/chuuyo.html', jalanUrl: 'https://www.jalan.net/380000/LRG_380200/' },
    couple:  { name: '高知 星ふる村くもの上のホテル', reason: 'カルスト台地の絶景・カップルで四国の屋根の星空と風景を満喫', rakutenUrl: 'https://travel.rakuten.co.jp/yado/ehime/chuuyo.html', jalanUrl: 'https://www.jalan.net/380000/LRG_380200/' },
    friends: { name: '四国カルスト 天狗高原 国民宿舎 天狗荘', reason: '広い施設・グループでカルスト台地ハイキングに最適', rakutenUrl: 'https://travel.rakuten.co.jp/yado/ehime/chuuyo.html', jalanUrl: 'https://www.jalan.net/380000/LRG_380200/' },
  },

  'zamami-island': {
    solo:    { name: '座間味島 民宿 あさぎ', reason: 'フェリー乗り場近く・格安素泊まりでケラマブルーの海を体験', rakutenUrl: 'https://travel.rakuten.co.jp/yado/okinawa/kerama.html', jalanUrl: 'https://www.jalan.net/470000/' },
    couple:  { name: '座間味島 旅館 サンセット', reason: 'ケラマ諸島の無人浜と夕日・カップルで世界屈指の珊瑚礁を独占', rakutenUrl: 'https://travel.rakuten.co.jp/yado/okinawa/kerama.html', jalanUrl: 'https://www.jalan.net/470000/' },
    friends: { name: '座間味島 民宿 しまうた', reason: '大人数対応の民宿・グループでホエールウォッチングと珊瑚礁を満喫', rakutenUrl: 'https://travel.rakuten.co.jp/yado/okinawa/kerama.html', jalanUrl: 'https://www.jalan.net/470000/' },
  },

  'iki-island': {
    solo:    { name: '壱岐 旅館 嬉野荘', reason: '郷ノ浦港近く・格安素泊まりで玄界灘の離島を一人で探訪', rakutenUrl: 'https://travel.rakuten.co.jp/yado/nagasaki/iki.html', jalanUrl: 'https://www.jalan.net/420000/' },
    couple:  { name: '壱岐 リゾートホテル モンステラ', reason: '壱岐の透明な海と湯ノ本温泉・カップルで離島の癒しを満喫', rakutenUrl: 'https://travel.rakuten.co.jp/yado/nagasaki/iki.html', jalanUrl: 'https://www.jalan.net/420000/' },
    friends: { name: '壱岐 ユースホステル壱岐', reason: '広い施設とグループプラン・壱岐の海の幸とビーチを仲間で楽しむ', rakutenUrl: 'https://travel.rakuten.co.jp/yado/nagasaki/iki.html', jalanUrl: 'https://www.jalan.net/420000/' },
  },

  'suzu': {
    solo:    { name: 'ホテルルートイン珠洲', reason: '珠洲市内・格安シングルプランで奥能登の塩田と灯台へのアクセス', rakutenUrl: 'https://travel.rakuten.co.jp/yado/ishikawa/noto.html', jalanUrl: 'https://www.jalan.net/170000/' },
    couple:  { name: '珠洲温泉 能登ロイヤルホテル', reason: '能登半島最北端の絶景と温泉・カップルで奥能登の海を独占', rakutenUrl: 'https://travel.rakuten.co.jp/yado/ishikawa/noto.html', jalanUrl: 'https://www.jalan.net/170000/' },
    friends: { name: '奥能登 すずの宿', reason: '広い和室・グループで揚げ浜塩と能登の海の幸を心ゆくまで堪能', rakutenUrl: 'https://travel.rakuten.co.jp/yado/ishikawa/noto.html', jalanUrl: 'https://www.jalan.net/170000/' },
  },

  'tsuyama': {
    solo:    { name: 'ホテルルートイン津山', reason: '津山駅近・格安シングルプランで津山城と城下町観光の拠点に', rakutenUrl: 'https://travel.rakuten.co.jp/yado/okayama/tsuyama.html', jalanUrl: 'https://www.jalan.net/330000/LRG_330800/' },
    couple:  { name: '津山 旅館 大橋', reason: '鶴山公園の桜と城下町の風情・カップルで美作の食文化を体験', rakutenUrl: 'https://travel.rakuten.co.jp/yado/okayama/tsuyama.html', jalanUrl: 'https://www.jalan.net/330000/LRG_330800/' },
    friends: { name: 'ホテルアルファーワン津山', reason: '広い客室とグループプラン・津山ホルモンと奥津温泉の拠点に', rakutenUrl: 'https://travel.rakuten.co.jp/yado/okayama/tsuyama.html', jalanUrl: 'https://www.jalan.net/330000/LRG_330800/' },
  },

  'ushimado': {
    solo:    { name: '牛窓オリーブリゾート 素泊まり棟', reason: '牛窓港近く・格安素泊まりで日本のエーゲ海を一人で体感', rakutenUrl: 'https://travel.rakuten.co.jp/yado/okayama/bizen.html', jalanUrl: 'https://www.jalan.net/330000/' },
    couple:  { name: '牛窓温泉 海の宿 シーサイドホテル', reason: '瀬戸内の絶景とオリーブ畑・カップルで地中海気分を満喫', rakutenUrl: 'https://travel.rakuten.co.jp/yado/okayama/bizen.html', jalanUrl: 'https://www.jalan.net/330000/' },
    friends: { name: '牛窓 民宿 うしまど荘', reason: '大人数対応の和室・グループで牛窓の海と備前焼体験を楽しむ', rakutenUrl: 'https://travel.rakuten.co.jp/yado/okayama/bizen.html', jalanUrl: 'https://www.jalan.net/330000/' },
  },

};
