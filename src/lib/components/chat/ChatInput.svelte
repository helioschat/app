<script lang="ts">
  import { Square, VenetianMask, Paperclip, Search, ArrowUp, Brain, Settings, Wrench } from 'lucide-svelte';
  import { providerInstances, selectedModel, settingsManager, toolsSettings } from '$lib/settings/SettingsManager';
  import { availableModels } from '$lib/stores/modelCache';
  import { onMount, tick, createEventDispatcher } from 'svelte';
  import { lastUsedModels } from '$lib/stores/modelPreferences';
  import ModelSelectorModal from '$lib/components/modal/types/ModelSelectorModal.svelte';
  import ReasoningOptionsModal from '$lib/components/modal/types/ReasoningOptionsModal.svelte';
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
  import { promptHistory } from '$lib/stores/promptHistory';
  import { toast } from 'svelte-sonner';

  const dispatch = createEventDispatcher<{
    webSearchToggle: { enabled: boolean; contextSize: 'low' | 'medium' | 'high' };
    reasoningToggle: {
      enabled: boolean;
      effort: 'minimal' | 'low' | 'medium' | 'high';
      summary: 'auto' | 'concise' | 'detailed';
    };
    toolUseToggle: { enabled: boolean };
    memoryToggle: { enabled: boolean };
  }>();

  export let userInput: string = '';
  export let isLoading: boolean = false;
  export let handleSubmit: (
    e: Event,
    attachments?: Attachment[],
    webSearchEnabled?: boolean,
    webSearchContextSize?: 'low' | 'medium' | 'high',
    reasoningEnabled?: boolean,
    reasoningEffort?: 'minimal' | 'low' | 'medium' | 'high',
    reasoningSummary?: 'auto' | 'concise' | 'detailed',
    toolUseEnabled?: boolean,
    memoryEnabled?: boolean,
  ) => Promise<void>;
  export let handleStop: () => Promise<void>;
  export let showTemporaryToggle: boolean = false;
  export let isTemporary: boolean = false;
  export let webSearchEnabled: boolean = false;
  export let webSearchContextSize: 'low' | 'medium' | 'high' = 'low';
  export let reasoningEnabled: boolean = false;
  export let reasoningEffort: 'minimal' | 'low' | 'medium' | 'high' = 'medium';
  export let reasoningSummary: 'auto' | 'concise' | 'detailed' = 'auto';
  export let toolUseEnabled: boolean = false;
  export let memoryEnabled: boolean = true;
  export let noPadding: boolean = false;
  export let isTemporaryChat: boolean = false;

  let userInputComponent: HTMLTextAreaElement;
  let fileInput: HTMLInputElement;

  let showModelSelector = false;
  let showReasoningOptions = false;
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

    return currentModel;
  })();

  $: effectiveModelFeatures = effectiveModel?.architecture?.inputModalities || [];
  $: ({ supportsImages: effectiveSupportsImages, supportsFiles: effectiveSupportsFiles } =
    getSupportedModalities(effectiveModelFeatures));
  $: isEffectiveImageGenerationModel = effectiveModel ? supportsImageGeneration(effectiveModel) : false;
  $: canAttachFiles = effectiveSupportsImages || effectiveSupportsFiles || isEffectiveImageGenerationModel;
  $: supportsWebSearch = currentModel?.supportsWebSearch;
  $: supportsReasoning = currentModel?.supportsReasoning || false;
  $: supportsReasoningSummary = currentModel?.doesntSupportReasoningSummary !== true;
  $: supportsTools = currentModel?.supportsTools || false;

  // Reset the tool-use toggle only when the loaded model explicitly doesn't support tools.
  // Guard with currentModel so we don't fire while models are still loading (currentModel=null).
  $: if (currentModel && !supportsTools && toolUseEnabled) {
    toolUseEnabled = false;
  }

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

  async function openReasoningOptions() {
    await tick();
    showReasoningOptions = true;
  }

  async function submit(e: Event) {
    e.preventDefault();

    // Save to prompt history only if not a temporary chat
    if (!isTemporaryChat && userInput.trim()) {
      promptHistory.addPrompt(userInput.trim());
    }

    await handleSubmit(
      e,
      attachments,
      webSearchEnabled,
      webSearchContextSize,
      reasoningEnabled,
      reasoningEffort,
      reasoningSummary,
      toolUseEnabled,
      memoryEnabled,
    );
    attachments = []; // Clear attachments after submit
    resizeTextarea({ target: userInputComponent } as unknown as Event);
  }

  function resizeTextarea(e: Event) {
    const target = e.target as HTMLTextAreaElement;
    target.style.height = 'auto';
    target.style.height = target.scrollHeight + 'px';
  }

  function handleInputChange(e: Event) {
    // Reset prompt history navigation when user types manually
    promptHistory.resetNavigation();
    resizeTextarea(e);
  }

  function isOnFirstLine(): boolean {
    if (!userInputComponent) return true;
    const cursorPos = userInputComponent.selectionStart;
    return !userInput.substring(0, cursorPos).includes('\n');
  }

  function isOnLastLine(): boolean {
    if (!userInputComponent) return true;
    const cursorPos = userInputComponent.selectionEnd;
    return !userInput.substring(cursorPos).includes('\n');
  }

  function submitTextarea(e: KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      submit(e);
    } else if (e.key === 'ArrowUp' && isOnFirstLine()) {
      e.preventDefault();
      const previousPrompt = promptHistory.navigatePrevious(userInput);
      if (previousPrompt !== null) {
        userInput = previousPrompt;
        // Move cursor to end
        setTimeout(() => {
          if (userInputComponent) {
            userInputComponent.setSelectionRange(userInput.length, userInput.length);
          }
          resizeTextarea(e);
        }, 1);
      }
    } else if (e.key === 'ArrowDown' && isOnLastLine()) {
      e.preventDefault();
      const nextPrompt = promptHistory.navigateNext();
      if (nextPrompt !== null) {
        userInput = nextPrompt;
        // Move cursor to end
        setTimeout(() => {
          if (userInputComponent) {
            userInputComponent.setSelectionRange(userInput.length, userInput.length);
          }
          resizeTextarea(e);
        }, 1);
      }
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

  async function handlePaste(e: ClipboardEvent) {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (const item of items) {
      if (item.type.startsWith('image/')) {
        // Check if the current model supports image attachments
        if (!effectiveSupportsImages && !isEffectiveImageGenerationModel) {
          toast.error('The selected model does not support image attachments.');
          return;
        }

        e.preventDefault();
        const file = item.getAsFile();
        if (!file) continue;

        try {
          const attachment = await createAttachment(file);
          if (attachment) {
            attachments = [...attachments, attachment];
          }
        } catch (error) {
          console.error('Failed to create attachment from pasted image:', error);
        }
      }
    }
  }

  function handleWebSearchToggle() {
    const newEnabled = !webSearchEnabled;
    webSearchEnabled = newEnabled;
    dispatch('webSearchToggle', {
      enabled: newEnabled,
      contextSize: webSearchContextSize,
    });
  }

  function handleReasoningToggle() {
    const newEnabled = !reasoningEnabled;
    reasoningEnabled = newEnabled;
    dispatch('reasoningToggle', {
      enabled: newEnabled,
      effort: reasoningEffort,
      summary: reasoningSummary,
    });
  }

  function handleToolUseToggle() {
    const newEnabled = !toolUseEnabled;
    toolUseEnabled = newEnabled;
    dispatch('toolUseToggle', { enabled: newEnabled });
  }

  function handleMemoryToggle() {
    const newEnabled = !memoryEnabled;
    memoryEnabled = newEnabled;
    dispatch('memoryToggle', { enabled: newEnabled });
  }

  function handleReasoningOptionsSelect(
    event: CustomEvent<{ effort: 'minimal' | 'low' | 'medium' | 'high'; summary: 'auto' | 'concise' | 'detailed' }>,
  ) {
    reasoningEffort = event.detail.effort;
    reasoningSummary = event.detail.summary;
    dispatch('reasoningToggle', {
      enabled: reasoningEnabled,
      effort: reasoningEffort,
      summary: reasoningSummary,
    });
  }
</script>

<form on:submit={(e) => submit(e)} class="mx-auto mb-8 flex w-full max-w-4xl flex-col gap-2" class:px-4={!noPadding}>
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
          id="chat-input-textarea"
          bind:this={userInputComponent}
          bind:value={userInput}
          rows="1"
          placeholder={isEffectiveImageGenerationModel
            ? 'Describe the image you want to generate...'
            : 'Ask anything...'}
          class="max-h-52 min-h-6 flex-1 resize-none !rounded-none !border-none !bg-transparent !px-2 !py-0 !text-base !shadow-none !ring-0"
          on:input={handleInputChange}
          on:keydown={submitTextarea}
          on:change={resizeTextarea}
          on:paste={handlePaste}
          autofocus></textarea>
      </div>
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2">
          {#if canShowAttachFiles}
            <button
              id="chat-attach-button"
              type="button"
              on:click|preventDefault={handleAttachClick}
              disabled={!canAttachFiles}
              class="button button-tertiary button-circle"
              title="Attach files">
              <Paperclip size={16} />
            </button>
          {/if}

          <div class="flex items-center gap-1">
            {#if showTemporaryToggle}
              <button
                on:click|preventDefault={() => (isTemporary = !isTemporary)}
                class="button button-circle"
                class:button-tertiary={!isTemporary}
                class:button-secondary={isTemporary}
                title={isTemporary ? "Temporary chat (won't be saved)" : 'Regular chat (will be saved)'}>
                <VenetianMask size={16}></VenetianMask>
                <span class="hidden text-xs lg:block">Temporary</span>
              </button>
            {/if}
            {#if supportsTools}
              <button
                on:click|preventDefault={handleToolUseToggle}
                class="button button-circle"
                class:button-tertiary={!toolUseEnabled}
                class:button-secondary={toolUseEnabled}
                title={toolUseEnabled ? 'Tools enabled (Exa Search)' : 'Tools disabled'}>
                <Wrench size={16}></Wrench>
                <span class="hidden text-xs lg:block">Tools</span>
              </button>
            {/if}
            {#if supportsTools && !isTemporaryChat}
              <button
                on:click|preventDefault={handleMemoryToggle}
                class="button button-circle"
                class:button-tertiary={!memoryEnabled}
                class:button-secondary={memoryEnabled}
                title={memoryEnabled ? 'Memory enabled' : 'Memory disabled'}>
                <Brain size={16}></Brain>
                <span class="hidden text-xs lg:block">Memory</span>
              </button>
            {/if}
            {#if supportsWebSearch}
              <button
                on:click|preventDefault={handleWebSearchToggle}
                class="button button-circle"
                class:button-tertiary={!webSearchEnabled}
                class:button-secondary={webSearchEnabled}
                title={webSearchEnabled ? 'Web search enabled' : 'Web search disabled'}>
                <Search size={16}></Search>
                <span class="hidden text-xs lg:block">Search</span>
              </button>
            {/if}
            {#if supportsReasoning}
              <button
                on:click|preventDefault={handleReasoningToggle}
                class="button button-circle"
                class:button-tertiary={!reasoningEnabled}
                class:button-secondary={reasoningEnabled}
                title={reasoningEnabled ? `Reasoning enabled (${reasoningEffort})` : 'Reasoning disabled'}>
                <Brain size={16}></Brain>
                <span class="hidden text-xs lg:block">Reason</span>
              </button>
              <button
                on:click|preventDefault={openReasoningOptions}
                class="button button-tertiary button-circle"
                title="Reasoning options">
                <Settings size={16}></Settings>
              </button>
            {/if}
          </div>
        </div>
        <div class="flex items-center gap-2">
          <button
            on:click|preventDefault={openModelSelector}
            disabled={!browser}
            class="button button-ghost button-circle">
            <span class="text-xs">
              {currentModel?.name || $selectedModel?.modelId || 'Select Model'}
            </span>
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
    lastUsedModels.recordUsage(providerInstanceId, modelId);
    showModelSelector = false;
  }}>
</ModelSelectorModal>

<ReasoningOptionsModal
  id="chat-reasoning-options"
  isOpen={showReasoningOptions}
  currentEffort={reasoningEffort}
  currentSummary={reasoningSummary}
  {supportsReasoningSummary}
  on:close={() => (showReasoningOptions = false)}
  on:select={handleReasoningOptionsSelect}>
</ReasoningOptionsModal>
