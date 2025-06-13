<script lang="ts">
  import { Send, Square, VenetianMask } from 'lucide-svelte';
  import { providerInstances, selectedModel } from '$lib/settings/SettingsManager';
  import { availableModels } from '$lib/stores/modelCache';
  import { onMount, tick } from 'svelte';
  import ModelSelectorModal from '$lib/components/modal/types/ModelSelectorModal.svelte';
  import { browser } from '$app/environment';

  export let userInput: string = '';
  export let isLoading: boolean = false;
  export let handleSubmit: (e: Event) => Promise<void>;
  export let handleStop: () => Promise<void>;
  export let showTemporaryToggle: boolean = false;
  export let isTemporary: boolean = false;

  let userInputComponent: HTMLTextAreaElement;

  let showModelSelector = false;
  let cachedModels: Record<string, { id: string; name: string }[]> = {};

  onMount(() => {
    cachedModels = $availableModels;

    // Subscribe to model cache changes
    const unsubscribe = availableModels.subscribe((models) => {
      cachedModels = models;
    });

    if (browser && userInputComponent) resizeTextarea({ target: userInputComponent } as unknown as Event);

    return unsubscribe;
  });

  async function openModelSelector() {
    await tick();
    showModelSelector = true;
  }

  async function submit(e: Event) {
    e.preventDefault();
    await handleSubmit(e);
    resizeTextarea({ target: userInputComponent } as unknown as Event);
  }

  function resizeTextarea(e: Event) {
    const target = e.target as HTMLTextAreaElement;
    target.style.height = 'auto';
    target.style.height = target.scrollHeight + 'px';
  }

  function submitTextarea(e: KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      submit(e);
    }
  }
</script>

<form on:submit={(e) => submit(e)} class="mx-auto mb-8 w-full max-w-4xl px-4">
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
          on:keydown={submitTextarea}
          on:change={resizeTextarea}></textarea>
      </div>
      <div class="flex h-7 items-center justify-between">
        <div class="flex items-center gap-2">
          <button
            type="button"
            on:click={openModelSelector}
            disabled={isLoading || !browser}
            class="button button-primary button-small !px-2">
            <span>{$selectedModel?.modelId || 'Select Model'}</span>
          </button>
          {#if showTemporaryToggle}
            <button
              type="button"
              on:click={() => (isTemporary = !isTemporary)}
              disabled={isLoading}
              class="button button-small !px-2"
              class:button-secondary={!isTemporary}
              class:button-primary={isTemporary}
              title={isTemporary ? "Temporary chat (won't be saved)" : 'Regular chat (will be saved)'}>
              <VenetianMask size={16}></VenetianMask>
              <span class="hidden lg:block">Temporary</span>
            </button>
          {/if}
        </div>
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
  availableModels={cachedModels}
  currentModelId={$selectedModel?.modelId}
  on:close={() => (showModelSelector = false)}
  on:select={(e) => {
    const { providerInstanceId, modelId } = e.detail;
    selectedModel.set({ providerInstanceId, modelId });
    showModelSelector = false;
  }}>
</ModelSelectorModal>
