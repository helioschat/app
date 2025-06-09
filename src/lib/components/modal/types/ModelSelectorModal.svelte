<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import Modal from '../Modal.svelte';
  import { Search } from 'lucide-svelte';
  import type { ModelInfo } from '$lib/providers/base';

  export let id: string;
  export let isOpen = false;
  export let models: ModelInfo[] = [];
  export let currentModelId: string | undefined;

  let searchQuery = '';

  const dispatch = createEventDispatcher<{
    close: void;
    select: { modelId: string };
  }>();

  function handleClose() {
    searchQuery = '';
    dispatch('close');
  }

  function handleSelect(modelId: string) {
    dispatch('select', { modelId });
    handleClose();
  }

  $: filteredModels = models.filter((model) => model.name.toLowerCase().includes(searchQuery.toLowerCase()));
</script>

<Modal {id} title="Select Model" {isOpen} on:close={handleClose}>
  <div class="flex items-center gap-2 pb-4">
    <Search size={20}></Search>
    <input type="text" bind:value={searchQuery} placeholder="Search models..." class="flex-1" autofocus />
  </div>

  <div class="max-h-[400px] overflow-y-auto">
    {#each filteredModels as model}
      <button
        type="button"
        on:click={() => handleSelect(model.id)}
        class="button button-secondary button-large w-full border-0 border-none"
        class:active={model.id === currentModelId}>
        <div class="flex-1 text-left">
          <div class="text-primary font-medium">{model.name}</div>
          {#if model.description}
            <div class="text-secondary text-sm">{model.description}</div>
          {/if}
        </div>
      </button>
    {/each}
  </div>
</Modal>
