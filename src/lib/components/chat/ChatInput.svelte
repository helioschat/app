<script lang="ts">
  import { Send, Square } from 'lucide-svelte';
  import { settingsManager, providerInstances, selectedModel } from '$lib/settings/SettingsManager';
  import { onMount, tick } from 'svelte';
  import ModelSelectorModal from '$lib/components/modal/types/ModelSelectorModal.svelte';
  import { browser } from '$app/environment';

  export let userInputComponent: HTMLTextAreaElement;
  export let userInput: string = '';
  export let isLoading: boolean = false;
  export let handleSubmit: (e: Event) => Promise<void>;
  export let handleStop: () => Promise<void>;

  let showModelSelector = false;
  let availableModels: Record<string, { id: string; name: string }[]> = {};

  onMount(async () => {
    availableModels = await settingsManager.loadAvailableModels();
    if (browser && userInputComponent) resizeTextarea({ target: userInputComponent } as unknown as Event);
  });

  async function openModelSelector() {
    availableModels = await settingsManager.loadAvailableModels();
    await tick();
    showModelSelector = true;
  }

  function resizeTextarea(e: Event) {
    const target = e.target as HTMLTextAreaElement;
    target.style.height = 'auto';
    target.style.height = target.scrollHeight + 'px';
  }

  function submitTextarea(e: KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  }
</script>

<form
  on:submit={(e) => {
    e.preventDefault();
    handleSubmit(e);
  }}
  class="mx-auto mb-8 w-full max-w-4xl px-4">
  <div class="flex w-full gap-4">
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <div
      class="flex flex-1 cursor-text flex-col gap-4 rounded-[28px] bg-[var(--color-3)] p-3 text-[var(--color-a12)]"
      on:click|stopPropagation={() => userInputComponent?.focus()}>
      <div class="flex flex-1">
        <textarea
          bind:this={userInputComponent}
          bind:value={userInput}
          rows="1"
          placeholder="Ask anything..."
          disabled={isLoading}
          class="max-h-52 min-h-6 flex-1 resize-none !rounded-none !p-0 outline-none"
          on:input={resizeTextarea}
          on:keydown={submitTextarea}></textarea>
      </div>
      <div class="flex h-7 items-center">
        <button
          type="button"
          on:click={openModelSelector}
          disabled={isLoading}
          class="button button-primary button-small !px-2">
          <span>{$selectedModel?.modelId || 'Select Model'}</span>
        </button>
      </div>
    </div>
    {#if isLoading}
      <button type="button" on:click={handleStop} class="button button-main button-large !rounded-full">
        <Square size={20}></Square>
      </button>
    {:else}
      <button
        type="submit"
        disabled={!userInput.trim()}
        class="button button-main button-large !rounded-full"
        class:opacity-50={!userInput.trim()}>
        <Send size={20}></Send>
      </button>
    {/if}
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
