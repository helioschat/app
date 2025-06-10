<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import Modal from '../Modal.svelte';
  import { type ProviderInstance } from '$lib/types';

  export let id: string;
  export let isOpen = false;
  export let provider: ProviderInstance;

  const dispatch = createEventDispatcher<{
    close: void;
    select: { name: string; apiKey: string; apiBaseUrl: string };
  }>();

  function handleClose() {
    dispatch('close');
  }

  function handleSave() {
    dispatch('select', {
      name: provider.name,
      apiKey: provider.config.apiKey || '',
      apiBaseUrl: provider.config.baseURL || '',
    });
    handleClose();
  }
</script>

<Modal {id} title="Edit Provider" {isOpen} on:close={handleSave}>
  <div class="flex flex-col gap-2">
    <div class="edit-section">
      <label for="provider-name">Name</label>
      <input type="text" id="provider-name" bind:value={provider.name} />
    </div>
    <div class="edit-section">
      <label for="provider-api-key">API Key</label>
      <input type="password" id="provider-api-key" placeholder="sk-..." bind:value={provider.config.apiKey} />
    </div>
    <div class="edit-section">
      <label for="provider-api-url">API Base URL (optional)</label>
      <input
        type="text"
        id="provider-api-url"
        placeholder="https://api.openai.com/v1"
        bind:value={provider.config.baseURL} />
    </div>
  </div>
</Modal>

<style lang="postcss">
  .edit-section {
    @apply flex flex-col;
  }
</style>
