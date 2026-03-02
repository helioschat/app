<script lang="ts">
  import MarkdownRenderer from '$lib/components/chat/MarkdownRenderer.svelte';
  import MessageAttachments from '$lib/components/chat/MessageAttachments.svelte';
  import { formatMessageTimestamp } from '$lib/utils/date';
  import type { MessageWithAttachments } from '$lib/types';
  import { streamStates } from '$lib/streaming';
  import { page } from '$app/state';
  import { ChevronDown, ChevronUp, Copy, RefreshCw, Edit, GitBranch } from 'lucide-svelte';
  import { providerInstances } from '$lib/settings/SettingsManager';

  interface Props {
    message: MessageWithAttachments;
    isEditing?: boolean;
    allowAssistantEditing?: boolean;
    onregenerate?: (detail: { message: MessageWithAttachments }) => void;
    onstartEdit?: (detail: { message: MessageWithAttachments }) => void;
    oncancelEdit?: (detail: { message: MessageWithAttachments }) => void;
    onbranch?: (detail: { message: MessageWithAttachments }) => void;
  }

  let {
    message,
    isEditing = false,
    allowAssistantEditing = false,
    onregenerate,
    onstartEdit,
    oncancelEdit,
    onbranch,
  }: Props = $props();

  const messageCreatedAt = message.createdAt;

  // True when the message has attachments that are all images and no text content
  let isImageOnly = $derived(
    !message.content &&
      !!message.attachments &&
      message.attachments.length > 0 &&
      message.attachments.every((a) => a.type === 'image' && a.previewUrl),
  );

  const providerName = $providerInstances.find((p) => p.id === message.providerInstanceId)?.name;
  let totalTime = $derived(message.metrics?.totalTime);
  let tokensPerSecond = $derived(message.metrics?.tokensPerSecond);

  let isCurrentlyStreaming = $derived(
    !!$streamStates[page.params.chatId] &&
      $streamStates[page.params.chatId].messageId === message.id &&
      $streamStates[page.params.chatId].isStreaming,
  );

  // True when this assistant message is the one currently streaming but has no content yet
  let isThinking = $derived(isCurrentlyStreaming && message.role === 'assistant' && message.content.length === 0);

  // User messages can only be edited when nothing is streaming in this chat
  let canEdit = $derived(!$streamStates[page.params.chatId]?.isStreaming);

  let showReasoning = $state(false);
  let hasReasoning = $derived(message.role === 'assistant' && message.reasoning && message.reasoning.length > 0);

  let copyButtonText = $state('Copy');

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
    onregenerate?.({ message });
  }

  function handleStartEdit() {
    if (isCurrentlyStreaming) return;
    if (isEditing) {
      oncancelEdit?.({ message });
    } else {
      onstartEdit?.({ message });
    }
  }

  function handleBranch() {
    onbranch?.({ message });
  }
</script>

