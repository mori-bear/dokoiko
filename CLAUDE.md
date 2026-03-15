# CLAUDE.md — どこ行こ？ プロジェクトルール

## 自動実行ルール（毎回確認不要）
- YES/NO 確認を出さない
- 途中で停止しない
- ファイル編集は自動実行する
- 自己レビュー → 差分修正 → 影響範囲確認 → commit → push を一気通貫で完結させる

## 品質基準
- 旅行サイトとして現実的な結果を出す（架空ルート禁止）
- 交通ロジックを壊さない（transportRenderer.js の優先順位を維持）
- アフィリエイトリンクを壊さない（Rakuten・じゃらん URL 形式を維持）
- QA FAIL = 0 を常に維持する（qa.js で確認）

## データ構造

### ファイル構成
```
src/data/destinations.json              マスターデータ（300件 destination）
src/data/hubs.json                      hub のみ（38件）
```

### 3階層構造
```
hub（宿泊拠点都市）           例: 金沢, 松山, 高山
  └ destination（観光エリア）  例: 白川郷, 城崎温泉, 美保関  → hotelHub 必須
      └ spot（ピンポイント）   例: 下灘駅（現在データなし）  → stayAllowed:[] で抽選除外
```

### 必須フィールド
| フィールド | 説明 |
|---|---|
| id | ユニーク文字列（kebab-case） |
| name | 都市名（ユニーク） |
| type | "hub" / "destination" / "spot" |
| prefecture | 都道府県名 |
| city | 市区町村名（宿検索 fallback 用） |
| region | 地方名 |
| lat | 緯度（Google Maps 座標用） |
| lng | 経度（Google Maps 座標用） |
| weight | hub=0.3〜0.35 / destination=1.2 / island=1.5 |
| distanceStars | 1〜5（東京基準） |
| stayAllowed | ["daytrip","1night","2night"] / spot=[] |
| stayBias | 0=daytrip推奨 / 1=1night / 2=2night（抽選バイアス） |
| hotelHub | 宿検索キーワード（destination 必須。温泉名・エリア名など） |
| hotelSearch | 宿検索補助キーワード（任意） |
| gatewayHub | 二次交通起点（バス・ローカル線の乗換駅名） |
| airportHub | 航空乗継ハブ（多ホップ飛行経由都市名） |
| railProvider | JR予約先: 'ekinet'\|'e5489'\|'jrkyushu'\|null |
| access | 交通情報オブジェクト |

## 宿泊リンク生成仕様（唯一の正式仕様）

> **この仕様が正式。矛盾する古い仕様が他に存在する場合はこちらが優先。**

### 実装ファイル
- `src/hotel/hotelLinkBuilder.js` — app.js が import するメインファイル
- `src/engine/hotelLinkBuilder.js` — qa.js 用（src/hotel/ と完全同期すること）

### 検索キーワード（固定ルール）
```
keyword = prefecture + " " + city
```

例:
- 草津温泉 → `群馬県 草津町`
- 城崎温泉 → `兵庫県 豊岡市`
- 石垣島  → `沖縄県 石垣市`
- 遠野    → `岩手県 遠野市`

### 楽天トラベル検索 URL（正式・唯一）
```
https://kw.travel.rakuten.co.jp/keyword/Search.do?f_query=${encodeURIComponent(prefecture + " " + city)}
```
- アフィリエイト経由: `RAKUTEN_AFF + target`（raw URL 連結、target を encode しない）
- RAKUTEN_AFF: `https://hb.afl.rakuten.co.jp/hgc/5113ee4b.8662cfc5.5113ee4c.119de89a/?pc=`
- パラメータ: `f_query`（旧 `f_keyword` は禁止）

