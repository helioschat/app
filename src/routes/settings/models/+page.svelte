<script lang="ts">
  import Spinner from '$lib/components/common/Spinner.svelte';
  import ModelList from '$lib/components/common/ModelList.svelte';
  import { settingsManager, providerInstances, disabledModels } from '$lib/settings/SettingsManager';
  import { availableModels, modelCache } from '$lib/stores/modelCache';
  import type { ModelInfo } from '$lib/providers';
  import type { ProviderInstance } from '$lib/types';
  import { onMount } from 'svelte';
  import { get } from 'svelte/store';
  import { CheckCheck, RefreshCcw, SquareCheckBig, SquareMinus } from 'lucide-svelte';

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

  function handleToggleModel(event: CustomEvent<{ providerInstanceId: string; modelId: string }>) {
    const { providerInstanceId, modelId } = event.detail;
    toggleModel(providerInstanceId, modelId);
  }

  function toggleAllModelsGlobally(enable: boolean) {
    for (const instance of $providerInstances) {
      const modelIds = cachedModels[instance.id]?.map((model) => model.id) || [];
      if (modelIds.length > 0) {
        settingsManager.toggleAllModels(instance.id, enable, modelIds);
      }
    }
    // Force a UI update by creating a new object reference
    cachedModels = { ...cachedModels };
  }

  async function refreshModels() {
    loading = true;
    const getProviderInstances = () => get(settingsManager.providerInstances);
    const { getLanguageModel } = await import('$lib/providers/registry');
    await modelCache.syncNow(getProviderInstances, getLanguageModel);
    loading = false;
  }

  function applyRecommendedModelsGlobally() {
    for (const instance of $providerInstances) {
      const models = cachedModels[instance.id] || [];
      if (models.length > 0) {
        settingsManager.applyRecommendedModels(instance.id, instance.config.matchedProvider, models);
      }
    }
    // Force a UI update by creating a new object reference
    cachedModels = { ...cachedModels };
  }
</script>

{#if loading}
  <div class="flex justify-center p-4">
    <Spinner></Spinner>
  </div>
{:else}
  <div class="flex flex-wrap justify-start gap-2 md:justify-between">
    <div class="flex flex-wrap gap-2">
      <button type="button" onclick={() => toggleAllModelsGlobally(true)} class="button button-secondary">
        <SquareCheckBig size={14}></SquareCheckBig>
        Enable All Models
      </button>
      <button type="button" onclick={() => toggleAllModelsGlobally(false)} class="button button-secondary">
        <SquareMinus size={14}></SquareMinus>
        Disable All Models
      </button>
      <button type="button" onclick={applyRecommendedModelsGlobally} class="button button-secondary">
        <CheckCheck size={14}></CheckCheck>
        Apply Recommended Models
      </button>
    </div>
    <div class="flex flex-wrap gap-2">
      <button type="button" onclick={refreshModels} class="button button-secondary" disabled={loading}>
        <RefreshCcw size={14}></RefreshCcw>
        Refresh Models
      </button>
    </div>
  </div>

  <ModelList
    providerInstances={$providerInstances}
    availableModels={cachedModels}
    mode="toggle"
    showSearch={true}
    maxHeight="none"
    enabledModelsState={disabledModelsState}
    on:toggle={handleToggleModel} />
{/if}
