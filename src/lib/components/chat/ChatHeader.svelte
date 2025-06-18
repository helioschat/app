<script lang="ts">
  import { CirclePlus, VenetianMask, ArrowLeft } from 'lucide-svelte';
  import type { Chat } from '$lib/types';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { activeChatId } from '$lib/stores/chat';

  export let chat: Chat | undefined;

  $: isSettingsPage = $page.url.pathname.startsWith('/settings');
</script>

<header class="flex min-h-[3.75rem] items-center justify-between px-4">
  {#if !isSettingsPage}
    <div class="flex items-center gap-2">
      {#if chat}
        {#if chat.temporary}
          <div title="Temporary chat (won't be saved)" class="flex items-center">
            <VenetianMask size={16}></VenetianMask>
          </div>
        {/if}
        <h2 class="line-clamp-1 text-lg font-semibold break-words drop-shadow-md">{chat.title}</h2>
      {/if}
    </div>
  {:else}
    <button onclick={() => goto(`/${$activeChatId}`)} class="button button-secondary">
      <ArrowLeft size={20}></ArrowLeft>
      <span class="hidden sm:block">Back to Chat</span>
    </button>
  {/if}
  <div>
    <a href="/" class="button button-secondary !flex w-full lg:!hidden" title="New Chat">
      <CirclePlus size={20} class="min-w-5"></CirclePlus>
    </a>
  </div>
</header>
