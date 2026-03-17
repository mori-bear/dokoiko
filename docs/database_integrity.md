# Database Integrity Report

生成日: 2026-03-16

## データ件数

| ファイル | 件数 |
|---|---|
| destinations.json | 299 |
| hubs.json | 38 |
| hotelAreas.json | 330 |

## destinations 地方別分布

| 地方 | 件数 |
|---|---|
| 中部 | 59 |
| 九州 | 44 |
| 東北 | 33 |
| 中国 | 32 |
| 近畿 | 31 |
| 関東 | 27 |
| 四国 | 27 |
| 北海道 | 22 |
| 沖縄 | 19 |
| 伊豆諸島 | 6 |

## 旅先タイプ

| タイプ | 件数 |
|---|---|
| 離島 (isIsland) | 39 |
| 温泉地 (onsen) | 67 |
| 日帰り専用 | 99 |

## 整合性チェック結果

| チェック項目 | 結果 |
|---|---|
| destination ID重複 | ✅ 0件 |
| destination 名前重複 | ✅ 0件 |
| hotelArea参照ミス | ✅ 0件 |
| hub参照ミス | ✅ 0件 (10件修正済み) |
| 必須フィールド欠損 | ✅ 0件 |
| lat/lng範囲外 | ✅ 0件 |

## dual-role（destination + hub両立）

CLAUDE.md仕様: 同一都市がdestinationとhubに存在することは正常。

現在のdual-role都市: 0件（石垣島・那覇・高松・函館は片方のみ）

## hotelAreas フィールド構成

```json
{
  "id": "tono",
  "prefecture": "岩手県",
  "city": "遠野市",
  "rakutenKeyword": "岩手県 遠野市",
  "jalanKeyword": "岩手県 遠野市",
  "jalanUrl": "https://www.jalan.net/uw/uwp2011/uww2011init.do?keyword=..."
}
```

## QA総合結果

| テスト | 結果 |
|---|---|
| データ構造 | PASS 637/637 |
| 交通リンク生成 | PASS 1495/1495 |
| 交通整合性 | PASS 35/35 |
| 宿リンクURL生成 | PASS 2093/2093 |
| アフィリエイトURL | PASS 897/897 |
| HTTP接続 | PASS 40/40 |
| ランダムシミュレーション(200回) | PASS 200/200 |
| **総計** | **PASS 6198 / FAIL 0** |
