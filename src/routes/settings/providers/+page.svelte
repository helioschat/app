<script lang="ts">
  import ProviderAddModal from '$lib/components/modal/types/ProviderAddModal.svelte';
  import Provider from '$lib/components/settings/Provider.svelte';
  import { detectKnownProvider } from '$lib/providers/known';
  import { providerInstances, settingsManager } from '$lib/settings/SettingsManager';
  import { modelCache } from '$lib/stores/modelCache';

  let showAddModal = $state(false);

  async function handleAddProvider(event: CustomEvent) {
    const { name, providerType, apiKey, baseURL } = event.detail;

    // Add the provider instance
    const providerId = settingsManager.addProviderInstance(name, providerType, { apiKey, baseURL });

    // Detect if this config matches a known provider for metadata purposes
    const matchedProvider = detectKnownProvider({ apiKey, baseURL });
    if (matchedProvider) {
      settingsManager.updateProviderInstance(providerId, {
        config: { apiKey, baseURL, matchedProvider },
      });
    }

    // Sync models for the new provider
    try {
      const { getLanguageModel } = await import('$lib/providers/registry');
      const newProvider = {
        id: providerId,
        name,
        providerType,
        config: { apiKey, baseURL, matchedProvider },
      };
      await modelCache.syncProvider(newProvider, getLanguageModel);

      // Apply default disabled models based on known provider metadata
      const all = modelCache.getAllCachedModels();
      const modelsForProvider = all[providerId] ?? [];
      settingsManager.applyDefaultDisabledModels(providerId, matchedProvider, modelsForProvider);
    } catch (error) {
      console.error('Failed to sync models for new provider:', error);
    }

    showAddModal = false;
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
  <button class="button button-primary" on:click={() => (showAddModal = true)}>Add New Provider</button>
</div>

<ProviderAddModal
  id="provider-add-modal"
  isOpen={showAddModal}
  on:close={() => (showAddModal = false)}
  on:select={handleAddProvider}></ProviderAddModal>
