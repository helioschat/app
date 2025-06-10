<script lang="ts">
  import ProviderAddModal from '$lib/components/modal/types/ProviderAddModal.svelte';
  import Provider from '$lib/components/settings/Provider.svelte';
  import { providerInstances, settingsManager } from '$lib/settings/SettingsManager';

  let showAddModal = $state(false);
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
  on:select={(e) => {
    const { name, providerType, apiKey, baseURL } = e.detail;
    settingsManager.addProviderInstance(name, providerType, { apiKey, baseURL });
    showAddModal = false;
  }}></ProviderAddModal>
