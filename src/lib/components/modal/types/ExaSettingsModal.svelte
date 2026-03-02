<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import Modal from '../Modal.svelte';

  export let id: string;
  export let isOpen = false;
  export let apiKey = '';

  const dispatch = createEventDispatcher<{
    close: void;
    save: { apiKey: string };
  }>();

  let draft = '';

  $: if (isOpen) {
    draft = apiKey;
  }

  function handleClose() {
    dispatch('close');
  }

  function handleSave() {
    dispatch('save', { apiKey: draft.trim() });
  }
</script>

<Modal {id} title="Exa Search Settings" {isOpen} on:close={handleClose} smallWidth>
  <div class="flex flex-col gap-4">
    <div class="flex flex-col gap-1">
      <label for="{id}-api-key" class="text-sm font-medium">API Key</label>
      <input
        id="{id}-api-key"
        type="password"
        bind:value={draft}
        class="w-full font-mono"
        placeholder="Enter your Exa API key" />
      <p class="text-secondary text-xs opacity-75">
        Get a free key at
        <a href="https://dashboard.exa.ai/api-keys" target="_blank" rel="noopener noreferrer" class="underline">
          dashboard.exa.ai/api-keys
        </a>. Once an API key is set and the tool is enabled, activate it per chat via the wrench button in the input
        bar.
      </p>
    </div>
  </div>

  <svelte:fragment slot="footer">
    <button class="button button-secondary" on:click={handleClose}>Cancel</button>
    <button class="button button-primary" on:click={handleSave}>Save</button>
  </svelte:fragment>
</Modal>
