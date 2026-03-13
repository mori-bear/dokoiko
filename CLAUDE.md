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
src/data/destinations.json              マスターデータ（200件 destination）
src/data/hubs.json                      hub のみ（38件）
src/data/destinations.destinations.json destination のみ（index.js がフェッチ）
src/data/destinations.hubs.json         hub のみ（index.js がフェッチ）
```

destinations.hubs.json と destinations.destinations.json は destinations.json / hubs.json から自動生成する。
マスターを編集したら必ず両方を再生成すること。

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
| region | 地方名 |
| lat | 緯度（Google Maps 座標用） |
| lng | 経度（Google Maps 座標用） |
| weight | hub=0.3〜0.35 / destination=1.2 / island=1.5 |
| distanceStars | 1〜5（東京基準） |
| stayAllowed | ["daytrip","1night","2night"] / spot=[] |
| stayBias | 0=daytrip推奨 / 1=1night / 2=2night（抽選バイアス） |
| hotelHub | 宿検索キーワード（destination 必須） |
| hotelSearch | 宿検索補助キーワード（任意） |
| gatewayHub | 二次交通起点（バス・ローカル線の乗換駅名） |
| airportHub | 航空乗継ハブ（多ホップ飛行経由都市名） |
| railProvider | JR予約先: 'ekinet'|'e5489'|'jrkyushu'|null |
| access | 交通情報オブジェクト |

### 宿泊リンク生成（src/hotel/hotelLinkBuilder.js）
- keyword 優先順: hotelHub → hotelSearch → name
- 楽天: `RAKUTEN_AFF + https://travel.rakuten.co.jp/package/search/?keyword=${encodeURIComponent(keyword)}`
- じゃらん: `VC_BASE + encodeURIComponent('https://www.jalan.net/uw/uwp2011/uww2011init.do?keyword=' + encodeURIComponent(keyword))`
- stayType=daytrip では宿セクション非表示

### 交通ロジック（transportRenderer.js）

フロー: 出発地 → 長距離交通（新幹線/飛行機/高速バス） → gatewayHub → 二次交通（bus/ferry/car） → destination

優先順位（resolveTransportLinks）:
1. 島かつフェリーあり: 飛行機（直行 or airportHub経由）+ フェリー + レンタカー
2. ★1 近場: Google Maps 1本のみ（lat/lng 座標使用）
3. 通常: JR → 高速バス → 飛行機 → フェリー → 二次交通
- 最大3ルート（limitRoutes(3)）

### secondaryTransport フィールド
- 型: 文字列 `'bus'|'ferry'|'car'`（旧object形式は廃止）
- gatewayHub がある destination は必須
- transportRenderer は railGateway → destination 間の二次交通として使用

### airportHub フィールド
- 多ホップ飛行の中継都市名（例: 与那国島→'那覇'）
- AIRPORT_HUB_GATEWAY（linkBuilder.js）で都市名→空港名を解決
- 直行便がない場合の fallback として使用

### Google Maps リンク（linkBuilder.js）
`buildGoogleMapsLink(origin, destination, mode, label, coords)`:
- coords = {lat, lng} を渡すと destination を `{lat},{lng}` 形式にする
- ★1 近場かつ railGateway なしの場合は city.lat/lng を自動使用
- フォールバック時も coords を使用

## ディレクトリ構成
```
src/config/constants.js          DEPARTURES, DEPARTURE_CITY_INFO
src/engine/selectionEngine.js    抽選：重み付きシャッフル＋nearestHubフォールバック
src/engine/distanceCalculator.js 距離計算（★1〜★3）
src/engine/distanceEngine.js     distanceCalculator.js の再エクスポートラッパー
src/transport/transportRenderer.js  交通リンクアセンブラ
src/transport/linkBuilder.js        GoogleMaps/JR/Skyscanner/レンタカーリンク生成
src/hotel/hotelLinkBuilder.js    宿泊リンク（楽天/じゃらん）← src/engine/ からコピー
src/engine/hotelLinkBuilder.js   宿泊リンク（後方互換用に残す）
src/data/hubs.json               38 hub都市
src/data/destinations.json       200 destination
src/data/spots.json              空（0件）
src/data/index.js                hubs.json + destinations.json をフェッチして結合
src/ui/render.js                 DOM描画
src/ui/handlers.js               イベントバインド
pages/about.html / privacy.html / disclaimer.html
index.html / style.css / app.js / qa.js
CLAUDE.md                        プロジェクトルール
```

## 禁止事項
- 複数都市同時表示禁止
- 0件メッセージ禁止（必ず1件返す）
- console.log 禁止（本番コード）
- グローバル汚染禁止（ES modules）
- Yahoo 乗換禁止

## 開発環境
```bash
npx serve . → http://localhost:3000
node qa.js  → QA チェック（FAIL=0 が目標）
```