### じゃらん検索 URL（正式・唯一）
```
https://www.jalan.net/uw/uwp2011/uww2011init.do?keyword={Shift-JIS encoded keyword}
```
- アフィリエイト経由: `VC_BASE + encodeURIComponent(target)`（二重エンコード正）
- VC_BASE: `https://ck.jp.ap.valuecommerce.com/servlet/referral?sid=3764408&pid=892559858&vc_url=`
- **Shift-JIS エンコード必須**: ブラウザ側では不可能なため `hotelAreas.json` の `jalanUrl` に事前計算済みURLを格納
- `_gen_jalan_urls.js` で hotelAreas.json 全件の jalanUrl を再生成する
- **`uwp1700` / `uww1701.do` は使用禁止**（観光MAPを表示するため宿一覧にならない）
- **`uwp2011` / `uww2011init.do` が正式ホテルキーワード検索**（Jalan の検索フォームが使用する）

### stayType=daytrip では宿セクション非表示（render.js 側で制御）

## 交通ロジック（transportRenderer.js）

フロー: 出発地 → 長距離交通（新幹線/飛行機/高速バス） → gatewayHub → 二次交通（bus/ferry/car） → destination

優先順位（resolveTransportLinks）:
1. transportGraph BFS ルート探索（初期化済みの場合）
2. フィールドベース fallback（旧ロジック）

BFS 優先順位: 島フェリー > 鉄道 > 飛行機 > フェリー
最大3ルート（limitRoutes(3)）

### 航空券リンク（Skyscanner）
- 出発地の空港: `DEPARTURE_CITY_INFO[departure].iata`
- 就航路線チェック: `FLIGHT_ROUTES[fromIata].includes(toIata)` で路線存在を必ず確認
- 路線が存在しない場合は Skyscanner ボタン非表示
- ラベル例: `航空券を比較する（伊丹 → 那覇）`
- 最大1ボタン（limitRoutes で skyscanner スライス 1 本）

### Google Maps リンク
- `buildGoogleMapsLink(originStation, accessStation, 'transit')`
- 最大1ボタン（limitRoutes で google-maps スライス 1 本）

### secondaryTransport フィールド
- 型: 文字列 `'bus'|'ferry'|'car'`（旧object形式は廃止）
- gatewayHub がある destination は必須
- transportRenderer は railGateway → destination 間の二次交通として使用

## ディレクトリ構成
```
src/config/constants.js          DEPARTURES, DEPARTURE_CITY_INFO
src/engine/selectionEngine.js    抽選：重み付きシャッフル＋nearestHubフォールバック
src/engine/distanceCalculator.js 距離計算（★1〜★3）
src/transport/transportRenderer.js  交通リンクアセンブラ（BFS + フォールバック）
src/transport/linkBuilder.js        GoogleMaps/JR/Skyscanner/レンタカーリンク生成
src/transport/airportMap.js         出発都市→IATA マップ
src/transport/flightRoutes.js       就航路線データ（出発IATA→着IATA配列）
src/hotel/hotelLinkBuilder.js    宿泊リンク（楽天/じゃらん）← app.js が import
src/engine/hotelLinkBuilder.js   宿泊リンク（qa.js 用 / src/hotel/ と完全同期）
src/data/hubs.json               38 hub都市
src/data/destinations.json       300 destination
src/data/hotelAreas.json         330エリア（jalanUrl: Shift-JIS事前エンコード済み）
src/data/index.js                hubs.json + destinations.json をフェッチして結合
src/ui/render.js                 DOM描画
src/ui/handlers.js               イベントバインド
pages/about.html / privacy.html / disclaimer.html
index.html / style.css / app.js / qa.js
CLAUDE.md                        プロジェクトルール（唯一の仕様書）
```

## 禁止事項
- 複数都市同時表示禁止
- 0件メッセージ禁止（必ず1件返す）
- console.log 禁止（本番コード）
- グローバル汚染禁止（ES modules）
- Yahoo 乗換禁止
- じゃらん旧 URL `uwp1700` / `uww1701.do` 禁止（観光MAP表示のため）
- 楽天旧パラメータ `f_keyword` 禁止

## 開発環境
```bash
npx serve . → http://localhost:3000
node qa.js  → QA チェック（FAIL=0 が目標）
```
