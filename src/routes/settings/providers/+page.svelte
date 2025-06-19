<script lang="ts">
  import ProviderModal from '$lib/components/modal/types/ProviderModal.svelte';
  import Provider from '$lib/components/settings/Provider.svelte';
  import { detectKnownProvider } from '$lib/providers/known';
  import { providerInstances, settingsManager } from '$lib/settings/SettingsManager';
  import { modelCache } from '$lib/stores/modelCache';

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

<div>
  <h2 class="text-xl font-semibold">Manage Providers</h2>
  <p class="text-sm text-gray-500">Add, remove, and configure your AI providers.</p>
</div>

<div class="space-y-4">
  {#each $providerInstances as instance (instance.id)}
    <Provider provider={instance}></Provider>
  {/each}
  <button class="button button-primary" onclick={() => (showAddModal = true)}>Add New Provider</button>
</div>

<ProviderModal
  id="provider-add-modal"
  isOpen={showAddModal}
  on:close={() => (showAddModal = false)}
  on:save={handleAddProvider}></ProviderModal>
