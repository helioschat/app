import { settingsManager } from '$lib/settings/SettingsManager';

export { advancedSettings, enabledModels, providerInstances } from '$lib/settings/SettingsManager';

// Types
export type { AdvancedSettings } from '$lib/settings/SettingsManager';

// Re-export the provider instance management functions from the SettingsManager instance
export const addProviderInstance = settingsManager.addProviderInstance.bind(settingsManager);
export const updateProviderInstance = settingsManager.updateProviderInstance.bind(settingsManager);
export const removeProviderInstance = settingsManager.removeProviderInstance.bind(settingsManager);
