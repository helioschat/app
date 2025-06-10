<script lang="ts">
  import Spinner from '$lib/components/common/Spinner.svelte';
  import { settingsManager, providerInstances } from '$lib/settings/SettingsManager';
  import type { ModelInfo } from '$lib/providers';
  import { onMount } from 'svelte';

  let availableModels = $state<Record<string, ModelInfo[]>>({});
  let loading = $state(true);

  onMount(async () => {
    availableModels = await settingsManager.loadAvailableModels();
    loading = false;
  });

  function toggleModel(providerInstanceId: string, modelId: string) {
    settingsManager.toggleModel(providerInstanceId, modelId);
    // We need to trigger a re-render manually here since the change is in a deep object
    availableModels = { ...availableModels };
  }

  function isModelEnabled(providerInstanceId: string, modelId: string) {
    return settingsManager.isModelEnabled(providerInstanceId, modelId);
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
          {#each availableModels[instance.id] as model (model.id)}
            <div class="button button-secondary button-large">
              <input
                type="checkbox"
                id={`${instance.id}-${model.id}`}
                checked={isModelEnabled(instance.id, model.id)}
                on:change={() => toggleModel(instance.id, model.id)}
                class="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
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
