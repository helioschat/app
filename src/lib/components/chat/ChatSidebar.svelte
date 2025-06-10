<script lang="ts">
  import { chats, isLoadingChats, deleteChatById, toggleChatPin } from '$lib/stores/chat';
  import { goto } from '$app/navigation';
  import { CirclePlus, Settings, Pin, Trash, Menu } from 'lucide-svelte';
  import { page } from '$app/state';
  import { manifest } from '$lib';
  import Spinner from '$lib/components/common/Spinner.svelte';
  import ConfirmationModal from '$lib/components/modal/types/ConfirmationModal.svelte';
  import { fade } from 'svelte/transition';

  const COLLAPSE_ANIMATION_DURATION = 150; //ms

  let { collapsed = $bindable(false) } = $props();

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

<aside
  class="flex w-64 flex-col gap-4 p-4"
  class:w-64={!collapsed}
  class:w-20={collapsed}
  style="--collapse-animation-duration: {COLLAPSE_ANIMATION_DURATION}ms">
  <div class="flex flex-col items-center gap-3.5">
    <div class="flex w-full items-center justify-between">
      <button class="button button-secondary h-10 min-h-10 w-10 min-w-10" on:click={() => (collapsed = !collapsed)}>
        <Menu size={20}></Menu>
      </button>
      {#if !collapsed}
        <h1 class="text-xl font-bold" transition:fade={{ duration: COLLAPSE_ANIMATION_DURATION * 0.75 }}>
          <a href="/">{manifest.name}</a>
        </h1>
        <a
          href="/settings"
          class="button button-secondary"
          title="Settings"
          transition:fade={{ duration: COLLAPSE_ANIMATION_DURATION * 0.75 }}>
          <Settings size={20} />
        </a>
      {/if}
    </div>
    <a href="/" class="button button-primary w-full" class:justify-center={collapsed} title="New Chat">
      <CirclePlus size={20} class="min-w-5" />
      {#if !collapsed}
        <p class="line-clamp-1 break-words" transition:fade={{ duration: COLLAPSE_ANIMATION_DURATION * 0.5 }}>
          New Chat
        </p>
      {/if}
    </a>
  </div>
  {#if !collapsed}
    <nav
      class="flex flex-1 flex-col gap-y-0.5 overflow-y-auto"
      transition:fade={{ duration: COLLAPSE_ANIMATION_DURATION * 0.75 }}>
      {#each $chats as chat}
        {@const isSelected = chat.id === page.params.chatId}
        <a
          href="/{chat.id}"
          class="thread-item group flex h-9 items-center justify-between rounded-[10px] py-2 pr-0.5 pl-2.5"
          class:selected={isSelected}
          title={chat.title}>
          <span class="truncate text-sm">{chat.title}</span>
          <div class="hidden items-center group-hover:flex">
            <button
              class="button button-secondary button-small"
              on:click|preventDefault|stopPropagation={() => handlePinChat(chat.id)}
              aria-label={chat.pinned ? 'Unpin chat' : 'Pin chat'}>
              <Pin size={16} class={!chat.pinned ? 'rotate-45' : ''} />
            </button>
            <button
              class="button button-secondary button-small"
              on:click|preventDefault|stopPropagation={() => handleDeleteChat(chat.id)}
              aria-label={`Delete chat ${chat.title}`}>
              <Trash size={16} />
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
  {/if}
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
  @reference 'tailwindcss';

  aside {
    transition: width var(--collapse-animation-duration) cubic-bezier(0.16, 1, 0.3, 1);
  }

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