<div
  class="message {message.role === 'assistant' ? 'assistant' : 'user'} group"
  class:editing={isEditing}
  data-message-id={message.id}
  tabindex="0">
  {#if hasReasoning && message.reasoning}
    <button
      class="reasoning-button button button-ghost button-small button-circle mb-0.5"
      class:thinking={isThinking}
      onclick={() => (showReasoning = !showReasoning)}>
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
        <MarkdownRenderer content={message.reasoning} isStreaming={false}></MarkdownRenderer>
      </div>
    {/if}
  {/if}
  <div class="message-container peer" class:image-only-container={isImageOnly}>
    <div class="message-content flex flex-col gap-2">
      {#if message.attachments && message.attachments.length > 0}
        <MessageAttachments attachments={message.attachments} isSent imageOnly={isImageOnly}></MessageAttachments>
      {/if}
      <!-- Display Mode -->
      {#if isThinking && !message.content}
        <div class="typing-indicator" aria-label="Generating response">
          <span></span>
          <span></span>
          <span></span>
        </div>
      {:else}
        <MarkdownRenderer
          content={message.content}
          isStreaming={isCurrentlyStreaming && message.role === 'assistant'}
          messageDate={message.createdAt}></MarkdownRenderer>
      {/if}
    </div>
  </div>

  <div
    class="message-actions flex h-[64px] max-h-[64px] opacity-0 group-hover:opacity-100 peer-hover:opacity-100 hover:opacity-100 xl:h-[44px]">
    <div class="flex flex-col gap-1 p-2 xl:flex-row">
      <div class="buttons flex items-center gap-2">
        <button class="button button-ghost button-small button-circle" onclick={copyMessageContent}>
          <Copy size={16}></Copy>
          <span>{copyButtonText}</span>
        </button>
        {#if message.role === 'assistant'}
          <button
            class="button button-ghost button-small button-circle"
            disabled={isCurrentlyStreaming}
            onclick={handleRegenerate}>
            <RefreshCw size={16}></RefreshCw>
            <span>Regenerate</span>
          </button>
          <button
            class="button button-ghost button-small button-circle"
            disabled={isCurrentlyStreaming}
            onclick={handleBranch}>
            <GitBranch size={16}></GitBranch>
            <span>Branch off</span>
          </button>
        {/if}
        {#if message.role === 'user'}
          <button
            class="button button-ghost button-small button-circle"
            disabled={!canEdit || isCurrentlyStreaming}
            onclick={handleStartEdit}>
            <Edit size={16}></Edit>
            <span>{isEditing ? 'Editing...' : 'Edit'}</span>
          </button>
        {/if}
        {#if message.role === 'assistant' && allowAssistantEditing}
          <button
            class="button button-ghost button-small button-circle"
            disabled={!canEdit || isCurrentlyStreaming}
            onclick={handleStartEdit}>
            <Edit size={16}></Edit>
            <span>{isEditing ? 'Editing...' : 'Edit'}</span>
          </button>
        {/if}
      </div>

      <div class="text-secondary flex items-center gap-1 text-xs">
        {#if messageCreatedAt}
          <div class="flex items-center">
            <span>{formatMessageTimestamp(messageCreatedAt)}</span>
          </div>
        {/if}

        {#if messageCreatedAt && message.role === 'assistant' && (providerName || message.model || totalTime || tokensPerSecond)}
          <span>&bull;</span>
          <div
            class="text-secondary flex items-center gap-1 text-xs"
            title={[
              ...[totalTime ? `${(totalTime / 1000).toFixed(2)}s` : null],
              ...[tokensPerSecond ? `${tokensPerSecond.toFixed(2)} tokens/sec` : null],
            ]
              .filter((x) => Boolean(x))
              .join(' • ')}>
            {[...[providerName ? `${providerName}` : null], ...[message.model ? `${message.model}` : null]]
              .filter((x) => Boolean(x))
              .join('/')}
          </div>
        {/if}
      </div>
    </div>
  </div>
</div>

<style lang="postcss">
  @reference "tailwindcss";
  @reference "../../../app.css";

  .message {
    @apply outline-none;
  }

  .message .message-container {
    @apply w-fit max-w-full rounded-3xl px-5 py-2.5;
    background-color: var(--color-a2);
  }

  .message .message-container.image-only-container {
    @apply rounded-xl bg-transparent px-0 py-0;
  }

  .message.user .message-container.image-only-container,
  .message.assistant .message-container.image-only-container {
    @apply bg-transparent;
  }

  .message.editing .message-container {
    @apply opacity-60;
    animation: editing-pulse 1.8s ease-in-out infinite;
  }

  @keyframes editing-pulse {
    0%,
    100% {
      box-shadow: 0 0 0 2px color-mix(in srgb, var(--red-9) 30%, transparent);
    }
    50% {
      box-shadow: 0 0 0 3px color-mix(in srgb, var(--red-9) 70%, transparent);
    }
  }

  .message.assistant {
    @apply py-2 pr-8 sm:pr-16 md:py-6 md:pr-32;
  }

  .message.assistant .message-container {
    @apply mr-auto bg-[var(--color-a2)];
  }

  .message.assistant .message-actions,
  .message.assistant .message-actions > .flex {
    @apply items-start justify-start xl:items-center;
  }

  .message.user {
    @apply pt-2 pl-8 sm:pl-16 md:pl-32;
  }

  .message.user .message-container {
    @apply ml-auto bg-[var(--red-10)]/95;
  }

  .message.user .message-actions,
  .message.user .message-actions > .flex {
    @apply items-end justify-end xl:items-center;
  }

  .message-actions .buttons {
    @apply gap-1 xl:gap-2;
  }

  .message-actions .buttons .button span {
    @apply hidden xl:block;
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

  .typing-indicator {
    @apply flex min-h-6 items-center gap-1 py-1;
  }

  .typing-indicator span {
    @apply block h-2 w-2 rounded-full;
    background-color: var(--color-a9);
    animation: typing-bounce 1.4s cubic-bezier(0.45, 0, 0.55, 1) infinite;
    opacity: 0.35;
  }

  .typing-indicator span:nth-child(2) {
    animation-delay: 0.18s;
  }

  .typing-indicator span:nth-child(3) {
    animation-delay: 0.36s;
  }

  @keyframes typing-bounce {
    0%,
    100% {
      transform: translateY(0);
      opacity: 0.35;
    }
    35% {
      transform: translateY(-4px);
      opacity: 0.9;
    }
    55% {
      transform: translateY(0);
      opacity: 0.35;
    }
  }
</style>
