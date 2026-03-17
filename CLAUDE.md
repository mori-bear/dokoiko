# どこいこ — プロジェクト仕様

Project: どこいこ (dokoiiko)
公開予定: 2026-04-01

---

## コンセプト

```
知らない場所に出会う
こんなとこあるんや
こうやって行けるんや
行こ
```

距離と日程だけで未知の街と出会い、そのまま予約完了まで。
目的地はつねに1都市のみ。ポエム禁止、実用重視。

---

## 機能

| 機能 | 内容 |
|------|------|
| ランダム旅行提案 | 出発地・距離・日程から1都市を抽選 |
| 交通リンク | 鉄道・航空・バス・フェリー・レンタカー |
| Google Maps | 出発駅 → 最寄駅のルート |
| 航空券リンク | Skyscanner（400km以上） |
| 宿リンク | 楽天トラベル + じゃらん |

---

## 交通ルール

- `accessStation` 優先でリンク生成
- 島（type: island）は `port` を使用
- JR予約リンクは `railCompany` で分岐
  - `east` → えきねっと
  - `central_west_shikoku` → e5489
  - `kyushu` → 九州ネット予約
  - `null` → 鉄道なし（沖縄など）
- 航空券は distanceLevel 4以上 / 400km超の場合に表示

---

## 宿泊ルール（stayPolicy）

| 値 | 表示 |
|----|------|
| destination | 目的地の宿のみ |
| hub | ハブ都市の宿のみ |
| both | 目的地 + ハブ 両方 |

日帰り（daytrip）時は宿泊リンクを表示しない。

---

## データ構造

### destinations.json (`src/data/destinations.json`)

必須フィールド:

```
id / name / prefecture / region
departures / distanceLevel / type
stayPolicy / transportHubs / railCompany
themes / staySupport / appeal / affiliate
```

### 特殊ルール

- 沖縄目的地: `railCompany = null`
- `type = onsen`: `stayPolicy = destination`
- `type = island`: `stayPolicy = both`
- 日帰り時: `distanceLevel 4・5` を除外

---

## スクリプト

```sh
node scripts/qa.js               # 総合品質テスト
node scripts/transportTest.js    # 交通リンク検証
node scripts/hotelTest.js        # 宿リンク検証
node scripts/e2eTest.js          # E2Eテスト
node scripts/buildGraph.js       # transportGraph 再生成
```

---

## ディレクトリ構成

```
src/
  config/constants.js        出発地・アフィリエイトID
  engine/selectionEngine.js  抽選ロジック
  transport/                 交通リンク生成
  affiliate/hotel.js         宿泊リンク
  data/destinations.json     目的地データ
  ui/                        DOM描画・イベント

data/                        旧データ（参照用）
scripts/                     QA・変換スクリプト
docs/                        設計ドキュメント
pages/                       about / privacy / disclaimer
```

---

## リリース条件

- QA PASS（node scripts/qa.js）
- 宿リンク正常（node scripts/hotelTest.js）
- 交通リンク正常（node scripts/transportTest.js）
