<script lang="ts">
  import { Send, Square } from 'lucide-svelte';
  import { providerSettings, selectedProvider } from '$lib/stores/settings';
  import { getAvailableProviders, getLanguageModel } from '$lib/providers/registry';
  import type { ModelInfo } from '$lib/providers/base';
  import { modelCache } from '$lib/stores/modelCache';
  import { onMount } from 'svelte';

  export let userInput: string = '';
  export let isLoading: boolean = false;
  export let handleSubmit: (e: Event) => Promise<void>;
  export let handleStop: () => Promise<void>;

  let availableModels: Record<string, ModelInfo[]> = {};
  let loading = true;

  onMount(async () => {
    await loadModels();
  });

  async function loadModels() {
    loading = true;
    try {
      const providers = getAvailableProviders();
      for (const provider of providers) {
        const cachedModels = modelCache.getCachedModels(provider);
        if (cachedModels) {
          availableModels[provider] = cachedModels;
        } else {
          const model = getLanguageModel(provider, $providerSettings[provider] || {});
          const models = await model.getAvailableModels();
          modelCache.cacheModels(provider, models);
          availableModels[provider] = models;
        }
      }
    } catch (error) {
      console.error('Failed to load models:', error);
    }
    loading = false;
  }

  $: isInputEmpty = !userInput.trim();
  $: currentProvider = $selectedProvider;
  $: currentModel = $providerSettings[currentProvider]?.model;
  $: currentModels = availableModels[currentProvider] || [];

  function handleModelChange(event: Event) {
    const select = event.target as HTMLSelectElement;
    providerSettings.update((settings) => ({
      ...settings,
      [currentProvider]: {
        ...settings[currentProvider],
        model: select.value,
      },
    }));
  }
</script>

<form
  on:submit={(e) => {
    e.preventDefault();
    handleSubmit(e);
  }}
  class="mx-auto mb-8 w-full max-w-4xl px-4">
  <div class="relative flex flex-1 flex-col">
    <div class="flex w-full gap-4">
      <input
        type="text"
        bind:value={userInput}
        placeholder="Ask anything..."
        disabled={isLoading}
        class="min-h-12 flex-1 !pb-14" />
      {#if isLoading}
        <button type="button" on:click={handleStop} class="button button-main h-12 w-12">
          <Square size={20}></Square>
        </button>
      {:else}
        <button
          type="submit"
          disabled={isInputEmpty}
          class="button button-main h-12 w-12"
          class:opacity-50={isInputEmpty}>
          <Send size={20}></Send>
        </button>
      {/if}
    </div>
    <div class="absolute bottom-0 left-0 flex h-12 items-center px-3 pb-3 text-sm">
      <select disabled={isLoading || loading} value={currentModel} on:change={handleModelChange} class="h-8 w-64 p-0">
        {#each currentModels as model}
          <option value={model.id}>{model.name}</option>
        {/each}
      </select>
    </div>
  </div>
</form>
