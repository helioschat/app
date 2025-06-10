<script lang="ts">
  import { Send, Square } from 'lucide-svelte';
  import { settingsManager, providerInstances, selectedModel } from '$lib/settings/SettingsManager';
  import { onMount, tick } from 'svelte';
  import ModelSelectorModal from '$lib/components/modal/types/ModelSelectorModal.svelte';

  export let userInput: string = '';
  export let isLoading: boolean = false;
  export let handleSubmit: (e: Event) => Promise<void>;
  export let handleStop: () => Promise<void>;

  let showModelSelector = false;
  let availableModels: Record<string, { id: string; name: string }[]> = {};

  onMount(async () => {
    availableModels = await settingsManager.loadAvailableModels();
  });

  async function openModelSelector() {
    availableModels = await settingsManager.loadAvailableModels();
    await tick();
    showModelSelector = true;
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
          disabled={!userInput.trim()}
          class="button button-main h-12 w-12"
          class:opacity-50={!userInput.trim()}>
          <Send size={20}></Send>
        </button>
      {/if}
    </div>
    <div class="absolute bottom-0 left-0 flex h-12 items-center px-3 pb-3">
      <button
        type="button"
        on:click={openModelSelector}
        disabled={isLoading}
        class="button button-primary button-small !px-2">
        <span>{$selectedModel?.modelId || 'Select Model'}</span>
      </button>
    </div>
  </div>
</form>

<ModelSelectorModal
  id="chat-model-selector"
  isOpen={showModelSelector}
  providerInstances={$providerInstances}
  {availableModels}
  currentModelId={$selectedModel?.modelId}
  on:close={() => (showModelSelector = false)}
  on:select={(e) => {
    const { providerInstanceId, modelId } = e.detail;
    selectedModel.set({ providerInstanceId, modelId });
    showModelSelector = false;
  }}>
</ModelSelectorModal>
