import {
  List,
  ActionPanel,
  Action,
  showToast,
  Toast,
  Icon,
  Color,
  confirmAlert,
  Alert,
} from "@raycast/api";
import { useState, useEffect, useMemo, useCallback } from "react";
import { AzureSubscription, AzureResource } from "./types";
import {
  checkAzureCli,
  getSubscriptions,
  getResources,
  getPortalUrl,
} from "./utils/azure";
import {
  getHistory,
  addToHistory,
  clearHistory,
  HistoryItem,
} from "./utils/history";
import {
  getFavorites,
  addToFavorites,
  removeFromFavorites,
} from "./utils/favorites";

const ALL_FILTER = "all";

function formatTags(tags?: Record<string, string>): string {
  if (!tags || Object.keys(tags).length === 0) return "";
  return Object.entries(tags)
    .map(([k, v]) => `${k}: ${v}`)
    .join(", ");
}

export default function Command() {
  const [cliStatus, setCliStatus] = useState<{
    installed: boolean;
    loggedIn: boolean;
  } | null>(null);
  const [subscriptions, setSubscriptions] = useState<AzureSubscription[]>([]);
  const [selectedSubscription, setSelectedSubscription] =
    useState<AzureSubscription | null>(null);
  const [resources, setResources] = useState<AzureResource[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchText, setSearchText] = useState("");
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [favorites, setFavorites] = useState<AzureResource[]>([]);
  const [typeFilter, setTypeFilter] = useState<string>(ALL_FILTER);
  const [locationFilter, setLocationFilter] = useState<string>(ALL_FILTER);

  // Load history and favorites on mount
  useEffect(() => {
    getHistory().then(setHistory);
    getFavorites().then(setFavorites);
  }, []);

  useEffect(() => {
    const status = checkAzureCli();
    setCliStatus(status);

    if (!status.installed) {
      showToast({
        style: Toast.Style.Failure,
        title: "Azure CLI がインストールされていません",
        message: "brew install azure-cli でインストールしてください",
      });
      setIsLoading(false);
      return;
    }

    if (!status.loggedIn) {
      showToast({
        style: Toast.Style.Failure,
        title: "Azure CLI にログインしていません",
        message: "az login を実行してください",
      });
      setIsLoading(false);
      return;
    }

    try {
      const subs = getSubscriptions();
      setSubscriptions(subs);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      showToast({
        style: Toast.Style.Failure,
        title: "サブスクリプションの取得に失敗しました",
        message: errorMessage,
      });
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    if (!selectedSubscription) {
      setResources([]);
      setTypeFilter(ALL_FILTER);
      setLocationFilter(ALL_FILTER);
      return;
    }

    setIsLoading(true);
    try {
      const res = getResources(
        selectedSubscription.id,
        selectedSubscription.name,
      );
      setResources(res);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      showToast({
        style: Toast.Style.Failure,
        title: "リソースの取得に失敗しました",
        message: errorMessage,
      });
      setResources([]);
    }
    setIsLoading(false);
  }, [selectedSubscription]);

  // Extract unique resource types and locations
  const resourceTypes = useMemo(() => {
    const types = new Set(resources.map((r) => r.type));
    return Array.from(types).sort();
  }, [resources]);

  const locations = useMemo(() => {
    const locs = new Set(resources.map((r) => r.location));
    return Array.from(locs).sort();
  }, [resources]);

  // Check if resource is favorite
  const isFavorite = useCallback(
    (resourceId: string) => {
      return favorites.some((f) => f.id === resourceId);
    },
    [favorites],
  );

  // Handle opening resource in portal with history
  const handleOpenInPortal = useCallback(async (resource: AzureResource) => {
    await addToHistory(resource);
    const updatedHistory = await getHistory();
    setHistory(updatedHistory);
  }, []);

  // Handle clearing history
  const handleClearHistory = useCallback(async () => {
    const confirmed = await confirmAlert({
      title: "履歴をクリア",
      message: "すべての履歴を削除しますか？",
      primaryAction: {
        title: "削除",
        style: Alert.ActionStyle.Destructive,
      },
    });
    if (confirmed) {
      await clearHistory();
      setHistory([]);
      showToast({
        style: Toast.Style.Success,
        title: "履歴をクリアしました",
      });
    }
  }, []);

  // Handle adding to favorites
  const handleAddToFavorites = useCallback(async (resource: AzureResource) => {
    await addToFavorites(resource);
    const updatedFavorites = await getFavorites();
    setFavorites(updatedFavorites);
    showToast({
      style: Toast.Style.Success,
      title: "お気に入りに追加しました",
    });
  }, []);

  // Handle removing from favorites
  const handleRemoveFromFavorites = useCallback(async (resourceId: string) => {
    await removeFromFavorites(resourceId);
    const updatedFavorites = await getFavorites();
    setFavorites(updatedFavorites);
    showToast({
      style: Toast.Style.Success,
      title: "お気に入りから削除しました",
    });
  }, []);

  if (cliStatus && !cliStatus.installed) {
    return (
      <List>
        <List.EmptyView
          icon={Icon.ExclamationMark}
          title="Azure CLI がインストールされていません"
          description="brew install azure-cli でインストールしてください"
        />
      </List>
    );
  }

  if (cliStatus && !cliStatus.loggedIn) {
    return (
      <List>
        <List.EmptyView
          icon={Icon.Person}
          title="Azure CLI にログインしていません"
          description="ターミナルで az login を実行してください"
        />
      </List>
    );
  }

  if (!selectedSubscription) {
    return (
      <List
        isLoading={isLoading}
        searchBarPlaceholder="サブスクリプションを検索..."
      >
        {favorites.length > 0 && (
          <List.Section title="お気に入り">
            {favorites.map((resource) => (
              <List.Item
                key={`favorite-${resource.id}`}
                title={resource.name}
                subtitle={resource.subscriptionName}
                icon={{ source: Icon.Star, tintColor: Color.Yellow }}
                accessories={[
                  { tag: resource.location },
                  { text: resource.type.split("/").pop() },
                ]}
                actions={
                  <ActionPanel>
                    <ActionPanel.Section>
                      <Action.OpenInBrowser
                        title="Azure Portal で開く"
                        url={getPortalUrl(resource.id)}
                        icon={Icon.Globe}
                        onOpen={() => handleOpenInPortal(resource)}
                      />
                      <Action.CopyToClipboard
                        title="リソース ID をコピー"
                        content={resource.id}
                        shortcut={{ modifiers: ["cmd"], key: "c" }}
                      />
                      <Action.CopyToClipboard
                        title="リソース名をコピー"
                        content={resource.name}
                        shortcut={{ modifiers: ["cmd", "shift"], key: "c" }}
                      />
                    </ActionPanel.Section>
                    <ActionPanel.Section>
                      <Action
                        title="お気に入りから削除"
                        icon={Icon.StarDisabled}
                        style={Action.Style.Destructive}
                        shortcut={{ modifiers: ["cmd"], key: "s" }}
                        onAction={() => handleRemoveFromFavorites(resource.id)}
                      />
                    </ActionPanel.Section>
                  </ActionPanel>
                }
              />
            ))}
          </List.Section>
        )}
        {history.length > 0 && (
          <List.Section title="最近アクセスしたリソース">
            {history.slice(0, 5).map((item) => (
              <List.Item
                key={`history-${item.resource.id}`}
                title={item.resource.name}
                subtitle={item.resource.subscriptionName}
                icon={{ source: Icon.Clock, tintColor: Color.SecondaryText }}
                accessories={[
                  { tag: item.resource.location },
                  { text: item.resource.type.split("/").pop() },
                ]}
                actions={
                  <ActionPanel>
                    <ActionPanel.Section>
                      <Action.OpenInBrowser
                        title="Azure Portal で開く"
                        url={getPortalUrl(item.resource.id)}
                        icon={Icon.Globe}
                        onOpen={() => handleOpenInPortal(item.resource)}
                      />
                      <Action.CopyToClipboard
                        title="リソース ID をコピー"
                        content={item.resource.id}
                        shortcut={{ modifiers: ["cmd"], key: "c" }}
                      />
                      <Action.CopyToClipboard
                        title="リソース名をコピー"
                        content={item.resource.name}
                        shortcut={{ modifiers: ["cmd", "shift"], key: "c" }}
                      />
                    </ActionPanel.Section>
                    <ActionPanel.Section>
                      {!isFavorite(item.resource.id) && (
                        <Action
                          title="お気に入りに追加"
                          icon={Icon.Star}
                          shortcut={{ modifiers: ["cmd"], key: "s" }}
                          onAction={() => handleAddToFavorites(item.resource)}
                        />
                      )}
                      <Action
                        title="履歴をクリア"
                        icon={Icon.Trash}
                        style={Action.Style.Destructive}
                        shortcut={{
                          modifiers: ["cmd", "shift"],
                          key: "delete",
                        }}
                        onAction={handleClearHistory}
                      />
                    </ActionPanel.Section>
                  </ActionPanel>
                }
              />
            ))}
          </List.Section>
        )}
        <List.Section title="サブスクリプション">
          {subscriptions.map((sub) => (
            <List.Item
              key={sub.id}
              title={sub.name}
              subtitle={sub.id}
              icon={{
                source: Icon.Key,
                tintColor: sub.isDefault ? Color.Blue : Color.SecondaryText,
              }}
              accessories={[
                sub.isDefault
                  ? { tag: { value: "デフォルト", color: Color.Blue } }
                  : {},
                { tag: sub.state },
              ]}
              actions={
                <ActionPanel>
                  <Action
                    title="サブスクリプションを選択"
                    icon={Icon.ArrowRight}
                    onAction={() => setSelectedSubscription(sub)}
                  />
                </ActionPanel>
              }
            />
          ))}
        </List.Section>
      </List>
    );
  }

  const filteredResources = resources.filter((res) => {
    const search = searchText.toLowerCase();
    const tagString = formatTags(res.tags).toLowerCase();
    const matchesSearch =
      res.name.toLowerCase().includes(search) ||
      res.resourceGroup.toLowerCase().includes(search) ||
      res.type.toLowerCase().includes(search) ||
      res.location.toLowerCase().includes(search) ||
      tagString.includes(search);

    const matchesType = typeFilter === ALL_FILTER || res.type === typeFilter;
    const matchesLocation =
      locationFilter === ALL_FILTER || res.location === locationFilter;

    return matchesSearch && matchesType && matchesLocation;
  });

  return (
    <List
      isLoading={isLoading}
      searchBarPlaceholder="リソースを検索..."
      onSearchTextChange={setSearchText}
      navigationTitle={selectedSubscription.name}
      searchBarAccessory={
        <List.Dropdown
          tooltip="フィルター"
          onChange={(value) => {
            if (value.startsWith("type:")) {
              setTypeFilter(value.replace("type:", ""));
            } else if (value.startsWith("location:")) {
              setLocationFilter(value.replace("location:", ""));
            }
          }}
        >
          <List.Dropdown.Section title="リソースタイプ">
            <List.Dropdown.Item
              title="すべてのタイプ"
              value={`type:${ALL_FILTER}`}
            />
            {resourceTypes.map((type) => (
              <List.Dropdown.Item
                key={type}
                title={type.split("/").pop() || type}
                value={`type:${type}`}
              />
            ))}
          </List.Dropdown.Section>
          <List.Dropdown.Section title="ロケーション">
            <List.Dropdown.Item
              title="すべてのロケーション"
              value={`location:${ALL_FILTER}`}
            />
            {locations.map((loc) => (
              <List.Dropdown.Item
                key={loc}
                title={loc}
                value={`location:${loc}`}
              />
            ))}
          </List.Dropdown.Section>
        </List.Dropdown>
      }
    >
      <List.Section title={`リソース (${filteredResources.length})`}>
        {filteredResources.map((res) => {
          const resourceIsFavorite = isFavorite(res.id);
          const accessories: List.Item.Accessory[] = [
            { tag: res.location },
            {
              tag: {
                value: res.type.split("/").pop() || res.type,
                color: Color.Purple,
              },
            },
          ];

          if (res.tags && Object.keys(res.tags).length > 0) {
            accessories.push({
              icon: { source: Icon.Tag, tintColor: Color.SecondaryText },
              tooltip: formatTags(res.tags),
            });
          }

          if (resourceIsFavorite) {
            accessories.unshift({
              icon: { source: Icon.Star, tintColor: Color.Yellow },
            });
          }

          return (
            <List.Item
              key={res.id}
              title={res.name}
              subtitle={res.resourceGroup}
              icon={Icon.Document}
              accessories={accessories}
              actions={
                <ActionPanel>
                  <ActionPanel.Section>
                    <Action.OpenInBrowser
                      title="Azure Portal で開く"
                      url={getPortalUrl(res.id)}
                      icon={Icon.Globe}
                      onOpen={() => handleOpenInPortal(res)}
                    />
                    <Action.CopyToClipboard
                      title="リソース ID をコピー"
                      content={res.id}
                      shortcut={{ modifiers: ["cmd"], key: "c" }}
                    />
                    <Action.CopyToClipboard
                      title="リソース名をコピー"
                      content={res.name}
                      shortcut={{ modifiers: ["cmd", "shift"], key: "c" }}
                    />
                    {res.tags && Object.keys(res.tags).length > 0 && (
                      <Action.CopyToClipboard
                        title="タグをコピー"
                        content={JSON.stringify(res.tags, null, 2)}
                        shortcut={{ modifiers: ["cmd", "opt"], key: "c" }}
                      />
                    )}
                  </ActionPanel.Section>
                  <ActionPanel.Section>
                    {resourceIsFavorite ? (
                      <Action
                        title="お気に入りから削除"
                        icon={Icon.StarDisabled}
                        shortcut={{ modifiers: ["cmd"], key: "s" }}
                        onAction={() => handleRemoveFromFavorites(res.id)}
                      />
                    ) : (
                      <Action
                        title="お気に入りに追加"
                        icon={Icon.Star}
                        shortcut={{ modifiers: ["cmd"], key: "s" }}
                        onAction={() => handleAddToFavorites(res)}
                      />
                    )}
                    <Action
                      title="サブスクリプション一覧に戻る"
                      icon={Icon.ArrowLeft}
                      shortcut={{ modifiers: ["cmd"], key: "b" }}
                      onAction={() => setSelectedSubscription(null)}
                    />
                  </ActionPanel.Section>
                </ActionPanel>
              }
            />
          );
        })}
      </List.Section>
    </List>
  );
}
