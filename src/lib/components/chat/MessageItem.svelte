<script lang="ts">
  import MarkdownRenderer from '$lib/components/chat/MarkdownRenderer.svelte';
  import MessageAttachments from '$lib/components/chat/MessageAttachments.svelte';
  import { likelyContainsMarkdown } from '$lib/utils/markdown';
  import { formatMessageTimestamp } from '$lib/utils/date';
  import type { MessageWithAttachments } from '$lib/types';
  import { isMessageStreaming } from '$lib/streaming';
  import { page } from '$app/state';
  import { ChevronDown, ChevronUp, Copy, RefreshCw, Check, X, Edit, GitBranch } from 'lucide-svelte';
  import { createEventDispatcher, tick } from 'svelte';
  import { providerInstances, selectedModel } from '$lib/settings/SettingsManager';
  import { availableModels } from '$lib/stores/modelCache';
  import ModelSelectorModal from '$lib/components/modal/types/ModelSelectorModal.svelte';
  import type { ModelInfo } from '$lib/providers/base';

  export let message: MessageWithAttachments;
  export let isStreaming: boolean = false;
  export let isThinking: boolean = false;
  export let canEdit: boolean = false; // Whether this message can be edited

  const dispatch = createEventDispatcher<{
    regenerate: { message: MessageWithAttachments };
    edit: { message: MessageWithAttachments; newContent: string; providerInstanceId: string; modelId: string };
    branch: { message: MessageWithAttachments };
  }>();

  $: isCurrentlyStreaming =
    isStreaming || (message.role === 'assistant' && isMessageStreaming(page.params.chatId, message.id));

  $: shouldUseMarkdown = likelyContainsMarkdown(message.content);

  $: showReasoning = false;
  $: hasReasoning = message.role === 'assistant' && message.reasoning && message.reasoning.length > 0;
  $: reasoningUsesMarkdown = hasReasoning && likelyContainsMarkdown(message.reasoning || '');

  $: providerName = $providerInstances.find((p) => p.id === message.providerInstanceId)?.name;
  $: generationTime = message.metrics?.totalTime ? `${(message.metrics.totalTime / 1000).toFixed(2)}s` : '';
  $: tokensPerSecond = message.metrics?.tokensPerSecond
    ? `${message.metrics.tokensPerSecond.toFixed(2)} tokens/sec`
    : '';

  let copyButtonText = 'Copy';
  let isEditing = false;
  let editContent = '';
  let editTextarea: HTMLTextAreaElement;
  let showEditModelSelector = false;
  let editProviderInstanceId = '';
  let editModelId = '';
  let cachedModels: Record<string, ModelInfo[]> = {};

  $: cachedModels = $availableModels;

  $: if (isEditing && editTextarea) {
    tick().then(() => {
      editTextarea.focus();
      resizeTextarea({ target: editTextarea } as unknown as Event);
    });
  }

  async function copyMessageContent() {
    try {
      await navigator.clipboard.writeText(message.content);
      copyButtonText = 'Copied!';
      setTimeout(() => {
        copyButtonText = 'Copy';
      }, 2000);
    } catch (err) {
      console.error('Failed to copy message:', err);
      copyButtonText = 'Failed to copy';
      setTimeout(() => {
        copyButtonText = 'Copy';
      }, 2000);
    }
  }

  function handleRegenerate() {
    dispatch('regenerate', { message });
  }

  function startEdit() {
    if (isCurrentlyStreaming) return;

    isEditing = true;
    editContent = message.content;

    // Default to the message's original provider and model, or fall back to selected model
    editProviderInstanceId = message.providerInstanceId || $selectedModel?.providerInstanceId || '';
    editModelId = message.model || $selectedModel?.modelId || '';
  }

  function cancelEdit() {
    isEditing = false;
    editContent = '';
    editProviderInstanceId = '';
    editModelId = '';
  }

  function confirmEdit() {
    if (!editContent.trim()) return;

    dispatch('edit', {
      message,
      newContent: editContent.trim(),
      providerInstanceId: editProviderInstanceId,
      modelId: editModelId,
    });

    isEditing = false;
  }

  function resizeTextarea(e: Event) {
    const target = e.target as HTMLTextAreaElement;
    target.style.height = 'auto';
    target.style.height = target.scrollHeight + 'px';
  }

  function handleEditKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      confirmEdit();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      cancelEdit();
    }
  }

  async function openEditModelSelector() {
    await tick();
    showEditModelSelector = true;
  }

  function handleBranch() {
    dispatch('branch', { message });
  }
