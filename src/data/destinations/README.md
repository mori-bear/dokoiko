# destinations/ ディレクトリ

## ファイル

- `generated.json` — Wikipedia APIから自動生成された目的地データ

## 生成パイプライン

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

## 注意

- 生成データは `_generated: true` フラグ付き
- 本番 destinations.json にマージする前に手動エンリッチメントが必要:
  - `stayDescription`, `finalAccess`, `transportHubs`, `tags`, `primary`, `onsenLevel` 等
- マージ前に `node scripts/qa.js` で品質検証
