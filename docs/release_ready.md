# どこいこ — リリース準備レポート

> 作成日: 2026-03-16
> QA実行: node scripts/qa.js / node scripts/e2eTest.js --bfs-only

---

## 公開可能か

**✅ 公開可能**

全QAチェック 6098件 PASS / FAIL 0

---

## QA 結果サマリ

| チェック項目 | 結果 |
|------------|------|
| データ構造検証 | PASS 637 / FAIL 0 |
| 交通リンク生成（1495組） | PASS 1495 / FAIL 0 |
| 交通整合性 | PASS 35 / FAIL 0 |
| 宿リンク URL 生成（2093件） | PASS 2093 / FAIL 0 |
| アフィリエイト URL 形式 | PASS 897 / FAIL 0 |
| HTTP 接続テスト | PASS 40 / FAIL 0 |
| UI 整合（daytrip 宿非表示） | PASS 43 / FAIL 0 |
| BFS 交通到達 | PASS 13 / FAIL 0 |
| GoogleMaps URL | PASS 598 / FAIL 0 |
| ランダムシミュレーション 100回 | PASS 100 / FAIL 0 |
| **特定ルート検証 5件** | **PASS 5 / FAIL 0** |
| ユーザーシミュレーション 78件 | PASS 78 / FAIL 0 |

---

## 今回実施した修正

### TASK1: 交通ロジック検証
5ルートすべて PASS:

| ルート | 検証結果 |
|--------|---------|
| 高松 → 道後温泉 | ✅ JR(5489) + Google Maps |
| 高松 → 牛窓 | ✅ JR(5489) + Google Maps |
| 東京 → 石垣島 | ✅ フライト(HND→ISG) + Google Maps |
| 大阪 → 田辺 | ✅ JR(5489) + Google Maps |
| 大阪 → 屋久島 | ✅ フライト(ITM→KUM) + フェリー + Google Maps |

### TASK2: 島ルール修正
- Google Maps 先の優先順位: `port → airportGateway → accessStation`
- 屋久島: 鹿児島港へのルート ✅
- 石垣島: 石垣空港へのルート ✅

### TASK3: JR予約リンク改善
| 変更前 | 変更後 |
|--------|--------|
| e5489 | 5489（JR西日本） |
| 九州ネット予約 | JR九州予約 |
| えきねっと | えきねっと（変更なし） |

### TASK4: 楽天リンク修正
- キーワード解決順を改善: `hotelSearch → hotelHub → prefecture+city`
- encodeURIComponent は全経路で適用済み

### TASK5: 航空券ボタン改善
- フォールバック時の空港 IATA を `CITY_AIRPORT` から取得
- `大阪 → OSA` 表示 → `大阪 → 伊丹` 表示に改善
- `東京 → TYO` → `東京 → 羽田` に改善

### TASK6: ユーザーシミュレーション
| 出発地 | プール数 | サンプル | 結果 |
|--------|---------|---------|------|
| 東京 | 68件 | 20件 | PASS 20/20 |
| 大阪 | 55件 | 20件 | PASS 20/20 |
| 高松 | 18件 | 18件 | PASS 18/18 |
| 福岡 | 34件 | 20件 | PASS 20/20 |

---

## 既知の残課題（リリースブロッカーではない）

### BFS 到達不可（97件）
多くは `destination:xxx` グラフノード未登録。
フィールドベースフォールバックで実用上は動作している。

**主な対象:**
- 秩父、奥多摩、大洗（関東近郊）
- 越後湯沢、糸魚川（北陸・甲信越）
- 嵐山、信楽（近畿）
- 柳川、吉野ヶ里（九州）
- 恩納村、名護、読谷村（沖縄）

対応: graph ノード追加で解決可能（post-launch タスク）

### travelTime 整合性（124件不整合）
stayRecommendation と travelTime の refMin 値がズレている。
ランダム抽選ロジックには影響するが、リンク生成には無影響。

対応: destinations.json の `stayRecommendation` 値を修正（post-launch タスク）

### 高松出発プール（18件）
他出発地より少ない。魅力的な四国近郊目的地を追加で拡充推奨。

---

## 改善候補（post-launch）

| 優先度 | 内容 |
|-------|------|
| High | BFS グラフ 97件のノード追加 |
| High | travelTime / stayRecommendation 整合修正（124件） |
| Medium | 高松・松山・徳島出発プール拡充 |
| Medium | destinations.json の `departures: []` 解消（全件確認） |
| Low | EX-IC ボタン（スマートEX）ラベル改善 |
| Low | FERRY_LINKS への未登録港追加 |
| Low | Google Flights リンクの実路線確認 |

---

## リリースチェックリスト

- [x] QA PASS（node scripts/qa.js）
- [x] 宿リンク正常（楽天 + じゃらん）
- [x] 交通リンク正常（JR / 飛行機 / フェリー）
- [x] Google Maps URL 正常
- [x] 特定ルート 5件 PASS
- [x] ユーザーシミュレーション PASS
- [x] JR予約リンクラベル修正済み
- [x] 島ルール修正済み
- [x] 航空券ボタン空港名表示修正済み
- [ ] 本番環境 HTTPS 動作確認（ローカル serve で確認推奨）

---

## 実行コマンド

```sh
# 全 QA
node scripts/qa.js

# 交通・BFS 検証（高速）
node scripts/e2eTest.js --bfs-only

# 開発サーバー
npx serve .
```
