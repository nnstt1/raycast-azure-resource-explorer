# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## プロジェクト概要

Azure リソースを検索するための Raycast 拡張機能。TypeScript + React で構築。
Azure CLI (`az` コマンド) および Azure Resource Graph を使用してリソースを検索し、Raycast UI で表示する。

## 機能要件

### コア機能

1. **Azure リソース検索**
   - すべてのリソースタイプを検索対象とする
   - Azure Resource Graph を使用した高速な全サブスクリプション検索
   - フォールバックとして Azure CLI による順次取得
   - Azure CLI (`az login` で認証済み) を使用

2. **サブスクリプション選択**
   - 検索時にサブスクリプションを選択できる UI を提供
   - ユーザーがアクセス可能なすべてのサブスクリプションを表示
   - デフォルトサブスクリプションを最上部に表示
   - サブスクリプションをデフォルトに設定可能

3. **フィルタリング機能**
   - リソースタイプでフィルタリング（例: VirtualMachine, StorageAccount など）
   - リージョン（Location）での絞り込み
   - グローバル検索（サブスクリプション選択なしで全リソース検索）

4. **検索結果表示**
   - リソース名
   - リソースグループ名
   - ロケーション（リージョン）
   - サブスクリプション名
   - リソースタイプ
   - タグ情報

### アクション機能

検索結果から以下のアクションを実行可能：

1. **Azure Portal で開く** - ブラウザで該当リソースの Portal ページを開く
2. **リソース ID をコピー** - リソース ID をクリップボードにコピー
3. **リソース名をコピー** - リソース名をクリップボードにコピー
4. **お気に入りに追加/削除** - よく使うリソースを保存

### 履歴・お気に入り機能

- 最近アクセスしたリソースの履歴を保存
- 履歴から素早く再アクセス可能
- お気に入りリソースの保存と表示

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

- **src/search.tsx**: メインのコマンドエントリポイント（検索 UI）
- **src/utils/azure.ts**: Azure CLI / Resource Graph ラッパー
- **src/utils/history.ts**: 履歴管理（LocalStorage 使用）
- **src/utils/favorites.ts**: お気に入り管理（LocalStorage 使用）
- **src/types.ts**: TypeScript 型定義
- **package.json**: Raycast 拡張機能のマニフェスト
- **assets/**: アイコンなどの静的ファイル

## 技術スタック

- Raycast API (`@raycast/api`, `@raycast/utils`)
- TypeScript (ES2023)
- Azure CLI (外部コマンド実行)
- Azure Resource Graph (高速検索)
- ESLint（Raycast 公式設定）

## Azure CLI コマンド例

```bash
# サブスクリプション一覧取得
az account list --output json

# リソース一覧取得（特定サブスクリプション）
az resource list --subscription <subscription-id> --output json

# Resource Graph クエリ（全サブスクリプション検索）
az graph query -q "Resources | project id, name, type, resourceGroup, location, subscriptionId, tags" --first 1000 --output json

# デフォルトサブスクリプション設定
az account set --subscription <subscription-id>
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
  tags?: Record<string, string>; // タグ情報
}
```

### 履歴データ型

```typescript
interface HistoryItem {
  resource: AzureResource;
  accessedAt: number; // Unix timestamp
}
```

## UI フロー

1. コマンド起動 → メイン画面（お気に入り、履歴、サブスクリプション一覧）
2. 検索バーに入力 → サブスクリプションとリソースの検索結果を表示
3. サブスクリプション選択 → そのサブスクリプション内のリソース一覧
4. リソースタイプ/ロケーションでフィルタリング可能
5. リソース選択 → アクション実行（Portal で開く / ID コピー / 名前コピー / お気に入り）
6. アクセスしたリソースは履歴に自動保存

## 実装状況

### Phase 1（MVP）- 完了

- [x] Azure CLI 実行ユーティリティ
- [x] サブスクリプション一覧取得
- [x] リソース一覧取得と表示
- [x] 基本的な検索・フィルタリング
- [x] Azure Portal で開くアクション
- [x] リソース ID/名前をコピー

### Phase 2 - 完了

- [x] 履歴機能の実装
- [x] リソースタイプでのフィルタリング UI
- [x] ロケーションでのフィルタリング UI
- [x] エラーハンドリングの強化

### Phase 3 - 完了

- [x] リソースタイプの表示
- [x] タグ情報の表示
- [x] お気に入り機能

### 追加機能 - 完了

- [x] Azure Resource Graph による高速検索
- [x] Azure CLI パスの設定機能
- [x] デフォルトサブスクリプション設定機能
- [x] グローバル検索（サブスクリプション/リソース分離表示）

## 注意事項

- Azure CLI がインストールされていない場合はエラーメッセージを表示
- `az login` が実行されていない場合は認証を促すメッセージを表示
- リソース取得は時間がかかる可能性があるため、Loading 状態を適切に表示
- 大量のリソースがある場合は Azure Resource Graph を使用して高速化
- Resource Graph が利用できない場合は従来の順次取得にフォールバック

## 参考リンク

- [Raycast API Documentation](https://developers.raycast.com/)
- [Azure CLI Reference](https://docs.microsoft.com/en-us/cli/azure/)
- [Azure Resource Manager](https://docs.microsoft.com/en-us/azure/azure-resource-manager/)
- [Azure Resource Graph](https://docs.microsoft.com/en-us/azure/governance/resource-graph/)
