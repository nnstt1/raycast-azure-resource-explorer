# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## プロジェクト概要

Azure リソースを検索するための Raycast 拡張機能。TypeScript + React で構築。
Azure CLI (`az` コマンド) を使用してリソースを検索し、Raycast UI で表示する。

## 機能要件

### コア機能

1. **Azure リソース検索**
   - すべてのリソースタイプを検索対象とする
   - リアルタイムで Azure から最新のリソース一覧を取得
   - Azure CLI (`az login` で認証済み) を使用

2. **サブスクリプション選択**
   - 検索時にサブスクリプションを選択できる UI を提供
   - ユーザーがアクセス可能なすべてのサブスクリプションを表示

3. **フィルタリング機能**
   - リソースタイプでフィルタリング（例: VirtualMachine, StorageAccount など）
   - リージョン（Location）での絞り込み

4. **検索結果表示（必須項目）**
   - リソース名
   - リソースグループ名
   - ロケーション（リージョン）
   - サブスクリプション名

5. **将来追加検討の表示項目**
   - リソースタイプ
   - ステータス（実行中/停止など、取得可能なら）
   - タグ

### アクション機能

検索結果から以下のアクションを実行可能：

1. **Azure Portal で開く** - ブラウザで該当リソースの Portal ページを開く
2. **リソース ID をコピー** - リソース ID をクリップボードにコピー
3. **リソース名をコピー** - リソース名をクリップボードにコピー

### 履歴機能

- 最近アクセスしたリソースの履歴を保存
- 履歴から素早く再アクセス可能

## 開発コマンド

```bash
# 依存関係インストール
npm install

# 開発モードで起動
npm run dev

# ビルド
npm run build

# Lint
npm run lint

# Lint + 自動修正
npm run fix-lint

# Raycast Store に公開
npm run publish
```

## アーキテクチャ

- **src/search.ts**: メインのコマンドエントリポイント（検索 UI）
- **src/utils/azure.ts**: Azure CLI ラッパー（`az` コマンド実行）
- **src/utils/history.ts**: 履歴管理（LocalStorage 使用）
- **src/types.ts**: TypeScript 型定義
- **package.json**: Raycast 拡張機能のマニフェスト
- **assets/**: アイコンなどの静的ファイル

## 技術スタック

- Raycast API (`@raycast/api`, `@raycast/utils`)
- TypeScript (ES2023)
- Azure CLI (外部コマンド実行)
- ESLint（Raycast 公式設定）

## Azure CLI コマンド例

```bash
# サブスクリプション一覧取得
az account list --output json

# リソース一覧取得（特定サブスクリプション）
az resource list --subscription <subscription-id> --output json

# リソース詳細取得
az resource show --ids <resource-id> --output json
```

## データ構造

### Azure Resource 型

```typescript
interface AzureResource {
  id: string;              // リソース ID
  name: string;            // リソース名
  type: string;            // リソースタイプ (例: Microsoft.Compute/virtualMachines)
  resourceGroup: string;   // リソースグループ名
  location: string;        // ロケーション（リージョン）
  subscriptionId: string;  // サブスクリプション ID
  subscriptionName?: string; // サブスクリプション名（表示用）
}
```

### 履歴データ型

```typescript
interface HistoryItem {
  resourceId: string;
  accessedAt: number; // Unix timestamp
}
```

## UI フロー

1. コマンド起動 → サブスクリプション選択画面
2. サブスクリプション選択 → リソース検索画面
3. 検索バーでフィルタリング（名前、リソースタイプ、ロケーション）
4. リソース選択 → アクション実行（Portal で開く / ID コピー / 名前コピー）
5. アクセスしたリソースは履歴に自動保存

## 実装の優先順位

### Phase 1（MVP）

- [ ] Azure CLI 実行ユーティリティ
- [ ] サブスクリプション一覧取得
- [ ] リソース一覧取得と表示
- [ ] 基本的な検索・フィルタリング
- [ ] Azure Portal で開くアクション
- [ ] リソース ID/名前をコピー

### Phase 2

- [ ] 履歴機能の実装
- [ ] リソースタイプでのフィルタリング UI
- [ ] ロケーションでのフィルタリング UI
- [ ] エラーハンドリングの強化

### Phase 3（将来追加検討）

- [ ] リソースタイプの表示
- [ ] ステータス情報の取得・表示
- [ ] タグ情報の表示
- [ ] お気に入り機能

## 注意事項

- Azure CLI がインストールされていない場合はエラーメッセージを表示
- `az login` が実行されていない場合は認証を促すメッセージを表示
- リソース取得は時間がかかる可能性があるため、Loading 状態を適切に表示
- 大量のリソースがある場合のパフォーマンスに注意

## 参考リンク

- [Raycast API Documentation](https://developers.raycast.com/)
- [Azure CLI Reference](https://docs.microsoft.com/en-us/cli/azure/)
- [Azure Resource Manager](https://docs.microsoft.com/en-us/azure/azure-resource-manager/)
