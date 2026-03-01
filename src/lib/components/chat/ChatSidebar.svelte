<script lang="ts">
  import { chats, isLoadingChats, deleteChatById, toggleChatPin, moveChatToFolder } from '$lib/stores/chat';
  import { folders, createFolder, renameFolder, deleteFolderById } from '$lib/stores/folders';
  import { goto } from '$app/navigation';
  import {
    CirclePlus,
    Settings,
    Pin,
    Trash,
    Menu,
    PinOff,
    Search,
    GitBranch,
    FolderPlus,
    Folder,
    FolderOpen,
    ChevronRight,
    Pencil,
    FolderInput,
    FolderMinus,
  } from 'lucide-svelte';
  import { page } from '$app/state';
  import { manifest } from '$lib';
  import Spinner from '$lib/components/common/Spinner.svelte';
  import ConfirmationModal from '$lib/components/modal/types/ConfirmationModal.svelte';
  import FolderModal from '$lib/components/modal/types/FolderModal.svelte';
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

  // ── Delete chat ──────────────────────────────────────────────────────────────
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

  // ── Pin chat ─────────────────────────────────────────────────────────────────
  async function handlePinChat(chatId: string) {
    await toggleChatPin(chatId);
  }

  // ── Folder: expand/collapse state ────────────────────────────────────────────
  let expandedFolders = $state<Set<string>>(new Set());

  function toggleFolder(folderId: string) {
    const next = new Set(expandedFolders);
    if (next.has(folderId)) {
      next.delete(folderId);
    } else {
      next.add(folderId);
    }
    expandedFolders = next;
  }

  // ── Folder modal (create + rename) ──────────────────────────────────────────
  let folderModalOpen = $state(false);
  /** When set, we're renaming an existing folder; when null we're creating. */
  let folderModalEditId = $state<string | null>(null);
  let folderModalInitialName = $state('');

  function openCreateFolder() {
    folderModalEditId = null;
    folderModalInitialName = '';
    folderModalOpen = true;
  }

  function openRenameFolder(folderId: string, currentName: string) {
    folderModalEditId = folderId;
    folderModalInitialName = currentName;
    folderModalOpen = true;
  }

  async function handleFolderModalConfirm(event: CustomEvent<{ name: string }>) {
    const { name } = event.detail;
    if (folderModalEditId) {
      await renameFolder(folderModalEditId, name);
    } else {
      const newFolder = await createFolder(name);
      // Auto-expand newly created folder
      expandedFolders = new Set([...expandedFolders, newFolder.id]);
    }
    folderModalOpen = false;
  }

  function handleFolderModalCancel() {
    folderModalOpen = false;
  }

  // ── Delete folder confirmation ───────────────────────────────────────────────
  let folderToDelete = $state<string | null>(null);

  function handleDeleteFolder(folderId: string) {
    folderToDelete = folderId;
  }

  async function handleConfirmDeleteFolder() {
    if (!folderToDelete) return;
    // Un-assign all chats in this folder
    const chatsInFolder = $chats.filter((c) => c.folderId === folderToDelete);
    for (const c of chatsInFolder) {
      await moveChatToFolder(c.id, null);
    }
    await deleteFolderById(folderToDelete);
    folderToDelete = null;
  }

  function handleCancelDeleteFolder() {
    folderToDelete = null;
  }

  // ── Move chat to folder dropdown ─────────────────────────────────────────────
  /** chatId of the chat whose folder-picker is open */
  let folderPickerOpenFor = $state<string | null>(null);

  function toggleFolderPicker(chatId: string) {
    folderPickerOpenFor = folderPickerOpenFor === chatId ? null : chatId;
  }

  async function handleMoveChatToFolder(chatId: string, folderId: string | null) {
    await moveChatToFolder(chatId, folderId);
    folderPickerOpenFor = null;
    // If moving into a folder, make sure it's expanded
    if (folderId) {
      expandedFolders = new Set([...expandedFolders, folderId]);
    }
  }

  // ── Derived data ─────────────────────────────────────────────────────────────
  let filteredChats = $derived(
    searchQuery.trim() && browser && $chats
      ? $chats.filter((chat) => !chat.temporary && chat.title.toLowerCase().includes(searchQuery.toLowerCase()))
      : $chats.filter((chat) => !chat.temporary),
  );

  /** Chats that belong to a specific folder */
  function chatsForFolder(folderId: string) {
    return filteredChats.filter((c) => c.folderId === folderId);
  }

  /** Chats that are NOT in any folder */
  let ungroupedChats = $derived(filteredChats.filter((c) => !c.folderId));

  let groupedChats = $derived(groupChatsByDate(ungroupedChats));

  // Workaround for Svelte's reactivity with derived stores
  let pinStates = $derived(
    filteredChats.reduce(
      (acc, chat) => {
        acc[chat.id] = Boolean(chat.pinned);
        return acc;
      },
      {} as Record<string, boolean>,
    ),
  );
