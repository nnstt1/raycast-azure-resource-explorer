import {
  List,
  ActionPanel,
  Action,
  showToast,
  Toast,
  Icon,
  Color,
} from "@raycast/api";
import { useState, useEffect } from "react";
import { AzureSubscription, AzureResource } from "./types";
import {
  checkAzureCli,
  getSubscriptions,
  getResources,
  getPortalUrl,
} from "./utils/azure";

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
      showToast({
        style: Toast.Style.Failure,
        title: "サブスクリプションの取得に失敗しました",
        message: String(error),
      });
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    if (!selectedSubscription) {
      setResources([]);
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
      showToast({
        style: Toast.Style.Failure,
        title: "リソースの取得に失敗しました",
        message: String(error),
      });
    }
    setIsLoading(false);
  }, [selectedSubscription]);

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
    return (
      res.name.toLowerCase().includes(search) ||
      res.resourceGroup.toLowerCase().includes(search) ||
      res.type.toLowerCase().includes(search) ||
      res.location.toLowerCase().includes(search)
    );
  });

  return (
    <List
      isLoading={isLoading}
      searchBarPlaceholder="リソースを検索..."
      onSearchTextChange={setSearchText}
      navigationTitle={selectedSubscription.name}
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
