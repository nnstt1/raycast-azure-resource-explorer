import { LocalStorage } from "@raycast/api";
import { AzureResource } from "../types";

const HISTORY_KEY = "azure-resource-history";
const MAX_HISTORY_ITEMS = 50;

export interface HistoryItem {
  resource: AzureResource;
  accessedAt: number;
}

export async function getHistory(): Promise<HistoryItem[]> {
  const data = await LocalStorage.getItem<string>(HISTORY_KEY);
  if (!data) {
    return [];
  }
  try {
    return JSON.parse(data) as HistoryItem[];
  } catch {
    return [];
  }
}

export async function addToHistory(resource: AzureResource): Promise<void> {
  const history = await getHistory();

  // Remove existing entry for the same resource
  const filtered = history.filter((item) => item.resource.id !== resource.id);

  // Add new entry at the beginning
  const newHistory: HistoryItem[] = [
    { resource, accessedAt: Date.now() },
    ...filtered,
  ].slice(0, MAX_HISTORY_ITEMS);

  await LocalStorage.setItem(HISTORY_KEY, JSON.stringify(newHistory));
}

export async function clearHistory(): Promise<void> {
  await LocalStorage.removeItem(HISTORY_KEY);
}
