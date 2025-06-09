import type { ModelInfo } from '$lib/providers/base';
import { getAvailableProviders, getLanguageModel } from '$lib/providers/registry';
import { derived, get, writable } from 'svelte/store';
import { modelCache } from './modelCache';
import { providerSettings, selectedProvider } from './settings';

function createModelSelectorStore() {
  const { subscribe, update } = writable({
    showModelSelector: false,
    availableModels: {} as Record<string, ModelInfo[]>,
    loading: true,
  });

  return {
    subscribe,
    setShowModelSelector: (value: boolean) => update((state) => ({ ...state, showModelSelector: value })),
    setAvailableModels: (models: Record<string, ModelInfo[]>) =>
      update((state) => ({ ...state, availableModels: models })),
    setLoading: (value: boolean) => update((state) => ({ ...state, loading: value })),
  };
}

export const modelSelectorState = createModelSelectorStore();

export const currentModelName = derived(
  [modelSelectorState, selectedProvider, providerSettings],
  ([$modelSelectorState, $selectedProvider, $providerSettings]) => {
    return (
      $modelSelectorState.availableModels[$selectedProvider]?.find(
        (m) => m.id === $providerSettings[$selectedProvider]?.model,
      )?.name || 'Select Model'
    );
  },
);

export async function loadModels() {
  modelSelectorState.setLoading(true);
  try {
    const providers = getAvailableProviders();
    const newModels: Record<string, ModelInfo[]> = {};

    for (const provider of providers) {
      const cachedModels = modelCache.getCachedModels(provider);
      if (cachedModels) {
        newModels[provider] = cachedModels;
      } else {
        const model = getLanguageModel(provider, get(providerSettings)[provider] || {});
        const models = await model.getAvailableModels();
        modelCache.cacheModels(provider, models);
        newModels[provider] = models;
      }
    }

    modelSelectorState.setAvailableModels(newModels);
  } catch (error) {
    console.error('Failed to load models:', error);
  } finally {
    modelSelectorState.setLoading(false);
  }
}

export function handleModelSelect(modelId: string) {
  const provider = get(selectedProvider);
  providerSettings.update((settings) => ({
    ...settings,
    [provider]: {
      ...settings[provider],
      model: modelId,
    },
  }));
  modelSelectorState.setShowModelSelector(false);
}

// Subscribe to provider changes to reload models
selectedProvider.subscribe((provider) => {
  if (provider) {
    loadModels();
  }
});
