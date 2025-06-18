import { browser } from '$app/environment';
import { settingsManager } from '$lib/settings/SettingsManager';
import { authState } from '$lib/stores/sync';
import { get } from 'svelte/store';
import { useProviderSync } from './hooks';

let providerUnsubscribe: (() => void) | null = null;
let modelsUnsubscribe: (() => void) | null = null;
let advancedSettingsUnsubscribe: (() => void) | null = null;
let syncDebounceTimeout: NodeJS.Timeout | null = null;
let authUnsubscribe: (() => void) | null = null;

const SYNC_DEBOUNCE_MS = 2000; // Wait 2 seconds after last change before syncing

// Track the last known values to detect if changes are from sync
let lastKnownProviders: string | null = null;
let lastKnownDisabledModels: string | null = null;
let lastKnownAdvancedSettings: string | null = null;

// Hot reload cleanup
if (browser && import.meta.hot) {
  import.meta.hot.dispose(() => {
    console.log('Hot reload detected - cleaning up auto-sync');
    disableAutoSync();
  });
}

/**
 * Execute a store update with sync values, preventing auto-sync
 */
export function executeAutomaticUpdate(updateFn: () => void): void {
  updateFn();
}

/**
 * Pre-record expected sync values to prevent auto-sync triggers
 */
export function recordExpectedSyncValues(
  providers?: unknown,
  disabledModels?: unknown,
  advancedSettings?: unknown,
): void {
  if (providers !== undefined) {
    lastKnownProviders = JSON.stringify(providers);
  }
  if (disabledModels !== undefined) {
    lastKnownDisabledModels = JSON.stringify(disabledModels);
  }
  if (advancedSettings !== undefined) {
    lastKnownAdvancedSettings = JSON.stringify(advancedSettings);
  }
}

/**
 * Enable automatic syncing when provider instances or disabled models change
 */
export function enableAutoSync(): void {
  if (!browser) return;

  const providerSync = useProviderSync();

  // Initialize last known values
  lastKnownProviders = JSON.stringify(get(settingsManager.providerInstances));
  lastKnownDisabledModels = JSON.stringify(get(settingsManager.disabledModels));
  lastKnownAdvancedSettings = JSON.stringify(get(settingsManager.advancedSettings));

  // Debounced sync function
  const debouncedSync = (syncFn: () => Promise<void>) => {
    if (syncDebounceTimeout) {
      clearTimeout(syncDebounceTimeout);
    }

    syncDebounceTimeout = setTimeout(async () => {
      const auth = get(authState);
      if (!auth.isAuthenticated) return;

      try {
        await syncFn();
      } catch (error) {
        console.error('Auto-sync failed:', error);
        // Don't throw - auto-sync failures should be silent
      }
    }, SYNC_DEBOUNCE_MS);
  };

  // Subscribe to provider instances changes
  if (!providerUnsubscribe) {
    providerUnsubscribe = settingsManager.providerInstances.subscribe((currentProviders) => {
      const currentSerialized = JSON.stringify(currentProviders);

      // If this matches our last known sync value, it's from sync - don't auto-sync
      if (lastKnownProviders === currentSerialized) {
        return;
      }

      // Update our known value and trigger sync
      lastKnownProviders = currentSerialized;
      debouncedSync(() => providerSync.pushProviderInstances());
    });
  }

  // Subscribe to disabled models changes
  if (!modelsUnsubscribe) {
    modelsUnsubscribe = settingsManager.disabledModels.subscribe((currentModels) => {
      const currentSerialized = JSON.stringify(currentModels);

      // If this matches our last known sync value, it's from sync - don't auto-sync
      if (lastKnownDisabledModels === currentSerialized) {
        return;
      }

      // Update our known value and trigger sync
      lastKnownDisabledModels = currentSerialized;
      debouncedSync(() => providerSync.pushDisabledModels());
    });
  }

  // Subscribe to advanced settings changes
  if (!advancedSettingsUnsubscribe) {
    advancedSettingsUnsubscribe = settingsManager.advancedSettings.subscribe((currentSettings) => {
      const currentSerialized = JSON.stringify(currentSettings);

      // If this matches our last known sync value, it's from sync - don't auto-sync
      if (lastKnownAdvancedSettings === currentSerialized) {
        return;
      }

      // Update our known value and trigger sync
      lastKnownAdvancedSettings = currentSerialized;
      debouncedSync(() => providerSync.pushAdvancedSettings());
    });
  }
}

/**
 * Disable automatic syncing
 */
export function disableAutoSync(): void {
  if (providerUnsubscribe) {
    providerUnsubscribe();
    providerUnsubscribe = null;
  }

  if (modelsUnsubscribe) {
    modelsUnsubscribe();
    modelsUnsubscribe = null;
  }

  if (advancedSettingsUnsubscribe) {
    advancedSettingsUnsubscribe();
    advancedSettingsUnsubscribe = null;
  }

  if (syncDebounceTimeout) {
    clearTimeout(syncDebounceTimeout);
    syncDebounceTimeout = null;
  }

  if (authUnsubscribe) {
    authUnsubscribe();
    authUnsubscribe = null;
  }

  // Reset known values
  lastKnownProviders = null;
  lastKnownDisabledModels = null;
  lastKnownAdvancedSettings = null;
}

/**
 * Check if auto-sync is currently enabled
 */
export function isAutoSyncEnabled(): boolean {
  return providerUnsubscribe !== null && modelsUnsubscribe !== null && advancedSettingsUnsubscribe !== null;
}

// Auto-enable sync when user logs in
if (browser) {
  authUnsubscribe = authState.subscribe((auth) => {
    if (auth.isAuthenticated && !isAutoSyncEnabled()) {
      enableAutoSync();
    } else if (!auth.isAuthenticated && isAutoSyncEnabled()) {
      disableAutoSync();
    }
  });
}

/**
 * Global cleanup function for both hot reloads and component destruction
 */
export function cleanupAutoSync(): void {
  disableAutoSync();
  console.log('Auto-sync cleaned up');
}
