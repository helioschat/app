import { browser } from '$app/environment';
import { get, writable } from 'svelte/store';

export interface FavoriteModel {
  providerInstanceId: string;
  modelId: string;
}

export interface LastUsedModel {
  providerInstanceId: string;
  modelId: string;
  usedAt: number; // unix timestamp ms
}

const FAVORITES_KEY = 'favoriteModels';
const LAST_USED_KEY = 'lastUsedModels';
const MAX_LAST_USED = 5;

function loadFromStorage<T>(key: string, fallback: T): T {
  if (!browser) return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

// --- Favorites store ---
function createFavoritesStore() {
  const initial = loadFromStorage<FavoriteModel[]>(FAVORITES_KEY, []);
  const store = writable<FavoriteModel[]>(initial);

  if (browser) {
    store.subscribe((value) => {
      localStorage.setItem(FAVORITES_KEY, JSON.stringify(value));
    });
  }

  function isFavorite(providerInstanceId: string, modelId: string): boolean {
    return get(store).some((m) => m.providerInstanceId === providerInstanceId && m.modelId === modelId);
  }

  function toggleFavorite(providerInstanceId: string, modelId: string): void {
    store.update((favorites) => {
      const exists = favorites.some((m) => m.providerInstanceId === providerInstanceId && m.modelId === modelId);
      if (exists) {
        return favorites.filter((m) => !(m.providerInstanceId === providerInstanceId && m.modelId === modelId));
      } else {
        return [...favorites, { providerInstanceId, modelId }];
      }
    });
  }

  return { ...store, isFavorite, toggleFavorite };
}

// --- Last used store ---
function createLastUsedStore() {
  const initial = loadFromStorage<LastUsedModel[]>(LAST_USED_KEY, []);
  const store = writable<LastUsedModel[]>(initial);

  if (browser) {
    store.subscribe((value) => {
      localStorage.setItem(LAST_USED_KEY, JSON.stringify(value));
    });
  }

  function recordUsage(providerInstanceId: string, modelId: string): void {
    store.update((entries) => {
      // Remove existing entry for this model if present
      const filtered = entries.filter((m) => !(m.providerInstanceId === providerInstanceId && m.modelId === modelId));
      // Prepend newest entry and cap at MAX_LAST_USED
      return [{ providerInstanceId, modelId, usedAt: Date.now() }, ...filtered].slice(0, MAX_LAST_USED);
    });
  }

  return { ...store, recordUsage };
}

export const favoriteModels = createFavoritesStore();
export const lastUsedModels = createLastUsedStore();
