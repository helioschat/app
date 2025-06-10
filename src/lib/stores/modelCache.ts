import { browser } from '$app/environment';
import type { ModelInfo } from '$lib/providers/base';
import { writable } from 'svelte/store';

interface CachedModels {
  models: ModelInfo[];
  timestamp: number;
}

interface ModelCache {
  [provider: string]: CachedModels;
}

const CACHE_TTL = 1000 * 60 * 60; // 1 hour in milliseconds

function createModelCache() {
  // Initialize from localStorage if available
  const initialCache: ModelCache = browser ? JSON.parse(localStorage.getItem('modelCache') || '{}') : {};

  const { subscribe, set, update } = writable<ModelCache>(initialCache);

  // Subscribe to changes and persist to localStorage
  if (browser) {
    subscribe((value) => {
      localStorage.setItem('modelCache', JSON.stringify(value));
    });
  }

  return {
    subscribe,
    set,
    update,

    /**
     * Get cached models for a provider if they exist and are not expired
     */
    getCachedModels: (provider: string): ModelInfo[] | null => {
      const cache = browser ? JSON.parse(localStorage.getItem('modelCache') || '{}') : {};
      const cached = cache[provider];

      if (!cached) return null;

      const now = Date.now();
      if (now - cached.timestamp > CACHE_TTL) {
        // Cache expired, remove it
        update((cache) => {
          const newCache = { ...cache };
          delete newCache[provider];
          return newCache;
        });
        return null;
      }

      return cached.models;
    },

    /**
     * Cache models for a provider
     */
    cacheModels: (provider: string, models: ModelInfo[]) => {
      update((cache) => ({
        ...cache,
        [provider]: {
          models,
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
  };
}

export const modelCache = createModelCache();
