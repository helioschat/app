<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import Modal from '../Modal.svelte';
  import { PROVIDER_TYPES } from '$lib/types';

  export let id: string;
  export let isOpen = false;

  $: name = '';
  $: providerType = 'openai-compatible' as (typeof PROVIDER_TYPES)[number];
  $: apiKey = '';
  $: baseURL = '';

  const dispatch = createEventDispatcher<{
    close: void;
    select: { name: string; providerType: (typeof PROVIDER_TYPES)[number]; apiKey: string; baseURL: string };
  }>();

  function handleClose() {
    name = '';
    providerType = 'openai-compatible' as (typeof PROVIDER_TYPES)[number];
    apiKey = '';
    baseURL = '';
    dispatch('close');
  }

  function handleSave() {
    dispatch('select', {
      name: name,
      providerType: providerType,
      apiKey: apiKey,
      baseURL: baseURL,
    });
    handleClose();
  }
</script>

<Modal {id} title="Add Provider" {isOpen} on:close={handleClose}>
  <div class="flex flex-col gap-2">
    <div class="edit-section">
      <label for="provider-name">Name</label>
      <input type="text" id="provider-name" autocomplete="off" bind:value={name} />
    </div>
    <div class="edit-section">
      <label for="provider-type">Type</label>
      <select id="provider-type" bind:value={providerType}>
        {#each PROVIDER_TYPES as type (type)}
          <option value={type}>{type}</option>
        {/each}
      </select>
    </div>
    <div class="edit-section">
      <label for="provider-api-key">API Key</label>
      <input type="password" id="provider-api-key" placeholder="sk-..." autocomplete="off" bind:value={apiKey} />
    </div>
    <div class="edit-section">
      <label for="provider-api-url">API Base URL (optional)</label>
      <input
        type="text"
        id="provider-api-url"
        placeholder="https://api.openai.com/v1"
        autocomplete="off"
        bind:value={baseURL} />
    </div>
    <button class="button button-primary" on:click={handleSave}>Add</button>
  </div>
</Modal>

<style lang="postcss">
  @reference "tailwind.css";

  .edit-section {
    @apply flex flex-col gap-0.5;
  }
</style>
