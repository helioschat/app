<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import Modal from '../Modal.svelte';
  import ModelList from '$lib/components/common/ModelList.svelte';
  import type { ModelInfo } from '$lib/providers/base';
  import type { ProviderInstance } from '$lib/types';

  export let id: string;
  export let isOpen = false;
  export let providerInstances: ProviderInstance[] = [];
  export let availableModels: Record<string, ModelInfo[]> = {};
  export let currentModelId: string | undefined;

  const dispatch = createEventDispatcher<{
    close: void;
    select: { providerInstanceId: string; modelId: string };
  }>();

  function handleClose() {
    dispatch('close');
  }

  function handleSelect(event: CustomEvent<{ providerInstanceId: string; modelId: string }>) {
    dispatch('select', event.detail);
    handleClose();
  }
</script>

<Modal {id} title="Select Model" {isOpen} on:close={handleClose}>
  <ModelList {providerInstances} {availableModels} {currentModelId} mode="select" on:select={handleSelect} />
</Modal>