</script>

<svelte:window on:resize={handleResize} />

{#if smallScreen && !collapsed}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="fixed z-[10] h-screen w-screen bg-black/50"
    transition:fade={{ duration: COLLAPSE_ANIMATION_DURATION * 0.75 }}
    on:click={() => {
      collapsed = true;
      folderPickerOpenFor = null;
    }}>
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
      <button
        id="toggle-sidebar-button"
        class="button button-ghost button-circle pointer-events-auto absolute top-0 left-0"
        on:click={() => handleToggle()}>
        <Menu size={16}></Menu>
      </button>
      <div class="min-h-[2.125rem] min-w-[2.125rem]"></div>
      {#if !collapsed}
        <h1 class="text-xl font-bold" transition:fade={{ duration: COLLAPSE_ANIMATION_DURATION * 0.75 }}>
          <a on:click={closeSidebarOnInteraction} href="/"
            >{manifest.name}<span class="text-secondary text-xs">beta</span></a>
        </h1>
        <a
          href="/settings"
          on:click={closeSidebarOnInteraction}
          class="button button-ghost button-circle"
          title="Settings"
          transition:fade={{ duration: COLLAPSE_ANIMATION_DURATION * 0.75 }}>
          <Settings size={16} />
        </a>
      {/if}
    </div>
    {#if (smallScreen && !collapsed) || !smallScreen}
      <div class="flex w-full gap-2">
        <a
          href="/"
          on:click={closeSidebarOnInteraction}
          class="button button-primary w-full"
          class:justify-center={collapsed}
          title="New Chat"
          transition:fade={{ duration: COLLAPSE_ANIMATION_DURATION * 0.75 }}>
          <CirclePlus size={16} class="min-w-5"></CirclePlus>
          {#if !collapsed}
            <span class="line-clamp-1 break-words" transition:fade={{ duration: COLLAPSE_ANIMATION_DURATION * 0.25 }}>
              New Chat
            </span>
          {/if}
        </a>
        {#if !smallScreen && !collapsed}
          <button
            class="button button-primary !px-0"
            transition:fade={{ duration: COLLAPSE_ANIMATION_DURATION * 0.75 }}
            on:click|stopPropagation={openCreateFolder}
            title="New folder">
            <FolderPlus size={16}></FolderPlus>
          </button>
        {/if}
      </div>
    {/if}
  </div>
  {#if !collapsed}
    <!-- Search input -->
    <div class="relative text-[var(--color-11)]" transition:fade={{ duration: COLLAPSE_ANIMATION_DURATION * 0.75 }}>
      <Search size={14} class="absolute top-1/2 left-3 -translate-y-1/2" />
      <input
        id="chat-search-input"
        type="text"
        bind:value={searchQuery}
        placeholder="Search chats..."
        class="input-small w-full !pl-8" />
    </div>
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <nav
      class="flex flex-1 flex-col gap-y-0.5 overflow-y-auto"
      transition:fade={{ duration: COLLAPSE_ANIMATION_DURATION * 0.75 }}
      on:click={() => {
        if (folderPickerOpenFor) folderPickerOpenFor = null;
      }}>
      <!-- ── Folders ── -->
      {#if $folders.length > 0}
        <div class="folder-section">
          {#each $folders as folder (folder.id)}
            {@const folderChats = chatsForFolder(folder.id)}
            {@const isExpanded = expandedFolders.has(folder.id)}
            <!-- Folder header row -->
            <div
              class="folder-row group flex h-8 w-full items-center rounded-[10px] pr-0.5 pl-1"
              on:click|stopPropagation={() => toggleFolder(folder.id)}>
              <!-- Expand/collapse toggle -->
              <button class="flex flex-1 cursor-pointer items-center gap-1.5 truncate text-left" title={folder.name}>
                <ChevronRight
                  size={13}
                  class="min-w-[13px] transition-transform duration-150"
                  style={isExpanded ? 'transform: rotate(90deg)' : ''} />
                {#if isExpanded}
                  <FolderOpen size={14} class="min-w-[14px] text-[var(--color-a11)]" />
                {:else}
                  <Folder size={14} class="min-w-[14px] text-[var(--color-a11)]" />
                {/if}
                <span class="truncate text-[0.8rem]">{folder.name}</span>
                {#if folderChats.length > 0}
                  <span class="folder-count ml-auto shrink-0 pr-1 text-[0.65rem] text-[var(--color-a9)]">
                    {folderChats.length}
                  </span>
                {/if}
              </button>

              <!-- Folder actions (visible on hover) -->
              <div class="hidden shrink-0 items-center group-hover:flex">
                <button
                  class="button button-ghost button-small button-circle"
                  on:click|stopPropagation={() => openRenameFolder(folder.id, folder.name)}
                  aria-label="Rename folder">
                  <Pencil size={13} />
                </button>
                <button
                  class="button button-ghost button-small button-circle"
                  on:click|stopPropagation={() => handleDeleteFolder(folder.id)}
                  aria-label="Delete folder">
                  <Trash size={13} />
                </button>
              </div>
            </div>

            <!-- Chats inside folder -->
            {#if isExpanded}
              <div class="folder-chats pl-4">
                {#each folderChats as chat (chat.id)}
                  {@const isSelected = chat.id === page.params.chatId}
                  {@const isGenerating = $streamStates[chat.id]?.isStreaming ?? false}
                  {@const isPinned = pinStates[chat.id] ?? false}
                  <a
                    href="/{chat.id}"
                    on:click={closeSidebarOnInteraction}
                    class="thread-item group flex h-8 items-center justify-between rounded-[10px] pr-0.5 pl-2.5"
                    class:selected={isSelected}
                    class:generating={isGenerating}
                    class:!pl-2={chat.branchedFrom !== undefined}
                    title={chat.title}>
                    <span class="flex items-center gap-0.5 truncate text-[0.8rem] transition-colors duration-200">
                      {#if chat.branchedFrom !== undefined}
                        <button
                          class="button button-ghost button-small button-circle inline-block !min-w-fit"
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
                        class="button button-ghost button-small button-circle"
                        on:click|preventDefault|stopPropagation={() => handleMoveChatToFolder(chat.id, null)}
                        aria-label="Remove from folder"
                        title="Remove from folder">
                        <FolderMinus size={13}></FolderMinus>
                      </button>
                      <button
                        class="button button-ghost button-small button-circle"
                        on:click|preventDefault|stopPropagation={() => handlePinChat(chat.id)}
                        aria-label={isPinned ? 'Unpin chat' : 'Pin chat'}>
                        {#if !isPinned}
                          <Pin size={14}></Pin>
                        {:else}
                          <PinOff size={14}></PinOff>
                        {/if}
                      </button>
                      <button
                        class="button button-ghost button-small button-circle"
                        on:click|preventDefault|stopPropagation={() => handleDeleteChat(chat.id)}
                        aria-label={`Delete chat ${chat.title}`}>
                        <Trash size={14}></Trash>
                      </button>
                    </div>
                  </a>
                {/each}
                {#if folderChats.length === 0}
                  <p class="py-1 pl-2 text-[0.75rem] text-[var(--color-a9)] italic">Empty folder</p>
                {/if}
              </div>
            {/if}
          {/each}
        </div>
      {/if}

      <!-- ── Un-foldered chats (date-grouped) ── -->
      {#each groupedChats as { group, chats: groupChats } (group)}
        <div class="group-section">
          {#if group}
            <h3 class="group-header mb-1 px-2.5 py-1 text-xs font-medium text-[var(--color-a11)]">{group}</h3>
          {/if}
          {#each groupChats as chat (chat.id)}
            {@const isSelected = chat.id === page.params.chatId}
            {@const isGenerating = $streamStates[chat.id]?.isStreaming ?? false}
            {@const isPinned = pinStates[chat.id] ?? false}
            <div class="relative">
              <a
                href="/{chat.id}"
                on:click={closeSidebarOnInteraction}
                class="thread-item group flex h-8 items-center justify-between rounded-[10px] pr-0.5 pl-2.5"
                class:selected={isSelected}
                class:generating={isGenerating}
                class:!pl-2={chat.branchedFrom !== undefined}
                title={chat.title}>
                <span class="flex items-center gap-0.5 truncate text-[0.8rem] transition-colors duration-200">
                  {#if chat.branchedFrom !== undefined}
                    <button
                      class="button button-ghost button-small button-circle inline-block !min-w-fit"
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
                  {#if $folders.length > 0}
                    <button
                      class="button button-ghost button-small button-circle"
                      on:click|preventDefault|stopPropagation={() => toggleFolderPicker(chat.id)}
                      aria-label="Move to folder"
                      title="Move to folder">
                      <FolderInput size={13}></FolderInput>
                    </button>
                  {/if}
                  <button
                    class="button button-ghost button-small button-circle"
                    on:click|preventDefault|stopPropagation={() => handlePinChat(chat.id)}
                    aria-label={isPinned ? 'Unpin chat' : 'Pin chat'}>
                    {#if !isPinned}
                      <Pin size={14}></Pin>
                    {:else}
                      <PinOff size={14}></PinOff>
                    {/if}
                  </button>
                  <button
                    class="button button-ghost button-small button-circle"
                    on:click|preventDefault|stopPropagation={() => handleDeleteChat(chat.id)}
                    aria-label={`Delete chat ${chat.title}`}>
                    <Trash size={14}></Trash>
                  </button>
                </div>
              </a>

              <!-- Folder picker dropdown -->
              {#if folderPickerOpenFor === chat.id}
                <!-- svelte-ignore a11y_no_static_element_interactions -->
                <div
                  class="folder-picker absolute right-0 z-20 mt-0.5 min-w-[140px] rounded-xl p-1 shadow-lg"
                  on:click|stopPropagation>
                  {#each $folders as f (f.id)}
                    <button
                      class="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-[0.8rem] hover:bg-[var(--color-a3)]"
                      on:click={() => handleMoveChatToFolder(chat.id, f.id)}>
                      <Folder size={13} class="text-[var(--color-a11)]" />
                      <span class="truncate">{f.name}</span>
                    </button>
                  {/each}
                </div>
              {/if}
            </div>
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

<!-- Delete chat modal -->
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

<!-- Delete folder confirmation modal -->
<ConfirmationModal
  id="delete-folder-modal"
  title="Delete Folder"
  message="Are you sure you want to delete this folder? Chats inside will remain but will no longer be grouped."
  confirmText="Delete"
  cancelText="Cancel"
  isDangerous={true}
  isOpen={folderToDelete !== null}
  on:confirm={handleConfirmDeleteFolder}
  on:cancel={handleCancelDeleteFolder} />

<!-- Create / rename folder modal -->
<FolderModal
  id="folder-name-modal"
  isOpen={folderModalOpen}
  initialName={folderModalInitialName}
  on:confirm={handleFolderModalConfirm}
  on:cancel={handleFolderModalCancel} />

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

  .folder-section {
    margin-bottom: 0.25rem;
  }

  .folder-row {
    cursor: pointer;
    user-select: none;
  }

  .folder-row:hover {
    background-color: var(--color-a3);
  }

  .folder-chats {
    margin-top: 0.125rem;
  }

  .folder-new-btn {
    margin-bottom: 0.375rem;
    transition: background-color 150ms;
  }

  .folder-picker {
    background-color: var(--color-2);
    border: 1px solid var(--color-a5);
    top: 100%;
  }

  .folder-count {
    font-variant-numeric: tabular-nums;
  }
</style>
