# Travel Test Report

生成日: 2026-03-16

## QA 総合結果

| テスト | 結果 |
|---|---|
| データ構造 | PASS 637/637 |
| 交通リンク生成（299件 × 5出発地） | PASS 1495/1495 |
| 交通整合性（代表ルート） | PASS 35/35 |
| 宿リンクURL生成 | PASS 2093/2093 |
| アフィリエイトURL形式 | PASS 897/897 |
| HTTP接続 | PASS 40/40 |
| UI整合（daytrip宿非表示） | PASS 43/43 |
| 二次交通文字列チェック | PASS 120/120 |
| transportGraph BFS | PASS 13/13 |
| GoogleMaps URL | PASS 598/598 |
| ランダムシミュレーション | PASS 100/100 |
| **総計** | **PASS 6098 / FAIL 0** |

## E2E シミュレーションテスト（scripts/travelE2E.js）

| ルート | 交通 | 宿リンク | Google Maps |
|---|---|---|---|
| 大阪 → 甑島 | ✅ JR九州（川内）+ フェリー（川内港） | ✅ | ✅ 大阪駅 → 川内港 |
| 大阪 → 石垣島 | ✅ 飛行機（伊丹→石垣）+ Skyscanner + Google Flights | ✅ | ✅ 大阪駅 → 石垣空港 |
| 大阪 → 田辺 | ✅ 鉄道（紀伊田辺）/ 迂回フライトはrenderで除外 | ✅ | ✅ 大阪駅 → 紀伊田辺駅 |
| 高松 → 道後温泉 | ✅ 鉄道（高松→道後温泉） | ✅ | ✅ 高松駅 → 道後温泉駅 |
| 大阪 → 屋久島 | ✅ 飛行機（伊丹→屋久島）+ フェリー | ✅ | ✅ 大阪駅 → 鹿児島港 |
| 東京 → 石垣島 | ✅ 飛行機（羽田→石垣）+ Skyscanner + Google Flights | ✅ | ✅ 東京駅 → 石垣空港 |
| 鹿児島 → 屋久島 | ✅ 飛行機（鹿児島→屋久島）追加 | ✅ | ✅ 鹿児島中央駅 → 鹿児島港 |

**E2E 結果: PASS 7 / FAIL 0**

## データ整合性チェック

| チェック項目 | 結果 |
|---|---|
| destination ID 重複 | 0件 ✅ |
| destination 名前重複 | 0件 ✅ |
| hotelArea 参照ミス | 0件 ✅ |
| hub 参照ミス | 0件 ✅ |
| transportGraph stale ノード | 0件 ✅ |
| 必須フィールド欠落 | 0件 ✅ |
| stayAllowed 非配列 | 0件 ✅ |
| 離島で交通手段なし | 0件 ✅ |

## ルート別動作確認

| ルート | 交通 | 宿リンク | Google Maps |
|---|---|---|---|
| 大阪 → 石垣島 | ✅ 飛行機（伊丹→石垣）+ Skyscanner + Google Flights | ✅ | ✅ 石垣空港 |
| 大阪 → 甑島 | ✅ JR九州（川内）+ フェリー（川内港） | ✅ | ✅ 川内港 |
| 大阪 → 田辺 | ✅ 鉄道（紀伊田辺）/ 飛行機迂回ルート除外 | ✅ | ✅ |
| 大阪 → 屋久島 | ✅ 飛行機（伊丹→屋久島） | ✅ | ✅ |
| 東京 → 石垣島 | ✅ 飛行機（羽田→石垣）+ Skyscanner + Google Flights | ✅ | ✅ |
| 鹿児島 → 屋久島 | ✅ 飛行機（鹿児島→屋久島）追加 | ✅ | ✅ |

## 修正内容（このセッション）

### TASK1: フォルダ構造整理
- JSON データファイルを `data/` ルートディレクトリへ移動
- QA/テストスクリプトを `scripts/` へコピー
- マイグレーションツールを `tools/` へコピー
- app.js・qa.js のフェッチパスを `./src/data/` → `./data/` に更新
- web ファイル（index.html, app.js, style.css）は GitHub Pages 制約のため root に維持

### TASK2/3: 宿泊リンクURL
- `travel.rakuten.co.jp/searchHotelArea.do` → HTTP 404 確認済み
- `www.jalan.net/yadolist/` → HTTP 404 確認済み
- **現在の動作URL（kw.travel.rakuten.co.jp, uwp2011）を維持**
- 楽天・じゃらん全 2093 件 PASS 確認済み

### TASK4: 離島 port フィールド追加
- 39 件の離島 destination に `port` フィールド追加（`ferryGateway || null`）
- 飛行機のみの離島（石垣・宮古・伊良部）は `port: null`

### TASK5: Island の Google Maps 目的地修正
- island 判定時、Google Maps の目的地を `city.ferryGateway`（港）に変更
- 例: 甑島 → `川内港へのルート（Googleマップ）`

### TASK6: フェリー前交通（島）
- `getIslandJR()` 関数追加：`city.hubStation` を使って港付近の駅への JR リンクを生成
- `getFerry()` の Google Maps 起点を `hubStation` に変更
- 例: 大阪→甑島 → JR九州（大阪→川内）+ Google Maps（川内駅→川内港）+ フェリー
- 屋久島: `ferryGateway: '鹿児島港'`, `hubStation: '鹿児島中央駅'` 追加

### TASK7: accessStation から railGateway フォールバック
- 豊後高田: `railGateway: '宇佐駅'` 追加（`accessStation: '宇佐駅'` があったが null だった）

### TASK8: JR+EX デュアルリンク
- `EX_CITIES` 出発地の場合、地域 JR リンクに加えて スマートEX リンクを追加
- 例: 大阪→仙台 → e5489 + スマートEX
- BFS 鉄道パス・fallback getRail・getIslandJR すべてに適用

### TASK9: Google Flights 追加
- `buildGoogleFlightsLink()` を linkBuilder.js に追加
- 飛行機ルート（BFS・fallback）で Skyscanner と並列表示
- URL: `https://www.google.com/flights#search;f={fromIata};t={toIata};tt=o`
- render.js に `btn-google-flights` クラス追加（青色 #1a73e8）

### TASK10: 飛行機距離条件
- 非離島の場合 distanceStars < 3（400km以下）は飛行機リンク非表示
- 島（isIsland=true / destType=island）は距離に関わらず飛行機表示

### TASK11: 迂回フライトルート除外
- `pathToLinks` で `fromIata !== CITY_AIRPORT[departure]` の場合スキップ
- 例: 大阪→田辺で東京経由 HND→SHM の誤ルートを除外

### TASK12: E2E シミュレーションテスト
- `scripts/travelE2E.js` 作成・PASS 7/7 確認
- 迂回フライトフィルターをE2Eチェックにも適用（transportRendererと同じロジック）

### TASK13: 200-random QA
- PASS 100 / FAIL 0

### TASK14: データ整合性
- destination ID 重複: 0件
- destination 名前重複: 0件
- hotelArea 参照ミス: 0件
- hub 参照ミス: 0件
- transportGraph stale ノード: 0件

### その他
- KOJ（鹿児島）→ KUM（屋久島）JAC 路線を flightRoutes.js と transportGraph.json に追加
- limitRoutes 再設計: skyscanner・google-flights はメイン3枠外に
