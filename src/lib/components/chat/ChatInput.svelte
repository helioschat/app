<script lang="ts">
  import { Send, Square, VenetianMask, Paperclip } from 'lucide-svelte';
  import { providerInstances, selectedModel } from '$lib/settings/SettingsManager';
  import { availableModels } from '$lib/stores/modelCache';
  import { onMount, tick } from 'svelte';
  import ModelSelectorModal from '$lib/components/modal/types/ModelSelectorModal.svelte';
  import MessageAttachments from './MessageAttachments.svelte';
  import { browser } from '$app/environment';
  import type { Attachment } from '$lib/types';
  import type { ModelInfo } from '$lib/providers/base';
  import { createAttachment, getSupportedModalities, getAcceptForModalities } from '$lib/utils/attachments';

  export let userInput: string = '';
  export let isLoading: boolean = false;
  export let handleSubmit: (e: Event, attachments?: Attachment[]) => Promise<void>;
  export let handleStop: () => Promise<void>;
  export let showTemporaryToggle: boolean = false;
  export let isTemporary: boolean = false;

  let userInputComponent: HTMLTextAreaElement;
  let fileInput: HTMLInputElement;

  let showModelSelector = false;
  let cachedModels: Record<string, ModelInfo[]> = {};
  let attachments: Attachment[] = [];

  $: currentModel = $selectedModel
    ? cachedModels[$selectedModel.providerInstanceId]?.find((m) => m.id === $selectedModel.modelId)
    : null;
  $: modelFeatures = currentModel?.architecture?.inputModalities || [];
  $: ({ supportsImages, supportsFiles } = getSupportedModalities(modelFeatures));
  $: canAttachFiles = supportsImages || supportsFiles;

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
    await handleSubmit(e, attachments);
    attachments = []; // Clear attachments after submit
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

  async function handleFileSelect(e: Event) {
    const target = e.target as HTMLInputElement;
    const files = target.files;
    if (!files) return;

    for (const file of files) {
      try {
        const attachment = await createAttachment(file);
        if (attachment) {
          attachments = [...attachments, attachment];
        }
      } catch (error) {
        console.error('Failed to create attachment:', error);
        // You might want to show a toast notification here
      }
    }

    // Clear the input
    target.value = '';
  }

  function handleAttachClick() {
    if (fileInput) {
      fileInput.click();
    }
  }

  function handleRemoveAttachment(e: CustomEvent<{ id: string }>) {
    attachments = attachments.filter((a) => a.id !== e.detail.id);
  }
</script>

<form on:submit={(e) => submit(e)} class="mx-auto mb-8 w-full max-w-4xl px-4">
  <!-- Hidden file input -->
  <input
    type="file"
    bind:this={fileInput}
    on:change={handleFileSelect}
    accept={getAcceptForModalities(modelFeatures)}
    multiple
    style="display: none;" />

  <!-- Attachments -->
  {#if attachments.length > 0}
    <MessageAttachments {attachments} canRemove on:remove={handleRemoveAttachment} />
  {/if}

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
        <div class="flex items-center gap-2">
          {#if canAttachFiles}
            <button
              type="button"
              on:click={handleAttachClick}
              disabled={isLoading}
              class="button button-secondary button-small !px-2"
              title="Attach files">
              <Paperclip size={16} />
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
        disabled={!userInput.trim() && attachments.length === 0}
        class="button button-main button-large !rounded-full"
        class:opacity-50={!userInput.trim() && attachments.length === 0}>
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
