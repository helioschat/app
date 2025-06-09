<script lang="ts">
  import { providerSettings, selectedProvider } from '$lib/stores/settings';
  import { getAvailableProviders } from '$lib/providers/registry';
  import { PROVIDER_OPENAI } from '$lib/types';
  import Spinner from '$lib/components/common/Spinner.svelte';

  export let data;

  $: availableModels = data.availableModels;
  $: loading = false;
</script>

<div>
  <label for="provider" class="mb-2">Select Provider</label>
  <select id="provider" bind:value={$selectedProvider}>
    {#each getAvailableProviders() as provider}
      <option value={provider}>{provider}</option>
    {/each}
  </select>
</div>

{#if loading}
  <div class="flex justify-center p-4">
    <Spinner></Spinner>
  </div>
{:else if $selectedProvider === PROVIDER_OPENAI}
  <div class="space-y-4">
    <div>
      <label for="openai-apiKey" class="mb-2 block font-medium">API Key</label>
      <input
        type="password"
        id="openai-apiKey"
        bind:value={$providerSettings[PROVIDER_OPENAI].apiKey}
        placeholder="sk-..." />
    </div>
    <div>
      <label for="openai-baseUrl" class="mb-2 block font-medium">Base URL (optional)</label>
      <input
        type="text"
        id="openai-baseUrl"
        bind:value={$providerSettings[PROVIDER_OPENAI].baseUrl}
        placeholder="https://api.openai.com/v1" />
      <p class="mt-1 text-sm text-gray-500">Leave empty to use the default OpenAI API endpoint</p>
    </div>
  </div>
{/if}
