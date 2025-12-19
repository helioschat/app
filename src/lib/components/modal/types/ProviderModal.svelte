<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import Modal from '../Modal.svelte';
  import ProviderForm from '../../common/ProviderForm.svelte';
  import { type ProviderInstance, PROVIDER_TYPES } from '$lib/types';

  export let id: string;
  export let isOpen = false;
  export let provider: ProviderInstance | null = null; // null for add mode, ProviderInstance for edit mode

  const dispatch = createEventDispatcher<{
    close: void;
    save: {
      name: string;
      providerType: (typeof PROVIDER_TYPES)[number];
      apiKey: string;
      baseURL: string;
      matchedProvider?: string;
    };
  }>();

  // Form state
  let name = '';
  let providerType = 'openai-compatible' as (typeof PROVIDER_TYPES)[number];
  let apiKey = '';
  let baseURL = '';
  let selectedKnownProvider: string | null = null;

  // Reactive: determine if we're in edit mode
  $: isEditMode = provider !== null;
  $: title = isEditMode ? 'Edit Provider' : 'Add Provider';

  // Initialize form when provider changes
  $: if (provider) {
    name = provider.name;
    providerType = provider.providerType;
    apiKey = provider.config.apiKey || '';
    baseURL = provider.config.baseURL || '';
    selectedKnownProvider = provider.config.matchedProvider || null;
  }

  // Reset form when switching to add mode
  $: if (!provider && isOpen) {
    name = '';
    providerType = 'openai-compatible' as (typeof PROVIDER_TYPES)[number];
    apiKey = '';
    baseURL = '';
    selectedKnownProvider = null;
  }

  $: canSave = name.trim() && baseURL.trim();

  function handleClose() {
    dispatch('close');
  }

  function handleSave() {
    if (canSave) {
      dispatch('save', {
        name: name.trim(),
        providerType,
        apiKey: apiKey.trim(),
        baseURL: baseURL.trim(),
        matchedProvider: selectedKnownProvider || undefined,
      });
    }
  }

  function handleProviderSelect(event: CustomEvent<{ providerId: string }>) {
    selectedKnownProvider = event.detail.providerId;
  }

  function handleCustomSelect() {
    selectedKnownProvider = null;
  }
</script>

<Modal {id} {title} {isOpen} on:close={handleClose}>
  <div class="flex flex-col gap-4">
    <!-- Provider Form Component -->
    <ProviderForm
      bind:name
      bind:apiKey
      bind:baseURL
      bind:selectedKnownProvider
      showQuickSetup={!isEditMode}
      showCustomOption={!isEditMode}
      editingProvider={provider}
      on:providerSelect={handleProviderSelect}
      on:customSelect={handleCustomSelect} />
  </div>

  <svelte:fragment slot="footer">
    <button class="button button-secondary" on:click={handleClose}>Cancel</button>
    <button class="button button-primary" on:click={handleSave} disabled={!canSave}>
      {isEditMode ? 'Save' : 'Add'}
    </button>
  </svelte:fragment>
</Modal>
