<script lang="ts">
  import { settingsManager } from '$lib/settings/SettingsManager';
  import { modelCache } from '$lib/stores/modelCache';
  import type { ProviderInstance } from '$lib/types';
  import { Pencil, Trash } from 'lucide-svelte';
  import ProviderModal from '../modal/types/ProviderModal.svelte';
  import ConfirmationModal from '../modal/types/ConfirmationModal.svelte';
  import { KNOWN_PROVIDERS } from '$lib/providers/known';

  export let provider: ProviderInstance;

  $: matchedProvider = provider.config.matchedProvider ? KNOWN_PROVIDERS[provider.config.matchedProvider] : null;

  $: showEditModal = false;

  let providerToDelete: string | null = null;

  function handleDeleteProvider(providerId: string) {
    providerToDelete = providerId;
  }

  async function handleConfirmDelete() {
    if (providerToDelete) {
      // Clear cache for the provider before deleting
      modelCache.clearProviderCache(providerToDelete);
      settingsManager.removeProviderInstance(providerToDelete);
      providerToDelete = null;
    }
  }

  function handleCancelDelete() {
    providerToDelete = null;
  }

  async function handleProviderUpdate(event: CustomEvent) {
    const { name, apiKey, baseURL, matchedProvider } = event.detail;

    // Update the provider instance
    settingsManager.updateProviderInstance(provider.id, {
      name,
      config: {
        apiKey,
        baseURL,
        matchedProvider,
      },
    });

    // Close modal immediately to keep UI responsive
    showEditModal = false;

    // Clear old cache and sync new models in the background
    modelCache.clearProviderCache(provider.id);

    // Import getLanguageModel and sync models for this provider
    (async () => {
      try {
        const { getLanguageModel } = await import('$lib/providers/registry');
        const updatedProvider = {
          ...provider,
          name,
          config: { apiKey, baseURL, matchedProvider },
        };
        await modelCache.syncProvider(updatedProvider, getLanguageModel);
      } catch (error) {
        console.error('Failed to sync models after provider update:', error);
      }
    })();
  }
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<!-- svelte-ignore a11y_click_events_have_key_events -->
<div
  class="button button-secondary button-large w-full !justify-between !text-left"
  on:click={() => (showEditModal = true)}>
  <div class="flex gap-3">
    {#if matchedProvider && matchedProvider.icon}
      <div class="flex items-center">
        <div class="provider-icon h-8 w-8 bg-white" style="--icon: url({matchedProvider.icon});"></div>
      </div>
    {/if}
    <div class="flex flex-col justify-center gap-1">
      <h3 class="font-semibold">{provider.name}</h3>
      <h4 class="text-secondary">{provider.config.baseURL}</h4>
    </div>
  </div>
  <div class="flex">
    <button class="button button-ghost button-circle" on:click={() => (showEditModal = true)}>
      <Pencil size={20}></Pencil>
    </button>
    <button
      class="button button-ghost button-circle"
      on:click|preventDefault|stopPropagation={() => handleDeleteProvider(provider.id)}>
      <Trash size={20}></Trash>
    </button>
  </div>
</div>

<ProviderModal
  id="provider-edit-modal"
  {provider}
  isOpen={showEditModal}
  on:close={() => (showEditModal = false)}
  on:save={handleProviderUpdate}></ProviderModal>

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

<style lang="postcss">
  .provider-icon {
    mask-position: center;
    mask-size: 100%;
    mask-repeat: no-repeat;
    mask-image: var(--icon);
  }
</style>
