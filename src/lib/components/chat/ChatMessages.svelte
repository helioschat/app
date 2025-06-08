<script lang="ts">
  import type { Chat } from '$lib/types';
  import MessageItem from '$lib/components/chat/MessageItem.svelte';
  import ResumeButton from '$lib/components/chat/ResumeButton.svelte';
  import ChatNotice from '$lib/components/chat/ChatNotice.svelte';
  import { chatError } from '$lib/stores/error';

  export let chat: Chat;
  export let isLoading: boolean = false;
  export let showResumeButton: boolean = false;
  export let currentlyStreamingMessageId: string = '';
  export let handleResumeGeneration: () => Promise<void>;
</script>

<div class="flex flex-1 justify-center overflow-y-auto px-4">
  <div class="mx-auto w-full max-w-4xl">
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
        <MessageItem {message} isStreaming={currentlyStreamingMessageId === message.id}></MessageItem>
      {/if}
    {/each}

    {#if showResumeButton}
      <ResumeButton {isLoading} {handleResumeGeneration}></ResumeButton>
    {/if}
  </div>
</div>
