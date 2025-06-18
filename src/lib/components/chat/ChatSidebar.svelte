<script lang="ts">
  import { chats, isLoadingChats, deleteChatById, toggleChatPin } from '$lib/stores/chat';
  import { goto } from '$app/navigation';
  import { CirclePlus, Settings, Pin, Trash, Menu, PinOff, Search, GitBranch } from 'lucide-svelte';
  import { page } from '$app/state';
  import { manifest } from '$lib';
  import Spinner from '$lib/components/common/Spinner.svelte';
  import ConfirmationModal from '$lib/components/modal/types/ConfirmationModal.svelte';
  import { fade } from 'svelte/transition';
  import { streamStates } from '$lib/streaming';
  import { groupChatsByDate } from '$lib/utils/date';
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';

  const COLLAPSE_ANIMATION_DURATION = 150; //ms

  let { collapsed = $bindable(false), smallScreen } = $props();

  // Track if user manually toggled to disable auto-collapse
  let manualMode = $state(false);

  function handleToggle() {
    collapsed = !collapsed;
    manualMode = true;
  }

  function closeSidebarOnInteraction() {
    if (!smallScreen || collapsed) return;
    collapsed = true;
    manualMode = false;
  }

  // Add resize handling to auto-collapse sidebar on small screens
  function handleResize() {
    if (!browser) return;

    const initialCollapsed = collapsed;

    if (manualMode) return; // Don't auto-collapse if user is in manual mode
    collapsed = smallScreen;
    if (collapsed && !initialCollapsed) {
      manualMode = false;
    }
  }

  onMount(() => {
    handleResize();
  });

  let chatToDelete = $state<string | null>(null);
  let searchQuery = $state('');

  function handleDeleteChat(chatId: string) {
    chatToDelete = chatId;
  }

  async function handleConfirmDelete() {
    if (chatToDelete) {
      await deleteChatById(chatToDelete);
      if (chatToDelete === page.params.chatId) {
        goto('/');
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

  let filteredChats = $derived(
    searchQuery.trim()
      ? $chats.filter((chat) => !chat.temporary && chat.title.toLowerCase().includes(searchQuery.toLowerCase()))
      : $chats.filter((chat) => !chat.temporary),
  );
</script>

<svelte:window on:resize={handleResize} />

{#if smallScreen && !collapsed}
  <div
    class="fixed z-[10] h-screen w-screen bg-black/50"
    transition:fade={{ duration: COLLAPSE_ANIMATION_DURATION * 0.75 }}
    on:click={() => (collapsed = true)}>
  </div>
{/if}

<aside
  class="z-[11] flex w-64 flex-col gap-4 p-2.5"
  class:w-64={!collapsed && !smallScreen}
  class:w-15={collapsed}
  class:w-full={!collapsed && smallScreen}
  class:md:w-128={!collapsed && smallScreen}
  class:collapsed
  class:small={smallScreen}
  style="--collapse-animation-duration: {COLLAPSE_ANIMATION_DURATION}ms">
  <div class="flex flex-col items-center gap-3.5">
    <div class="relative flex w-full items-center justify-between">
      <button class="button button-secondary pointer-events-auto absolute top-0 left-0" on:click={() => handleToggle()}>
        <Menu size={20}></Menu>
      </button>
      <div class="h-10 min-h-10 w-10 min-w-10"></div>
      {#if !collapsed}
        <h1 class="text-xl font-bold" transition:fade={{ duration: COLLAPSE_ANIMATION_DURATION * 0.75 }}>
          <a on:click={closeSidebarOnInteraction} href="/">{manifest.name}</a>
        </h1>
        <a
          href="/settings"
          on:click={closeSidebarOnInteraction}
          class="button button-secondary"
          title="Settings"
          transition:fade={{ duration: COLLAPSE_ANIMATION_DURATION * 0.75 }}>
          <Settings size={20} />
        </a>
      {/if}
    </div>
    {#if (smallScreen && !collapsed) || !smallScreen}
      <a
        href="/"
        on:click={closeSidebarOnInteraction}
        class="button button-primary w-full"
        class:justify-center={collapsed}
        title="New Chat"
        transition:fade={{ duration: COLLAPSE_ANIMATION_DURATION * 0.75 }}>
        <CirclePlus size={20} class="min-w-5"></CirclePlus>
        {#if !collapsed}
          <p class="line-clamp-1 break-words" transition:fade={{ duration: COLLAPSE_ANIMATION_DURATION * 0.25 }}>
            New Chat
          </p>
        {/if}
      </a>
    {/if}
  </div>
  {#if !collapsed}
    <!-- Search input -->
    <div class="relative text-[var(--color-11)]" transition:fade={{ duration: COLLAPSE_ANIMATION_DURATION * 0.75 }}>
      <Search size={16} class="absolute top-1/2 left-3 -translate-y-1/2" />
      <input type="text" bind:value={searchQuery} placeholder="Search chats..." class="w-full !py-1.5 !pl-8 text-sm" />
    </div>
    <nav
      class="flex flex-1 flex-col gap-y-0.5 overflow-y-auto"
      transition:fade={{ duration: COLLAPSE_ANIMATION_DURATION * 0.75 }}>
      {#each groupChatsByDate(filteredChats) as { group, chats: groupChats }}
        <div class="group-section">
          {#if group}
            <h3 class="group-header mb-1 px-2.5 py-1 text-xs font-medium text-[var(--color-a11)]">{group}</h3>
          {/if}
          {#each groupChats as chat}
            {@const isSelected = chat.id === page.params.chatId}
            {@const isGenerating = $streamStates[chat.id]?.isStreaming ?? false}
            <a
              href="/{chat.id}"
              on:click={closeSidebarOnInteraction}
              class="thread-item group flex h-9 items-center justify-between rounded-[10px] py-2 pr-0.5 pl-2.5"
              class:selected={isSelected}
              class:generating={isGenerating}
              class:!pl-2={chat.branchedFrom !== undefined}
              title={chat.title}>
              <span class="flex items-center gap-0.5 truncate text-sm transition-colors duration-200">
                {#if chat.branchedFrom !== undefined}
                  <button
                    class="button button-secondary button-small text-secondary inline-block h-full"
                    on:click|preventDefault|stopPropagation={() => {
                      goto(`/${chat.branchedFrom?.threadId}#${chat.branchedFrom?.messageId}`);
                      closeSidebarOnInteraction();
                    }}
                    title="Branched from chat">
                    <GitBranch size={14}></GitBranch>
                  </button>
                {/if}
                {chat.title}</span>
              <div class="hidden items-center group-hover:flex">
                <button
                  class="button button-secondary button-small"
                  on:click|preventDefault|stopPropagation={() => handlePinChat(chat.id)}
                  aria-label={chat.pinned ? 'Unpin chat' : 'Pin chat'}>
                  {#if !chat.pinned}
                    <Pin size={16}></Pin>
                  {:else}
                    <PinOff size={16}></PinOff>
                  {/if}
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
        </div>
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

  aside.small {
    @apply pointer-events-none;
    @apply absolute top-0 left-0 h-screen;
  }

  aside.small:not(.collapsed) {
    @apply pointer-events-auto;
    background: var(--color-1);
  }

  .group-section {
    margin-bottom: 0.75rem;
  }

  .group-section:last-child {
    margin-bottom: 0;
  }

  .group-header {
    color: var(--color-a9);
    font-weight: 500;
    font-size: 0.75rem;
    line-height: 1rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin-bottom: 0.25rem;
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

  .thread-item.generating span {
    background: linear-gradient(to right, var(--color-a3), var(--color-a12), var(--color-a3)) 0 0 no-repeat;
    background-size: 200%;
    color: var(--color-a6);
    background-clip: text;
    animation-name: shine;
    animation-duration: 1s;
    animation-iteration-count: infinite;
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
