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
src/data/destinations.json              マスターデータ（170件 = 38 hub + 132 destination）
src/data/destinations.hubs.json         hub のみ（index.js がフェッチ）
src/data/destinations.destinations.json destination のみ（index.js がフェッチ）
```

destinations.hubs.json と destinations.destinations.json は destinations.json から自動生成する。
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
| weight | hub=0.3〜0.35 / destination=1.2 / island=1.5 |
| distanceStars | 1〜5（東京基準） |
| stayAllowed | ["daytrip","1night","2night"] / spot=[] |
| hotelHub | 宿検索キーワード（destination 必須） |
| hotelSearch | 宿検索補助キーワード（任意） |
| access | 交通情報オブジェクト |

### 宿泊リンク生成（hotelLinkBuilder.js）
- keyword 優先順: hotelHub → hotelSearch → name
- 楽天: `RAKUTEN_AFF + https://travel.rakuten.co.jp/search/?keyword=${encodeURIComponent(keyword)}`
- じゃらん: `VC_BASE + encodeURIComponent('https://www.jalan.net/uw/uwp2011/uww2011init.do?keyword=' + encodeURIComponent(keyword))`
- stayType=daytrip では宿セクション非表示

### 交通ロジック優先順位（transportRenderer.js）
portHubs(島) > ferryGateway > airportGateway > railGateway > car
- 島（isIsland=true）: フェリー + Google Maps + レンタカー自動追加
- 最大3ルート（limitRoutes()）

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
