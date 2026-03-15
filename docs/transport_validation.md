# Transport Validation Report

生成日: 2026-03-15

## transportGraph.json 統計

| 項目 | 値 |
|---|---|
| 総ノード数 | 699 |
| 総エッジ数 | 1292 |
| hub:ノード | 197 |
| station:ノード | 181 |
| airport:ノード | 46 |
| ferry:ノード | 0 |

## BFSルート検証（QA結果）

| ルート | 結果 |
|---|---|
| 東京→上高地 | ✅ PASS |
| 大宮→乳頭温泉 | ✅ PASS |
| 名古屋→馬籠 | ✅ PASS |
| 高松→志々島 | ✅ PASS |
| 大阪→与那国島 | ✅ PASS |
| 大阪→那須 | ✅ PASS |

## QA 200回ランダムシミュレーション

| 指標 | 値 |
|---|---|
| 実行回数 | 200 |
| PASS | 200 |
| FAIL | 0 |
| 交通リンク0件 | 0 |
| 宿リンク不正 | 0 |
| GoogleMaps不正 | 0 |

## hub参照整合性

destinations.json の hub フィールドは全299件 hubs.json の有効IDを参照。

直近修正（hub参照ミス10件）:

| destination | 旧hub | 新hub |
|---|---|---|
| 吉野, 田辺 | nara | osaka-t |
| 熊野 | nara | nagoya-t |
| 西表島 | ishigaki | naha |
| 飛騨古川 | takayama-o | gifu |
| 豊後高田 | beppu | fukuoka-t |
| 伊豆高原 | atami | tokyo-o |
| 志々島 | takamatsu-t | takamatsu |
| 大船渡, 久慈 | ichinoseki/hachinohe | morioka |