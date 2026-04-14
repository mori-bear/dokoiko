# destinations/ ディレクトリ

## ファイル

- `generated.json` — Wikipedia APIから自動生成された目的地データ（最低限フィールド）
- `enriched.json`  — `generated.json` をUI使用可能な品質に自動エンリッチしたデータ

## 完全自動パイプライン

```bash
# 一発実行（generate → enrich → merge → dedupe → validate）
node scripts/generateDestinations.js --batch=200 --auto-merge
```

処理フロー:
```
Wikipedia API
     ↓ generate
generated.json
     ↓ enrich
enriched.json
     ↓ merge（destinations.json に追加・id重複は既存優先・安全ガード）
destinations.json
     ↓ dedupe（name + prefecture で重複排除）
destinations.json（重複なし）
     ↓ validate（structure のみ）
最終件数ログ
```

## 個別ステップ実行

```bash
# ステージ1: 生成
node scripts/generateDestinations.js --batch=500

# ステージ2: エンリッチ
node scripts/enrichDestinations.js

# ステージ3: マージ
node scripts/mergeDestinations.js

# ステージ4: 重複排除
node scripts/deduplicateDestinations.js --apply

# ステージ5: 検証
node scripts/validateStructure.js
```

## 自動ガード

- **安全ガード**: name/lat/lng/destType 欠損はスキップ
- **日本範囲外除外**: lat<24 or lat>46 / lng<122 or lng>146（北方領土等）
- **id重複保護**: 既存 destinations.json を優先
- **name+prefecture重複**: 手動登録（`_generated` フラグなし）を優先

## 注意：本番QA通過には追加エンリッチが必要

完全自動生成データは既存 `node scripts/qa.js` の厳密チェックに未対応:
- `travelTime` / `stayRecommendation` 未設定
- `island` の `ferryGateway` 整合性（ports.json との紐づけ）
- catch文字数制限（30文字以内）

推奨運用:
1. `--auto-merge` でstaging環境（別ファイル）にマージ
2. 手動で不足フィールドを補完
3. QA通過後に本番 destinations.json にマージ

## 出力フィールド（enriched）

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
  "stayDescription": "温泉に2回入って、部屋でゆっくりして寝る",
  "tags": ["温泉", "自然", "街歩き"],
  "primary": ["温泉"],
  "weight": 1.5,
  "stayPriority": "high",
  "onsenLevel": 2,
  "accessStation": "札幌駅",
  "railProvider": "ekinet",
  "finalAccess": { "type": "train", "line": "在来線", "to": "阿寒湖温泉" },
  "_generated": true,
  "_enriched": true,
  "_source": "wikipedia"
}
```
