<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import Modal from '../Modal.svelte';
  import ModelItem from '$lib/components/common/ModelItem.svelte';
  import { Search } from 'lucide-svelte';
  import type { ModelInfo } from '$lib/providers/base';
  import type { ProviderInstance } from '$lib/types';
  import { settingsManager } from '$lib/settings/SettingsManager';

  export let id: string;
  export let isOpen = false;
  export let providerInstances: ProviderInstance[] = [];
  export let availableModels: Record<string, ModelInfo[]> = {};
  export let currentModelId: string | undefined;

  let searchQuery = '';

  const dispatch = createEventDispatcher<{
    close: void;
    select: { providerInstanceId: string; modelId: string };
  }>();

  function handleClose() {
    searchQuery = '';
    dispatch('close');
  }

  function handleSelect(providerInstanceId: string, modelId: string) {
    dispatch('select', { providerInstanceId, modelId });
    handleClose();
  }
</script>

<Modal {id} title="Select Model" {isOpen} on:close={handleClose}>
  <div class="flex items-center gap-2 pb-4">
    <Search size={20}></Search>
    <input type="text" bind:value={searchQuery} placeholder="Search models..." class="flex-1" autofocus />
  </div>

  <div class="max-h-[400px] overflow-y-auto">
    {#each providerInstances as instance (instance.id)}
      {@const allInstanceModels = availableModels[instance.id] || []}
      {@const enabledAndFilteredModels = allInstanceModels.filter(
        (model) =>
          settingsManager.isModelEnabled(instance.id, model.id) &&
          model.name.toLowerCase().includes(searchQuery.toLowerCase()),
      )}

      {#if enabledAndFilteredModels.length > 0}
        <h3 class="text-primary mt-4 text-sm font-semibold first:mt-0">{instance.name}</h3>
        {#each enabledAndFilteredModels as model (model.id)}
          <ModelItem
            {model}
            mode="select"
            isActive={model.id === currentModelId}
            onclick={() => handleSelect(instance.id, model.id)} />
        {/each}
      {/if}
    {/each}
  </div>
</Modal>
