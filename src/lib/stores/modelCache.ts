import { browser } from '$app/environment';
import type { LanguageModel, ModelInfo } from '$lib/providers/base';
import { applyModelOverrides, detectKnownProvider, getDefaultModel } from '$lib/providers/known';
import type { ProviderConfig, ProviderInstance, ProviderType } from '$lib/types';
import { derived, writable } from 'svelte/store';

interface CachedModels {
  models: ModelInfo[];
  timestamp: number;
}

interface ModelCache {
  [provider: string]: CachedModels;
}

interface SyncState {
  isSyncing: boolean;
  lastSyncTime: number | null;
  syncErrors: Record<string, string>;
}

const CACHE_TTL = 1000 * 60 * 60; // 1 hour in milliseconds
const SYNC_INTERVAL = 1000 * 60 * 30; // 30 minutes in milliseconds

/**
 * Sort models by createdAt (newest first), then by name, then by id
 */
function sortModels(models: ModelInfo[]): ModelInfo[] {
  return [...models].sort((a, b) => {
    // If both have createdAt, sort by createdAt (newest first)
    if (a.createdAt && b.createdAt) {
      return b.createdAt - a.createdAt;
    }
    // If only one has createdAt, prioritize the one with createdAt
    if (a.createdAt && !b.createdAt) {
      return -1;
    }
    if (!a.createdAt && b.createdAt) {
      return 1;
    }
    // If neither has createdAt, sort alphabetically by name, then by id
    if (a.name && b.name) {
      return a.name.localeCompare(b.name);
    }
    // If only one has name, prioritize the one with name
    if (a.name && !b.name) {
      return -1;
    }
    if (!a.name && b.name) {
      return 1;
    }
    // If neither has name, sort by id
    return a.id.localeCompare(b.id);
  });
}

function createModelCache() {
  // Initialize from localStorage if available
  const initialCache: ModelCache = browser ? JSON.parse(localStorage.getItem('modelCache') || '{}') : {};
  const initialSyncState: SyncState = {
    isSyncing: false,
    lastSyncTime: null,
    syncErrors: {},
  };

  const { subscribe, set, update } = writable<ModelCache>(initialCache);
  const { subscribe: subscribeSyncState, update: updateSyncState } = writable<SyncState>(initialSyncState);

  // Subscribe to changes and persist to localStorage
  if (browser) {
    subscribe((value) => {
      localStorage.setItem('modelCache', JSON.stringify(value));
    });
  }

  let syncInterval: NodeJS.Timeout | null = null;

  return {
    subscribe,
    set,
    update,
    syncState: { subscribe: subscribeSyncState },

    /**
     * Get all cached models as a record
     */
    getAllCachedModels: (): Record<string, ModelInfo[]> => {
      const cache = browser ? JSON.parse(localStorage.getItem('modelCache') || '{}') : {};
      const result: Record<string, ModelInfo[]> = {};
      const now = Date.now();

      for (const [provider, cached] of Object.entries(cache) as [string, CachedModels][]) {
        if (now - cached.timestamp <= CACHE_TTL) {
          result[provider] = cached.models;
        }
      }

      return result;
    },

    /**
     * Cache models for a provider
     */
    cacheModels: (provider: string, models: ModelInfo[]) => {
      const sortedModels = sortModels(models);
      update((cache) => ({
        ...cache,
        [provider]: {
          models: sortedModels,
          timestamp: Date.now(),
        },
      }));
    },

    /**
     * Clear all cached models
     */
    clearCache: () => {
      set({});
    },

    /**
     * Start background sync
     */
    startBackgroundSync: async (
      getProviderInstances: () => ProviderInstance[],
      getLanguageModel: (type: ProviderType, config: ProviderConfig) => LanguageModel,
    ) => {
      if (!browser) return;

      // Initial sync
      await syncModels(getProviderInstances, getLanguageModel, updateSyncState, update);

      // Set up periodic sync
      syncInterval = setInterval(async () => {
        await syncModels(getProviderInstances, getLanguageModel, updateSyncState, update);
      }, SYNC_INTERVAL);
    },

    /**
     * Stop background sync
     */
    stopBackgroundSync: () => {
      if (syncInterval) {
        clearInterval(syncInterval);
        syncInterval = null;
      }
    },

    /**
     * Manually trigger sync
     */
    syncNow: async (
      getProviderInstances: () => ProviderInstance[],
      getLanguageModel: (type: ProviderType, config: ProviderConfig) => LanguageModel,
    ) => {
      if (!browser) return;
      await syncModels(getProviderInstances, getLanguageModel, updateSyncState, update);
    },

    /**
     * Sync models for a specific provider instance
     */
    syncProvider: async (
      providerInstance: ProviderInstance,
      getLanguageModel: (type: ProviderType, config: ProviderConfig) => LanguageModel,
    ) => {
      if (!browser) return;
      await syncSpecificProvider(providerInstance, getLanguageModel, updateSyncState, update);
    },

    /**
     * Clear cached models for a specific provider
     */
    clearProviderCache: (providerId: string) => {
      update((cache) => {
        const newCache = { ...cache };
        delete newCache[providerId];
        return newCache;
      });
    },
  };
}

