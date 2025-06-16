<script lang="ts">
  import { CirclePlus, VenetianMask } from 'lucide-svelte';
  import type { Chat } from '$lib/types';

  export let chat: Chat;
</script>

<header class="flex items-center justify-between p-4">
  <div class="flex items-center gap-2">
    {#if chat.temporary}
      <div title="Temporary chat (won't be saved)" class="flex items-center">
        <VenetianMask size={16}></VenetianMask>
      </div>
    {/if}
    <h2 class="line-clamp-1 text-lg font-semibold break-words drop-shadow-md">{chat.title}</h2>
  </div>
  <div>
    <a
      href="/"
      class="new-chat-btn button button-secondary button-small !flex w-full !p-0 opacity-100 transition-opacity lg:!hidden"
      title="New Chat">
      <CirclePlus size={20} class="min-w-5"></CirclePlus>
    </a>
  </div>
</header>

<style lang="postcss">
  @reference "tailwindcss";

  header {
    background: linear-gradient(to bottom, var(--color-1), transparent);
  }

  :global(.small) header {
    @apply pl-14;
  }
</style>
