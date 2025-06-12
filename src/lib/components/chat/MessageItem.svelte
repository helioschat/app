<script lang="ts">
  import MarkdownRenderer from '$lib/components/chat/MarkdownRenderer.svelte';
  import { likelyContainsMarkdown } from '$lib/utils/markdown';
  import type { Message } from '$lib/types';
  import { isMessageStreaming } from '$lib/streaming';
  import { page } from '$app/state';
  import { ChevronDown, ChevronUp, Copy, RefreshCw } from 'lucide-svelte';
  import { createEventDispatcher } from 'svelte';
  import { providerInstances } from '$lib/settings/SettingsManager';

  export let message: Message;
  export let isStreaming: boolean = false;
  export let isThinking: boolean = false;

  const dispatch = createEventDispatcher<{
    regenerate: { message: Message };
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
</script>

<div class="message {message.role === 'assistant' ? 'assistant' : 'user'} group" data-message-id={message.id}>
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
    <div class="message-content">
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
    </div>
  </div>

  <div
    class="message-actions flex h-[44px] max-h-[44px] items-center opacity-0 group-hover:opacity-100 peer-hover:opacity-100 hover:opacity-100">
    <div class="flex gap-2 p-2">
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
      </div>
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

<style lang="postcss">
  @reference "tailwindcss";

  .message .message-container {
    @apply w-fit max-w-full rounded-3xl px-5 py-2.5;
    background-color: var(--color-a2);
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
