<script lang="ts">
  import { chats, createNewChat, isLoadingChats, deleteChatById, toggleChatPin } from '$lib/stores/chat';
  import { goto } from '$app/navigation';
  import { CirclePlus, Settings, Pin, Trash, Menu } from 'lucide-svelte';
  import { page } from '$app/state';
  import { manifest } from '$lib';
  import Spinner from '$lib/components/common/Spinner.svelte';
  import ConfirmationModal from '$lib/components/common/ConfirmationModal.svelte';

  export function handleCreateNewChat() {
    const newChatId = createNewChat();
    goto(`/${newChatId}`);
  }

  let chatToDelete: string | null = null;

  function handleDeleteChat(chatId: string) {
    chatToDelete = chatId;
  }

  async function handleConfirmDelete() {
    if (chatToDelete) {
      await deleteChatById(chatToDelete);
      if (chatToDelete === page.params.chatId) {
        const remainingChats = $chats;
        if (remainingChats.length > 0) {
          goto(`/${remainingChats[0].id}`);
        } else {
          goto('/');
        }
      }
      chatToDelete = null;
    }
  }

  function handleCancelDelete() {
    chatToDelete = null;
  }

  async function handlePinChat(chatId: string) {
    await toggleChatPin(chatId);
  }
</script>

<aside class="flex w-64 flex-col gap-4 p-4">
  <div class="flex flex-col items-center gap-3.5">
    <div class="flex w-full items-center justify-between">
      <button class="button button-secondary">
        <Menu size={20}></Menu>
      </button>
      <h1 class="text-xl font-bold"><a href="/">{manifest.name}</a></h1>
      <a href="/settings" class="button button-secondary" title="Settings">
        <Settings size={20}></Settings>
      </a>
    </div>
    <a href="/" class="button button-primary w-full" title="New Chat">
      <CirclePlus size={20}></CirclePlus>
      New Chat
    </a>
  </div>
  <nav class="flex flex-1 flex-col gap-y-0.5 overflow-y-auto">
    {#each $chats as chat}
      {@const isSelected = chat.id === page.params.chatId}
      <a
        href="/{chat.id}"
        class="thread-item group flex h-9 items-center justify-between rounded-[10px] py-2 pr-0.5 pl-2.5"
        class:selected={isSelected}>
        <span class="truncate text-sm">{chat.title}</span>
        <div class="hidden items-center group-hover:flex">
          <button
            class="button button-secondary"
            on:click={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handlePinChat(chat.id);
            }}
            aria-label={chat.pinned ? 'Unpin chat' : 'Pin chat'}>
            <Pin size={16} class={!chat.pinned ? 'rotate-45' : ''}></Pin>
          </button>
          <button
            class="button button-secondary"
            on:click={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handleDeleteChat(chat.id);
            }}
            aria-label={`Delete chat ${chat.title}`}>
            <Trash size={16}></Trash>
          </button>
        </div>
      </a>
    {/each}
    {#if $isLoadingChats}
      <div class="flex justify-center py-2">
        <Spinner></Spinner>
      </div>
    {/if}
  </nav>
</aside>

<ConfirmationModal
  id="delete-chat-modal"
  title="Delete Chat"
  message="Are you sure you want to delete this chat? This action cannot be undone."
  confirmText="Delete"
  cancelText="Cancel"
  isDangerous={true}
  isOpen={chatToDelete !== null}
  on:confirm={handleConfirmDelete}
  on:cancel={handleCancelDelete} />

<style lang="postcss">
  @reference "tailwindcss";

  .thread-item.selected {
    background-color: var(--color-a3);
  }

  .thread-item:hover {
    background-color: var(--color-a4);
  }

  .thread-item:active {
    background-color: var(--color-a5);
  }
</style>
