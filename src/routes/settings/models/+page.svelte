<script lang="ts">
  import Spinner from '$lib/components/common/Spinner.svelte';
  import { getAvailableProviders } from '$lib/providers/registry';
  import { settingsManager } from '$lib/settings/SettingsManager';

  export let data;

  $: availableModels = data.availableModels;
  $: loading = false;

  function toggleModel(provider: string, modelId: string) {
    settingsManager.toggleModel(provider, modelId);
  }

  function isModelEnabled(provider: string, modelId: string) {
    return settingsManager.isModelEnabled(provider, modelId);
  }
</script>

{#if loading}
  <div class="flex justify-center p-4">
    <Spinner></Spinner>
  </div>
{:else}
  {#each getAvailableProviders() as provider}
    <div class="mb-6">
      <h3 class="mb-3 text-xl font-semibold">{provider}</h3>
      <div class="space-y-2">
        {#if availableModels[provider]?.length}
          {#each availableModels[provider] as model}
            <div class="button button-secondary button-large">
              <input
                type="checkbox"
                id={`${provider}-${model.id}`}
                checked={isModelEnabled(provider, model.id)}
                on:change={() => toggleModel(provider, model.id)}
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
          <p class="text-gray-500">No models available for this provider</p>
        {/if}
      </div>
    </div>
  {/each}
{/if}
