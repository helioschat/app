<script lang="ts">
  import type { Chat, Message } from '$lib/types';
  import MessageItem from '$lib/components/chat/MessageItem.svelte';
  import ResumeButton from '$lib/components/chat/ResumeButton.svelte';
  import ChatNotice from '$lib/components/chat/ChatNotice.svelte';
  import { chatError } from '$lib/stores/error';
  import { scrollState } from '$lib/stores/scroll';
  import { onMount } from 'svelte';

  export let chat: Chat;
  export let isLoading: boolean = false;
  export let showResumeButton: boolean = false;
  export let currentlyStreamingMessageId: string = '';
  export let handleResumeGeneration: () => Promise<void>;
  export let handleRegenerate: (message: Message) => Promise<void>;

  let messagesContainer: HTMLDivElement;

  function scrollToBottom() {
    if (!messagesContainer) return;
    messagesContainer.scrollTo({
      top: messagesContainer.scrollHeight,
      behavior: 'instant',
    });
  }

  function handleScroll(event: Event) {
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
  class="mx-auto h-full w-full max-w-4xl flex-1 justify-center overflow-y-auto px-4 pt-16 pb-24"
  bind:this={messagesContainer}
  on:scroll={handleScroll}>
  {#each chat.messages as message (message.id)}
    {#if message.role === 'assistant' && message.content === '' && $chatError}
      <ChatNotice type="error">
        <div class="flex flex-col gap-1">
          <p class="font-medium">{$chatError.message}</p>
          {#if $chatError.code}
            <p class="text-sm opacity-75">Error code: {$chatError.code}</p>
          {/if}
        </div>
      </ChatNotice>
    {:else}
      <MessageItem
        {message}
        isStreaming={currentlyStreamingMessageId === message.id}
        on:regenerate={({ detail }) => handleRegenerate(detail.message)}></MessageItem>
    {/if}
  {/each}

  {#if showResumeButton}
    <ResumeButton {isLoading} {handleResumeGeneration}></ResumeButton>
  {/if}
</div>
