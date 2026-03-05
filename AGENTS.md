## Overview

AIエージェントツール/対話型の CLI を想定した、`Zero external dependencies` なUI部品を集めたリポジトリです

## 技術仕様

- runtime: `bun`
- language: TypeScript
- testing: `bun test`
- formatter: biome `bun run format`

## 作業ルール

- 日本語で応答する
- ドキュメント作成は日本語で行う
- コメントは日本語でつける
- コードは常にメンテナンス製とテスト容易性を最も重要視する
- タスクは常に逐次実行する。並列化は行わない
- 時間の節約・開発スループットよりも、確実とトレーサビリティを優先する
- 後方互換性や例外処理のために処理を複雑にせず、シンプルで唯一の正解のために DRY な実装を行う
- ツールが出力するメッセージは英語で記述する。ただし `src/cli.ts` のサンプル実装は日本語で行なって良い。

## Folder Rule

- `@src/ `- Bunのコード本体
  - `lib.ts` - 外部公開用の型定義・エクスポートなど
  - `components/` - UI Component
  - `core/` - 内部用のコアライブラリ
  - `utils/` - ユーティリティ関数
- `@test/` - テストコードを格納する

## Definition of Done

- `scripts/sanity.sh` を実行し、型エラー・フォーマット・全件テストが全てパスすること
- 新規APIの場合は、 `scripts/example.ts` にサンプル実装を追加する
