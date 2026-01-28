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
import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { AzureSubscription, AzureResource } from "./types";
import {
  checkAzureCli,
  getSubscriptions,
  getResources,
  getAllResources,
  queryResourceGraph,
  setDefaultSubscription,
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
  const [allResources, setAllResources] = useState<AzureResource[]>([]);
  const [allResourcesLoaded, setAllResourcesLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingAllResources, setIsLoadingAllResources] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [favorites, setFavorites] = useState<AzureResource[]>([]);
  const [typeFilter, setTypeFilter] = useState<string>(ALL_FILTER);
  const [locationFilter, setLocationFilter] = useState<string>(ALL_FILTER);
  const subscriptionsRef = useRef<AzureSubscription[]>([]);

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
        title: "Azure CLI is not installed",
        message: "Please install with: brew install azure-cli",
      });
      setIsLoading(false);
      return;
    }

    if (!status.loggedIn) {
      showToast({
        style: Toast.Style.Failure,
        title: "Not logged in to Azure CLI",
        message: "Please run: az login",
      });
      setIsLoading(false);
      return;
    }

    try {
      const subs = getSubscriptions();
      setSubscriptions(subs);
      subscriptionsRef.current = subs;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      showToast({
        style: Toast.Style.Failure,
        title: "Failed to fetch subscriptions",
        message: errorMessage,
      });
    }
    setIsLoading(false);
  }, []);

  // Load resources for selected subscription
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
        title: "Failed to fetch resources",
        message: errorMessage,
      });
      setResources([]);
    }
    setIsLoading(false);
  }, [selectedSubscription]);

  // Load all resources when search text is entered (lazy loading)
  useEffect(() => {
    if (
      searchText &&
      !allResourcesLoaded &&
      !isLoadingAllResources &&
      !selectedSubscription
    ) {
      setIsLoadingAllResources(true);

      // Use setTimeout to allow React to render loading state before blocking operation
      setTimeout(() => {
        // Try Resource Graph first (faster), fallback to sequential fetching
        let all: AzureResource[] = [];
        let useResourceGraph = true;

        try {
          all = queryResourceGraph(subscriptionsRef.current);
          // If Resource Graph returned empty results, try fallback
          if (all.length === 0 && subscriptionsRef.current.length > 0) {
            useResourceGraph = false;
          }
        } catch {
          useResourceGraph = false;
        }

        // Fallback to sequential fetching if Resource Graph failed or returned empty
        if (!useResourceGraph) {
          try {
            all = getAllResources(subscriptionsRef.current);
          } catch (error) {
            const errorMessage =
              error instanceof Error ? error.message : String(error);
            showToast({
              style: Toast.Style.Failure,
              title: "Failed to fetch resources",
              message: errorMessage,
            });
          }
        }

        setAllResources(all);
        setAllResourcesLoaded(true);
        setIsLoadingAllResources(false);
      }, 0);
    }
  }, [
    searchText,
    allResourcesLoaded,
    isLoadingAllResources,
    selectedSubscription,
  ]);

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
      title: "Clear History",
      message: "Are you sure you want to clear all history?",
      primaryAction: {
        title: "Clear",
        style: Alert.ActionStyle.Destructive,
      },
    });
    if (confirmed) {
      await clearHistory();
      setHistory([]);
      showToast({
        style: Toast.Style.Success,
        title: "History cleared",
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
      title: "Added to favorites",
    });
  }, []);

  // Handle removing from favorites
  const handleRemoveFromFavorites = useCallback(async (resourceId: string) => {
    await removeFromFavorites(resourceId);
    const updatedFavorites = await getFavorites();
    setFavorites(updatedFavorites);
    showToast({
      style: Toast.Style.Success,
      title: "Removed from favorites",
    });
  }, []);

  // Handle setting default subscription
  const handleSetDefaultSubscription = useCallback(
    (subscription: AzureSubscription) => {
      try {
        setDefaultSubscription(subscription.id);
        // Update subscriptions state to reflect the change
        setSubscriptions((prev) =>
          prev.map((sub) => ({
            ...sub,
            isDefault: sub.id === subscription.id,
          })),
        );
        subscriptionsRef.current = subscriptionsRef.current.map((sub) => ({
          ...sub,
          isDefault: sub.id === subscription.id,
        }));
        showToast({
          style: Toast.Style.Success,
          title: "Default subscription changed",
          message: subscription.name,
        });
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        showToast({
          style: Toast.Style.Failure,
          title: "Failed to set default subscription",
          message: errorMessage,
        });
      }
    },
    [],
  );

  // Sort subscriptions with default first
  const sortedSubscriptions = useMemo(() => {
    return [...subscriptions].sort((a, b) => {
      if (a.isDefault && !b.isDefault) return -1;
      if (!a.isDefault && b.isDefault) return 1;
      return a.name.localeCompare(b.name);
    });
  }, [subscriptions]);

  if (cliStatus && !cliStatus.installed) {
    return (
      <List>
        <List.EmptyView
          icon={Icon.ExclamationMark}
          title="Azure CLI is not installed"
          description="Please install with: brew install azure-cli"
        />
      </List>
    );
  }

  if (cliStatus && !cliStatus.loggedIn) {
    return (
      <List>
        <List.EmptyView
          icon={Icon.Person}
          title="Not logged in to Azure CLI"
          description="Please run 'az login' in your terminal"
        />
      </List>
    );
  }

  // Subscription selection view (with global search)
  if (!selectedSubscription) {
    // Filter subscriptions based on search text
    const subscriptionResults = searchText
      ? sortedSubscriptions.filter((sub) => {
          const search = searchText.toLowerCase();
          return (
            sub.name.toLowerCase().includes(search) ||
            sub.id.toLowerCase().includes(search)
          );
        })
      : [];

    // Filter resources from all subscriptions based on search text
    const searchResults =
      searchText && allResourcesLoaded
        ? allResources.filter((res) => {
            const search = searchText.toLowerCase();
            const tagString = formatTags(res.tags).toLowerCase();
            return (
              res.name.toLowerCase().includes(search) ||
              res.resourceGroup.toLowerCase().includes(search) ||
              res.type.toLowerCase().includes(search) ||
              res.location.toLowerCase().includes(search) ||
              (res.subscriptionName?.toLowerCase().includes(search) ?? false) ||
              tagString.includes(search)
            );
          })
        : [];

    return (
      <List
        isLoading={isLoading || isLoadingAllResources}
        searchBarPlaceholder="Search subscriptions or resources..."
        searchText={searchText}
        onSearchTextChange={setSearchText}
      >
        {searchText && subscriptionResults.length > 0 && (
          <List.Section title={`Subscriptions (${subscriptionResults.length})`}>
            {subscriptionResults.map((sub) => (
              <List.Item
                key={`sub-search-${sub.id}`}
                title={sub.name}
                subtitle={sub.id}
                icon={{
                  source: Icon.Key,
                  tintColor: sub.isDefault ? Color.Blue : Color.SecondaryText,
                }}
                accessories={[
                  sub.isDefault
                    ? { tag: { value: "Default", color: Color.Blue } }
                    : {},
                  { tag: sub.state },
                ]}
                actions={
                  <ActionPanel>
                    <Action
                      title="Select Subscription"
                      icon={Icon.ArrowRight}
                      onAction={() => {
                        setSearchText("");
                        setSelectedSubscription(sub);
                      }}
                    />
                    {!sub.isDefault && (
                      <Action
                        title="Set as Default"
                        icon={Icon.Star}
                        shortcut={{ modifiers: ["cmd"], key: "d" }}
                        onAction={() => handleSetDefaultSubscription(sub)}
                      />
                    )}
                  </ActionPanel>
                }
              />
            ))}
          </List.Section>
        )}
        {searchText && searchResults.length > 0 && (
          <List.Section title={`Resources (${searchResults.length})`}>
            {searchResults.slice(0, 50).map((res) => {
              const resourceIsFavorite = isFavorite(res.id);
              return (
                <List.Item
                  key={`search-${res.id}`}
                  title={res.name}
                  subtitle={res.resourceGroup}
                  icon={
                    resourceIsFavorite
                      ? { source: Icon.Star, tintColor: Color.Yellow }
                      : Icon.Document
                  }
                  accessories={[
                    { text: res.subscriptionName },
                    { tag: res.location },
                    {
                      tag: {
                        value: res.type.split("/").pop() || res.type,
                        color: Color.Purple,
                      },
                    },
                  ]}
                  actions={
                    <ActionPanel>
                      <ActionPanel.Section>
                        <Action.OpenInBrowser
                          title="Open in Azure Portal"
                          url={getPortalUrl(res.id)}
                          icon={Icon.Globe}
                          onOpen={() => handleOpenInPortal(res)}
                        />
                        <Action.CopyToClipboard
                          title="Copy Resource ID"
                          content={res.id}
                          shortcut={{ modifiers: ["cmd"], key: "c" }}
                        />
                        <Action.CopyToClipboard
                          title="Copy Resource Name"
                          content={res.name}
                          shortcut={{ modifiers: ["cmd", "shift"], key: "c" }}
                        />
                      </ActionPanel.Section>
                      <ActionPanel.Section>
                        {resourceIsFavorite ? (
                          <Action
                            title="Remove from Favorites"
                            icon={Icon.StarDisabled}
                            shortcut={{ modifiers: ["cmd"], key: "s" }}
                            onAction={() => handleRemoveFromFavorites(res.id)}
                          />
                        ) : (
                          <Action
                            title="Add to Favorites"
                            icon={Icon.Star}
                            shortcut={{ modifiers: ["cmd"], key: "s" }}
                            onAction={() => handleAddToFavorites(res)}
                          />
                        )}
                      </ActionPanel.Section>
                    </ActionPanel>
                  }
                />
              );
            })}
          </List.Section>
        )}
        {searchText && isLoadingAllResources && (
          <List.Section title="Searching...">
            <List.Item
              title="Loading resources from all subscriptions..."
              icon={Icon.MagnifyingGlass}
            />
          </List.Section>
        )}
        {!searchText && favorites.length > 0 && (
          <List.Section title="Favorites">
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
                        title="Open in Azure Portal"
                        url={getPortalUrl(resource.id)}
                        icon={Icon.Globe}
                        onOpen={() => handleOpenInPortal(resource)}
                      />
                      <Action.CopyToClipboard
                        title="Copy Resource ID"
                        content={resource.id}
                        shortcut={{ modifiers: ["cmd"], key: "c" }}
                      />
                      <Action.CopyToClipboard
                        title="Copy Resource Name"
                        content={resource.name}
                        shortcut={{ modifiers: ["cmd", "shift"], key: "c" }}
                      />
                    </ActionPanel.Section>
                    <ActionPanel.Section>
                      <Action
                        title="Remove from Favorites"
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
        {!searchText && history.length > 0 && (
          <List.Section title="Recently Accessed">
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
                        title="Open in Azure Portal"
                        url={getPortalUrl(item.resource.id)}
                        icon={Icon.Globe}
                        onOpen={() => handleOpenInPortal(item.resource)}
                      />
                      <Action.CopyToClipboard
                        title="Copy Resource ID"
                        content={item.resource.id}
                        shortcut={{ modifiers: ["cmd"], key: "c" }}
                      />
                      <Action.CopyToClipboard
                        title="Copy Resource Name"
                        content={item.resource.name}
                        shortcut={{ modifiers: ["cmd", "shift"], key: "c" }}
                      />
                    </ActionPanel.Section>
                    <ActionPanel.Section>
                      {!isFavorite(item.resource.id) && (
                        <Action
                          title="Add to Favorites"
                          icon={Icon.Star}
                          shortcut={{ modifiers: ["cmd"], key: "s" }}
                          onAction={() => handleAddToFavorites(item.resource)}
                        />
                      )}
                      <Action
                        title="Clear History"
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
        {!searchText && (
          <List.Section title="Subscriptions">
            {sortedSubscriptions.map((sub) => (
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
                    ? { tag: { value: "Default", color: Color.Blue } }
                    : {},
                  { tag: sub.state },
                ]}
                actions={
                  <ActionPanel>
                    <Action
                      title="Select Subscription"
                      icon={Icon.ArrowRight}
                      onAction={() => setSelectedSubscription(sub)}
                    />
                    {!sub.isDefault && (
                      <Action
                        title="Set as Default"
                        icon={Icon.Star}
                        shortcut={{ modifiers: ["cmd"], key: "d" }}
                        onAction={() => handleSetDefaultSubscription(sub)}
                      />
                    )}
                  </ActionPanel>
                }
              />
            ))}
          </List.Section>
        )}
      </List>
    );
  }

  // Resource list view for selected subscription
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
      searchBarPlaceholder="Search resources..."
      searchText={searchText}
      onSearchTextChange={setSearchText}
      navigationTitle={selectedSubscription.name}
      searchBarAccessory={
        <List.Dropdown
          tooltip="Filter"
          onChange={(value) => {
            if (value.startsWith("type:")) {
              setTypeFilter(value.replace("type:", ""));
            } else if (value.startsWith("location:")) {
              setLocationFilter(value.replace("location:", ""));
            }
          }}
        >
          <List.Dropdown.Section title="Resource Type">
            <List.Dropdown.Item
              title="All Types"
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
          <List.Dropdown.Section title="Location">
            <List.Dropdown.Item
              title="All Locations"
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
      <List.Section title={`Resources (${filteredResources.length})`}>
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
                      title="Open in Azure Portal"
                      url={getPortalUrl(res.id)}
                      icon={Icon.Globe}
                      onOpen={() => handleOpenInPortal(res)}
                    />
                    <Action.CopyToClipboard
                      title="Copy Resource ID"
                      content={res.id}
                      shortcut={{ modifiers: ["cmd"], key: "c" }}
                    />
                    <Action.CopyToClipboard
                      title="Copy Resource Name"
                      content={res.name}
                      shortcut={{ modifiers: ["cmd", "shift"], key: "c" }}
                    />
                    {res.tags && Object.keys(res.tags).length > 0 && (
                      <Action.CopyToClipboard
                        title="Copy Tags"
                        content={JSON.stringify(res.tags, null, 2)}
                        shortcut={{ modifiers: ["cmd", "opt"], key: "c" }}
                      />
                    )}
                  </ActionPanel.Section>
                  <ActionPanel.Section>
                    {resourceIsFavorite ? (
                      <Action
                        title="Remove from Favorites"
                        icon={Icon.StarDisabled}
                        shortcut={{ modifiers: ["cmd"], key: "s" }}
                        onAction={() => handleRemoveFromFavorites(res.id)}
                      />
                    ) : (
                      <Action
                        title="Add to Favorites"
                        icon={Icon.Star}
                        shortcut={{ modifiers: ["cmd"], key: "s" }}
                        onAction={() => handleAddToFavorites(res)}
                      />
                    )}
                    <Action
                      title="Back to Subscriptions"
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
