<script lang="ts">
  import Spinner from '$lib/components/common/Spinner.svelte';
  import { settingsManager, providerInstances, disabledModels } from '$lib/settings/SettingsManager';
  import type { ModelInfo } from '$lib/providers';
  import { onMount } from 'svelte';

  let availableModels = $state<Record<string, ModelInfo[]>>({});
  let loading = $state(true);
  let disabledModelsState = $state<Record<string, string[]>>({});

  onMount(async () => {
    availableModels = await settingsManager.loadAvailableModels();
    loading = false;
    // Subscribe to disabledModels changes
    disabledModels.subscribe((value) => {
      disabledModelsState = value;
      availableModels = { ...availableModels };
    });
  });

  function toggleModel(providerInstanceId: string, modelId: string) {
    settingsManager.toggleModel(providerInstanceId, modelId);
    // We need to trigger a re-render manually here since the change is in a deep object
    availableModels = { ...availableModels };
  }

  function isModelEnabled(providerInstanceId: string, modelId: string) {
    return !(disabledModelsState[providerInstanceId]?.includes(modelId) ?? false);
  }

  function toggleAllModels(providerInstanceId: string, enable: boolean) {
    const modelIds = availableModels[providerInstanceId].map((model) => model.id);
    settingsManager.toggleAllModels(providerInstanceId, enable, modelIds);
    // Force a UI update by creating a new object reference
    availableModels[providerInstanceId] = [...availableModels[providerInstanceId]];
    availableModels = { ...availableModels };
  }

  function areAllModelsEnabled(providerInstanceId: string) {
    const models = availableModels[providerInstanceId];
    if (!models || models.length === 0) return false;
    return models.every((model) => isModelEnabled(providerInstanceId, model.id));
  }
</script>

{#if loading}
  <div class="flex justify-center p-4">
    <Spinner></Spinner>
  </div>
{:else}
  {#each $providerInstances as instance (instance.id)}
    <div class="mb-6">
      <h3 class="mb-3 text-xl font-semibold">{instance.name} ({instance.providerType})</h3>
      <div class="space-y-2">
        {#if availableModels[instance.id]?.length}
          <input
            type="checkbox"
            id={`select-all-${instance.id}`}
            checked={areAllModelsEnabled(instance.id)}
            on:change={(e) => toggleAllModels(instance.id, e.currentTarget.checked)} />
          <label for={`select-all-${instance.id}`} class="select-none">Select All Models</label>
          {#each availableModels[instance.id] as model (model.id)}
            <div
              class="button button-secondary button-large select-none"
              on:click={() => toggleModel(instance.id, model.id)}>
              <input
                type="checkbox"
                id={`${instance.id}-${model.id}`}
                checked={isModelEnabled(instance.id, model.id)}
                on:change={() => toggleModel(instance.id, model.id)} />
              <div class="ml-3 h-full w-full flex-1 text-left">
                <p class="font-medium">{model.name}</p>
                {#if model.description}
                  <p class="text-secondary">{model.description}</p>
                {/if}
              </div>
              {#if model.contextWindow}
                <div class="text-sm text-gray-500">
                  Context: {model.contextWindow.toLocaleString()} tokens
                </div>
              {/if}
            </div>
          {/each}
        {:else}
          <p class="text-gray-500">No models available. Check your API key and Base URL in the Providers tab.</p>
        {/if}
      </div>
    </div>
  {/each}
{/if}
