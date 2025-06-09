<script lang="ts">
  import MarkdownRenderer from '$lib/components/chat/MarkdownRenderer.svelte';
  import { likelyContainsMarkdown } from '$lib/utils/markdown';
  import type { Message } from '$lib/types';
  import { isMessageStreaming } from '$lib/utils/streamState';
  import { page } from '$app/state';
  import { Copy } from 'lucide-svelte';

  export let message: Message;
  export let isStreaming: boolean = false;

  $: isCurrentlyStreaming =
    isStreaming || (message.role === 'assistant' && isMessageStreaming(page.params.chatId, message.id));

  $: shouldUseMarkdown = likelyContainsMarkdown(message.content);

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
</script>

<div class="message {message.role === 'assistant' ? 'assistant' : 'user'}" data-message-id={message.id}>
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

  <div class="message-actions opacity-0 peer-hover:opacity-100 hover:opacity-100">
    <div class="flex gap-2 p-2">
      <div class="flex items-center gap-2">
        <button class="button button-secondary button-small" on:click={copyMessageContent}>
          <Copy size={16}></Copy>
          {copyButtonText}
        </button>
      </div>
      {#if message.role === 'assistant' && (message.provider || message.model || generationTime || tokensPerSecond)}
        <div class="text-secondary flex items-center gap-1 text-xs">
          {#if message.provider}
            <span>{message.provider}</span>
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
    @apply w-fit rounded-3xl px-5 py-2.5;
    background-color: var(--color-a2);
  }

  .message.assistant {
    @apply my-6 mr-32;
  }

  .message.assistant .message-container {
    @apply justify-self-start;
    background-color: var(--color-2);
  }

  .message.user .message-container {
    @apply my-2 ml-32;
  }

  .message.user .message-container {
    @apply justify-self-end;
    background-color: var(--blue-10);
  }

  .cursor {
    display: inline-block;
    animation: blink 1s step-end infinite;
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
</style>
