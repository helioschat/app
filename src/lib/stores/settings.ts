import { settingsManager } from '$lib/settings/SettingsManager';

export {
  advancedSettings,
  disabledModels,
  personalizationSettings,
  providerInstances,
  toolsSettings,
} from '$lib/settings/SettingsManager';

// Types
export type { AdvancedSettings, PersonalizationSettings, ToolsSettings } from '$lib/settings/SettingsManager';

// Re-export the provider instance management functions from the SettingsManager instance
export const addProviderInstance = settingsManager.addProviderInstance.bind(settingsManager);
export const updateProviderInstance = settingsManager.updateProviderInstance.bind(settingsManager);
export const removeProviderInstance = settingsManager.removeProviderInstance.bind(settingsManager);
