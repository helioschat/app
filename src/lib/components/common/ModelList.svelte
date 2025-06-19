<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import ModelItem from './ModelItem.svelte';
  import { Search } from 'lucide-svelte';
  import type { ModelInfo } from '$lib/providers/base';
  import type { ProviderInstance } from '$lib/types';
  import { settingsManager } from '$lib/settings/SettingsManager';

  export let providerInstances: ProviderInstance[] = [];
  export let availableModels: Record<string, ModelInfo[]> = {};
  export let mode: 'select' | 'toggle' = 'select';
  export let showSearch = true;
  export let maxHeight = '400px';
  export let currentModelId: string | undefined = undefined;
  export let enabledModelsState: Record<string, string[]> = {};

  let searchQuery = '';

  const dispatch = createEventDispatcher<{
    select: { providerInstanceId: string; modelId: string };
    toggle: { providerInstanceId: string; modelId: string };
  }>();

  function handleSelect(providerInstanceId: string, modelId: string) {
    dispatch('select', { providerInstanceId, modelId });
  }

  function handleToggle(providerInstanceId: string, modelId: string) {
    dispatch('toggle', { providerInstanceId, modelId });
  }

  function isModelEnabled(providerInstanceId: string, modelId: string) {
    if (mode === 'select') {
      return settingsManager.isModelEnabled(providerInstanceId, modelId);
    } else {
      return !(enabledModelsState[providerInstanceId]?.includes(modelId) ?? false);
    }
  }

  function getFilteredModels(instance: ProviderInstance) {
    const allInstanceModels = availableModels[instance.id] || [];

    if (mode === 'select') {
      return allInstanceModels.filter(
        (model) =>
          settingsManager.isModelEnabled(instance.id, model.id) &&
          model.name.toLowerCase().includes(searchQuery.toLowerCase()),
      );
    } else {
      return allInstanceModels.filter((model) => model.name.toLowerCase().includes(searchQuery.toLowerCase()));
    }
  }
</script>

{#if showSearch}
  <div class="flex items-center gap-2 pb-4">
    <Search size={20}></Search>
    <input type="text" bind:value={searchQuery} placeholder="Search models..." class="flex-1" />
  </div>
{/if}

<div class="overflow-x-hidden overflow-y-auto" style="max-height: {maxHeight}">
  {#if providerInstances.length > 0}
    {#each providerInstances as instance (instance.id)}
      {@const filteredModels = getFilteredModels(instance)}

      {#if filteredModels.length > 0}
        <h3 class="text-primary mt-4 text-sm font-semibold first:mt-0">{instance.name}</h3>
        <div class="space-y-2">
          {#each filteredModels as model (model.id)}
            <ModelItem
              {model}
              {mode}
              minimal={mode === 'select'}
              isActive={mode === 'select' && model.id === currentModelId}
              isEnabled={mode === 'toggle' ? isModelEnabled(instance.id, model.id) : undefined}
              onclick={mode === 'select' ? () => handleSelect(instance.id, model.id) : undefined}
              onchange={mode === 'toggle' ? () => handleToggle(instance.id, model.id) : undefined} />
          {/each}
        </div>
      {:else}
        <p class="empty-notice">No providers with available models found. Please configure your providers first.</p>
      {/if}
    {/each}
  {:else}
    <p class="empty-notice">No providers found. Please configure your providers first.</p>
  {/if}
</div>

<style lang="postcss">
  @reference "tailwindcss";

  .empty-notice {
    @apply my-8 text-center text-sm text-[var(--color-a11)];
  }
</style>
