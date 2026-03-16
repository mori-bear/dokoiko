# Release Status

生成日: 2026-03-16

## バージョン: 10.3

## QA 結果

| テスト | 結果 |
|---|---|
| データ構造 | PASS 637/637 |
| 交通リンク生成 | PASS 1495/1495 |
| 宿リンクURL生成 | PASS 2093/2093 |
| アフィリエイトURL | PASS 897/897 |
| HTTP接続 | PASS 40/40 |
| ランダムシミュレーション | PASS 100/100 |
| E2E シミュレーション | PASS 7/7 |
| **総計** | **PASS 6098 / FAIL 0** |

## データ統計

| ファイル | 件数 |
|---|---|
| destinations.json | 299 |
| hubs.json | 38 |
| hotelAreas.json | 330 |
| transportGraph.json nodes | 695 |
| transportGraph.json edges | 1287 |

## 公開準備チェックリスト

| 項目 | 状態 |
|---|---|
| どこ行こボタン正常動作 | ✅ |
| 宿リンク正常（楽天・じゃらん） | ✅ PASS 2093/2093 |
| 交通ルート自然（大阪→田辺=鉄道、石垣=飛行機） | ✅ |
| Google Maps 正常（island は港へ） | ✅ |
| JR予約リンク正しい（東日本/西日本/九州/EX） | ✅ |
| Google Flights リンク追加 | ✅ |
| Skyscanner リンク | ✅ |
| フェリー前交通（JR+港Maps） | ✅ |
| 迂回フライトルート除外 | ✅ |
| 飛行機距離条件（近距離非表示） | ✅ |
| 離島 port フィールド整備 | ✅ 39件 |
| データ整合性 | ✅ エラー 0件 |
| E2E テスト | ✅ PASS 7/7 |

## フォルダ構造

```
data/                    JSON データファイル（root ミラー）
  destinations.json      299 destinations
  hubs.json              38 hubs
  hotelAreas.json        330 hotel areas
  transportGraph.json    695 nodes / 1287 edges
  transportHubs.json

src/                     ES module ソース
  config/constants.js
  engine/selectionEngine.js
  transport/transportRenderer.js
  transport/linkBuilder.js
  transport/flightRoutes.js
  transport/airportMap.js
  hotel/hotelLinkBuilder.js
  ui/render.js
  data/                  src ミラー

scripts/                 QA・テストスクリプト
  qa.js
  transportTest.js
  hotelTest.js
  travelE2E.js           E2E シミュレーションテスト

tools/                   マイグレーションツール
  buildGraph.js
  patchGraph.js
  genJalanUrls.js

docs/                    ドキュメント
  release_status.md
  travel_test_report.md
  database_integrity.md
  e2e_test_result.json   E2E テスト結果

index.html / app.js / style.css  (root: GitHub Pages)
```

## 注記

### 宿泊 URL について
ユーザー指定 URL は動作しないことを確認済み:
- `travel.rakuten.co.jp/searchHotelArea.do` → HTTP 404
- `www.jalan.net/yadolist/` → HTTP 404

現在の動作 URL（HTTP 200 確認済み）を維持:
- 楽天: `kw.travel.rakuten.co.jp/keyword/Search.do?f_query=`
- じゃらん: `www.jalan.net/uw/uwp2011/uww2011init.do?keyword=`（Shift-JIS事前エンコード）

### web/ ディレクトリについて
- index.html / app.js / style.css は GitHub Pages (CNAME) の制約によりルートに配置
- web/ ディレクトリへの移動不可（GitHub Pages はルート or /docs ディレクトリのみ）
