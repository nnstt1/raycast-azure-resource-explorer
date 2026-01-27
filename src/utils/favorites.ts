import { LocalStorage } from "@raycast/api";
import { AzureResource } from "../types";

const FAVORITES_KEY = "azure-resource-favorites";

export async function getFavorites(): Promise<AzureResource[]> {
  const data = await LocalStorage.getItem<string>(FAVORITES_KEY);
  if (!data) {
    return [];
  }
  try {
    return JSON.parse(data) as AzureResource[];
  } catch {
    return [];
  }
}

export async function addToFavorites(resource: AzureResource): Promise<void> {
  const favorites = await getFavorites();

  // Check if already exists
  if (favorites.some((f) => f.id === resource.id)) {
    return;
  }

  const newFavorites = [...favorites, resource];
  await LocalStorage.setItem(FAVORITES_KEY, JSON.stringify(newFavorites));
}

export async function removeFromFavorites(resourceId: string): Promise<void> {
  const favorites = await getFavorites();
  const newFavorites = favorites.filter((f) => f.id !== resourceId);
  await LocalStorage.setItem(FAVORITES_KEY, JSON.stringify(newFavorites));
}

export async function isFavorite(resourceId: string): Promise<boolean> {
  const favorites = await getFavorites();
  return favorites.some((f) => f.id === resourceId);
}
