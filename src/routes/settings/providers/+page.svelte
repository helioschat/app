<script lang="ts">
  import ProviderModal from '$lib/components/modal/types/ProviderModal.svelte';
  import Provider from '$lib/components/settings/Provider.svelte';
  import { detectKnownProvider } from '$lib/providers/known';
  import { providerInstances, settingsManager } from '$lib/settings/SettingsManager';
  import { modelCache } from '$lib/stores/modelCache';
  import { Plus } from 'lucide-svelte';

  let showAddModal = $state(false);

  async function handleAddProvider(event: CustomEvent) {
    const { name, providerType, apiKey, baseURL, matchedProvider } = event.detail;

    // Add the provider instance with detected or provided matched provider
    const finalMatchedProvider = matchedProvider || detectKnownProvider({ apiKey, baseURL });
    const providerId = settingsManager.addProviderInstance(name, providerType, {
      apiKey,
      baseURL,
      matchedProvider: finalMatchedProvider,
    });

    // Close modal immediately to keep UI responsive
    showAddModal = false;

    // Sync models for the new provider in the background
    (async () => {
      try {
        const { getLanguageModel } = await import('$lib/providers/registry');
        const newProvider = {
          id: providerId,
          name,
          providerType,
          config: { apiKey, baseURL, matchedProvider: finalMatchedProvider },
        };
        await modelCache.syncProvider(newProvider, getLanguageModel);

        // Apply default disabled models based on known provider metadata
        const all = modelCache.getAllCachedModels();
        const modelsForProvider = all[providerId] ?? [];
        settingsManager.applyDefaultDisabledModels(providerId, finalMatchedProvider, modelsForProvider);
      } catch (error) {
        console.error('Failed to sync models for new provider:', error);
      }
    })();
  }
</script>

<div class="flex flex-wrap justify-start gap-2 md:justify-between">
  <button class="button button-secondary" onclick={() => (showAddModal = true)}>
    <Plus size={14}></Plus>
    Add New Provider
  </button>
</div>

<div class="space-y-2">
  {#each $providerInstances as instance (instance.id)}
    <Provider provider={instance}></Provider>
  {/each}
</div>

<ProviderModal
  id="provider-add-modal"
  isOpen={showAddModal}
  on:close={() => (showAddModal = false)}
  on:save={handleAddProvider}></ProviderModal>
