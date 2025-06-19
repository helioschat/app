<script lang="ts">
  import type { Chat, Message } from '$lib/types';
  import MessageItem from '$lib/components/chat/MessageItem.svelte';
  import ChatNotice from '$lib/components/chat/ChatNotice.svelte';
  import { scrollState } from '$lib/stores/scroll';
  import { RefreshCw } from 'lucide-svelte';
  import { onMount } from 'svelte';

  export let chat: Chat;
  export let currentlyStreamingMessageId: string = '';
  export let handleRegenerate: (message: Message) => Promise<void>;
  export let handleEdit: (
    message: Message,
    newContent: string,
    providerInstanceId: string,
    modelId: string,
  ) => Promise<void>;
  export let handleBranch: (message: Message) => void;

  let messagesContainer: HTMLDivElement;

  function scrollToBottom() {
    if (!messagesContainer) return;
    messagesContainer.scrollTo({
      top: messagesContainer.scrollHeight,
      behavior: 'instant',
    });
  }

  function handleScroll() {
    if (!messagesContainer || !currentlyStreamingMessageId) return;

    const isNearBottom =
      messagesContainer.scrollHeight - messagesContainer.scrollTop - messagesContainer.clientHeight < 100;

    if (isNearBottom) {
      scrollState.enableAutoScroll();
    } else {
      scrollState.disableAutoScroll();
    }
  }

  // Initial load and new messages
  $: if (chat?.messages?.length && !currentlyStreamingMessageId) {
    scrollToBottom();
    scrollState.enableAutoScroll();
  }

  // During streaming
  $: if (currentlyStreamingMessageId && $scrollState.shouldAutoScroll) {
    scrollToBottom();
  }

  onMount(() => {
    scrollToBottom();
    scrollState.enableAutoScroll();
    return () => scrollState.reset();
  });
</script>

<div
  class="mx-auto h-full w-full max-w-4xl flex-1 justify-center overflow-x-hidden overflow-y-auto px-4 pt-16 pb-32"
  bind:this={messagesContainer}
  on:scroll={handleScroll}>
  {#each chat.messages as message (message.id)}
    {#if message.role === 'assistant' && message.error}
      <ChatNotice type="error">
        <div class="flex flex-col gap-3">
          <div class="flex flex-col gap-1">
            <p class="font-medium">{message.error.message}</p>
            {#if message.error.code}
              <p class="text-sm opacity-75">Error code: {message.error.code}</p>
            {/if}
            {#if message.content && message.content.length > 0}
              <div class="mt-2 rounded bg-black/10 p-2 text-sm">
                <p class="mb-1 font-medium opacity-75">Partial response:</p>
                <p class="whitespace-pre-wrap">{message.content}</p>
              </div>
            {/if}
          </div>
          <div class="flex justify-end">
            <button class="button button-secondary button-small" on:click={() => handleRegenerate(message)}>
              <RefreshCw size={16}></RefreshCw>
              Regenerate
            </button>
          </div>
        </div>
      </ChatNotice>
    {:else}
      <MessageItem
        {message}
        isStreaming={currentlyStreamingMessageId === message.id}
        isThinking={currentlyStreamingMessageId === message.id &&
          message.content.length === 0 &&
          message.role === 'assistant'}
        canEdit={!currentlyStreamingMessageId}
        on:regenerate={({ detail }) => handleRegenerate(detail.message)}
        on:edit={({ detail }) =>
          handleEdit(detail.message, detail.newContent, detail.providerInstanceId, detail.modelId)}
        on:branch={({ detail }) => handleBranch(detail.message)}></MessageItem>
    {/if}
  {/each}
</div>
