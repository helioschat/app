<script lang="ts">
  import type { Chat } from '$lib/types';
  import MessageItem from '$lib/components/chat/MessageItem.svelte';
  import ResumeButton from '$lib/components/chat/ResumeButton.svelte';

  export let chat: Chat;
  export let isLoading: boolean = false;
  export let showResumeButton: boolean = false;
  export let currentlyStreamingMessageId: string = '';
  export let handleResumeGeneration: () => Promise<void>;
</script>

<div class="flex flex-1 justify-center overflow-y-auto px-4">
  <div class="mx-auto w-full max-w-4xl">
    {#each chat.messages as message (message.id)}
      <MessageItem {message} isStreaming={currentlyStreamingMessageId === message.id}></MessageItem>
    {/each}

    {#if showResumeButton}
      <ResumeButton {isLoading} {handleResumeGeneration}></ResumeButton>
    {/if}
  </div>
</div>
