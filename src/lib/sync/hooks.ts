import { settingsManager } from '$lib/settings/SettingsManager';
import { syncManager } from '$lib/stores/sync';
import { get } from 'svelte/store';

/**
 * Hook for syncing provider instances and disabled models
 */
export function useProviderSync() {
  /**
   * Sync provider instances with the remote server
   */
  const syncProviderInstances = async (): Promise<void> => {
    await syncManager.pullProviderInstances((remoteProviders) => {
      // Directly update - the comparison logic in autoSync will handle this
      settingsManager.providerInstances.set(remoteProviders);
    });
  };

  /**
   * Sync disabled models with the remote server
   */
  const syncDisabledModels = async (): Promise<void> => {
    await syncManager.pullDisabledModels((remoteDisabledModels) => {
      // Directly update - the comparison logic in autoSync will handle this
      settingsManager.disabledModels.set(remoteDisabledModels);
    });
  };

  /**
   * Sync advanced settings with the remote server
   */
  const syncAdvancedSettings = async (): Promise<void> => {
    await syncManager.pullAdvancedSettings((remoteAdvancedSettings) => {
      // Directly update - the comparison logic in autoSync will handle this
      settingsManager.advancedSettings.set(remoteAdvancedSettings);
    });
  };

  /**
   * Sync both provider instances and disabled models
   */
  const syncAll = async (): Promise<void> => {
    await Promise.all([syncProviderInstancesInternal(), syncDisabledModelsInternal(), syncAdvancedSettingsInternal()]);
  };

  // Internal sync functions
  const syncProviderInstancesInternal = async (): Promise<void> => {
    await syncManager.pullProviderInstances((remoteProviders) => {
      settingsManager.providerInstances.set(remoteProviders);
    });
  };

  const syncDisabledModelsInternal = async (): Promise<void> => {
    await syncManager.pullDisabledModels((remoteDisabledModels) => {
      settingsManager.disabledModels.set(remoteDisabledModels);
    });
  };

  const syncAdvancedSettingsInternal = async (): Promise<void> => {
    await syncManager.pullAdvancedSettings((remoteAdvancedSettings) => {
      settingsManager.advancedSettings.set(remoteAdvancedSettings);
    });
  };

  /**
   * Push local provider instances to remote server
   */
  const pushProviderInstances = async (): Promise<void> => {
    const localProviders = get(settingsManager.providerInstances);
    const syncSettings = syncManager.syncSettings;
    let passphraseHash: string | undefined;

    const unsubscribe = syncSettings.subscribe((settings) => {
      passphraseHash = settings.passphraseHash;
    });
    unsubscribe();

    if (!passphraseHash) {
      throw new Error('No passphrase hash available for encryption');
    }

    await syncManager.pushProviderInstances(localProviders, passphraseHash);
  };

  /**
   * Push local disabled models to remote server
   */
  const pushDisabledModels = async (): Promise<void> => {
    const localDisabledModels = get(settingsManager.disabledModels);
    const syncSettings = syncManager.syncSettings;
    let passphraseHash: string | undefined;

    const unsubscribe = syncSettings.subscribe((settings) => {
      passphraseHash = settings.passphraseHash;
    });
    unsubscribe();

    if (!passphraseHash) {
      throw new Error('No passphrase hash available for encryption');
    }

    await syncManager.pushDisabledModels(localDisabledModels, passphraseHash);
  };

  /**
   * Push local advanced settings to remote server
   */
  const pushAdvancedSettings = async (): Promise<void> => {
    const localAdvancedSettings = get(settingsManager.advancedSettings);
    const syncSettings = syncManager.syncSettings;
    let passphraseHash: string | undefined;

    const unsubscribe = syncSettings.subscribe((settings) => {
      passphraseHash = settings.passphraseHash;
    });
    unsubscribe();

    if (!passphraseHash) {
      throw new Error('No passphrase hash available for encryption');
    }

    await syncManager.pushAdvancedSettings(localAdvancedSettings, passphraseHash);
  };

  return {
    syncProviderInstances,
    syncDisabledModels,
    syncAdvancedSettings,
    syncAll,
    pushProviderInstances,
    pushDisabledModels,
    pushAdvancedSettings,
    // Automatic sync controls
    startAutomaticSync: syncManager.startAutomaticSync.bind(syncManager),
    stopAutomaticSync: syncManager.stopAutomaticSync.bind(syncManager),
  };
}