</script>

<div
  class="message {message.role === 'assistant' ? 'assistant' : 'user'} group"
  class:editing={isEditing}
  data-message-id={message.id}>
  {#if hasReasoning}
    <button
      class="reasoning-button button button-secondary text-sm"
      class:thinking={isThinking}
      on:click={() => (showReasoning = !showReasoning)}>
      <span class="flex items-center gap-1">
        <div class="inline-block">
          {#if !showReasoning}
            <ChevronDown size={16}></ChevronDown>
          {:else}
            <ChevronUp size={16}></ChevronUp>
          {/if}
        </div>
        {isThinking
          ? 'Thinking...'
          : message.metrics?.thinkingTime
            ? `Thought for ${(message.metrics.thinkingTime / 1000).toFixed(2)} seconds`
            : 'Show thought process'}</span>
    </button>

    {#if showReasoning}
      <div class="reasoning-content text-secondary mb-2 text-xs">
        {#if reasoningUsesMarkdown}
          <MarkdownRenderer content={message.reasoning || ''} isStreaming={false}></MarkdownRenderer>
        {:else}
          <p class="whitespace-pre-wrap italic">{message.reasoning}</p>
        {/if}
      </div>
    {/if}
  {/if}
  <div class="message-container peer">
    <div class="message-content flex flex-col gap-2">
      {#if message.attachments && message.attachments.length > 0}
        <MessageAttachments attachments={message.attachments} isSent></MessageAttachments>
      {/if}
      {#if isEditing}
        <!-- Edit Mode -->
        <div class="edit-container flex w-full flex-col gap-2">
          <textarea
            bind:this={editTextarea}
            bind:value={editContent}
            rows="3"
            placeholder="Edit your message..."
            class="w-full !rounded-2xl"
            on:input={resizeTextarea}
            on:keydown={handleEditKeydown}></textarea>

          <div class="flex items-center justify-between gap-4 sm:gap-8">
            <button
              type="button"
              on:click={openEditModelSelector}
              class="button button-primary button-small !rounded-l-2xl !px-2">
              <span>{editModelId || 'Select Model'}</span>
            </button>

            <div class="flex items-center gap-2">
              <button
                type="button"
                on:click={cancelEdit}
                class="button button-secondary button-small !px-2"
                aria-label="Cancel edit">
                <X size={16} />
                <span class="hidden md:block"> Cancel </span>
              </button>
              <button
                type="button"
                on:click={confirmEdit}
                disabled={!editContent.trim()}
                class="button button-primary button-small !rounded-t !rounded-r-2xl !px-2"
                aria-label="Save edit">
                <Check size={16} />
                <span class="hidden sm:block"> Save </span>
              </button>
            </div>
          </div>
        </div>
      {:else if message.content}
        <!-- Display Mode -->
        {#if shouldUseMarkdown}
          <MarkdownRenderer content={message.content} isStreaming={isCurrentlyStreaming && message.role === 'assistant'}
          ></MarkdownRenderer>
        {:else}
          <p class="whitespace-pre-wrap">
            {message.content}
            {#if isCurrentlyStreaming && message.role === 'assistant'}
              <span class="cursor">▋</span>
            {/if}
          </p>
        {/if}
      {/if}
    </div>
  </div>

  <div
    class="message-actions flex h-[44px] max-h-[44px] items-center opacity-0 group-hover:opacity-100 peer-hover:opacity-100 hover:opacity-100">
    <div class="flex gap-2 p-2">
      <div class="text-secondary flex items-center gap-1 text-xs">
        <span>{formatMessageTimestamp(message.createdAt)}</span>
      </div>
      {#if !isEditing}
        <div class="flex items-center gap-2">
          <button class="button button-secondary button-small" on:click={copyMessageContent}>
            <Copy size={16}></Copy>
            {copyButtonText}
          </button>
          {#if message.role === 'assistant' && !isCurrentlyStreaming}
            <button class="button button-secondary button-small" on:click={handleRegenerate}>
              <RefreshCw size={16}></RefreshCw>
              Regenerate
            </button>
          {/if}
          {#if message.role === 'user'}
            <button
              class="button button-secondary button-small"
              disabled={!canEdit || isCurrentlyStreaming}
              on:click={startEdit}>
              <Edit size={16}></Edit>
              Edit
            </button>
          {/if}
          <button class="button button-secondary button-small" on:click={handleBranch}>
            <GitBranch size={16}></GitBranch>
            Branch off
          </button>
        </div>
      {/if}
      {#if message.role === 'assistant' && (providerName || message.model || generationTime || tokensPerSecond)}
        <div class="text-secondary flex items-center gap-1 text-xs">
          {#if providerName}
            <span>{providerName}</span>
            {#if message.model}
              /
            {/if}
          {/if}
          {#if message.model}
            <span>{message.model}</span>
          {/if}
          {#if generationTime}
            <span>
              &bull;
              {generationTime}
            </span>
          {/if}
          {#if tokensPerSecond}
            <span>
              &bull;
              {tokensPerSecond}
            </span>
          {/if}
        </div>
      {/if}
    </div>
  </div>
</div>

<ModelSelectorModal
  id="message-edit-model-selector"
  isOpen={showEditModelSelector}
  providerInstances={$providerInstances}
  availableModels={cachedModels}
  currentModelId={editModelId}
  on:close={() => (showEditModelSelector = false)}
  on:select={(e) => {
    const { providerInstanceId, modelId } = e.detail;
    editProviderInstanceId = providerInstanceId;
    editModelId = modelId;
    showEditModelSelector = false;
  }}>
</ModelSelectorModal>

<style lang="postcss">
  @reference "tailwindcss";

  .message .message-container {
    @apply w-fit max-w-full rounded-3xl px-5 py-2.5;
    background-color: var(--color-a2);
  }

  .message.editing .message-container {
    @apply min-w-2/3 px-2.5;
  }

  .message.assistant {
    @apply py-6 pr-32;
  }

  .message.assistant .message-container {
    @apply mr-auto;
    background-color: var(--color-2);
  }

  .message.assistant .message-actions {
    @apply justify-start;
  }

  .message.user {
    @apply pt-2 pl-32;
  }

  .message.user .message-container {
    @apply ml-auto;
    background-color: var(--blue-10);
  }

  .message.user .message-actions {
    @apply justify-end;
  }

  .cursor {
    display: inline-block;
    animation: blink 1s step-end infinite;
  }

  .reasoning-content {
    @apply rounded-xl p-3 opacity-90;
    background-color: var(--color-a2);
  }

  .reasoning-button > span {
    color: var(--color-a11);
  }

  .reasoning-button.thinking > span {
    background: linear-gradient(to right, var(--color-a3), var(--color-a12), var(--color-a3)) 0 0 no-repeat;
    background-size: 200%;
    color: var(--color-a6);
    background-clip: text;
    animation-name: shine;
    animation-duration: 1s;
    animation-iteration-count: infinite;
  }

  @keyframes blink {
    0%,
    100% {
      opacity: 1;
    }
    50% {
      opacity: 0;
    }
  }

  @keyframes shine {
    0% {
      background-position: -200%;
    }
    100% {
      background-position: 200%;
    }
  }
</style>
