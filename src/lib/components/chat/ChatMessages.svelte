<script lang="ts">
  import type { Chat, Message } from '$lib/types';
  import MessageItem from '$lib/components/chat/MessageItem.svelte';
  import ChatNotice from '$lib/components/chat/ChatNotice.svelte';
  import { RefreshCw } from 'lucide-svelte';

  interface Props {
    chat: Chat;
    editingMessageId?: string;
    handleRegenerate: (message: Message) => Promise<void>;
    handleStartEdit: (message: Message) => void;
    handleCancelEdit: () => void;
    handleBranch: (message: Message) => void;
  }

  let {
    chat,
    editingMessageId = '',
    handleRegenerate,
    handleStartEdit,
    handleCancelEdit,
    handleBranch,
  }: Props = $props();
</script>

<div class="mx-auto h-full w-full max-w-4xl flex-1 justify-center px-4 pt-16">
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
            <button class="button button-secondary button-small" onclick={() => handleRegenerate(message)}>
              <RefreshCw size={16}></RefreshCw>
              Regenerate
            </button>
          </div>
        </div>
      </ChatNotice>
    {:else}
      <MessageItem
        {message}
        isEditing={editingMessageId === message.id}
        onregenerate={({ message }) => handleRegenerate(message)}
        onstartEdit={({ message }) => handleStartEdit(message)}
        oncancelEdit={handleCancelEdit}
        onbranch={({ message }) => handleBranch(message)}></MessageItem>
    {/if}
  {/each}
</div>

<style lang="postcss">
  @reference "tailwindcss";

  :global(.messages-container .message:last-of-type) {
    @apply pb-48;
  }
</style>
