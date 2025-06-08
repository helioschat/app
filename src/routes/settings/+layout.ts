import { settingsManager } from '$lib/settings/SettingsManager';

export async function load() {
  // Load models data once at the layout level to share across all settings pages
  const availableModels = await settingsManager.loadAvailableModels();

  return {
    availableModels,
  };
}

// Client-side only route
export const ssr = false;
