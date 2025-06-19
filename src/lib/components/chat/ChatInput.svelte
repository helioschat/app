<script lang="ts">
  import { Square, VenetianMask, Paperclip, Search, ArrowUp } from 'lucide-svelte';
  import { providerInstances, selectedModel, settingsManager } from '$lib/settings/SettingsManager';
  import { availableModels } from '$lib/stores/modelCache';
  import { onMount, tick, createEventDispatcher } from 'svelte';
  import ModelSelectorModal from '$lib/components/modal/types/ModelSelectorModal.svelte';
  import MessageAttachments from './MessageAttachments.svelte';
  import { browser } from '$app/environment';
  import type { Attachment } from '$lib/types';
  import type { ModelInfo } from '$lib/providers/base';
  import {
    createAttachment,
    getSupportedModalities,
    getAcceptForModalities,
    supportsImageGeneration,
  } from '$lib/utils/attachments';
  import { getDefaultModel, detectKnownProvider } from '$lib/providers/known';

  const dispatch = createEventDispatcher<{
    webSearchToggle: { enabled: boolean; contextSize: 'low' | 'medium' | 'high' };
  }>();

  export let userInput: string = '';
  export let isLoading: boolean = false;
  export let handleSubmit: (
    e: Event,
    attachments?: Attachment[],
    webSearchEnabled?: boolean,
    webSearchContextSize?: 'low' | 'medium' | 'high',
  ) => Promise<void>;
  export let handleStop: () => Promise<void>;
  export let showTemporaryToggle: boolean = false;
  export let isTemporary: boolean = false;
  export let webSearchEnabled: boolean = false;
  export let webSearchContextSize: 'low' | 'medium' | 'high' = 'low';

  let userInputComponent: HTMLTextAreaElement;
  let fileInput: HTMLInputElement;

  let showModelSelector = false;
  let cachedModels: Record<string, ModelInfo[]> = {};
  let attachments: Attachment[] = [];

  $: currentModel = $selectedModel
    ? cachedModels[$selectedModel.providerInstanceId]?.find((m) => m.id === $selectedModel.modelId)
    : null;

  // Base model features (for determining if we should show attachment button at all)
  $: baseModelFeatures = currentModel?.architecture?.inputModalities || [];
  $: ({ supportsImages: baseSupportsImages, supportsFiles: baseSupportsFiles } =
    getSupportedModalities(baseModelFeatures));
  $: isImageGenerationModel = currentModel ? supportsImageGeneration(currentModel) : false;
  $: canShowAttachFiles = baseSupportsImages || baseSupportsFiles || isImageGenerationModel;

  // Effective model features (for determining if attachment button should be enabled)
  $: effectiveModel = (() => {
    if (!currentModel || !$selectedModel) return null;

    // If web search is enabled and there's a redirect model, use that model's capabilities
    if (webSearchEnabled && currentModel.webSearchModelRedirect) {
      const redirectModel = cachedModels[$selectedModel.providerInstanceId]?.find(
        (m) => m.id === currentModel.webSearchModelRedirect,
      );
      return redirectModel || currentModel;
    }

    return currentModel;
  })();

  $: effectiveModelFeatures = effectiveModel?.architecture?.inputModalities || [];
  $: ({ supportsImages: effectiveSupportsImages, supportsFiles: effectiveSupportsFiles } =
    getSupportedModalities(effectiveModelFeatures));
  $: isEffectiveImageGenerationModel = effectiveModel ? supportsImageGeneration(effectiveModel) : false;
  $: canAttachFiles = effectiveSupportsImages || effectiveSupportsFiles || isEffectiveImageGenerationModel;
  $: supportsWebSearch = currentModel?.supportsWebSearch || !!currentModel?.webSearchModelRedirect;

  onMount(() => {
    cachedModels = $availableModels;

    // Subscribe to model cache changes
    const unsubscribe = availableModels.subscribe((models) => {
      cachedModels = models;
      // Try to set default model if none is selected
      trySetDefaultModel();
    });

    if (browser && userInputComponent) {
      userInputComponent.focus();
      resizeTextarea({ target: userInputComponent } as unknown as Event);
    }

    // Try to set default model on initial load
    trySetDefaultModel();

    return unsubscribe;
  });

  function trySetDefaultModel() {
    // Only set default if no model is currently selected
    if ($selectedModel) return;

    const instances = $providerInstances;
    if (!instances || instances.length === 0) return;

    // Try to find a provider with cached models and set its default model
    for (const instance of instances) {
      const models = cachedModels[instance.id];
      if (!models || models.length === 0) continue;

      // Detect the known provider type for this instance
      const matchedProvider = instance.config.matchedProvider || detectKnownProvider(instance.config);

      // Get the default model for this provider
      const defaultModelId = getDefaultModel(matchedProvider || '', models);

      if (defaultModelId) {
        // Verify the model exists in the cached models and is enabled
        const modelExists = models.some((m) => m.id === defaultModelId);
        const isEnabled = settingsManager.isModelEnabled(instance.id, defaultModelId);

        if (modelExists && isEnabled) {
          selectedModel.set({ providerInstanceId: instance.id, modelId: defaultModelId });
          return; // Found and set a default model, we're done
        }
      }

      // If the default model isn't available or enabled, try to find the first enabled model
      const firstEnabledModel = models.find((model) => settingsManager.isModelEnabled(instance.id, model.id));
      if (firstEnabledModel) {
        selectedModel.set({ providerInstanceId: instance.id, modelId: firstEnabledModel.id });
        return; // Found and set the first enabled model, we're done
      }
    }
  }

  async function openModelSelector() {
    await tick();
    showModelSelector = true;
  }

  async function submit(e: Event) {
    e.preventDefault();
    await handleSubmit(e, attachments, webSearchEnabled, webSearchContextSize);
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

  function handleWebSearchToggle() {
    const newEnabled = !webSearchEnabled;
    webSearchEnabled = newEnabled;
    dispatch('webSearchToggle', {
      enabled: newEnabled,
      contextSize: webSearchContextSize,
    });
  }
</script>

<form on:submit={(e) => submit(e)} class="mx-auto mb-8 flex w-full max-w-4xl flex-col gap-2 px-4">
  <!-- Hidden file input -->
  <input
    type="file"
    bind:this={fileInput}
    on:change={handleFileSelect}
    accept={getAcceptForModalities(effectiveModelFeatures)}
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
      class="flex flex-1 cursor-text flex-col gap-4 rounded-[28px] border border-[var(--color-a6)]/15 bg-[var(--color-3)]/67.5 px-3 pt-4 pb-3 text-[var(--color-a12)] backdrop-blur-2xl"
      on:click|stopPropagation={() => userInputComponent?.focus()}>
      <div class="flex flex-1">
        <textarea
          bind:this={userInputComponent}
          bind:value={userInput}
          rows="1"
          placeholder={isEffectiveImageGenerationModel
            ? 'Describe the image you want to generate...'
            : 'Ask anything...'}
          disabled={isLoading}
          class="max-h-52 min-h-6 flex-1 resize-none !rounded-none !bg-transparent !px-2 !py-0 outline-none"
          on:input={resizeTextarea}
          on:keydown={submitTextarea}
          on:change={resizeTextarea}
          autofocus></textarea>
      </div>
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2">
          {#if canShowAttachFiles}
            <button
              type="button"
              on:click|preventDefault={handleAttachClick}
              disabled={isLoading || !canAttachFiles}
              class="button button-tertiary button-circle"
              title="Attach files">
              <Paperclip size={16} />
            </button>
          {/if}

          <div class="flex items-center gap-1">
            {#if showTemporaryToggle}
              <button
                on:click|preventDefault={() => (isTemporary = !isTemporary)}
                disabled={isLoading}
                class="button button-circle"
                class:button-tertiary={!isTemporary}
                class:button-secondary={isTemporary}
                title={isTemporary ? "Temporary chat (won't be saved)" : 'Regular chat (will be saved)'}>
                <VenetianMask size={16}></VenetianMask>
                <span class="hidden text-xs lg:block">Temporary</span>
              </button>
            {/if}
            {#if supportsWebSearch}
              <button
                on:click|preventDefault={handleWebSearchToggle}
                disabled={isLoading}
                class="button button-circle"
                class:button-tertiary={!webSearchEnabled}
                class:button-secondary={webSearchEnabled}
                title={webSearchEnabled ? 'Web search enabled' : 'Web search disabled'}>
                <Search size={16}></Search>
                <span class="hidden text-xs lg:block">Search</span>
              </button>
            {/if}
          </div>
        </div>
        <div class="flex items-center gap-2">
          <button
            on:click|preventDefault={openModelSelector}
            disabled={isLoading || !browser}
            class="button button-ghost button-circle">
            <span class="text-xs">{$selectedModel?.modelId || 'Select Model'}</span>
          </button>
          {#if isLoading}
            <button type="button" on:click|preventDefault={handleStop} class="button button-primary button-circle">
              <Square size={14}></Square>
            </button>
          {:else}
            <button
              type="submit"
              disabled={!userInput.trim() && attachments.length === 0}
              class="button button-primary button-circle">
              <ArrowUp size={14}></ArrowUp>
            </button>
          {/if}
        </div>
      </div>
    </div>
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
