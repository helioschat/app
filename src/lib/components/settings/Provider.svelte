<script lang="ts">
  import { settingsManager } from '$lib/settings/SettingsManager';
  import type { ProviderInstance } from '$lib/types';
  import { Pencil, Trash } from 'lucide-svelte';
  import ProviderEditModal from '../modal/types/ProviderEditModal.svelte';
  import ConfirmationModal from '../modal/types/ConfirmationModal.svelte';

  export let provider: ProviderInstance;

  $: showEditModal = false;

  let providerToDelete: string | null = null;

  function handleDeleteProvider(providerId: string) {
    providerToDelete = providerId;
  }

  async function handleConfirmDelete() {
    if (providerToDelete) {
      settingsManager.removeProviderInstance(providerToDelete);
      providerToDelete = null;
    }
  }

  function handleCancelDelete() {
    providerToDelete = null;
  }
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<!-- svelte-ignore a11y_click_events_have_key_events -->
<div
  class="button button-secondary button-large flex w-full !justify-between !text-left"
  on:click={() => (showEditModal = true)}>
  <div class="flex">
    <div></div>
    <div>
      <h3 class="font-semibold">{provider.name}</h3>
      <h4 class="text-secondary">{provider.config.baseURL}</h4>
    </div>
  </div>
  <div class="flex">
    <button class="button button-secondary" on:click={() => (showEditModal = true)}>
      <Pencil size={20}></Pencil>
    </button>
    <button
      class="button button-secondary"
      on:click|preventDefault|stopPropagation={() => handleDeleteProvider(provider.id)}>
      <Trash size={20}></Trash>
    </button>
  </div>
</div>

<ProviderEditModal
  id="provider-edit-modal"
  {provider}
  isOpen={showEditModal}
  on:close={() => (showEditModal = false)}
  on:select={(e) => {
    const { name, apiKey, apiBaseUrl } = e.detail;
    settingsManager.updateProviderInstance(provider.id, {
      name,
      config: {
        apiKey,
        baseURL: apiBaseUrl,
      },
    });
    showEditModal = false;
  }}></ProviderEditModal>

<ConfirmationModal
  id="delete-provider-modal"
  title="Delete Provider"
  message="Are you sure you want to delete this provider? This action cannot be undone."
  confirmText="Delete"
  cancelText="Cancel"
  isDangerous={true}
  isOpen={providerToDelete !== null}
  on:confirm={handleConfirmDelete}
  on:cancel={handleCancelDelete} />
