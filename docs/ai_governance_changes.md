# AI Governance 変更記録 — dokoiiko

> 対象: `MORI-LAB/_governance/constitution.md`
> 調査日: 2026-03-16

---

## 調査結果

### constitution.md の Claude Code 制限チェック

| チェック項目 | 条文 | 制限あり？ | 判定 |
|-------------|------|-----------|------|
| shell command confirmation | 第2条（削除のみ限定） | 部分的 | ✅ 問題なし |
| node -e 実行制限 | 記載なし | なし | ✅ 問題なし |
| bash execution block | 記載なし | なし | ✅ 問題なし |
| file edit confirmation | 記載なし | なし | ✅ 問題なし |
| フォルダ構造変更制限 | 第6条 | あり | ⚠ 要注意 |

### 結論

**constitution.md の修正は不要。**

第2条（破壊的変更の確認）・第6条（フォルダ構造不可侵）は
Claude Code の通常作業（コード編集・スクリプト実行）を妨げていない。

ただし以下の点に注意:

- 第2条: ファイル・フォルダ削除時はユーザー承認が原則
  → 本タスクはユーザーが明示的に指示したため適用除外
- 第6条: フォルダ構造変更は提案→承認が原則
  → 本タスクはユーザーが明示的に指示したため適用除外

---

## dokoiiko/CLAUDE.md の Execution Policy との整合性

dokoiiko プロジェクトの `CLAUDE.md` には独自の実行ポリシーがある:

```
Execution Policy:
- ファイル編集の確認質問は禁止
- 修正は自動実行する
- ファイル削除を自動実行してよい
```

これは MORI-LAB 憲法第2条と矛盾する部分がある（削除の自動実行）。
ただし dokoiiko/CLAUDE.md は今回 TASK5 でサイト仕様専用に書き直す。

---

## 変更サマリー

| 対象ファイル | 変更内容 |
|-------------|---------|
| `_governance/constitution.md` | **変更なし**（制限なし確認済み） |
| `dokoiiko/CLAUDE.md` | TASK5 にてサイト仕様専用に整理 |
| `MORI-LAB/CLAUDE.md` | TASK2 にて新規作成 |
