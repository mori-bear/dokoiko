# destinations/ ディレクトリ

## ファイル

- `generated.json` — Wikipedia APIから自動生成された目的地データ（最低限フィールド）
- `enriched.json`  — `generated.json` をUI使用可能な品質に自動エンリッチしたデータ

## 2段階パイプライン

### Stage 1: 生成（generate）

```bash
# テストモード（北海道のみ・約1分）
node scripts/generateDestinations.js --test

# 本番実行（全47都道府県 × 9カテゴリ・数十分〜1時間）
node scripts/generateDestinations.js
```

### 処理フロー

1. 都道府県 × カテゴリ（温泉/島/山/観光地/滝/湖/城/神社/寺院）で Wikipedia API 取得
2. 正規化（括弧内除去・空白除去）
3. 既存 `destinations.json` との重複排除
4. ページの緯度経度取得
5. `generated.json` に出力

### 出力フィールド

```json
{
  "id": "gen_北海_阿寒湖温泉",
  "name": "阿寒湖温泉",
  "displayName": "阿寒湖温泉",
  "prefecture": "北海道",
  "region": "北海道",
  "lat": 43.43,
  "lng": 144.09,
  "destType": "onsen",
  "hubCity": "札幌",
  "fallbackCity": "札幌",
  "isStayable": true,
  "_generated": true,
  "_source": "wikipedia"
}
```

### Stage 2: エンリッチ（enrich）

```bash
# generated.json → enriched.json
node scripts/enrichDestinations.js
```

自動付与する項目:
- `stayDescription` / `description` / `catch` — destType別テンプレ
- `finalAccess` — train/ferry/bus の構造化オブジェクト
- `transportHubs` / `accessStation` / `gateway` — 都道府県別代表駅
- `railProvider` / `jrArea` — 都道府県別JR系統
- `tags` / `primary` / `secondary` — destType別固定セット
- `weight` — onsen 1.5 > island 1.3 > mountain 1.2 > sight 1.0
- `stayPriority` / `onsenLevel` / `departures` — デフォルト値
- `isIsland` / `requiresCar` 等のフラグ

### 一括実行

```bash
node scripts/generateDestinations.js && node scripts/enrichDestinations.js
```

## マージ手順

```bash
# 1. パイプライン実行
node scripts/generateDestinations.js
node scripts/enrichDestinations.js

# 2. 本番マージ（手動）
# src/data/destinations.json に src/data/destinations/enriched.json を結合
# ※ _generated/_enriched フラグで識別可能

# 3. QA検証
node scripts/qa.js
```

## 注意

- `_generated: true` / `_enriched: true` フラグで自動生成物を識別
- エンリッチ結果は UI で即使用可能な品質（全必須フィールド埋め）
- 品質を高めたい場合は手動で `finalAccess.line`, `stayDescription`, `spots` 等を上書き
