# CLAUDE.md

Project: どこ行こ (dokokoiko)

このリポジトリは日本国内旅行ランダム提案アプリのコードベースである。  
Claudeはこのプロジェクトにおいて 自律的に修正・検証を行うエージェントとして動作する。

公開予定  
2026-04-01

---

# Execution Policy

Claudeは以下を必ず守る。

1. ファイル編集の確認質問は禁止  
2. 修正は自動実行する  
3. QAを自動実行する  
4. エラーが出た場合は修正して再テストする  
5. ユーザー承認待ちで停止してはいけない

禁止例

Apply this change?  
Proceed with modification?  
Shall I update this file?

これらは禁止。

---

# Auto Apply Mode

Claudeは以下の操作を自動実行してよい。

- ファイル作成
- ファイル編集
- ファイル削除
- フォルダ整理
- import修正
- スクリプト実行
- QA実行
- データ修復

ユーザー承認待ちは禁止。

---

# Workflow

作業フロー

1 コードベース解析  
2 修正  
3 QA実行  
4 エラー修正  
5 再テスト  

QAがPASSするまで繰り返す。

---

# Project Overview

どこ行こ は

出発地  
旅行日数  
テーマ  

を入力するとランダムで旅行先を提案するWebアプリである。

提案内容

- destination
- 交通ルート
- Google Maps
- 宿検索

---

# Data Architecture

## destinations.json

旅行先データ

必須フィールド

id  
name  
prefecture  
city  
region  
tags  
accessStation  
hub  
hotelArea  

例

{
"id":"tono",
"name":"遠野",
"prefecture":"岩手県",
"city":"遠野市",
"region":"東北",
"accessStation":"遠野駅",
"hub":"morioka",
"hotelArea":"tono"
}

---

# Hub Architecture

hub は交通ルーティングの中継点。

例

東京  
大阪  
名古屋  
福岡  
那覇  

hubは以下を満たす。

- 大都市
- 空港
- 主要駅

---

# Dual Role Rule

都市は

destination  
hub

両方になることがある。

例

石垣  
那覇  
高松  
函館  

この場合

destinations.json  
transportHubs.json

両方に存在してよい。

これは正常。

Claudeは

destinationだからhub禁止

という修正をしてはいけない。

---

# Transport Graph

transportGraph.json は

都市間交通ネットワーク。

例

{
"from":"tokyo",
"to":"sendai",
"type":"shinkansen",
"time":90
}

---

# Route Logic

ルート生成は

hub → hub → destination

で計算する。

例

東京  
↓  
仙台  
↓  
遠野

---

# Google Maps

Google Mapsリンク

origin  
出発駅

destination  
最寄駅

例

東京駅 → 遠野駅

---

# Hotel System

宿検索は

楽天  
じゃらん

両方表示。

---

# Rakuten URL

https://travel.rakuten.co.jp/searchHotelArea.do?f_query={prefecture}%20{city}

---

# Jalan URL

https://www.jalan.net/yadolist/?keyword={prefecture}%20{city}

必ず

encodeURIComponent

を使う。

---

# Hotel Validation

Claudeは以下をテストする。

- URLが開く
- 404でない
- 宿一覧が表示される

---

# QA Tests

Claudeは以下を自動実行する。

100回ランダム旅行生成

チェック項目

- destination存在
- hub存在
- 交通ルート
- 宿URL
- MapsURL

---

# Data Integrity

Claudeは以下をチェックする。

destination ID重複  
destination name重複  
hotelArea参照  
hub参照  
transportGraph参照  

問題があれば自動修正。

---

# Folder Structure

repo構造

data/
destinations.json
hotelAreas.json
transportGraph.json
transportHubs.json

scripts/
qa.js
hotelTest.js
transportTest.js

web/
index.html
app.js
style.css

---

# Error Handling

Claudeは

エラー発見  
↓  
原因特定  
↓  
修正  
↓  
再テスト

を自動実行する。

---

# Release Condition

以下が満たされたら公開可能。

QA PASS  
宿リンク正常  
交通ルート正常  

---

# Release Date

2026-04-01