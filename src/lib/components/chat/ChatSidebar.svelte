<script lang="ts">
  import { chats, createNewChat, isLoadingChats } from '$lib/stores/chat';
  import { goto } from '$app/navigation';
  import { CirclePlus, Settings, Pin, Trash, Menu } from 'lucide-svelte';
  import { page } from '$app/state';
  import { manifest } from '$lib';
  import Spinner from '$lib/components/common/Spinner.svelte';

  export function handleCreateNewChat() {
    const newChatId = createNewChat();
    goto(`/${newChatId}`);
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
          <button class="button button-secondary"><Pin size={16}></Pin></button>
          <button class="button button-secondary"><Trash size={16}></Trash></button>
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
