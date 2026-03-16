# Release Status

生成日: 2026-03-16

## バージョン: 10.2

## 修正内容（このセッション）

### バグ修正
- **石垣島 Skyscanner リンク修正**: `pathToLinks` の `fromIata` を BFS エッジ (`airport:HND`) から取得するよう修正。`fromCity.iata` = `TYO` だと `FLIGHT_ROUTES['TYO']` が存在せず Skyscanner が非表示になっていた。

### データ整合性
- `transportGraph.json` から削除済み destination の stale ノード 4 件除去（noto, sanriku, yunomineonsen, tobe）+ 関連エッジ 6 件除去
- `src/data/destinations.json.bak` / `destinations_v2.json` 削除

## QA 結果

| テスト | 結果 |
|---|---|
| データ構造 | PASS 637/637 |
| 交通リンク生成 | PASS 1495/1495 |
| 交通整合性 | PASS 35/35 |
| 宿リンクURL生成 | PASS 2093/2093 |
| アフィリエイトURL | PASS 897/897 |
| HTTP接続 | PASS 40/40 |
| ランダムシミュレーション | PASS 100/100 |
| **総計** | **PASS 6098 / FAIL 0** |

## データ統計

| ファイル | 件数 |
|---|---|
| destinations.json | 299 |
| hubs.json | 38 |
| hotelAreas.json | 330 |
| transportGraph.json nodes | 695 |
| transportGraph.json edges | 1286 |

## 公開準備状態

- QA FAIL: 0
- 石垣島 Skyscanner: 表示
- 宿リンク（楽天・じゃらん）: 全299件 PASS
- アフィリエイト URL 形式: PASS
- GitHub Pages: index.html 配置済み
