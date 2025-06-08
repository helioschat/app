import { browser } from '$app/environment';
import type { ModelInfo } from '$lib/providers/base';
import { getAvailableProviders, getLanguageModel } from '$lib/providers/registry';
import { modelCache } from '$lib/stores/modelCache';
import type { Provider, ProviderConfig } from '$lib/types';
import { PROVIDER_OPENAI } from '$lib/types';
import { get, writable } from 'svelte/store';

// Advanced settings interface
export interface AdvancedSettings {
  systemPrompt: string;
}

export class SettingsManager {
  // Default settings
  private static readonly defaultProviderSettings: Record<Provider, ProviderConfig> = {
    [PROVIDER_OPENAI]: { apiKey: '', baseUrl: '', model: 'gpt-4.1-nano' },
  };

  private static readonly defaultAdvancedSettings: Record<string, AdvancedSettings> = {
    default: {
      systemPrompt: 'You are a helpful AI assistant.',
    },
  };

  // Stores
  public readonly providerSettings = writable<Record<Provider, ProviderConfig>>(this.getInitialProviderSettings());
  public readonly selectedProvider = writable<Provider>(this.getInitialProvider());
  public readonly advancedSettings = writable<Record<string, AdvancedSettings>>(this.getInitialAdvancedSettings());
  public readonly enabledModels = writable<Record<string, string[]>>({});

  constructor() {
    // Initialize persistence
    if (browser) {
      this.providerSettings.subscribe((value) => {
        localStorage.setItem('providerSettings', JSON.stringify(value));
      });

      this.selectedProvider.subscribe((value) => {
        localStorage.setItem('selectedProvider', JSON.stringify(value));
      });

      this.advancedSettings.subscribe((value) => {
        localStorage.setItem('advancedSettings', JSON.stringify(value));
      });

      this.enabledModels.subscribe((value) => {
        localStorage.setItem('enabledModels', JSON.stringify(value));
      });
    }
  }

  // Initialize provider settings from localStorage or defaults
  private getInitialProviderSettings(): Record<Provider, ProviderConfig> {
    if (browser) {
      const storedValue = localStorage.getItem('providerSettings');
      if (storedValue) {
        try {
          // Merge with default values to ensure all providers have proper defaults
          return { ...SettingsManager.defaultProviderSettings, ...JSON.parse(storedValue) };
        } catch (error) {
          console.error('Error parsing provider settings from localStorage', error);
          return SettingsManager.defaultProviderSettings;
        }
      }
    }
    return SettingsManager.defaultProviderSettings;
  }

  private getInitialProvider(): Provider {
    if (browser) {
      const storedProvider = localStorage.getItem('selectedProvider');
      if (storedProvider) {
        try {
          const provider = JSON.parse(storedProvider);
          if (getAvailableProviders().includes(provider)) {
            return provider;
          }
        } catch {
          // ignore
        }
      }
    }
    return PROVIDER_OPENAI;
  }

  // Initialize advanced settings from localStorage or defaults
  private getInitialAdvancedSettings(): Record<string, AdvancedSettings> {
    if (browser) {
      const storedValue = localStorage.getItem('advancedSettings');
      if (storedValue) {
        try {
          return JSON.parse(storedValue);
        } catch (error) {
          console.error('Error parsing advanced settings from localStorage', error);
          return SettingsManager.defaultAdvancedSettings;
        }
      }
    }
    return SettingsManager.defaultAdvancedSettings;
  }

  /**
   * Register a new provider with default settings
   * @param provider Provider ID
   * @param defaultConfig Default configuration
   */
  public registerProviderSettings(provider: Provider, defaultConfig: ProviderConfig): void {
    this.providerSettings.update((settings) => {
      // Only add if it doesn't exist
      if (!settings[provider]) {
        settings[provider] = defaultConfig;
      }
      return settings;
    });
  }

  /**
   * Get advanced settings for a provider
   * @param provider Provider ID
   * @returns Advanced settings for the provider or default settings
   */
  public getAdvancedSettingsForProvider(provider: Provider): AdvancedSettings {
    const settings = get(this.advancedSettings);
    return settings[provider] || settings.default || SettingsManager.defaultAdvancedSettings.default;
  }

  /**
   * Check if a model is enabled
   * @param provider Provider ID
   * @param modelId Model ID
   * @returns Whether the model is enabled
   */
  public isModelEnabled(provider: string, modelId: string): boolean {
    const models = get(this.enabledModels);
    return models[provider]?.includes(modelId) ?? true; // Default to enabled
  }

  /**
   * Toggle model enabled/disabled
   * @param provider Provider ID
   * @param modelId Model ID
   */
  public toggleModel(provider: string, modelId: string): void {
    this.enabledModels.update((models) => {
      // Initialize if not exists
      if (!models[provider]) {
        models[provider] = [];
      }

      // Toggle model
      if (models[provider].includes(modelId)) {
        models[provider] = models[provider].filter((id) => id !== modelId);
      } else {
        models[provider].push(modelId);
      }

      return models;
    });
  }

  /**
   * Load all available models for all providers
   * @returns Promise resolving to a record of available models by provider
   */
  public async loadAvailableModels(): Promise<Record<string, ModelInfo[]>> {
    const availableModels: Record<string, ModelInfo[]> = {};
    const providers = getAvailableProviders();
    const currentSettings = get(this.providerSettings);

    // Load models for each provider
    for (const provider of providers) {
      try {
        // Check cache first
        const cachedModels = modelCache.getCachedModels(provider);
        if (cachedModels) {
          availableModels[provider] = cachedModels;
          continue;
        }

        // Cache miss - fetch from provider
        const model = getLanguageModel(provider, currentSettings[provider] || {});
        const models = await model.getAvailableModels();

        // Cache the results since we got them without error
        modelCache.cacheModels(provider, models);
        availableModels[provider] = models;
      } catch (error) {
        // Don't cache results when we hit an error since these will be fallback models
        console.error(`Failed to fetch models for ${provider}`, error);
        availableModels[provider] = [];
      }
    }

    return availableModels;
  }
}

// Settings singleton
export const settingsManager = new SettingsManager();

export const { providerSettings, selectedProvider, advancedSettings, enabledModels } = settingsManager;
