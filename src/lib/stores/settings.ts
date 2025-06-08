import { settingsManager } from '$lib/settings/SettingsManager';

export { advancedSettings, enabledModels, providerSettings, selectedProvider } from '$lib/settings/SettingsManager';

// Types
export type { AdvancedSettings } from '$lib/settings/SettingsManager';

// Re-export the registerProviderSettings function from the SettingsManager instance
export const registerProviderSettings = settingsManager.registerProviderSettings.bind(settingsManager);
