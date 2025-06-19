<script lang="ts">
  import Spinner from '$lib/components/common/Spinner.svelte';
  import ModelItem from '$lib/components/common/ModelItem.svelte';
  import { settingsManager, providerInstances, disabledModels } from '$lib/settings/SettingsManager';
  import { availableModels, modelCache } from '$lib/stores/modelCache';
  import type { ModelInfo } from '$lib/providers';
  import type { ProviderInstance } from '$lib/types';
  import { onMount } from 'svelte';
  import { get } from 'svelte/store';

  let cachedModels = $state<Record<string, ModelInfo[]>>({});
  let loading = $state(true);
  let disabledModelsState = $state<Record<string, string[]>>({});
  onMount(() => {
    // Initialize with cached models
    cachedModels = $availableModels;
    loading = false;

    // Check for providers with no models and sync them
    checkAndSyncMissingModels();

    // Subscribe to model cache changes
    const unsubscribeModels = availableModels.subscribe((models) => {
      cachedModels = models;
    });

    // Subscribe to disabledModels changes
    const unsubscribeDisabled = disabledModels.subscribe((value) => {
      disabledModelsState = value;
      // Trigger reactivity by creating new reference
      cachedModels = { ...cachedModels };
    });

    return () => {
      unsubscribeModels();
      unsubscribeDisabled();
    };
  });

  async function checkAndSyncMissingModels() {
    const instances = get(providerInstances);
    const providersToSync: ProviderInstance[] = [];

    // Find providers that have no cached models
    for (const instance of instances) {
      if (!cachedModels[instance.id] || cachedModels[instance.id].length === 0) {
        providersToSync.push(instance);
      }
    }

    if (providersToSync.length > 0) {
      try {
        const { getLanguageModel } = await import('$lib/providers/registry');

        // Sync models for providers with no models
        for (const instance of providersToSync) {
          try {
            await modelCache.syncProvider(instance, getLanguageModel);
          } catch (error) {
            console.error(`Failed to sync models for ${instance.name}:`, error);
          }
        }
      } catch (error) {
        console.error('Failed to import getLanguageModel:', error);
      }
    }
  }

  function toggleModel(providerInstanceId: string, modelId: string) {
    settingsManager.toggleModel(providerInstanceId, modelId);
    // We need to trigger a re-render manually here since the change is in a deep object
    cachedModels = { ...cachedModels };
  }

  function isModelEnabled(providerInstanceId: string, modelId: string) {
    return !(disabledModelsState[providerInstanceId]?.includes(modelId) ?? false);
  }

  function toggleAllModels(providerInstanceId: string, enable: boolean) {
    const modelIds = cachedModels[providerInstanceId]?.map((model) => model.id) || [];
    settingsManager.toggleAllModels(providerInstanceId, enable, modelIds);
    // Force a UI update by creating a new object reference
    if (cachedModels[providerInstanceId]) {
      cachedModels[providerInstanceId] = [...cachedModels[providerInstanceId]];
    }
    cachedModels = { ...cachedModels };
  }

  function areAllModelsEnabled(providerInstanceId: string) {
    const models = cachedModels[providerInstanceId];
    if (!models || models.length === 0) return false;
    return models.every((model) => isModelEnabled(providerInstanceId, model.id));
  }

  async function refreshModels() {
    loading = true;
    const getProviderInstances = () => get(settingsManager.providerInstances);
    const { getLanguageModel } = await import('$lib/providers/registry');
    await modelCache.syncNow(getProviderInstances, getLanguageModel);
    loading = false;
  }

  function applyRecommendedModels(providerInstanceId: string, instance: ProviderInstance) {
    const models = cachedModels[providerInstanceId] || [];
    settingsManager.applyRecommendedModels(providerInstanceId, instance.config.matchedProvider, models);
    // Force a UI update by creating a new object reference
    if (cachedModels[providerInstanceId]) {
      cachedModels[providerInstanceId] = [...cachedModels[providerInstanceId]];
    }
    cachedModels = { ...cachedModels };
  }
</script>

{#if loading}
  <div class="flex justify-center p-4">
    <Spinner></Spinner>
  </div>
{:else}
  <div class="mb-4 flex items-center justify-between">
    <h2 class="text-2xl font-semibold">Model Configuration</h2>
    <button type="button" onclick={refreshModels} class="button button-secondary" disabled={loading}>
      Refresh Models
    </button>
  </div>
  {#each $providerInstances as instance (instance.id)}
    <div class="mb-6">
      <h3 class="mb-3 text-xl font-semibold">{instance.name} ({instance.providerType})</h3>
      <div class="space-y-2">
        {#if cachedModels[instance.id]?.length}
          <div class="mb-3 flex flex-wrap gap-2">
            <div class="flex items-center">
              <input
                type="checkbox"
                id={`select-all-${instance.id}`}
                checked={areAllModelsEnabled(instance.id)}
                onchange={(e) => toggleAllModels(instance.id, e.currentTarget.checked)} />
              <label for={`select-all-${instance.id}`} class="ml-2 select-none">Select All Models</label>
            </div>
            <button
              type="button"
              onclick={() => applyRecommendedModels(instance.id, instance)}
              class="button button-secondary">
              Select Recommended Models
            </button>
          </div>
          {#each cachedModels[instance.id] as model (model.id)}
            <ModelItem
              {model}
              mode="toggle"
              isEnabled={isModelEnabled(instance.id, model.id)}
              onchange={() => toggleModel(instance.id, model.id)} />
          {/each}
        {:else}
          <p class="text-gray-500">No models available. Check your API key and Base URL in the Providers tab.</p>
        {/if}
      </div>
    </div>
  {/each}
{/if}
