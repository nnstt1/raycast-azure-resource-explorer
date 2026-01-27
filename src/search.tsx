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

const ALL_FILTER = "all";

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
  const [typeFilter, setTypeFilter] = useState<string>(ALL_FILTER);
  const [locationFilter, setLocationFilter] = useState<string>(ALL_FILTER);

  // Load history on mount
  useEffect(() => {
    getHistory().then(setHistory);
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
    const matchesSearch =
      res.name.toLowerCase().includes(search) ||
      res.resourceGroup.toLowerCase().includes(search) ||
      res.type.toLowerCase().includes(search) ||
      res.location.toLowerCase().includes(search);

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
        {filteredResources.map((res) => (
          <List.Item
            key={res.id}
            title={res.name}
            subtitle={res.resourceGroup}
            icon={Icon.Document}
            accessories={[
              { tag: res.location },
              { text: res.type.split("/").pop() },
            ]}
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
                </ActionPanel.Section>
                <ActionPanel.Section>
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
        ))}
      </List.Section>
    </List>
  );
}