/**
 * Background sync function
 */
async function syncModels(
  getProviderInstances: () => ProviderInstance[],
  getLanguageModel: (type: ProviderType, config: ProviderConfig) => LanguageModel,
  updateSyncState: (updater: (state: SyncState) => SyncState) => void,
  updateCache: (updater: (cache: ModelCache) => ModelCache) => void,
) {
  updateSyncState((state) => ({ ...state, isSyncing: true, syncErrors: {} }));

  const instances = getProviderInstances();
  const errors: Record<string, string> = {};

  for (const instance of instances) {
    try {
      const configWithInstanceId = { ...instance.config, providerInstanceId: instance.id };
      const model = getLanguageModel(instance.providerType, configWithInstanceId);
      let models = await model.getAvailableModels();
      const matched = instance.config.matchedProvider;
      if (matched) {
        models = applyModelOverrides(matched, models);
      }

      updateCache((cache) => ({
        ...cache,
        [instance.id]: {
          models: sortModels(models),
          timestamp: Date.now(),
        },
      }));
    } catch (error) {
      console.error(`Failed to sync models for ${instance.name} (${instance.id})`, error);
      errors[instance.id] = error instanceof Error ? error.message : 'Unknown error';
    }
  }

  updateSyncState((state) => ({
    ...state,
    isSyncing: false,
    lastSyncTime: Date.now(),
    syncErrors: errors,
  }));
}

/**
 * Sync models for a specific provider instance
 */
async function syncSpecificProvider(
  instance: ProviderInstance,
  getLanguageModel: (type: ProviderType, config: ProviderConfig) => LanguageModel,
  updateSyncState: (updater: (state: SyncState) => SyncState) => void,
  updateCache: (updater: (cache: ModelCache) => ModelCache) => void,
) {
  updateSyncState((state) => ({
    ...state,
    isSyncing: true,
    syncErrors: { ...state.syncErrors, [instance.id]: '' },
  }));

  try {
    const configWithInstanceId = { ...instance.config, providerInstanceId: instance.id };
    const model = getLanguageModel(instance.providerType, configWithInstanceId);
    let models = await model.getAvailableModels();
    const matched =
      (instance.config as ProviderConfig & { matchedProvider?: string }).matchedProvider ??
      detectKnownProvider(instance.config as ProviderConfig);
    if (matched) {
      models = applyModelOverrides(matched, models);
    }

    updateCache((cache) => ({
      ...cache,
      [instance.id]: {
        models: sortModels(models),
        timestamp: Date.now(),
      },
    }));

    updateSyncState((state) => ({
      ...state,
      isSyncing: false,
      lastSyncTime: Date.now(),
      syncErrors: { ...state.syncErrors, [instance.id]: '' },
    }));
  } catch (error) {
    console.error(`Failed to sync models for ${instance.name} (${instance.id})`, error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    updateSyncState((state) => ({
      ...state,
      isSyncing: false,
      syncErrors: { ...state.syncErrors, [instance.id]: errorMessage },
    }));
  }
}

export const modelCache = createModelCache();

// Create a derived store that provides reactive access to all cached models
export const availableModels = derived([modelCache], () => {
  return modelCache.getAllCachedModels();
});

/**
 * Get the default model for a provider instance, falling back to the first cached model
 */
export function getProviderDefaultModel(
  providerInstanceId: string,
  matchedProviderId: string | undefined,
  cachedModels?: Record<string, ModelInfo[]>,
): string | undefined {
  const models = cachedModels?.[providerInstanceId] || modelCache.getAllCachedModels()[providerInstanceId];
  return getDefaultModel(matchedProviderId || '', models);
}
