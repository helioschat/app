import { browser } from '$app/environment';
import type { ProviderConfig, ProviderInstance, ProviderType, SelectedModel } from '$lib/types';
import { get, writable } from 'svelte/store';
import { v7 as uuidv7 } from 'uuid';

// Advanced settings interface
export interface AdvancedSettings {
  systemPrompt: string;
}

export class SettingsManager {
  // Default settings
  private static getDefaultProviderInstances(): ProviderInstance[] {
    return [];
  }

  private static readonly defaultAdvancedSettings: AdvancedSettings = {
    systemPrompt: 'You are a helpful AI assistant.',
  };

  // Stores
  public readonly providerInstances = writable<ProviderInstance[]>(this.getInitialProviderInstances());
  public readonly selectedModel = writable<SelectedModel | null>(this.getInitialSelectedModel());
  public readonly advancedSettings = writable<AdvancedSettings>(this.getInitialAdvancedSettings());
  public readonly disabledModels = writable<Record<string, string[]>>(this.getInitialDisabledModels());

  constructor() {
    // Initialize persistence
    if (browser) {
      this.providerInstances.subscribe((value) => {
        localStorage.setItem('providerInstances', JSON.stringify(value));
      });

      this.selectedModel.subscribe((value) => {
        if (value) {
          localStorage.setItem('selectedModel', JSON.stringify(value));
        } else {
          localStorage.removeItem('selectedModel');
        }
      });

      this.advancedSettings.subscribe((value) => {
        localStorage.setItem('advancedSettings', JSON.stringify(value));
      });

      this.disabledModels.subscribe((value) => {
        localStorage.setItem('disabledModels', JSON.stringify(value));
      });
    }
  }

  // Initialize provider settings from localStorage or defaults
  private getInitialProviderInstances(): ProviderInstance[] {
    if (browser) {
      const storedValue = localStorage.getItem('providerInstances');
      if (storedValue) {
        try {
          return JSON.parse(storedValue);
        } catch (error) {
          console.error('Error parsing provider instances from localStorage', error);
          return SettingsManager.getDefaultProviderInstances();
        }
      }
    }
    return SettingsManager.getDefaultProviderInstances();
  }

  private getInitialSelectedModel(): SelectedModel | null {
    if (browser) {
      const storedValue = localStorage.getItem('selectedModel');
      if (storedValue) {
        try {
          return JSON.parse(storedValue);
        } catch (error) {
          console.error('Error parsing selected model from localStorage', error);
          return null;
        }
      }
    }
    return null;
  }

  // Initialize advanced settings from localStorage or defaults
  private getInitialAdvancedSettings(): AdvancedSettings {
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

  private getInitialDisabledModels(): Record<string, string[]> {
    if (browser) {
      const storedValue = localStorage.getItem('disabledModels');
      if (storedValue) {
        try {
          return JSON.parse(storedValue);
        } catch (error) {
          console.error('Error parsing disabled models from localStorage', error);
          return {};
        }
      }
    }
    return {};
  }

  public addProviderInstance(name: string, providerType: ProviderType, config: ProviderConfig): string {
    const newInstance: ProviderInstance = {
      id: uuidv7(),
      name,
      providerType,
      config,
    };

    this.providerInstances.update((instances) => {
      return [...instances, newInstance];
    });

    return newInstance.id;
  }

  public updateProviderInstance(id: string, update: Partial<ProviderInstance>): void {
    this.providerInstances.update((instances) => {
      return instances.map((instance) => {
        if (instance.id === id) {
          const newConfig =
            instance.config && update.config
              ? { ...instance.config, ...update.config }
              : update.config || instance.config;

          return { ...instance, ...update, config: newConfig };
        }
        return instance;
      });
    });
  }

  public removeProviderInstance(id: string): void {
    this.providerInstances.update((instances) => {
      return instances.filter((instance) => instance.id !== id);
    });

    // If the selected provider is removed, select another one
    if (get(this.selectedModel)?.providerInstanceId === id) {
      const instances = get(this.providerInstances);
      if (instances.length > 0) {
        // Find the first available model for the new default provider
        // This is a bit of a placeholder, a more robust solution would be to
        // fetch the models and select the first one.
        this.selectedModel.set({
          providerInstanceId: instances[0].id,
          modelId: 'default-model', // Placeholder
        });
      } else {
        this.selectedModel.set(null);
      }
    }
  }

  /**
   * Get advanced settings (global)
   * @returns Global advanced settings
   */
  public getAdvancedSettings(): AdvancedSettings {
    return get(this.advancedSettings);
  }

  /**
   * Check if a model is enabled
   * @param providerInstanceId Provider instance ID
   * @param modelId Model ID
   * @returns Whether the model is enabled
   */
  public isModelEnabled(providerInstanceId: string, modelId: string): boolean {
    const models = get(this.disabledModels);
    return !(models[providerInstanceId]?.includes(modelId) ?? false); // Default to enabled
  }

  /**
   * Toggle model enabled/disabled
   * @param providerInstanceId Provider instance ID
   * @param modelId Model ID
   */
  public toggleModel(providerInstanceId: string, modelId: string): void {
    this.disabledModels.update((models) => {
      if (!models[providerInstanceId]) {
        models[providerInstanceId] = [];
      }

      if (models[providerInstanceId].includes(modelId)) {
        models[providerInstanceId] = models[providerInstanceId].filter((id) => id !== modelId);
      } else {
        models[providerInstanceId].push(modelId);
      }

      return models;
    });
  }

  /**
   * Toggle all models for a provider to be enabled or disabled
   * @param providerInstanceId Provider instance ID
   * @param enable If true, enable all models; if false, disable all models
   * @param modelIds List of model IDs to toggle for this provider
   */
  public toggleAllModels(providerInstanceId: string, enable: boolean, modelIds: string[]): void {
    this.disabledModels.update((models) => {
      if (enable) {
        models[providerInstanceId] = [];
      } else {
        models[providerInstanceId] = [...modelIds];
      }
      return models;
    });
  }
}

// Settings singleton
export const settingsManager = new SettingsManager();

export const { providerInstances, selectedModel, advancedSettings, disabledModels } = settingsManager;
